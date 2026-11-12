import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import test from 'node:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PrismaService } from '../../apps/api/dist/database/prisma.service.js';
import {
  AdminRole,
  DocumentParserKind,
  DocumentProcessorKind,
  DocumentProcessingReviewStatus,
  DiscoveredUrlStatus,
  Jurisdiction,
  SourceHealth,
  SourceKind,
  SourceStatus,
  CrawlRunStatus,
} from '../../apps/api/dist/generated/prisma/enums.js';
import { DocumentsRepository } from '../../apps/api/dist/modules/documents/documents.repository.js';
import { FixtureLocalStorage } from '../../apps/api/dist/modules/documents/fixture-local-storage.js';
import { ParserCacheRepository } from '../../apps/api/dist/modules/documents/cache/parser-cache.repository.js';
import { ProcessingResultsRepository } from '../../apps/api/dist/modules/documents/processing-results.repository.js';
import { DocumentProcessingProcessor } from '../../apps/api/dist/modules/jobs/document-processing.processor.js';
import { DocumentProcessingContentService } from '../../apps/api/dist/modules/jobs/document-processing-content.service.js';
import { JobsService } from '../../apps/api/dist/modules/jobs/jobs.service.js';
import { ProcessingReviewService } from '../../apps/api/dist/modules/reviews/processing-review.service.js';
import {
  DEFAULT_JOB_OPTIONS,
  createJobQueues,
} from '../../apps/api/dist/modules/jobs/job-queues.js';

const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { QueueEvents, Worker } = requireApi('bullmq');
const redisUrl = process.env.TEST_REDIS_URL || process.env.REDIS_URL || 'redis://127.0.0.1:6380';
const redisConnection = { url: redisUrl, maxRetriesPerRequest: null };
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const previousNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'test';
const database = new PrismaService();
test.after(async () => {
  await database.$disconnect();
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
});

async function waitForState(queue, jobId, expected, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await queue.getJob(jobId);
    if (job && (await job.getState()) === expected) return job;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Job ' + jobId + ' did not reach state ' + expected);
}

async function cleanup(worker, events, queues, service) {
  await worker?.close();
  await events?.close();
  await Promise.all(Object.values(queues).map((queue) => queue.obliterate({ force: true })));
  await service.onApplicationShutdown();
}

test('job IDs deduplicate repeated source refresh triggers', async () => {
  const prefix = 'test-step031-' + randomUUID();
  const queues = createJobQueues(redisUrl, prefix);
  const service = new JobsService(queues);
  const events = new QueueEvents('source.refresh', { connection: redisConnection, prefix });
  let executions = 0;
  const worker = new Worker(
    'source.refresh',
    async () => {
      executions += 1;
      return { accepted: true };
    },
    { connection: redisConnection, prefix },
  );

  try {
    await Promise.all([events.waitUntilReady(), worker.waitUntilReady()]);
    const payload = {
      sourceId: 'c7e0ca61-3f26-4b2a-8d0f-6dafc8f40d33',
      scheduleVersion: 7,
    };
    const first = await service.enqueueSourceRefresh(payload);
    const repeatedWhileActive = await service.enqueueSourceRefresh(payload);
    assert.equal(repeatedWhileActive.id, first.id);
    await waitForState(queues['source.refresh'], first.id, 'completed');
    const repeatedAfterCompletion = await service.enqueueSourceRefresh(payload);
    assert.equal(repeatedAfterCompletion.id, first.id);
    assert.equal(executions, 1);
    assert.equal(await queues['source.refresh'].getCompletedCount(), 1);
  } finally {
    await cleanup(worker, events, queues, service);
  }
});

test('exhausted jobs remain in the per-queue failed set after exponential retries', async () => {
  const prefix = 'test-step031-' + randomUUID();
  const queues = createJobQueues(redisUrl, prefix);
  const service = new JobsService(queues);
  const queueName = 'document.classify';
  const events = new QueueEvents(queueName, { connection: redisConnection, prefix });
  let attempts = 0;
  const worker = new Worker(
    queueName,
    async () => {
      attempts += 1;
      throw new Error('simulated final failure');
    },
    { connection: redisConnection, prefix },
  );

  try {
    await Promise.all([events.waitUntilReady(), worker.waitUntilReady()]);
    const job = await service.enqueueDocumentClassify(
      'c7e0ca61-3f26-4b2a-8d0f-6dafc8f40d33',
      'a'.repeat(64),
    );
    const failed = await waitForState(queues[queueName], job.id, 'failed');
    assert.equal(attempts, DEFAULT_JOB_OPTIONS.attempts);
    assert.equal(failed.attemptsMade, DEFAULT_JOB_OPTIONS.attempts);
    assert.equal(failed.failedReason, 'simulated final failure');
    assert.equal(failed.opts.removeOnFail, false);
    assert.equal(await queues[queueName].getFailedCount(), 1);
  } finally {
    await cleanup(worker, events, queues, service);
  }
});

