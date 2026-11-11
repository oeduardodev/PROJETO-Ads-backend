import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HttpFetchError,
  ResponsibleHttpClient,
} from '../apps/api/dist/modules/crawling/http/responsible-http.client.js';

const host = 'www.prg.ufpb.br';
const agent = 'AlemDoSiSUBot/1.0';

function response(status, body = '', headers = {}) {
  return { status, headers, body: Buffer.from(body) };
}

function mockTransport({ route, addresses = ['8.8.8.8'], sleeps = [] }) {
  const calls = [];
  return {
    calls,
    resolve: async (resolvedHost) => {
      calls.push({ type: 'resolve', host: resolvedHost });
      return addresses.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
    },
    request: async (url, address, options) => {
      calls.push({ type: 'request', url: url.toString(), address, options });
      return route(url);
    },
    sleep: async (milliseconds) => sleeps.push(milliseconds),
    random: () => 0,
  };
}

function client(transport, overrides = {}) {
  return new ResponsibleHttpClient({
    allowedHosts: [host],
    collectionAllowed: true,
    userAgent: agent,
    transport,
    ...overrides,
  });
}

test('blocks localhost, cloud metadata, private DNS results, and IP literal URLs', async () => {
  for (const [url, allowedHosts, addresses] of [
    ['https://localhost/notice', ['localhost'], ['127.0.0.1']],
    ['https://metadata.example/notice', ['metadata.example'], ['169.254.169.254']],
    ['https://private.example/notice', ['private.example'], ['10.0.0.8']],
    ['https://169.254.169.254/latest/meta-data/', ['169.254.169.254'], ['169.254.169.254']],
    ['https://[::1]/notice', ['[::1]'], ['::1']],
  ]) {
    const transport = mockTransport({ route: () => response(200), addresses });
    const instance = client(transport, { allowedHosts });
    await assert.rejects(instance.fetch(url), HttpFetchError, url);
    assert.equal(
      transport.calls.some((call) => call.type === 'request'),
      false,
      url,
    );
  }
});

test('rejects redirects to internal addresses before requesting the destination', async () => {
  const transport = mockTransport({
    route: (url) =>
      url.pathname === '/robots.txt'
        ? response(404)
        : response(302, '', { location: 'https://127.0.0.1/admin' }),
  });
  await assert.rejects(client(transport).fetch(`https://${host}/edital`), /IP literal URLs/u);
  assert.equal(
    transport.calls.some((call) => call.url?.includes('127.0.0.1')),
    false,
  );
});

test('rejects mixed public/private DNS answers before opening any connection', async () => {
  const transport = mockTransport({
    route: () => response(200),
    addresses: ['8.8.8.8', '10.0.0.8'],
  });
  await assert.rejects(client(transport).fetch(`https://${host}/edital`), /non-public address/u);
  assert.equal(
    transport.calls.some((call) => call.type === 'request'),
    false,
  );
});

test('re-resolves same-host redirects and blocks a DNS rebinding to a private address', async () => {
  const requests = [];
  let resolution = 0;
  const transport = {
    resolve: async () => {
      resolution += 1;
      return [
        {
          address: resolution === 3 ? '127.0.0.1' : '8.8.8.8',
          family: 4,
        },
      ];
    },
    request: async (url, address) => {
      requests.push({ path: url.pathname, address: address.address });
      return url.pathname === '/robots.txt'
        ? response(404)
        : response(302, '', { location: `https://${host}/next` });
    },
    sleep: async () => {},
    random: () => 0,
  };
  await assert.rejects(client(transport).fetch(`https://${host}/edital`), /non-public address/u);
  assert.equal(
    requests.some((request) => request.path === '/next'),
    false,
  );
});

test('blocks robots-disallowed paths and never requests the page', async () => {
  const transport = mockTransport({
    route: (url) =>
      url.pathname === '/robots.txt'
        ? response(200, 'User-agent: *\nDisallow: /restricted\n')
        : response(200, '<html/>', { 'content-type': 'text/html' }),
  });
  await assert.rejects(
    client(transport).fetch(`https://${host}/restricted/editais`),
    /robots.txt disallows/u,
  );
  assert.equal(
    transport.calls.some((call) => call.url?.endsWith('/restricted/editais')),
    false,
  );
});

