import assert from 'node:assert/strict';
import test from 'node:test';
import { AdminSourcesService } from '../apps/api/dist/modules/sources/admin-sources.service.js';
import { AdminSourcesController } from '../apps/api/dist/modules/sources/admin.controller.js';
import { REQUIRED_ADMIN_ROLES } from '../apps/api/dist/modules/authz/roles.decorator.js';
import { loadAdminSourceRunCooldownSeconds } from '../apps/api/dist/config/environment.js';

const institutionId = '123e4567-e89b-42d3-a456-426614174000';
const domainId = '123e4567-e89b-42d3-a456-426614174001';
const sourceId = '123e4567-e89b-42d3-a456-426614174002';
const actor = {
  id: '123e4567-e89b-42d3-a456-426614174003',
  issuer: 'https://identity.example.edu',
  subject: 'administrator',
  requestId: '123e4567-e89b-42d3-a456-426614174004',
};

function fixture() {
  let domain;
  let source;
  const events = [];
  const jobs = [];
  const keys = new Map();
  const institution = { id: institutionId, publicFlag: true, verifiedAt: new Date() };
  const database = {
    institution: { findUnique: async () => institution },
    allowedDomain: {
      findUnique: async ({ where }) =>
        where.id === domainId || where.institutionId_host?.host === domain?.host ? domain : null,
      create: async ({ data }) =>
        (domain = { id: domainId, reviewedAt: null, collectionAllowed: false, ...data }),
      update: async ({ data }) => Object.assign(domain, data),
    },
    source: {
      findUnique: async ({ where }) =>
        (where.id === sourceId || where.institutionId_url?.url === source?.url) && source
          ? { ...source, institution, allowedDomain: domain }
          : null,
      create: async ({ data }) => (source = { id: sourceId, health: 'HEALTHY', ...data }),
      update: async ({ data }) =>
        Object.assign(
          source,
          Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)),
        ),
    },
    discoveredUrl: { count: async () => 3 },
    auditEvent: { create: async ({ data }) => (events.push(data), data) },
  };
  database.$transaction = async (callback) => callback(database);
  const redis = {
    set: async (key, value) => {
      if (keys.has(key)) return null;
      keys.set(key, value);
      return 'OK';
    },
    ttl: async () => 45,
    eval: async (_script, _count, key, token) => {
      if (keys.get(key) === token) keys.delete(key);
    },
    get: async () => null,
    disconnect: () => undefined,
  };
  const queue = {
    enqueueManualSourceRefresh: async (id) => (jobs.push(id), { id: 'manual-job-1' }),
    sourceRefreshBackoff: async () => ({ active: false, nextRetryAt: null }),
    sourceRefreshQueueCounts: async () => ({ waiting: 2, active: 1, delayed: 3, failed: 4 }),
  };
  return { service: new AdminSourcesService(database, queue, redis), events, jobs, keys };
}

test('only ADMIN can change the allowlist and source configuration', () => {
  for (const action of ['registerDomain', 'reviewDomain', 'register', 'configure']) {
    assert.deepEqual(
      Reflect.getMetadata(REQUIRED_ADMIN_ROLES, AdminSourcesController.prototype[action]),
      ['ADMIN'],
    );
  }
  assert.deepEqual(Reflect.getMetadata(REQUIRED_ADMIN_ROLES, AdminSourcesController), [
    'CURATOR',
    'ADMIN',
  ]);
});

