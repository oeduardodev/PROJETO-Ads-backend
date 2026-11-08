import assert from 'node:assert/strict';
import test from 'node:test';
import { ReviewsRepository } from '../apps/api/dist/modules/reviews/reviews.repository.js';

function plan(action = 'REVIEW_CANDIDATE') {
  const previous = {
    institutionId: 'institution-1',
    primaryDocumentId: 'document-v1',
    documentIds: ['document-v1'],
    evidence: [
      {
        fieldPath: 'windows[0].endDate',
        documentId: 'document-v1',
        pageOrSection: 'p. 2',
        quote: '27/07',
      },
    ],
  };
  const candidate = {
    institutionId: 'institution-1',
    primaryDocumentId: 'document-v2',
    documentIds: ['document-v1', 'document-v2'],
    evidence: [
      {
        fieldPath: 'windows[0].endDate',
        documentId: 'document-v2',
        pageOrSection: 'p. 3',
        quote: '20/07',
      },
    ],
  };
  return {
    action,
    previousDocumentId: 'document-v1',
    candidateDocumentId: 'document-v2',
    changedFields: [
      { path: 'windows[0].endDate', before: '2026-07-27', after: '2026-07-20', critical: true },
    ],
    requiresReview: action !== 'NO_CHANGE',
    blocksCurrentPublication: action !== 'NO_CHANGE',
    previous,
    candidate,
  };
}

function repository() {
  const calls = {
    transaction: 0,
    revisionCreate: 0,
    evidenceCreateMany: 0,
    publicationStatus: 'PUBLICADO',
    ingestionState: 'NEEDS_REVIEW',
    reviewDecisions: [],
  };
  let existing = null;
  const database = {
    $transaction: async (operation) => {
      calls.transaction += 1;
      const transaction = {
        revision: {
          findFirst: async () => existing,
          findUnique: async () => existing,
          create: async ({ data }) => {
            calls.revisionCreate += 1;
            existing = { id: 'revision-1', ...data };
            return existing;
          },
        },
        evidence: {
          createMany: async ({ data }) => {
            calls.evidenceCreateMany += 1;
            calls.evidence = data;
            return { count: data.length };
          },
        },
        selectionProcess: {
          findUnique: async ({ select }) => ({
            ...(select.publicationStatus ? { publicationStatus: calls.publicationStatus } : {}),
            ...(select.ingestionState ? { ingestionState: calls.ingestionState } : {}),
          }),
          updateMany: async ({ where, data }) => {
            if (where.publicationStatus && where.publicationStatus !== calls.publicationStatus) {
              return { count: 0 };
            }
            if (where.ingestionState && where.ingestionState !== calls.ingestionState) {
              return { count: 0 };
            }
            if (data.publicationStatus) calls.publicationStatus = data.publicationStatus;
            if (data.ingestionState) calls.ingestionState = data.ingestionState;
            if (data.ingestionStateReason) calls.ingestionStateReason = data.ingestionStateReason;
            return { count: 1 };
          },
        },
        reviewDecision: {
          create: async ({ data }) => calls.reviewDecisions.push(data),
        },
      };
      return operation(transaction);
    },
  };
  return {
    service: new ReviewsRepository(database),
    calls,
    setExisting: (value) => (existing = value),
  };
}

function candidateInput(revisionPlan, overrides = {}) {
  return {
    processId: 'process-1',
    plan: revisionPlan,
    officialSourceVerified: true,
    criticalRevisionPolicy: 'KEEP_PREVIOUS',
    ...overrides,
  };
}

test('records revision and candidate evidence atomically without replacing prior evidence', async () => {
  const { service, calls } = repository();
  const result = await service.recordRevisionCandidate(candidateInput(plan()));
  assert.equal(result.status, 'RECORDED');
  assert.equal(calls.transaction, 1);
  assert.equal(calls.revisionCreate, 1);
  assert.equal(calls.evidenceCreateMany, 1);
  assert.equal(calls.evidence[0].documentId, 'document-v2');
  assert.equal(result.revision.changedFieldsJson.previousSnapshot.evidence[0].quote, '27/07');
  assert.equal(result.revision.changedFieldsJson.candidateSnapshot.evidence[0].quote, '20/07');
  assert.equal(calls.publicationStatus, 'PUBLICADO');
  assert.equal(calls.reviewDecisions[0].decision, 'KEEP_PREVIOUS_VERSION');
});

