import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DocumentParserKind } from '../../apps/api/dist/generated/prisma/enums.js';
import { ResponsibleHttpClient } from '../../apps/api/dist/modules/crawling/http/responsible-http.client.js';
import {
  DocumentFetchError,
  fetchTypedArtifact,
} from '../../apps/api/dist/modules/documents/fetch/secure-artifact-fetcher.js';
import { FixtureLocalStorage } from '../../apps/api/dist/modules/documents/fixture-local-storage.js';
import {
  HTML_DOCUMENT_PARSER_VERSION,
  normalizeHtmlDocument,
} from '../../apps/api/dist/modules/documents/parsers/html/html-document.parser.js';
import {
  PDF_TEXT_PARSER_VERSION,
  parsePdfText,
  PdfParseError,
} from '../../apps/api/dist/modules/documents/parsers/pdf/pdf-text.parser.js';
import { ParserCacheRepository } from '../../apps/api/dist/modules/documents/cache/parser-cache.repository.js';
import { DocumentsRepository } from '../../apps/api/dist/modules/documents/documents.repository.js';

const sourceHost = 'source.example.org';
const allowedHosts = [sourceHost, 'files.example.org'];
const sourceUrl = `https://${sourceHost}/admissao/selecoes#topo`;
const fixtureHtmlUrl = 'fixture://local/ingestion/source-html';
const fixturePdfUrl = 'fixture://local/ingestion/annex-pdf';
const capturedAt = new Date('2026-11-05T15:30:00.000Z');
const htmlBytes = await readFile(
  new URL('../fixtures/documents/html/long-menu.v1.html', import.meta.url),
);
const pdfBytes = await readFile(
  new URL('../fixtures/documents/pdf/table-schedule.v1.pdf', import.meta.url),
);
const corruptPdfBytes = Buffer.from('%PDF-1.7\nPRIVATE_SYNTHETIC_CORRUPT_FIXTURE');

function response(status, body = Buffer.alloc(0), contentType) {
  return {
    status,
    headers: { 'content-type': contentType },
    body: Buffer.from(body),
  };
}

function createFixtureTransport() {
  const requests = [];
  const routes = new Map([
    [`${sourceHost}/admissao/selecoes`, response(200, htmlBytes, 'text/html; charset=utf-8')],
    [`${sourceHost}/docs/anexo-i.pdf`, response(200, pdfBytes, 'application/pdf')],
    [`${sourceHost}/notices/mismatch.pdf`, response(200, htmlBytes, 'text/html')],
    ['files.example.org/docs/corrupt.pdf', response(200, corruptPdfBytes, 'application/pdf')],
  ]);
  const transport = {
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    request: async (url) => {
      requests.push(`${url.host}${url.pathname}`);
      if (url.pathname === '/robots.txt') return response(404);
      const fixture = routes.get(`${url.host}${url.pathname}`);
      if (!fixture) throw new Error('Offline transport has no fixture for this URL');
      return response(fixture.status, fixture.body, fixture.headers['content-type']);
    },
    sleep: async () => undefined,
    random: () => 0,
  };
  const client = new ResponsibleHttpClient({
    allowedHosts,
    collectionAllowed: true,
    userAgent: 'AlemDoSiSU-Offline-Replay/1.0',
    maxBytes: 1024 * 1024,
    transport,
  });
  return { client, requests };
}

