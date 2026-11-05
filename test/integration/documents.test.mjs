import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PrismaService } from '../../apps/api/dist/database/prisma.service.js';
import { DocumentRelationType } from '../../apps/api/dist/generated/prisma/enums.js';
import { DocumentsRepository } from '../../apps/api/dist/modules/documents/documents.repository.js';
import { FixtureLocalStorage } from '../../apps/api/dist/modules/documents/fixture-local-storage.js';
import { DocumentRelationsRepository } from '../../apps/api/dist/modules/documents/versioning/document-relations.repository.js';

if (!process.env.TEST_DATABASE_URL)
  throw new Error('TEST_DATABASE_URL is required for local integration tests');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';

const database = new PrismaService();
const documents = new DocumentsRepository(database);
const documentRelations = new DocumentRelationsRepository(database);
const fixtureRoot = await mkdtemp(join(tmpdir(), 'ads-snapshot-fixtures-'));
const storage = new FixtureLocalStorage(fixtureRoot);

test.after(async () => database.$disconnect());

test('same bytes keep one hash identity while changed and reverted bytes retain URL versions', async () => {
  const urlA = 'fixture://local/notices/alpha';
  const urlB = 'fixture://local/notices/beta';
  const bytesA = Buffer.from('<html><body>fixture alpha</body></html>');
  const bytesB = Buffer.from('<html><body>fixture revised</body></html>');
  const fixtureDocumentIds = new Set();
  try {
    const first = await documents.recordFixtureSnapshot({
      url: urlA,
      mediaType: 'text/html',
      bytes: bytesA,
      storage,
    });
    fixtureDocumentIds.add(first.id);
    const repeated = await documents.recordFixtureSnapshot({
      url: urlA,
      mediaType: 'text/html',
      bytes: bytesA,
      storage,
    });
    fixtureDocumentIds.add(repeated.id);
    const revised = await documents.recordFixtureSnapshot({
      url: urlA,
      mediaType: 'text/html',
      bytes: bytesB,
      storage,
    });
    fixtureDocumentIds.add(revised.id);
    const otherUrl = await documents.recordFixtureSnapshot({
      url: urlB,
      mediaType: 'text/html',
      bytes: bytesA,
      storage,
    });
    fixtureDocumentIds.add(otherUrl.id);
    const reverted = await documents.recordFixtureSnapshot({
      url: urlA,
      mediaType: 'text/html',
      bytes: bytesA,
      storage,
    });
    fixtureDocumentIds.add(reverted.id);

    const attachment = await documentRelations.linkDocuments({
      originDocumentId: first.id,
      relatedDocumentId: otherUrl.id,
      relationType: DocumentRelationType.ATTACHMENT,
    });
    const repeatedAttachment = await documentRelations.linkDocuments({
      originDocumentId: first.id,
      relatedDocumentId: otherUrl.id,
      relationType: DocumentRelationType.ATTACHMENT,
    });

    assert.equal(first.id, repeated.id);
    assert.deepEqual(
      (await documents.listVersions(urlA)).map((item) => item.version),
      [1, 2, 3],
    );
    assert.equal(revised.version, 2);
    assert.equal(reverted.version, 3);
    assert.equal(otherUrl.version, 1);
    assert.notEqual(first.id, otherUrl.id);
    assert.equal(attachment.id, repeatedAttachment.id);
    assert.deepEqual(
      (await documentRelations.listRelatedDocuments(first.id)).map((relation) => ({
        relatedDocumentId: relation.relatedDocument.id,
        relationType: relation.relationType,
      })),
      [{ relatedDocumentId: otherUrl.id, relationType: DocumentRelationType.ATTACHMENT }],
    );
    assert.deepEqual(await documentRelations.listRelatedDocuments(revised.id), []);
    assert.equal(first.url, urlA);
    assert.equal(first.version, 1);
    assert.equal(first.sha256, createHash('sha256').update(bytesA).digest('hex'));
    assert.equal(first.sha256, otherUrl.sha256);
    assert.equal(first.sha256, reverted.sha256);
    assert.notEqual(first.sha256, revised.sha256);
    assert.equal(first.sha256, createHash('sha256').update(bytesA).digest('hex'));
    assert.deepEqual(await storage.read(first.storageKey), bytesA);
    assert.equal(await database.documentBlob.count(), 2);
    assert.equal(await database.document.count(), 4);

    await assert.rejects(
      documents.recordFixtureSnapshot({
        url: 'https://www.prg.ufpb.br/editais/ingressantes/',
        mediaType: 'text/html',
        bytes: bytesA,
        storage,
      }),
      /reviewed retention policy/iu,
    );
    process.env.NODE_ENV = 'production';
    try {
      assert.throws(() => new FixtureLocalStorage(fixtureRoot), /test directory/iu);
    } finally {
      process.env.NODE_ENV = 'test';
    }
  } finally {
    if (fixtureDocumentIds.size > 0) {
      await database.documentRelation.deleteMany({
        where: {
          OR: [
            { originDocumentId: { in: [...fixtureDocumentIds] } },
            { relatedDocumentId: { in: [...fixtureDocumentIds] } },
          ],
        },
      });
    }
    await database.document.deleteMany({ where: { url: { startsWith: 'fixture://local/' } } });
    await database.documentBlob.deleteMany({ where: { storageKey: { startsWith: 'fixtures/' } } });
  }
});
