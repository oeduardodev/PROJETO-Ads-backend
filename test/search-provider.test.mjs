import assert from 'node:assert/strict';
import test from 'node:test';
import { RedisSearchQuotaStore } from '../apps/api/dist/modules/discovery/providers/redis-search-quota.store.js';
import { buildSiteDomainQuery } from '../apps/api/dist/modules/discovery/providers/search-provider.js';
import { SearchProviderService } from '../apps/api/dist/modules/discovery/providers/search-provider.service.js';
import { searchQuotaRedisKey } from '../apps/api/dist/modules/discovery/providers/search-quota.store.js';

const host = 'www.prg.ufpb.br';
const terms = ['seleção especial', 'vagas remanescentes'];

function harness({ provider, limit = 2, consume = true } = {}) {
  const calls = { provider: [], fallback: 0, quota: [] };
  const quota = {
    tryConsume: async (...args) => {
      calls.quota.push(args);
      return consume;
    },
  };
  const service = new SearchProviderService(provider, quota, limit);
  const fallback = async () => {
    calls.fallback += 1;
    return [{ url: `https://${host}/feed.xml` }];
  };
  return { calls, service, fallback };
}

test('site query uses a normalized exact authorized host and plain-text terms', () => {
  assert.deepEqual(buildSiteDomainQuery(' WWW.PRG.UFPB.BR. ', terms), {
    host,
    terms,
    query: 'site:www.prg.ufpb.br seleção especial vagas remanescentes',
  });
  assert.throws(() => buildSiteDomainQuery('localhost', terms), /public DNS name/u);
  assert.throws(() => buildSiteDomainQuery(host, ['\nsite:evil.example']), /plain text/u);
  assert.throws(() => buildSiteDomainQuery(host, ['   ']), /cannot be empty/u);
});

test('mock provider results are filtered to HTTPS on the exact authorized host and deduplicated', async () => {
  const { calls, service, fallback } = harness({
    provider: {
      search: async (request) => {
        calls.provider.push(request);
        return [
          { url: `https://${host}/edital#top`, title: 'Oficial' },
          { url: `https://${host}/edital`, title: 'Duplicado' },
          { url: 'https://sub.www.prg.ufpb.br/edital' },
          { url: 'https://evil.example/edital' },
          { url: `http://${host}/inseguro` },
          { url: `https://user@${host}/credencial` },
          { url: `https://${host}:8443/porta` },
        ];
      },
    },
  });

  const result = await service.discover(host, terms, fallback, new Date('2026-11-05T12:00:00Z'));

  assert.equal(result.source, 'external');
  assert.deepEqual(result.results, [{ url: `https://${host}/edital`, title: 'Oficial' }]);
  assert.equal(calls.provider.length, 1);
  assert.deepEqual(calls.provider[0], buildSiteDomainQuery(host, terms));
  assert.equal(calls.quota.length, 1);
  assert.equal(calls.fallback, 0);
});

test('zero quota disables external calls and uses only the supplied source-strategy fallback', async () => {
  const { calls, service, fallback } = harness({ provider: { search: async () => [] }, limit: 0 });
  const result = await service.discover(host, terms, fallback);

  assert.equal(result.source, 'fallback');
  assert.deepEqual(result.results, [{ url: `https://${host}/feed.xml` }]);
  assert.equal(calls.provider.length, 0);
  assert.equal(calls.quota.length, 0);
  assert.equal(calls.fallback, 1);
});

test('quota exhaustion or Redis errors fall back without calling the provider', async () => {
  const exhausted = harness({ provider: { search: async () => [] }, consume: false });
  assert.equal(
    (await exhausted.service.discover(host, terms, exhausted.fallback)).source,
    'fallback',
  );
  assert.equal(exhausted.calls.provider.length, 0);

  const calls = { provider: 0, fallback: 0 };
  const service = new SearchProviderService(
    {
      search: async () => {
        calls.provider += 1;
        return [];
      },
    },
    {
      tryConsume: async () => {
        throw new Error('redis unavailable');
      },
    },
    2,
  );
  const result = await service.discover(host, terms, async () => {
    calls.fallback += 1;
    return [];
  });
  assert.equal(result.source, 'fallback');
  assert.equal(calls.provider, 0);
  assert.equal(calls.fallback, 1);
});

test('provider failures consume the admitted attempt and use the existing discovery fallback', async () => {
  const { calls, service, fallback } = harness({
    provider: {
      search: async () => {
        calls.provider.push('attempt');
        throw new Error('provider unavailable');
      },
    },
  });
  const result = await service.discover(host, terms, fallback);

  assert.equal(result.source, 'fallback');
  assert.deepEqual(result.results, [{ url: `https://${host}/feed.xml` }]);
  assert.equal(calls.provider.length, 1);
  assert.equal(calls.quota.length, 1);
  assert.equal(calls.fallback, 1);
});

test('Redis quota keys are isolated by exact host and UTC day', () => {
  const beforeUtcMidnight = new Date('2026-11-06T20:59:30-03:00');
  const afterUtcMidnight = new Date('2026-11-06T21:00:00-03:00');
  assert.equal(
    searchQuotaRedisKey('WWW.PRG.UFPB.BR', beforeUtcMidnight),
    'alem-do-sisu:search-quota:2026-11-06:www.prg.ufpb.br',
  );
  assert.notEqual(
    searchQuotaRedisKey(host, beforeUtcMidnight),
    searchQuotaRedisKey('comprov.ufcg.edu.br', beforeUtcMidnight),
  );
  assert.notEqual(
    searchQuotaRedisKey(host, beforeUtcMidnight),
    searchQuotaRedisKey(host, afterUtcMidnight),
  );
});

test('Redis quota consumes atomically and expires at the next UTC midnight', async () => {
  const calls = [];
  const store = new RedisSearchQuotaStore({
    eval: async (...args) => {
      calls.push(args);
      return 1;
    },
    disconnect: () => undefined,
  });
  const at = new Date('2026-11-06T20:59:30-03:00');

  assert.equal(await store.tryConsume(host, 4, at), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], 1);
  assert.equal(calls[0][2], searchQuotaRedisKey(host, at));
  assert.equal(calls[0][3], '4');
  assert.equal(calls[0][4], String(Date.UTC(2026, 10, 7) / 1000));
  assert.match(calls[0][0], /INCR/u);
  assert.match(calls[0][0], /EXPIREAT/u);
});

test('quota zero never contacts Redis and invalid quota is rejected', async () => {
  let calls = 0;
  const store = new RedisSearchQuotaStore({
    eval: async () => {
      calls += 1;
      return 1;
    },
    disconnect: () => undefined,
  });
  assert.equal(await store.tryConsume(host, 0), false);
  assert.equal(calls, 0);
  await assert.rejects(() => store.tryConsume(host, -1), /non-negative safe integer/u);
});
