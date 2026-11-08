import assert from 'node:assert/strict';
import test from 'node:test';
import { AdminReviewCommandsService } from '../apps/api/dist/modules/reviews/commands/admin-review-commands.service.js';
import { ReviewCommandsRepository } from '../apps/api/dist/modules/reviews/commands/review-commands.repository.js';

const processId = '123e4567-e89b-42d3-a456-426614174000';
const evidenceId = '123e4567-e89b-42d3-a456-426614174001';
const offeringId = '123e4567-e89b-42d3-a456-426614174002';
const campusId = '123e4567-e89b-42d3-a456-426614174003';
const actor = {
  id: 'admin-user-id',
  kind: 'HUMAN',
  permissions: ['process.verify', 'process.publish', 'process.reject', 'process.hide'],
  adminIdentity: {
    id: 'admin-user-id',
    issuer: 'https://identity.example',
    subject: 'reviewer-1',
    requestId: 'request-1',
  },
};
const evidence = [
  {
    id: evidenceId,
    fieldPath: 'selectionType',
    pageOrSection: 'page 2',
    url: 'https://www.example.edu/notice.pdf',
    sha256: 'a'.repeat(64),
  },
];

function makeDatabase(overrides = {}) {
  let state = {
    process: {
      id: processId,
      noticeCode: 'A-1',
      ingestionState: 'NEEDS_REVIEW',
      publicationStatus: 'EM_REVISAO',
      ingestionStateReason: null,
      reviewVersion: 0,
      verifiedAt: null,
    },
    offerings: [
      {
        id: offeringId,
        processId,
        institutionId: 'institution-1',
        courseName: 'Original',
        normalizedCourseName: 'ORIGINAL',
        seats: 20,
      },
    ],
    windows: [],
    requirements: [],
    reservations: [],
    campuses: [
      {
        id: campusId,
        institutionId: 'institution-1',
        verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ],
    evidence: [
      {
        id: evidenceId,
        processId,
        fieldPath: 'selectionType',
        pageOrSection: 'page 2',
        document: { url: evidence[0].url, sha256: evidence[0].sha256 },
      },
    ],
    decisions: [],
    audit: [],
    ...overrides,
  };
  const updateRow = (row, data) => {
    for (const [key, value] of Object.entries(data)) {
      row[key] =
        value && typeof value === 'object' && 'increment' in value
          ? row[key] + value.increment
          : value;
    }
  };
  const matches = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);
  const tx = {
    selectionProcess: {
      findUnique: async () => structuredClone(state.process),
      updateMany: async ({ where, data }) => {
        if (!matches(state.process, where)) return { count: 0 };
        updateRow(state.process, data);
        return { count: 1 };
      },
      update: async ({ where, data }) => {
        if (!matches(state.process, where)) throw new Error('process not found');
        updateRow(state.process, data);
        return structuredClone(state.process);
      },
    },
    evidence: {
      findMany: async ({ where }) =>
        state.evidence
          .filter((item) => item.processId === where.processId && where.id.in.includes(item.id))
          .map((item) => structuredClone(item)),
    },
    offering: {
      findFirst: async ({ where }) => state.offerings.find((item) => matches(item, where)) ?? null,
      update: async ({ where, data }) => {
        const row = state.offerings.find((item) => matches(item, where));
        if (!row) throw new Error('offering not found');
        updateRow(row, data);
        return structuredClone(row);
      },
    },
    applicationWindow: {
      findFirst: async ({ where }) => state.windows.find((item) => matches(item, where)) ?? null,
      update: async ({ where, data }) => {
        const row = state.windows.find((item) => matches(item, where));
        if (!row) throw new Error('window not found');
        updateRow(row, data);
        return structuredClone(row);
      },
    },
    requirement: {
      findFirst: async ({ where }) =>
        state.requirements.find((item) => matches(item, where)) ?? null,
      update: async ({ where, data }) => {
        const row = state.requirements.find((item) => matches(item, where));
        if (!row) throw new Error('requirement not found');
        updateRow(row, data);
        return structuredClone(row);
      },
    },
    offeringReservation: {
      findUnique: async ({ where }) => {
        const row = state.reservations.find((item) => item.id === where.id);
        return row ? { ...row, offering: { processId: row.processId } } : null;
      },
      update: async ({ where, data }) => {
        const row = state.reservations.find((item) => item.id === where.id);
        if (!row) throw new Error('reservation not found');
        updateRow(row, data);
        return structuredClone(row);
      },
    },
    campus: {
      findFirst: async ({ where }) => state.campuses.find((item) => matches(item, where)) ?? null,
    },
    reviewDecision: { create: async ({ data }) => (state.decisions.push(data), data) },
    auditEvent: { create: async ({ data }) => (state.audit.push(data), data) },
  };
  const database = {
    $transaction: async (callback) => {
      const backup = structuredClone(state);
      try {
        return await callback(tx);
      } catch (error) {
        state = backup;
        throw error;
      }
    },
  };
  return {
    database,
    get state() {
      return state;
    },
  };
}

const base = { processId, expectedReviewVersion: 0, actor, reason: 'Checked official evidence' };

