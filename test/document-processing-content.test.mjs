import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { after } from 'node:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DocumentParserKind, SourceStatus } from '../apps/api/dist/generated/prisma/enums.js';
import { FixtureLocalStorage } from '../apps/api/dist/modules/documents/fixture-local-storage.js';
import { DocumentProcessingContentService } from '../apps/api/dist/modules/jobs/document-processing-content.service.js';

const previousNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'test';
after(() => {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
});

test('worker parses an authorized HTML fixture into versioned cached review excerpts', async () => {
  const documentId = 'c20e3c31-e995-4aec-8d83-7ec4cf59c3f8';
  const bytes = Buffer.from(
    '<!doctype html><html><head><title>Seleção</title></head><body><main><h1>Graduação</h1><p>Seleção própria para ingresso na graduação.</p></main></body></html>',
  );
  const storage = new FixtureLocalStorage(
    join(tmpdir(), 'alem-do-sisu-worker-fixtures', String(process.pid)),
  );
  const stored = await storage.write(bytes);
  const cacheKeys = [];
  const service = new DocumentProcessingContentService(
    {
      document: {
        async findUnique() {
          return {
            id: documentId,
            url: 'fixture://local/candidate/example',
            sha256: stored.sha256,
            storageKey: stored.storageKey,
            mediaType: 'text/html',
            discoveredUrl: {
              canonicalUrl: 'https://www.example.test/selection',
              observations: [
                {
                  source: {
                    status: SourceStatus.ACTIVE,
                    allowedDomain: {
                      host: 'www.example.test',
                      reviewedAt: new Date('2026-01-01T00:00:00.000Z'),
                      collectionAllowed: true,
                    },
                  },
                },
              ],
            },
          };
        },
      },
    },
    {
      async getOrCompute(key, compute) {
        cacheKeys.push(key);
        return { cacheHit: false, result: await compute() };
      },
    },
  );

  try {
    const parsed = await service.parseFixture(documentId, stored.sha256);
    assert.equal(parsed.title, 'Graduação');
    assert.deepEqual(parsed.excerpts, [
      {
        pageOrSection: 'Graduação',
        text: 'Graduação\nSeleção própria para ingresso na graduação.',
      },
    ]);
    assert.equal(cacheKeys.length, 1);
    assert.equal(cacheKeys[0].parserKind, DocumentParserKind.HTML_DOCUMENT);
    assert.equal(cacheKeys[0].sha256, stored.sha256);
  } finally {
    await storage.delete(stored.storageKey);
  }
});

test('worker refuses a fixture when the source host is not actively reviewed', async () => {
  const service = new DocumentProcessingContentService(
    {
      document: {
        async findUnique() {
          return {
            id: 'c20e3c31-e995-4aec-8d83-7ec4cf59c3f8',
            url: 'fixture://local/candidate/example',
            sha256: 'a'.repeat(64),
            storageKey: 'fixtures/sha256/aa/' + 'a'.repeat(64),
            mediaType: 'text/html',
            discoveredUrl: {
              canonicalUrl: 'https://www.example.test/selection',
              observations: [
                {
                  source: {
                    status: SourceStatus.DRAFT,
                    allowedDomain: {
                      host: 'www.example.test',
                      reviewedAt: null,
                      collectionAllowed: false,
                    },
                  },
                },
              ],
            },
          };
        },
      },
    },
    { getOrCompute: async () => assert.fail('unauthorized content must not reach parser cache') },
  );

  await assert.rejects(
    service.parseFixture('c20e3c31-e995-4aec-8d83-7ec4cf59c3f8', 'a'.repeat(64)),
    /no active, reviewed exact-host authorization/u,
  );
});

test('worker parses PDF fixture pages into versioned excerpts without OCR', async () => {
  const documentId = 'c20e3c31-e995-4aec-8d83-7ec4cf59c3f8';
  const bytes = await readFile(
    new URL('./fixtures/documents/pdf/table-schedule.v1.pdf', import.meta.url),
  );
  const storage = new FixtureLocalStorage(
    join(tmpdir(), 'alem-do-sisu-worker-fixtures', String(process.pid)),
  );
  const stored = await storage.write(bytes);
  let cacheKey;
  const service = new DocumentProcessingContentService(
    {
      document: {
        async findUnique() {
          return {
            id: documentId,
            url: 'fixture://local/candidate/pdf',
            sha256: stored.sha256,
            storageKey: stored.storageKey,
            mediaType: 'application/pdf',
            discoveredUrl: {
              canonicalUrl: 'https://www.example.test/notice.pdf',
              observations: [
                {
                  source: {
                    status: SourceStatus.ACTIVE,
                    allowedDomain: {
                      host: 'www.example.test',
                      reviewedAt: new Date('2026-01-01T00:00:00.000Z'),
                      collectionAllowed: true,
                    },
                  },
                },
              ],
            },
          };
        },
      },
    },
    {
      async getOrCompute(key, compute) {
        cacheKey = key;
        return { cacheHit: false, result: await compute() };
      },
    },
  );

  try {
    const parsed = await service.parseFixture(documentId, stored.sha256);
    assert.equal(parsed.excerpts[0].pageOrSection, 'página 1');
    assert.match(parsed.excerpts[0].text, /TABELA DE OFERTAS/u);
    assert.equal(cacheKey.parserKind, DocumentParserKind.PDF_TEXT);
    assert.equal(cacheKey.parserVersion, 1);
  } finally {
    await storage.delete(stored.storageKey);
  }
});