test('classification persists before enqueueing extraction and both jobs replay idempotently', async () => {
  const prefix = 'test-step079-' + randomUUID();
  const queues = createJobQueues(redisUrl, prefix);
  const service = new JobsService(queues);
  let databaseDocumentId;
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
  const institutionId = randomUUID();
  const allowedDomainId = randomUUID();
  const sourceId = randomUUID();
  const crawlRunId = randomUUID();
  const discoveredUrlId = randomUUID();
  const sourceHost = 'www.example.test';
  const canonicalUrl = `https://${sourceHost}/step079/${randomUUID()}`;
  const bytes = Buffer.from(
    '<!doctype html><html><body><main><h1>Graduation selection</h1><p>Independent selection for undergraduate admission.</p></main></body></html>',
  );
  const storage = new FixtureLocalStorage(
    join(tmpdir(), 'alem-do-sisu-worker-fixtures', String(process.pid)),
  );
  const documents = new DocumentsRepository(database);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  let fixtureDocument;
  let processingReviewItemId;
  let admin;
  let reviewedProcessId;
  const events = ['document.classify', 'document.extract'].map(
    (queueName) => new QueueEvents(queueName, { connection: redisConnection, prefix }),
  );
  const processing = new DocumentProcessingProcessor(
    new ProcessingResultsRepository(database),
    service,
    new DocumentProcessingContentService(database, new ParserCacheRepository(database)),
  );
  const classifyWorker = new Worker('document.classify', (job) => processing.classify(job), {
    connection: redisConnection,
    prefix,
  });
  const extractWorker = new Worker('document.extract', (job) => processing.extract(job), {
    connection: redisConnection,
    prefix,
  });

  try {
    await database.institution.create({
      data: {
        id: institutionId,
        name: `Fixture Institution ${suffix}`,
        normalizedName: `fixture institution ${suffix.toLowerCase()}`,
        acronym: `T${suffix}`,
        jurisdiction: Jurisdiction.FEDERAL,
        verifiedAt: new Date(),
      },
    });
    await database.allowedDomain.create({
      data: {
        id: allowedDomainId,
        institutionId,
        host: sourceHost,
        evidenceUrl: `https://${sourceHost}/about`,
        reviewedAt: new Date(),
        collectionAllowed: true,
      },
    });
    await database.source.create({
      data: {
        id: sourceId,
        institutionId,
        allowedDomainId,
        url: `https://${sourceHost}/index`,
        kind: SourceKind.HTML_INDEX,
        status: SourceStatus.ACTIVE,
        health: SourceHealth.HEALTHY,
      },
    });
    await database.crawlRun.create({
      data: {
        id: crawlRunId,
        sourceId,
        status: CrawlRunStatus.SUCCEEDED,
        success: true,
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });
    await database.discoveredUrl.create({
      data: {
        id: discoveredUrlId,
        canonicalUrl,
        status: DiscoveredUrlStatus.CANDIDATE,
        observations: {
          create: { sourceId, crawlRunId },
        },
      },
    });
    fixtureDocument = await documents.recordFixtureSnapshot({
      url: `fixture://local/candidate/${discoveredUrlId}`,
      discoveredUrlId,
      mediaType: 'text/html',
      bytes,
      storage,
    });
    databaseDocumentId = fixtureDocument.id;
    await Promise.all(
      [
        events.map((event) => event.waitUntilReady()),
        classifyWorker.waitUntilReady(),
        extractWorker.waitUntilReady(),
      ].flat(),
    );

    const classifyJob = await service.enqueueDocumentClassify(fixtureDocument.id, sha256);
    await waitForState(queues['document.classify'], classifyJob.id, 'completed');
    const extractJobId = `document-extract-${fixtureDocument.id}-v1`;
    await waitForState(queues['document.extract'], extractJobId, 'completed');

    const persisted = await database.documentProcessingResult.findMany({
      where: { documentId: fixtureDocument.id },
      orderBy: { processorKind: 'asc' },
    });
    assert.deepEqual(
      persisted.map((result) => result.processorKind),
      [DocumentProcessorKind.CLASSIFICATION, DocumentProcessorKind.EXTRACTION],
    );
    assert.ok(persisted.every((result) => result.status === 'PENDING_REVIEW'));
    assert.ok(persisted.every((result) => result.sha256 === sha256 && result.schemaVersion === 1));
    const classification = persisted.find(
      (result) => result.processorKind === DocumentProcessorKind.CLASSIFICATION,
    );
    assert.equal(classification.resultJson.reason, 'SCOPE_REQUIRES_HUMAN_REVIEW');
    assert.equal(
      classification.resultJson.result.evidence[0].excerpt,
      'Graduation selection\nIndependent selection for undergraduate admission.',
    );
    assert.equal(
      await database.documentParseCache.count({
        where: { sha256, parserKind: DocumentParserKind.HTML_DOCUMENT, parserVersion: 1 },
      }),
      1,
    );
    const reviewItem = await database.documentProcessingReviewItem.findUniqueOrThrow({
      where: { documentId_sha256: { documentId: fixtureDocument.id, sha256 } },
    });
    processingReviewItemId = reviewItem.id;
    assert.equal(reviewItem.status, DocumentProcessingReviewStatus.OPEN);
    assert.equal(reviewItem.discoveredUrlId, discoveredUrlId);
    assert.equal(reviewItem.processId, null);

    admin = await database.adminUser.create({
      data: {
        issuer: `https://issuer-${suffix}.example.test`,
        subject: `curator-${suffix}`,
        role: AdminRole.CURATOR,
      },
    });
    const resolution = await new ProcessingReviewService(database).resolve(
      reviewItem.id,
      {
        expectedReviewVersion: 0,
        institutionId,
        reason: 'Review fixture evidence and begin a private draft.',
      },
      { id: admin.id, issuer: admin.issuer, subject: admin.subject, requestId: suffix },
    );
    reviewedProcessId = resolution.processId;
    assert.equal(resolution.status, 'RESOLVED');
    assert.equal(resolution.reviewVersion, 1);
    const draft = await database.selectionProcess.findUniqueOrThrow({
      where: { id: reviewedProcessId },
    });
    assert.equal(draft.publicationStatus, 'RASCUNHO');
    assert.equal(draft.ingestionState, 'NEEDS_REVIEW');
    assert.equal(draft.referenceUrl, canonicalUrl);
    assert.equal(draft.noticeCode, null);
    assert.equal(
      await database.auditEvent.count({
        where: { resourceType: 'DocumentProcessingReviewItem', resourceId: reviewItem.id },
      }),
      1,
    );
    const resolvedItem = await database.documentProcessingReviewItem.findUniqueOrThrow({
      where: { id: reviewItem.id },
    });
    assert.equal(resolvedItem.status, DocumentProcessingReviewStatus.RESOLVED);
    assert.equal(resolvedItem.processId, reviewedProcessId);

    const replay = await service.enqueueDocumentClassify(fixtureDocument.id, sha256);
    assert.equal(replay.id, classifyJob.id);
    assert.equal(
      await database.documentProcessingResult.count({ where: { documentId: fixtureDocument.id } }),
      2,
    );
  } finally {
    await Promise.all([
      classifyWorker.close(),
      extractWorker.close(),
      ...events.map((event) => event.close()),
    ]);
    await Promise.all(Object.values(queues).map((queue) => queue.obliterate({ force: true })));
    await service.onApplicationShutdown();
    if (databaseDocumentId) {
      if (processingReviewItemId) {
        await database.auditEvent.deleteMany({
          where: {
            resourceType: 'DocumentProcessingReviewItem',
            resourceId: processingReviewItemId,
          },
        });
      }
      await database.documentProcessingReviewItem.deleteMany({
        where: { documentId: databaseDocumentId },
      });
      await database.documentProcessingResult.deleteMany({
        where: { documentId: databaseDocumentId },
      });
      if (reviewedProcessId) {
        await database.selectionProcess.delete({ where: { id: reviewedProcessId } });
      }
      if (admin) await database.adminUser.delete({ where: { id: admin.id } });
      await database.document.deleteMany({ where: { id: databaseDocumentId } });
      await database.documentParseCache.deleteMany({ where: { sha256 } });
      await database.documentBlob.deleteMany({ where: { sha256 } });
      await storage.delete(storage.identify(bytes).storageKey);
    }
    await database.discoveryObservation.deleteMany({ where: { discoveredUrlId } });
    await database.discoveredUrl.deleteMany({ where: { id: discoveredUrlId } });
    await database.crawlRun.deleteMany({ where: { id: crawlRunId } });
    await database.source.deleteMany({ where: { id: sourceId } });
    await database.allowedDomain.deleteMany({ where: { id: allowedDomainId } });
    await database.institution.deleteMany({ where: { id: institutionId } });
  }
});
