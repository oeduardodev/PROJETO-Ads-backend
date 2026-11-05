import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { FixtureLocalStorage } from '../apps/api/dist/modules/documents/fixture-local-storage.js';
import { SnapshotRetentionRepository } from '../apps/api/dist/modules/documents/cache/snapshot-retention.repository.js';
import {
  isSnapshotBlobExpired,
  snapshotBlobRetentionDeadline,
} from '../apps/api/dist/modules/documents/cache/snapshot-retention.js';

const day = 24 * 60 * 60 * 1_000;
const reviewedAt = new Date('2026-01-01T00:00:00.000Z');
const source = (days) => ({ snapshotRetentionDays: days, retentionReviewedAt: reviewedAt });
const document = (sources, capturedAt = new Date('2026-01-02T00:00:00.000Z')) => ({
  capturedAt,
  discoveredUrl: { observations: sources.map((entry) => ({ source: entry })) },
});

test('requires a reviewed policy for every source linked to every shared document', () => {
  const neverReviewed = { snapshotRetentionDays: null, retentionReviewedAt: null };
  const blob = {
    expiredAt: null,
    documents: [document([source(30)]), document([source(30), neverReviewed])],
  };
  assert.equal(snapshotBlobRetentionDeadline(blob), undefined);
  assert.equal(isSnapshotBlobExpired(blob, new Date('2030-01-01T00:00:00.000Z')), false);
});

test('uses the latest deadline across all source and document links', () => {
  const blob = {
    expiredAt: null,
    documents: [
      document([source(10)], new Date('2026-01-02T00:00:00.000Z')),
      document([source(40)], new Date('2026-01-03T00:00:00.000Z')),
    ],
  };
  const deadline = new Date('2026-01-03T00:00:00.000Z');
  deadline.setTime(deadline.getTime() + 40 * day);
  assert.equal(snapshotBlobRetentionDeadline(blob).getTime(), deadline.getTime());
  assert.equal(isSnapshotBlobExpired(blob, new Date(deadline.getTime() - 1)), false);
  assert.equal(isSnapshotBlobExpired(blob, deadline), true);
});

test('deletes only eligible blob bytes and parser cache while preserving document records', async () => {
  const sha256 = 'b'.repeat(64);
  const documentRow = document([source(1)], new Date('2025-12-01T00:00:00.000Z'));
  const blob = {
    sha256,
    storageKey: `fixtures/sha256/bb/${sha256}`,
    expiredAt: null,
    createdAt: new Date('2025-12-01T00:00:00.000Z'),
    documents: [{ ...documentRow, id: randomUUID() }],
  };
  const documentIds = blob.documents.map(({ id }) => id);
  const evidence = [{ documentId: documentIds[0], quote: 'reviewed excerpt' }];
  const relations = [{ originDocumentId: documentIds[0] }];
  let deletedCache = false;
  let deletedBytes;
  const database = {
    $transaction: async (operation) => operation(database),
    $queryRaw: async (strings) =>
      strings.join('').includes('SELECT "expired_at"') ? [{ expiredAt: blob.expiredAt }] : [],
    documentBlob: {
      findMany: async () => [{ ...blob }],
      findUnique: async () => blob,
      update: async ({ data }) => Object.assign(blob, data),
    },
    documentParseCache: {
      deleteMany: async ({ where }) => {
        assert.equal(where.sha256, sha256);
        deletedCache = true;
      },
    },
  };
  const repository = new SnapshotRetentionRepository(database);
  const result = await repository.cleanupExpiredBlobs(new Date('2026-02-01T00:00:00.000Z'), {
    delete: async (storageKey) => {
      deletedBytes = storageKey;
    },
  });

  assert.deepEqual(result, { examinedBlobs: 1, expiredBlobs: 1, nextCursor: null });
  assert.equal(deletedBytes, blob.storageKey);
  assert.equal(deletedCache, true);
  assert.ok(blob.expiredAt instanceof Date);
  assert.deepEqual(
    blob.documents.map(({ id }) => id),
    documentIds,
  );
  assert.equal(evidence.length, 1);
  assert.equal(relations.length, 1);
});

test('keeps shared blobs and cache when any linked source lacks a reviewed policy', async () => {
  const sha256 = 'c'.repeat(64);
  const blob = {
    sha256,
    storageKey: `fixtures/sha256/cc/${sha256}`,
    expiredAt: null,
    documents: [
      document([source(1)]),
      document([{ snapshotRetentionDays: null, retentionReviewedAt: null }]),
    ],
  };
  const database = {
    $transaction: async (operation) => operation(database),
    documentBlob: { findMany: async () => [blob] },
  };
  let deleteCalled = false;
  const result = await new SnapshotRetentionRepository(database).cleanupExpiredBlobs(
    new Date('2026-02-01T00:00:00.000Z'),
    { delete: async () => (deleteCalled = true) },
  );
  assert.deepEqual(result, { examinedBlobs: 1, expiredBlobs: 0, nextCursor: null });
  assert.equal(deleteCalled, false);
});

test('uses a normalized SHA-256 cursor to continue bounded cleanup pages', async () => {
  const firstSha = 'b'.repeat(64);
  const lastSha = 'c'.repeat(64);
  let query;
  const database = {
    documentBlob: {
      findMany: async (input) => {
        query = input;
        return [
          { sha256: firstSha, documents: [] },
          { sha256: lastSha, documents: [] },
        ];
      },
    },
  };
  const result = await new SnapshotRetentionRepository(database).cleanupExpiredBlobs(
    new Date('2026-02-01T00:00:00.000Z'),
    { delete: async () => assert.fail('ineligible blobs must be kept') },
    2,
    'a'.repeat(64).toUpperCase(),
  );
  assert.deepEqual(query.where, { expiredAt: null, sha256: { gt: 'a'.repeat(64) } });
  assert.equal(result.nextCursor, lastSha);
  assert.equal(result.expiredBlobs, 0);
});

test('fixture storage deletion is idempotent for local test artifacts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ads-retention-'));
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  try {
    const storage = new FixtureLocalStorage(root);
    const stored = await storage.write(Buffer.from('synthetic fixture bytes'));
    await storage.delete(stored.storageKey);
    await storage.delete(stored.storageKey);
    await assert.rejects(storage.read(stored.storageKey), { code: 'ENOENT' });
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    await rm(root, { recursive: true, force: true });
  }
});