test('replaying a candidate document returns the prior revision without duplicating history', async () => {
  const { service, calls } = repository();
  await service.recordRevisionCandidate(candidateInput(plan()));
  const result = await service.recordRevisionCandidate(candidateInput(plan()));
  assert.equal(result.status, 'REPLAY');
  assert.equal(calls.revisionCreate, 1);
  assert.equal(calls.evidenceCreateMany, 1);
});

test('same version replay does not open a transaction or write history', async () => {
  const { service, calls } = repository();
  const result = await service.recordRevisionCandidate(candidateInput(plan('NO_CHANGE')));
  assert.deepEqual(result, { status: 'UNCHANGED', revision: null });
  assert.equal(calls.transaction, 0);
});

test('rejects candidate evidence that points to an unlinked document', () => {
  const { service, calls } = repository();
  const candidate = plan();
  candidate.candidate.evidence[0].documentId = 'unlinked-document';
  assert.throws(() => service.recordRevisionCandidate(candidateInput(candidate)));
  assert.equal(calls.transaction, 0);
});

test('hides a published process only under explicit policy after official critical revision', async () => {
  const { service, calls } = repository();
  await service.recordRevisionCandidate(candidateInput(plan(), { criticalRevisionPolicy: 'HIDE' }));
  assert.equal(calls.publicationStatus, 'OCULTO');
  assert.equal(calls.reviewDecisions[0].decision, 'HIDE_CRITICAL_REVISION');
});

test('unverified source cannot change visibility or create a policy audit decision', async () => {
  const { service, calls } = repository();
  await service.recordRevisionCandidate(
    candidateInput(plan(), { criticalRevisionPolicy: 'HIDE', officialSourceVerified: false }),
  );
  assert.equal(calls.publicationStatus, 'PUBLICADO');
  assert.deepEqual(calls.reviewDecisions, []);
});

test('persists ingestion transitions and audit records atomically', async () => {
  const { service, calls } = repository();
  const result = await service.transitionIngestion({
    processId: 'process-1',
    to: 'VERIFIED',
    actor: { id: 'curator-1', kind: 'HUMAN', permissions: ['process.verify'] },
    reason: 'Official source and critical facts confirmed',
    officialSourceVerified: true,
    unresolvedCriticalFacts: false,
  });
  assert.equal(result.from, 'NEEDS_REVIEW');
  assert.equal(result.to, 'VERIFIED');
  assert.equal(calls.ingestionState, 'VERIFIED');
  assert.equal(calls.reviewDecisions[0].decision, 'INGESTION_NEEDS_REVIEW_TO_VERIFIED');
});

test('publishes only through an authorized, verified human transition and audits the actor', async () => {
  const { service, calls } = repository();
  calls.publicationStatus = 'EM_REVISAO';
  calls.ingestionState = 'VERIFIED';
  const result = await service.transitionPublication({
    processId: 'process-1',
    to: 'PUBLICADO',
    actor: { id: 'curator-1', kind: 'HUMAN', permissions: ['process.publish'] },
    reason: 'Reviewed official notice and all critical fields',
    officialSourceVerified: true,
    scopeEligible: true,
    unresolvedCriticalFacts: false,
  });
  assert.equal(result.from, 'EM_REVISAO');
  assert.equal(calls.publicationStatus, 'PUBLICADO');
  assert.equal(calls.reviewDecisions[0].reviewerId, 'curator-1');
  assert.equal(calls.reviewDecisions[0].decision, 'PUBLICATION_EM_REVISAO_TO_PUBLICADO');
});
