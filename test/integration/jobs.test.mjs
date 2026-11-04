import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import test from 'node:test';
import { JobsService } from '../../apps/api/dist/modules/jobs/jobs.service.js';
import {
  DEFAULT_JOB_OPTIONS,
  createJobQueues,
} from '../../apps/api/dist/modules/jobs/job-queues.js';

const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { QueueEvents, Worker } = requireApi('bullmq');
const redisUrl = process.env.TEST_REDIS_URL || process.env.REDIS_URL || 'redis://127.0.0.1:6380';
const redisConnection = { url: redisUrl, maxRetriesPerRequest: null };

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
