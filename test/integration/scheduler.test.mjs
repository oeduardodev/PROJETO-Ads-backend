import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import test from 'node:test';
import { PrismaService } from '../../apps/api/dist/database/prisma.service.js';
import { JobsService } from '../../apps/api/dist/modules/jobs/jobs.service.js';
import { createJobQueues } from '../../apps/api/dist/modules/jobs/job-queues.js';
import { SourceScheduler } from '../../apps/api/dist/modules/discovery/scheduler/source-scheduler.js';
import { SourcesRepository } from '../../apps/api/dist/modules/sources/sources.repository.js';

if (!process.env.TEST_DATABASE_URL)
  throw new Error('TEST_DATABASE_URL is required for local integration tests');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const Redis = requireApi('ioredis');
const database = new PrismaService();
const redisUrl = process.env.TEST_REDIS_URL || process.env.REDIS_URL || 'redis://127.0.0.1:6380';

test.after(async () => database.$disconnect());

async function setup(prefix) {
  const institution = await database.institution.findUniqueOrThrow({ where: { acronym: 'UFPB' } });
  const domainIds = [];
  const sourceIds = [];
  const queues = createJobQueues(redisUrl, prefix);
  const jobs = new JobsService(queues);
  const sources = new SourcesRepository(database);
  const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: null });
  const scheduler = new SourceScheduler(sources, jobs, queues, redis, 1);

  async function addDomain(host, allowed = true) {
    const now = new Date();
    const domain = await database.allowedDomain.create({
      data: {
        institutionId: institution.id,
        host,
        evidenceUrl: 'https://' + host + '/reviewed-test-fixture',
        reviewedAt: allowed ? now : null,
        collectionAllowed: allowed,
      },
    });
    domainIds.push(domain.id);
    return domain;
  }

  async function addSource(domain, options = {}) {
    const id = randomUUID();
    const source = await database.source.create({
      data: {
        id,
        institutionId: institution.id,
        allowedDomainId: domain.id,
        url: 'https://' + domain.host + '/index-' + id,
        kind: 'HTML_INDEX',
        frequencyMinutes: options.frequencyMinutes ?? 1440,
        priority: options.priority ?? 100,
        status: options.status ?? 'ACTIVE',
        health: options.health ?? 'UNKNOWN',
        lastCheckedAt: options.lastCheckedAt ?? null,
      },
    });
    sourceIds.push(source.id);
    return source;
  }

  async function cleanup() {
    await scheduler.onApplicationShutdown();
    await Promise.all(sourceIds.map((id) => database.source.delete({ where: { id } })));
    await Promise.all(domainIds.map((id) => database.allowedDomain.delete({ where: { id } })));
    await queues['source.refresh'].obliterate({ force: true });
    await jobs.onApplicationShutdown();
  }

  return { addDomain, addSource, cleanup, jobs, queues, scheduler, sources };
}

test('paused, draft, blocked, and unreviewed sources are not scheduled', async () => {
  const context = await setup('test-step032-paused-' + randomUUID());
  try {
    const approved = await context.addDomain('paused-' + randomUUID() + '.example.org');
    const unreviewed = await context.addDomain(
      'unreviewed-' + randomUUID() + '.example.org',
      false,
    );
    await context.addSource(approved, { status: 'PAUSED' });
    await context.addSource(approved, { status: 'DRAFT' });
    await context.addSource(approved, { health: 'BLOCKED' });
    await context.addSource(unreviewed);

    assert.equal(await context.scheduler.runOnce(), 0);
    assert.equal(await context.queues['source.refresh'].getWaitingCount(), 0);
    assert.equal(await context.queues['source.refresh'].getPrioritizedCount(), 0);
  } finally {
    await context.cleanup();
  }
});

test('health ordering and exact-host concurrency cap keep one source job in flight', async () => {
  const context = await setup('test-step032-cap-' + randomUUID());
  try {
    const host = 'cap-' + randomUUID() + '.example.org';
    const domain = await context.addDomain(host);
    await context.addSource(domain, { health: 'DEGRADED', priority: 0 });
    const healthy = await context.addSource(domain, { health: 'HEALTHY', priority: 100 });
    await context.addSource(domain, { health: 'UNKNOWN', priority: 200 });

    assert.equal(await context.scheduler.runOnce(), 1);
    const jobs = await context.queues['source.refresh'].getJobs(
      ['waiting', 'prioritized'],
      0,
      -1,
      true,
    );
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].data.sourceId, healthy.id);
    assert.equal(await context.scheduler.runOnce(), 0);
    assert.equal(await context.queues['source.refresh'].getWaitingCount(), 0);
    assert.equal(await context.queues['source.refresh'].getPrioritizedCount(), 1);
  } finally {
    await context.cleanup();
  }
});

test('concurrent schedulers enqueue only one source refresh for the current window', async () => {
  const context = await setup('test-step032-lock-' + randomUUID());
  const firstRedis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: null });
  const secondRedis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: null });
  let announceScan;
  let releaseScan;
  const scanStarted = new Promise((resolve) => (announceScan = resolve));
  const scanGate = new Promise((resolve) => (releaseScan = resolve));
  const delayedSources = {
    listSchedulable: async () => {
      announceScan();
      await scanGate;
      return context.sources.listSchedulable();
    },
    mapHostsBySourceIds: (sourceIds) => context.sources.mapHostsBySourceIds(sourceIds),
  };
  const firstScheduler = new SourceScheduler(
    delayedSources,
    context.jobs,
    context.queues,
    firstRedis,
    1,
  );
  const secondScheduler = new SourceScheduler(
    context.sources,
    context.jobs,
    context.queues,
    secondRedis,
    1,
  );
  try {
    const domain = await context.addDomain('lock-' + randomUUID() + '.example.org');
    await context.addSource(domain);

    const firstRun = firstScheduler.runOnce();
    await scanStarted;
    const secondResult = await secondScheduler.runOnce();
    releaseScan();
    const firstResult = await firstRun;
    const results = [firstResult, secondResult];
    assert.equal(results[0] + results[1], 1);
    const jobs = await context.queues['source.refresh'].getJobs(
      ['waiting', 'prioritized'],
      0,
      -1,
      true,
    );
    assert.equal(jobs.length, 1);
    assert.equal(
      jobs[0].id,
      'source-refresh-' + jobs[0].data.sourceId + '-v' + jobs[0].data.scheduleVersion,
    );
  } finally {
    releaseScan();
    await firstScheduler.onApplicationShutdown();
    await secondScheduler.onApplicationShutdown();
    await context.cleanup();
  }
});
