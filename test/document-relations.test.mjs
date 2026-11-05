import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { DocumentRelationType } from '../apps/api/dist/generated/prisma/enums.js';
import { DocumentRelationsRepository } from '../apps/api/dist/modules/documents/versioning/document-relations.repository.js';
import { validateDocumentRelation } from '../apps/api/dist/modules/documents/versioning/document-relation.js';

const originDocumentId = '80fc8a31-cf6f-4d81-9a4a-f86af0aad456';
const relatedDocumentId = '7d5ffcb6-e5cc-4808-9877-10c7a617760a';

test('validates version-specific directed relations and keeps independent document IDs', () => {
  for (const relationType of Object.values(DocumentRelationType)) {
    assert.deepEqual(
      validateDocumentRelation({
        originDocumentId: originDocumentId.toUpperCase(),
        relatedDocumentId,
        relationType,
      }),
      { originDocumentId, relatedDocumentId, relationType },
    );
  }
  assert.throws(
    () =>
      validateDocumentRelation({
        originDocumentId,
        relatedDocumentId: originDocumentId,
        relationType: DocumentRelationType.ATTACHMENT,
      }),
    /cannot be related to itself/u,
  );
  assert.throws(
    () =>
      validateDocumentRelation({
        originDocumentId,
        relatedDocumentId: 'not-a-uuid',
        relationType: DocumentRelationType.RELATED,
      }),
    /relatedDocumentId must be a UUID/u,
  );
});

test('upserts directed typed relations idempotently without changing their original snapshot', async () => {
  const rows = new Map();
  const calls = [];
  const database = {
    documentRelation: {
      upsert: async (args) => {
        calls.push(args);
        const key = [
          args.where.originDocumentId_relatedDocumentId_relationType.originDocumentId,
          args.where.originDocumentId_relatedDocumentId_relationType.relatedDocumentId,
          args.where.originDocumentId_relatedDocumentId_relationType.relationType,
        ].join('|');
        if (!rows.has(key))
          rows.set(key, { id: randomUUID(), ...args.create, createdAt: new Date() });
        return rows.get(key);
      },
      findMany: async () => [],
    },
  };
  const repository = new DocumentRelationsRepository(database);
  const firstSnapshotRelation = {
    originDocumentId,
    relatedDocumentId,
    relationType: DocumentRelationType.ATTACHMENT,
  };
  const first = await repository.linkDocuments(firstSnapshotRelation);
  const replay = await repository.linkDocuments(firstSnapshotRelation);
  const laterVersion = await repository.linkDocuments({
    ...firstSnapshotRelation,
    originDocumentId: '9b81c773-4b6b-4f0d-a432-09b6a15f0a0e',
  });

  assert.equal(first.id, replay.id);
  assert.equal(first.createdAt, replay.createdAt);
  assert.notEqual(first.id, laterVersion.id);
  assert.equal(rows.size, 2);
  assert.ok(calls.every((call) => Object.keys(call.update).length === 0));
});
