import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileProcessIdentity } from '../apps/api/dist/modules/processes/deduplication/reconcile-process.js';

const incoming = {
  institutionId: 'institution-a',
  noticeCode: ' PS 01/2026 ',
  noticeYear: 2026,
  primaryDocumentId: 'document-new',
  primaryDocumentSha256: 'a'.repeat(64),
};
const current = {
  id: 'process-1',
  institutionId: 'institution-a',
  noticeCode: 'PS 01/2026',
  noticeYear: 2026,
  primaryDocumentIds: ['document-original'],
  primaryDocumentHashes: ['a'.repeat(64)],
};

test('replay and URL changes retain a process identified by institution, notice and year', () => {
  assert.deepEqual(reconcileProcessIdentity(incoming, [current]), {
    action: 'MATCH',
    processId: 'process-1',
    basis: 'NOTICE_YEAR',
  });
  assert.deepEqual(
    reconcileProcessIdentity({ ...incoming, primaryDocumentId: 'document-original' }, [current]),
    {
      action: 'MATCH',
      processId: 'process-1',
      basis: 'NOTICE_YEAR',
    },
  );
  assert.deepEqual(
    reconcileProcessIdentity(incoming, [{ ...current, institutionId: 'institution-b' }]),
    {
      action: 'CREATE',
    },
  );
});

test('exact primary document ID can match incomplete extraction without inventing notice identity', () => {
  assert.deepEqual(
    reconcileProcessIdentity(
      { ...incoming, noticeCode: null, noticeYear: null, primaryDocumentId: 'document-original' },
      [current],
    ),
    { action: 'MATCH', processId: 'process-1', basis: 'DOCUMENT_ID' },
  );
});

test('hash-only fallback holds a URL change for assisted review instead of creating a duplicate', () => {
  assert.deepEqual(
    reconcileProcessIdentity({ ...incoming, noticeCode: null, noticeYear: null }, [current]),
    { action: 'REVIEW', reason: 'HASH_MATCH', candidateIds: ['process-1'] },
  );
});

test('different notices and different document hashes do not merge by course or institution', () => {
  assert.deepEqual(
    reconcileProcessIdentity(
      { ...incoming, noticeCode: 'PS 02/2026', primaryDocumentSha256: 'b'.repeat(64) },
      [current],
    ),
    { action: 'CREATE' },
  );
});

test('conflicting notice and shared document cannot silently merge', () => {
  const result = reconcileProcessIdentity({ ...incoming, noticeCode: 'PS 02/2026' }, [current]);
  assert.equal(result.action, 'REVIEW');
  assert.deepEqual(result.candidateIds, ['process-1']);
});

test('one document shared by two notices blocks an otherwise matching notice', () => {
  const second = {
    ...current,
    id: 'process-2',
    noticeCode: 'PS 02/2026',
    primaryDocumentHashes: ['a'.repeat(64)],
  };
  const result = reconcileProcessIdentity(incoming, [current, second]);
  assert.deepEqual(result, {
    action: 'REVIEW',
    reason: 'IDENTITY_CONFLICT',
    candidateIds: ['process-1', 'process-2'],
  });
});

test('ambiguous notice identity never chooses a process by array order', () => {
  const result = reconcileProcessIdentity(incoming, [current, { ...current, id: 'process-2' }]);
  assert.deepEqual(result, {
    action: 'REVIEW',
    reason: 'AMBIGUOUS_NOTICE',
    candidateIds: ['process-1', 'process-2'],
  });
});