function createMemoryDatabase() {
  const blobs = new Map();
  const documents = [];
  const parserCache = new Map();
  const database = {
    $transaction: async (operation) => operation(database),
    $queryRaw: async (_strings, sha256) =>
      blobs.has(sha256) ? [{ expiredAt: blobs.get(sha256).expiredAt }] : [],
    documentBlob: {
      upsert: async ({ where, create, update }) => {
        if (!blobs.has(where.sha256)) blobs.set(where.sha256, { ...create });
        else Object.assign(blobs.get(where.sha256), update);
        return blobs.get(where.sha256);
      },
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
    documentParseCache: {
      findUnique: async ({ where }) => {
        const key = where.sha256_parserKind_parserVersion;
        return parserCache.get(`${key.sha256}|${key.parserKind}|${key.parserVersion}`) ?? null;
      },
      upsert: async ({ where, create }) => {
        const identity = where.sha256_parserKind_parserVersion;
        const key = `${identity.sha256}|${identity.parserKind}|${identity.parserVersion}`;
        if (!parserCache.has(key)) parserCache.set(key, { ...create });
        return parserCache.get(key);
      },
    },
  };
  return { database, blobs, documents, parserCache };
}

function failureCategory(error) {
  if (error instanceof DocumentFetchError) return `fetch.${error.failureCode}`;
  if (error instanceof PdfParseError) return `pdf.${error.failureCode}`;
  return 'other.UNKNOWN';
}

test('offline fixture replay fetches, snapshots, parses, caches, and measures failures', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ads-ingestion-replay-'));
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  try {
    const { client, requests } = createFixtureTransport();
    const { database, blobs, documents, parserCache } = createMemoryDatabase();
    const storage = new FixtureLocalStorage(root);
    const snapshots = new DocumentsRepository(database);
    const cache = new ParserCacheRepository(database);
    const failuresByCategory = {};
    const parserCalls = { html: 0, pdf: 0 };

    async function measured(operation) {
      try {
        return { result: await operation(), error: null };
      } catch (error) {
        const category = failureCategory(error);
        failuresByCategory[category] = (failuresByCategory[category] ?? 0) + 1;
        return { result: null, error };
      }
    }

    async function replay() {
      const htmlArtifact = await fetchTypedArtifact(client, sourceUrl, {
        maxBytes: 1024 * 1024,
        capturedAt,
      });
      const htmlDocument = await snapshots.recordFixtureSnapshot({
        url: fixtureHtmlUrl,
        mediaType: htmlArtifact.mediaType,
        bytes: htmlArtifact.bytes,
        storage,
      });
      const htmlResult = await cache.getOrCompute(
        {
          sha256: htmlArtifact.sha256,
          parserKind: DocumentParserKind.HTML_DOCUMENT,
          parserVersion: HTML_DOCUMENT_PARSER_VERSION,
        },
        async () => {
          parserCalls.html += 1;
          return normalizeHtmlDocument(
            htmlArtifact.bytes.toString('utf8'),
            htmlArtifact.sourceUrl,
            allowedHosts,
            1_000_000,
          );
        },
      );
      const pdfUrl = htmlResult.result.documentLinks.find(
        (link) => new URL(link.url).host === sourceHost,
      )?.url;
      assert.ok(pdfUrl, 'fixture HTML should provide an authorized PDF candidate');

      const pdfArtifact = await fetchTypedArtifact(client, pdfUrl, {
        maxBytes: 1024 * 1024,
        capturedAt,
      });
      const pdfDocument = await snapshots.recordFixtureSnapshot({
        url: fixturePdfUrl,
        mediaType: pdfArtifact.mediaType,
        bytes: pdfArtifact.bytes,
        storage,
      });
      const pdfResult = await cache.getOrCompute(
        {
          sha256: pdfArtifact.sha256,
          parserKind: DocumentParserKind.PDF_TEXT,
          parserVersion: PDF_TEXT_PARSER_VERSION,
        },
        async () => {
          parserCalls.pdf += 1;
          return parsePdfText(pdfArtifact.bytes, {
            maxBytes: 1024 * 1024,
            maxPages: 5,
            maxTextItemsPerPage: 100,
          });
        },
      );

      return {
        html: {
          sha256: htmlArtifact.sha256,
          document: htmlDocument,
          parsed: htmlResult.result,
          cacheHit: htmlResult.cacheHit,
        },
        pdf: {
          sha256: pdfArtifact.sha256,
          document: pdfDocument,
          parsed: pdfResult.result,
          cacheHit: pdfResult.cacheHit,
        },
      };
    }

    const first = await replay();
    const replayed = await replay();
    for (const kind of ['html', 'pdf']) {
      assert.equal(first[kind].document.id, replayed[kind].document.id);
      assert.equal(first[kind].document.version, 1);
      assert.equal(first[kind].document.sha256, first[kind].sha256);
      assert.equal(replayed[kind].sha256, first[kind].sha256);
      assert.equal(first[kind].cacheHit, false);
      assert.equal(replayed[kind].cacheHit, true);
      assert.equal(
        first[kind].sha256,
        createHash('sha256')
          .update(kind === 'html' ? htmlBytes : pdfBytes)
          .digest('hex'),
      );
    }
    assert.match(first.html.parsed.text, /Exemplo de teste sem edital real/u);
    assert.match(first.pdf.parsed.pages[0].text, /TABELA DE OFERTAS/u);
    assert.equal(parserCalls.html, 1);
    assert.equal(parserCalls.pdf, 1);
    assert.equal(documents.length, 2);
    assert.equal(blobs.size, 2);
    assert.equal(parserCache.size, 2);
    assert.deepEqual(await storage.read(first.html.document.storageKey), htmlBytes);
    assert.deepEqual(await storage.read(first.pdf.document.storageKey), pdfBytes);

    const mismatch = await measured(() =>
      fetchTypedArtifact(client, `https://${sourceHost}/notices/mismatch.pdf`, {
        maxBytes: 1024 * 1024,
        capturedAt,
      }),
    );
    assert.ok(mismatch.error instanceof DocumentFetchError);
    assert.equal(mismatch.error.failureCode, 'MIME_MISMATCH');

    const corruptArtifact = await fetchTypedArtifact(
      client,
      'https://files.example.org/docs/corrupt.pdf',
      { maxBytes: 1024 * 1024, capturedAt },
    );
    const corrupt = await measured(() =>
      parsePdfText(corruptArtifact.bytes, {
        maxBytes: 1024 * 1024,
        maxPages: 5,
        maxTextItemsPerPage: 100,
      }),
    );
    assert.ok(corrupt.error instanceof PdfParseError);
    assert.equal(corrupt.error.failureCode, 'PARSE_FAILED');
    assert.deepEqual(failuresByCategory, {
      'fetch.MIME_MISMATCH': 1,
      'pdf.PARSE_FAILED': 1,
    });
    assert.ok(
      requests.every((request) => allowedHosts.some((host) => request.startsWith(`${host}/`))),
    );
    assert.ok(requests.includes(`${sourceHost}/admissao/selecoes`));
    assert.ok(requests.includes(`${sourceHost}/docs/anexo-i.pdf`));
    assert.ok(requests.includes('files.example.org/docs/corrupt.pdf'));
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    await rm(root, { recursive: true, force: true });
  }
});
