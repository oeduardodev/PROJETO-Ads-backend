import assert from 'node:assert/strict';
import test from 'node:test';
import { ProcessingReviewService } from '../apps/api/dist/modules/reviews/processing-review.service.js';

const itemId = 'c20e3c31-e995-4aec-8d83-7ec4cf59c3f8';
const institutionId = 'c7e0ca61-3f26-4b2a-8d0f-6dafc8f40d33';
const actor = {
  id: 'admin-1',
  issuer: 'https://issuer.example',
  subject: 'curator-1',
  requestId: 'request-1',
};

function fixture({ version = 0, status = 'OPEN', host = 'www.ufpb.br' } = {}) {
  const state = { processes: [], updates: [], audits: [] };
  const reviewItem = {
    id: itemId,
    status,
    reviewVersion: version,
    processId: null,
    discoveredUrl: {
      canonicalUrl: 'https://www.ufpb.br/editais/2026',
      observations: [
        {
          source: {
            status: 'ACTIVE',
            institutionId,
            allowedDomain: { host, reviewedAt: new Date(), collectionAllowed: true },
            institution: { id: institutionId, verifiedAt: new Date(), publicFlag: true },
          },
        },
      ],
    },
  };
  const transaction = {
    documentProcessingReviewItem: {
      async findUnique() {
        return reviewItem;
      },
      async updateMany({ where, data }) {
        state.updates.push({ where, data });
        if (reviewItem.status !== where.status || reviewItem.reviewVersion !== where.reviewVersion)
          return { count: 0 };
        Object.assign(reviewItem, data, { reviewVersion: reviewItem.reviewVersion + 1 });
        return { count: 1 };
      },
    },
    selectionProcess: {
      async create({ data }) {
        state.processes.push(data);
        return { id: 'process-1' };
      },
    },
    auditEvent: {
      async create({ data }) {
        state.audits.push(data);
      },
    },
  };
  const database = {
    ...transaction,
    async $transaction(callback) {
      return callback(transaction);
    },
  };
  return { service: new ProcessingReviewService(database), state, reviewItem };
}

test('curator action creates a draft only on explicit request and records source-bound audit', async () => {
  const { service, state } = fixture();
  const result = await service.resolve(
    itemId,
    {
      expectedReviewVersion: 0,
      institutionId,
      reason: 'Inspecionar os resultados tipados antes de preencher o edital.',
    },
    actor,
  );

  assert.equal(state.processes.length, 1);
  assert.equal(state.processes[0].publicationStatus, 'RASCUNHO');
  assert.equal(state.processes[0].referenceUrl, 'https://www.ufpb.br/editais/2026');
  assert.equal(state.processes[0].noticeCode, undefined);
  assert.equal(result.status, 'RESOLVED');
  assert.equal(result.processId, 'process-1');
  assert.equal(state.updates[0].where.reviewVersion, 0);
  assert.equal(state.audits[0].actorAdminUserId, actor.id);
  assert.equal(state.audits[0].requestId, actor.requestId);
});

test('processing artifact cannot create a draft for an unrelated institution', async () => {
  const { service, state } = fixture();
  await assert.rejects(
    service.resolve(
      itemId,
      {
        expectedReviewVersion: 0,
        institutionId: 'e7c9e9bb-07cb-47b0-aabd-e32056bad926',
        reason: 'Revisao humana.',
      },
      actor,
    ),
  );
  assert.equal(state.processes.length, 0);
  assert.equal(state.updates.length, 0);
});

test('processing artifact rejects stale review versions before writing', async () => {
  const { service, state } = fixture({ version: 2 });
  await assert.rejects(
    service.resolve(
      itemId,
      {
        expectedReviewVersion: 1,
        institutionId,
        reason: 'Revisao humana.',
      },
      actor,
    ),
  );
  assert.equal(state.processes.length, 0);
  assert.equal(state.audits.length, 0);
});