test('domain is inert until human review; source activation and changes are audited', async () => {
  const { service, events } = fixture();
  const domain = await service.registerDomain(
    {
      institutionId,
      host: 'www.example.edu',
      evidenceUrl: 'https://www.example.edu/policy',
      reason: 'Register official host',
    },
    actor,
  );
  assert.equal(domain.collectionAllowed, false);
  assert.equal(domain.reviewedAt, null);
  const source = await service.registerSource(
    {
      institutionId,
      url: 'https://www.example.edu/notices',
      kind: 'HTML_INDEX',
      reason: 'Register notice index',
    },
    actor,
  );
  assert.equal(source.status, 'DRAFT');
  await assert.rejects(
    service.configureSource(sourceId, { status: 'ACTIVE', reason: 'Activate source' }, actor),
    (error) => error.getStatus() === 409,
  );
  await assert.rejects(
    service.reviewDomain(domainId, { collectionAllowed: true, reason: 'Incomplete review' }, actor),
    (error) => error.getStatus() === 400,
  );
  await service.reviewDomain(
    domainId,
    {
      collectionAllowed: true,
      officialSourceVerified: true,
      accessPolicyReviewed: true,
      reason: 'Access policy reviewed',
    },
    actor,
  );
  const active = await service.configureSource(
    sourceId,
    { status: 'ACTIVE', frequencyMinutes: 120, reason: 'Begin monitoring' },
    actor,
  );
  assert.equal(active.status, 'ACTIVE');
  assert.equal(active.frequencyMinutes, 120);
  assert.deepEqual(
    events.map((event) => event.action),
    ['source.domain.register', 'source.register', 'source.domain.review', 'source.configure'],
  );
  assert.equal(events.at(-1).actorAdminUserId, actor.id);
  assert.equal(events.at(-1).beforeJson.status, 'DRAFT');
  assert.equal(events.at(-1).afterJson.status, 'ACTIVE');
});

test('manual run is rate limited by exact host and records the requester', async () => {
  const { service, events, jobs, keys } = fixture();
  await service.registerDomain(
    {
      institutionId,
      host: 'www.example.edu',
      evidenceUrl: 'https://www.example.edu/policy',
      reason: 'Register host',
    },
    actor,
  );
  await service.reviewDomain(
    domainId,
    {
      collectionAllowed: true,
      officialSourceVerified: true,
      accessPolicyReviewed: true,
      reason: 'Access policy reviewed',
    },
    actor,
  );
  await service.registerSource(
    {
      institutionId,
      url: 'https://www.example.edu/notices',
      kind: 'HTML_INDEX',
      reason: 'Register source',
    },
    actor,
  );
  await service.configureSource(sourceId, { status: 'ACTIVE', reason: 'Activate' }, actor);
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousRedisUrl = process.env.REDIS_URL;
  process.env.DATABASE_URL = 'postgresql://test_user:test_password@127.0.0.1:5433/test_db';
  process.env.REDIS_URL = 'redis://127.0.0.1:6380';
  try {
    const health = await service.get(sourceId);
    assert.equal(health.candidateCount, 3);
    assert.deepEqual(health.sourceRefreshQueue, {
      waiting: 2,
      active: 1,
      delayed: 3,
      failed: 4,
    });
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previousRedisUrl;
  }
  assert.equal(
    (await service.run(sourceId, { reason: 'Check official correction' }, actor)).state,
    'queued',
  );
  assert.equal(jobs.length, 1);
  assert.equal(keys.has('alem-do-sisu:admin-source-run:www.example.edu'), true);
  assert.equal(events.at(-1).reason, 'Check official correction');
  await assert.rejects(
    service.run(sourceId, { reason: 'Repeat' }, actor),
    (error) => error.getStatus() === 429 && error.retryAfterSeconds === 45,
  );
  assert.equal(jobs.length, 1);
});

test('cooldown config and exact host evidence reject invalid values', async () => {
  assert.equal(loadAdminSourceRunCooldownSeconds({}), 60);
  assert.equal(loadAdminSourceRunCooldownSeconds({ ADMIN_SOURCE_RUN_COOLDOWN_SECONDS: '90' }), 90);
  assert.throws(() =>
    loadAdminSourceRunCooldownSeconds({ ADMIN_SOURCE_RUN_COOLDOWN_SECONDS: '0' }),
  );
  const { service } = fixture();
  await assert.rejects(
    service.registerDomain(
      {
        institutionId,
        host: 'www.example.edu',
        evidenceUrl: 'https://example.edu/policy',
        reason: 'Wrong host',
      },
      actor,
    ),
    (error) => error.getStatus() === 400,
  );
});