test('approval atomically verifies and publishes with version increment and evidence audit', async () => {
  const memory = makeDatabase();
  const repository = new ReviewCommandsRepository(memory.database);
  const result = await repository.approve({
    ...base,
    evidence,
    scopeEligible: true,
    unresolvedCriticalFacts: false,
  });

  assert.equal(result.ingestionState, 'VERIFIED');
  assert.equal(result.publicationStatus, 'PUBLICADO');
  assert.equal(result.reviewVersion, 1);
  assert.equal(memory.state.process.reviewVersion, 1);
  assert.equal(memory.state.decisions[0].decision, 'APPROVED_AND_PUBLISHED');
  assert.equal(memory.state.audit[0].action, 'process.approve');
  assert.equal(memory.state.audit[0].afterJson.evidence[0].sha256, 'a'.repeat(64));
});

test('stale version returns 409 without changing process or writing decisions', async () => {
  const memory = makeDatabase();
  const repository = new ReviewCommandsRepository(memory.database);
  await assert.rejects(
    repository.approve({
      ...base,
      expectedReviewVersion: 1,
      evidence,
      scopeEligible: true,
      unresolvedCriticalFacts: false,
    }),
    (error) => error.getStatus() === 409,
  );
  assert.equal(memory.state.process.reviewVersion, 0);
  assert.equal(memory.state.process.publicationStatus, 'EM_REVISAO');
  assert.equal(memory.state.decisions.length, 0);
  assert.equal(memory.state.audit.length, 0);
});

test('correction requires linked evidence, increments version, and hides changed public data', async () => {
  const memory = makeDatabase({
    process: {
      id: processId,
      noticeCode: 'A-1',
      ingestionState: 'VERIFIED',
      publicationStatus: 'PUBLICADO',
      ingestionStateReason: null,
      reviewVersion: 4,
      verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  });
  const repository = new ReviewCommandsRepository(memory.database);
  const result = await repository.correct({
    ...base,
    expectedReviewVersion: 4,
    evidence,
    patches: [{ target: 'process', field: 'noticeCode', value: 'A-2', evidenceId }],
  });

  assert.equal(memory.state.process.noticeCode, 'A-2');
  assert.equal(memory.state.process.ingestionState, 'NEEDS_REVIEW');
  assert.equal(memory.state.process.publicationStatus, 'OCULTO');
  assert.equal(result.reviewVersion, 5);
  assert.equal(memory.state.audit[0].beforeJson.fields[0].value, 'A-1');
  assert.equal(memory.state.audit[0].afterJson.fields[0].value, 'A-2');
  assert.equal(memory.state.audit[0].afterJson.fields[0].evidence.sha256, 'a'.repeat(64));
});

test('correction updates related offerings only within the process and preserves normalized search keys', async () => {
  const memory = makeDatabase();
  const repository = new ReviewCommandsRepository(memory.database);
  await repository.correct({
    ...base,
    evidence,
    patches: [
      {
        target: 'offering',
        targetId: offeringId,
        field: 'courseName',
        value: '  Ciência   da Computação ',
        evidenceId,
      },
    ],
  });
  assert.equal(memory.state.offerings[0].courseName, 'Ciência da Computação');
  assert.equal(memory.state.offerings[0].normalizedCourseName, 'CIENCIA DA COMPUTACAO');
});

test('correction rejects unsupported fields and cross-process child IDs transactionally', async () => {
  const memory = makeDatabase();
  const repository = new ReviewCommandsRepository(memory.database);
  await assert.rejects(
    repository.correct({
      ...base,
      evidence,
      patches: [
        { target: 'process', field: 'institutionId', value: 'another-institution', evidenceId },
      ],
    }),
    (error) => error.getStatus() === 400,
  );
  await assert.rejects(
    repository.correct({
      ...base,
      evidence,
      patches: [
        {
          target: 'offering',
          targetId: '123e4567-e89b-42d3-a456-426614174099',
          field: 'courseName',
          value: 'Hidden process course',
          evidenceId,
        },
      ],
    }),
    (error) => error.getStatus() === 404,
  );
  assert.equal(memory.state.process.reviewVersion, 0);
  assert.equal(memory.state.process.publicationStatus, 'EM_REVISAO');
});

test('admin command service rejects unreviewed source hosts and incomplete approval assertions', async () => {
  let passed = false;
  let evidenceUrl = 'https://www.example.edu/notice.pdf';
  const database = {
    selectionProcess: {
      findUnique: async () => ({
        referenceUrl: 'https://www.example.edu/notice',
        institution: {
          sources: [{ allowedDomain: { host: 'www.example.edu', reviewedAt: new Date() } }],
        },
      }),
    },
    evidence: {
      findMany: async ({ where }) =>
        where.id.in.map((id) => ({
          id,
          fieldPath: 'selectionType',
          pageOrSection: 'page 2',
          document: { url: evidenceUrl, sha256: 'b'.repeat(64) },
        })),
    },
  };
  const service = new AdminReviewCommandsService(database, {
    approve: async (input) => ((passed = true), input),
  });
  await assert.rejects(
    service.approve(
      processId,
      {
        expectedReviewVersion: 0,
        reason: 'I reviewed the notice',
        evidenceIds: [evidenceId],
        scopeEligible: false,
        unresolvedCriticalFacts: false,
      },
      actor,
    ),
    (error) => error.getStatus() === 400,
  );
  assert.equal(passed, false);
  evidenceUrl = 'https://unreviewed.example.net/notice.pdf';
  await assert.rejects(
    service.approve(
      processId,
      {
        expectedReviewVersion: 0,
        reason: 'I reviewed the notice',
        evidenceIds: [evidenceId],
        scopeEligible: true,
        unresolvedCriticalFacts: false,
      },
      actor,
    ),
    (error) => error.getStatus() === 400,
  );
});
