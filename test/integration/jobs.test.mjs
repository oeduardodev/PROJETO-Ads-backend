import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import test from 'node:test';
import { PrismaService } from '../../apps/api/dist/database/prisma.service.js';
import { DocumentProcessorKind } from '../../apps/api/dist/generated/prisma/enums.js';
import { ProcessingResultsRepository } from '../../apps/api/dist/modules/documents/processing-results.repository.js';
import { DocumentProcessingProcessor } from '../../apps/api/dist/modules/jobs/document-processing.processor.js';
import { JobsService } from '../../apps/api/dist/modules/jobs/jobs.service.js';
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
const database = new PrismaService();
test.after(async () => database.$disconnect());

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
  const databaseDocumentId = randomUUID();
  const bytesIdentity = 'step079:' + randomUUID();
  const sha256 = createHash('sha256').update(bytesIdentity).digest('hex');
  const storageKey = 'fixture-local/' + sha256;
  const documentUrl = 'fixture://local/step079/' + randomUUID();
  const events = ['document.classify', 'document.extract'].map(
    (queueName) => new QueueEvents(queueName, { connection: redisConnection, prefix }),
  );
  const processing = new DocumentProcessingProcessor(
    new ProcessingResultsRepository(database),
    service,
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
    await database.documentBlob.create({
      data: { sha256, storageKey, byteLength: 1 },
    });
    await database.document.create({
      data: {
        id: databaseDocumentId,
        url: documentUrl,
        sha256,
        storageKey,
        mediaType: 'application/pdf',
        version: 1,
      },
    });
    await Promise.all([
      ...events.map((event) => event.waitUntilReady()),
      classifyWorker.waitUntilReady(),
      extractWorker.waitUntilReady(),
    ]);

    const classifyJob = await service.enqueueDocumentClassify(databaseDocumentId, sha256);
    await waitForState(queues['document.classify'], classifyJob.id, 'completed');
    const extractJobId = `document-extract-${databaseDocumentId}-v1`;
    await waitForState(queues['document.extract'], extractJobId, 'completed');

    const persisted = await database.documentProcessingResult.findMany({
      where: { documentId: databaseDocumentId },
      orderBy: { processorKind: 'asc' },
    });
    assert.deepEqual(
      persisted.map((result) => result.processorKind),
      [DocumentProcessorKind.CLASSIFICATION, DocumentProcessorKind.EXTRACTION],
    );
    assert.ok(persisted.every((result) => result.status === 'PENDING_REVIEW'));
    assert.ok(persisted.every((result) => result.sha256 === sha256 && result.schemaVersion === 1));
    const [reviewItem] = await database.documentProcessingReviewItem.findMany({
      where: { documentId: databaseDocumentId, sha256 },
    });
    assert.equal(reviewItem.status, 'OPEN');
    assert.equal(reviewItem.discoveredUrlId, null);
    assert.equal(reviewItem.processId, null);

    const replay = await service.enqueueDocumentClassify(databaseDocumentId, sha256);
    assert.equal(replay.id, classifyJob.id);
    assert.equal(
      await database.documentProcessingResult.count({ where: { documentId: databaseDocumentId } }),
      2,
    );
  } finally {
    await Promise.all([
      classifyWorker.close(),
      extractWorker.close(),
      ...events.map((e) => e.close()),
    ]);
    await Promise.all(Object.values(queues).map((queue) => queue.obliterate({ force: true })));
    await service.onApplicationShutdown();
    await database.documentProcessingReviewItem.deleteMany({
      where: { documentId: databaseDocumentId },
    });
    await database.documentProcessingResult.deleteMany({
      where: { documentId: databaseDocumentId },
    });
    await database.document.deleteMany({ where: { id: databaseDocumentId } });
    await database.documentBlob.deleteMany({ where: { sha256 } });
  }
});
