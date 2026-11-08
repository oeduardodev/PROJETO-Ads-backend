import assert from 'node:assert/strict';
import test from 'node:test';
import { AdminReviewQueueService } from '../apps/api/dist/modules/reviews/admin-review-queue.service.js';

const institutionId = '123e4567-e89b-42d3-a456-426614174000';
const processId = '123e4567-e89b-42d3-a456-426614174001';

function service({ items = [], total = items.length, detail = null } = {}) {
  const calls = {};
  const instance = new AdminReviewQueueService({
    selectionProcess: {
      count: async (input) => ((calls.count = input), total),
      findMany: async (input) => ((calls.list = input), items),
      findUnique: async (input) => ((calls.detail = input), detail),
    },
  });
  return { instance, calls };
}

test('review queue filters by state and institution, paginates, and has deterministic ordering', async () => {
  const { instance, calls } = service({ items: [{ id: processId }], total: 31 });
  const result = await instance.list({
    state: 'NEEDS_REVIEW',
    institution_id: institutionId,
    page: '2',
    page_size: '10',
  });

  assert.deepEqual(calls.count.where, { ingestionState: 'NEEDS_REVIEW', institutionId });
  assert.deepEqual(calls.list.where, calls.count.where);
  assert.deepEqual(calls.list.orderBy, [{ createdAt: 'asc' }, { id: 'asc' }]);
  assert.equal(calls.list.skip, 10);
  assert.equal(calls.list.take, 10);
  assert.deepEqual(result.meta, { page: 2, pageSize: 10, total: 31, totalPages: 4 });
});

test('review queue defaults to NEEDS_REVIEW and rejects invalid filters and pagination', async () => {
  const { instance, calls } = service();
  await instance.list({});
  assert.deepEqual(calls.list.where, { ingestionState: 'NEEDS_REVIEW' });

  await assert.rejects(
    instance.list({ state: 'NOT_A_STATE' }),
    (error) => error.getStatus() === 400,
  );
  await assert.rejects(
    instance.list({ institution_id: 'bad-id' }),
    (error) => error.getStatus() === 400,
  );
  await assert.rejects(instance.list({ page: '0' }), (error) => error.getStatus() === 400);
});

test('review detail returns process, evidence with document hashes, revisions and status', async () => {
  const process = {
    id: processId,
    ingestionState: 'NEEDS_REVIEW',
    publicationStatus: 'EM_REVISAO',
    offerings: [],
    windows: [],
    requirements: [],
    evidence: [
      {
        fieldPath: 'applicationWindow.endDate',
        quote: '...',
        document: { sha256: 'a'.repeat(64) },
      },
    ],
    revisions: [{ changedFieldsJson: { deadline: { before: null, after: '2030-02-10' } } }],
    reviewDecisions: [],
  };
  const { instance, calls } = service({ detail: process });
  const result = await instance.get(processId);

  assert.equal(result.evidence[0].document.sha256, 'a'.repeat(64));
  assert.deepEqual(result.revisions[0].changedFieldsJson.deadline, {
    before: null,
    after: '2030-02-10',
  });
  assert.equal(result.ingestionState, 'NEEDS_REVIEW');
  assert.equal(calls.detail.select.reviewVersion, true);
  assert.deepEqual(calls.detail.where, { id: processId });
  assert.equal(calls.detail.select.evidence.include.document.select.sha256, true);
  assert.equal(calls.detail.select.revisions.include.document.select.version, true);
});

test('review detail rejects malformed IDs and returns 404 for unknown process', async () => {
  const { instance } = service();
  await assert.rejects(instance.get('not-a-uuid'), (error) => error.getStatus() === 400);
  await assert.rejects(instance.get(processId), (error) => error.getStatus() === 404);
});
