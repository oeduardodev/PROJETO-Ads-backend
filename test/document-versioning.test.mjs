import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DocumentRelationType } from '../apps/api/dist/generated/prisma/enums.js';
import { DocumentsRepository } from '../apps/api/dist/modules/documents/documents.repository.js';
import { FixtureLocalStorage } from '../apps/api/dist/modules/documents/fixture-local-storage.js';
import { DocumentRelationsRepository } from '../apps/api/dist/modules/documents/versioning/document-relations.repository.js';

const fixtureRoot = await mkdtemp(join(tmpdir(), 'ads-document-versioning-'));
const originalNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'test';

const blobs = new Map();
const documents = [];
const relations = new Map();

const database = {
  $transaction: async (operation) => operation(database),
  documentBlob: {
    upsert: async ({ create }) => {
      if (!blobs.has(create.sha256)) blobs.set(create.sha256, { ...create });
      return blobs.get(create.sha256);
    },
    count: async () => blobs.size,
  },
  document: {
    findFirst: async ({ where }) =>
      documents
        .filter((document) => document.url === where.url)
        .sort((left, right) => right.version - left.version)[0] ?? null,
    findMany: async ({ where }) =>
      documents
        .filter((document) => document.url === where.url)
        .sort((left, right) => left.version - right.version),
    create: async ({ data }) => {
      const document = { id: randomUUID(), ...data };
      documents.push(document);
      return document;
    },
    update: async ({ where, data }) => {
      const document = documents.find((candidate) => candidate.id === where.id);
      Object.assign(document, data);
      return document;
    },
  },
  documentRelation: {
    upsert: async ({ where, create }) => {
      const identity = where.originDocumentId_relatedDocumentId_relationType;
      const key = `${identity.originDocumentId}|${identity.relatedDocumentId}|${identity.relationType}`;
      if (!relations.has(key))
        relations.set(key, { id: randomUUID(), ...create, createdAt: new Date() });
      return relations.get(key);
    },
    findMany: async ({ where, include }) => {
      const selected = [...relations.values()]
        .filter((relation) => relation.originDocumentId === where.originDocumentId)
        .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
      return include.relatedDocument
        ? selected.map((relation) => ({
            ...relation,
            relatedDocument: documents.find(
              (document) => document.id === relation.relatedDocumentId,
            ),
          }))
        : selected;
    },
  },
};

const snapshots = new DocumentsRepository(database);
const documentRelations = new DocumentRelationsRepository(database);
const storage = new FixtureLocalStorage(fixtureRoot);

test.after(async () => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  await rm(fixtureRoot, { recursive: true, force: true });
});

test('new snapshots preserve each URL version, hash, storage, and its original relations', async () => {
  const mainUrl = 'fixture://local/notices/independent-main';
  const attachmentUrl = 'fixture://local/notices/independent-attachment';
  const oldBytes = Buffer.from('<html><body>main version 1</body></html>');
  const newBytes = Buffer.from('<html><body>main version 2</body></html>');
  const attachmentBytes = Buffer.from('<html><body>independent attachment</body></html>');

  const mainV1 = await snapshots.recordFixtureSnapshot({
    url: mainUrl,
    mediaType: 'text/html',
    bytes: oldBytes,
    storage,
  });
  const attachment = await snapshots.recordFixtureSnapshot({
    url: attachmentUrl,
    mediaType: 'text/html',
    bytes: attachmentBytes,
    storage,
  });
  const relation = await documentRelations.linkDocuments({
    originDocumentId: mainV1.id,
    relatedDocumentId: attachment.id,
    relationType: DocumentRelationType.ATTACHMENT,
  });
  const replay = await documentRelations.linkDocuments({
    originDocumentId: mainV1.id,
    relatedDocumentId: attachment.id,
    relationType: DocumentRelationType.ATTACHMENT,
  });
  const mainV2 = await snapshots.recordFixtureSnapshot({
    url: mainUrl,
    mediaType: 'text/html',
    bytes: newBytes,
    storage,
  });

  assert.notEqual(mainV1.id, attachment.id);
  assert.equal(relation.id, replay.id);
  assert.equal(mainV1.url, mainUrl);
  assert.equal(mainV1.version, 1);
  assert.equal(mainV1.sha256, createHash('sha256').update(oldBytes).digest('hex'));
  assert.equal(mainV2.url, mainUrl);
  assert.equal(mainV2.version, 2);
  assert.equal(mainV2.sha256, createHash('sha256').update(newBytes).digest('hex'));
  assert.deepEqual(await storage.read(mainV1.storageKey), oldBytes);
  assert.deepEqual(await storage.read(mainV2.storageKey), newBytes);
  assert.deepEqual(await snapshots.listVersions(mainUrl), [mainV1, mainV2]);
  assert.equal((await documentRelations.listRelatedDocuments(mainV1.id)).length, 1);
  assert.deepEqual(await documentRelations.listRelatedDocuments(mainV2.id), []);
  assert.equal(await database.documentBlob.count(), 3);
});
