import assert from 'node:assert/strict';
import test from 'node:test';
import { JobsService } from '../apps/api/dist/modules/jobs/jobs.service.js';
import { DEFAULT_JOB_OPTIONS, JOB_QUEUE_NAMES } from '../apps/api/dist/modules/jobs/job-queues.js';

const sourceId = 'c7e0ca61-3f26-4b2a-8d0f-6dafc8f40d33';
const documentId = '80fc8a31-cf6f-4d81-9a4a-f86af0aad456';
const processId = '9b81c773-4b6b-4f0d-a432-09b6a15f0a0e';

function serviceWithRecordedCalls() {
  const calls = [];
  const queues = Object.fromEntries(
    JOB_QUEUE_NAMES.map((queueName) => [
      queueName,
      {
        add: async (jobName, data, options) => {
          calls.push({ queueName, jobName, data, options });
          return { queueName, jobName, data, options };
        },
        close: async () => undefined,
      },
    ]),
  );
  return { service: new JobsService(queues), calls };
}

test('all seven job producers create stable IDs from persisted record identity', async () => {
  const { service, calls } = serviceWithRecordedCalls();
  const dueAt = '2026-11-04T15:00:00-03:00';
  await service.enqueueSourceRefresh({ sourceId, scheduleVersion: 2 }, 101);
  await service.enqueueUrlFetch(sourceId);
  await service.enqueueDocumentClassify(documentId, 'A'.repeat(64));
  await service.enqueueDocumentExtract(documentId, 3);
  await service.enqueueDocumentOcr({
    documentId,
    sha256: 'B'.repeat(64),
    pageNumber: 2,
    pipelineVersion: 1,
  });
  await service.enqueueProcessValidate(processId, 4);
  await service.enqueueProcessRecheck(processId, dueAt);

  assert.deepEqual(
    calls.map(({ queueName }) => queueName),
    [...JOB_QUEUE_NAMES],
  );
  assert.deepEqual(
    calls.map(({ options }) => options.jobId),
    [
      'source-refresh-' + sourceId + '-v2',
      'url-fetch-' + sourceId,
      'document-classify-' + documentId + '-' + 'a'.repeat(64),
      'document-extract-' + documentId + '-v3',
      `document-ocr-${documentId}-${'b'.repeat(64)}-p2-v1`,
      'process-validate-' + processId + '-r4',
      'process-recheck-' + processId + '-' + Date.parse(dueAt),
    ],
  );
  assert.equal(calls[0].options.priority, 101);
  assert.equal(calls[2].data.sha256, 'a'.repeat(64));
  assert.equal(calls[4].data.sha256, 'b'.repeat(64));
  assert.equal(calls[6].data.dueAt, '2026-11-04T18:00:00.000Z');
});

test('queues retry with jitter and retain final failures for manual retry', () => {
  assert.equal(DEFAULT_JOB_OPTIONS.attempts, 3);
  assert.deepEqual(DEFAULT_JOB_OPTIONS.backoff, {
    type: 'exponential',
    delay: 1_000,
    jitter: 0.5,
  });
  assert.equal(DEFAULT_JOB_OPTIONS.removeOnFail, false);
  assert.deepEqual(DEFAULT_JOB_OPTIONS.removeOnComplete, {
    age: 7 * 24 * 60 * 60,
    count: 1_000,
  });
});

test('job payload identity rejects malformed IDs, versions, hashes, and due dates', async () => {
  const { service } = serviceWithRecordedCalls();
  assert.throws(() => service.enqueueUrlFetch('not-a-uuid'), /candidateUrlId must be a UUID/u);
  assert.throws(
    () => service.enqueueSourceRefresh({ sourceId, scheduleVersion: 0 }),
    /scheduleVersion must be a positive safe integer/u,
  );
  assert.throws(
    () => service.enqueueDocumentClassify(documentId, 'not-a-hash'),
    /sha256 must contain 64 hexadecimal characters/u,
  );
  assert.throws(
    () =>
      service.enqueueDocumentOcr({ documentId, sha256: 'bad', pageNumber: 1, pipelineVersion: 1 }),
    /sha256 must contain 64 hexadecimal characters/u,
  );
  assert.throws(
    () =>
      service.enqueueDocumentOcr({
        documentId,
        sha256: 'a'.repeat(64),
        pageNumber: 0,
        pipelineVersion: 1,
      }),
    /pageNumber must be a positive safe integer/u,
  );
  assert.throws(
    () => service.enqueueProcessRecheck(processId, 'tomorrow'),
    /dueAt must include an explicit timezone/u,
  );
  assert.throws(
    () => service.enqueueProcessRecheck(processId, '2026-11-04T15:00:00'),
    /dueAt must include an explicit timezone/u,
  );
  assert.throws(
    () => service.enqueueProcessRecheck(processId, '2026-11-04T15:00:00+99:99'),
    /dueAt must be a valid date-time/u,
  );
});