test('source HTTP 403 blocks without retry and never returns its body', async () => {
  let pageAttempts = 0;
  const transport = mockTransport({
    route: (url) => {
      if (url.pathname === '/robots.txt') return response(404);
      pageAttempts += 1;
      return response(403, '<html>blocked</html>', { 'content-type': 'text/html' });
    },
  });
  await assert.rejects(
    client(transport).fetch(`https://${host}/edital`),
    (error) => error instanceof HttpFetchError && error.code === 'HTTP' && error.status === 403,
  );
  assert.equal(pageAttempts, 1);
});

test('bounded retries report source unavailability without returning HTML', async () => {
  let pageAttempts = 0;
  const sleeps = [];
  const transport = mockTransport({
    sleeps,
    route: (url) => {
      if (url.pathname === '/robots.txt') return response(404);
      pageAttempts += 1;
      throw new Error('ECONNRESET');
    },
  });
  await assert.rejects(
    client(transport).fetch(`https://${host}/edital`),
    (error) => error instanceof HttpFetchError && error.code === 'NETWORK',
  );
  assert.equal(pageAttempts, 3);
  assert.deepEqual(sleeps, [500, 1_000]);
});

test('retries 429 using Retry-After and returns only after a successful attempt', async () => {
  const sleeps = [];
  let attempts = 0;
  const transport = mockTransport({
    sleeps,
    route: (url) => {
      if (url.pathname === '/robots.txt') return response(404);
      attempts += 1;
      return attempts < 3
        ? response(429, '', { 'retry-after': '2' })
        : response(200, '<html/>', { 'content-type': 'text/html' });
    },
  });
  const result = await client(transport).fetch(`https://${host}/edital`);
  assert.equal(result.status, 200);
  assert.equal(attempts, 3);
  assert.deepEqual(sleeps, [2_000, 2_000]);
});

test('surfaces exhausted 429 attempts with retry metadata for source review', async () => {
  const sleeps = [];
  const transport = mockTransport({
    sleeps,
    route: (url) =>
      url.pathname === '/robots.txt' ? response(404) : response(429, '', { 'retry-after': '1' }),
  });
  await assert.rejects(
    client(transport).fetch(`https://${host}/edital`),
    (error) =>
      error instanceof HttpFetchError && error.status === 429 && error.retryAfterMs === 1_000,
  );
  assert.deepEqual(sleeps, [1_000, 1_000]);
});

test('does not retry before a valid Retry-After time', async () => {
  const sleeps = [];
  let attempts = 0;
  const transport = mockTransport({
    sleeps,
    route: (url) => {
      if (url.pathname === '/robots.txt') return response(404);
      attempts += 1;
      return attempts < 3
        ? response(429, '', { 'retry-after': '90' })
        : response(200, '<html/>', { 'content-type': 'text/html' });
    },
  });
  await client(transport).fetch(`https://${host}/edital`);
  assert.deepEqual(sleeps, [90_000, 90_000]);
});

test('enforces response byte limits and reviewed collection permission', async () => {
  const transport = mockTransport({
    route: (url) =>
      url.pathname === '/robots.txt'
        ? response(404)
        : response(200, '123456', { 'content-type': 'text/plain' }),
  });
  await assert.rejects(
    client(transport, { maxBytes: 5 }).fetch(`https://${host}/edital`),
    /byte limit/u,
  );
  assert.throws(
    () => client(transport, { collectionAllowed: false }),
    /permission has not been reviewed/u,
  );
});

test('sends the configured User-Agent and rejects cross-host redirects', async () => {
  const transport = mockTransport({
    route: (url) =>
      url.pathname === '/robots.txt'
        ? response(404)
        : response(302, '', { location: 'https://portal.ufpb.br/edital' }),
  });
  await assert.rejects(
    client(transport).fetch(`https://${host}/edital`),
    /outside the authorized/u,
  );
  const pageCall = transport.calls.find((call) => call.url?.endsWith('/robots.txt'));
  assert.equal(pageCall.options.userAgent, agent);
});
