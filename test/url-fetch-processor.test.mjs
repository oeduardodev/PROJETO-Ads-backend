import assert from 'node:assert/strict';
import test from 'node:test';
import { SourceStatus, DiscoveredUrlStatus } from '../apps/api/dist/generated/prisma/enums.js';
import { UrlFetchProcessor } from '../apps/api/dist/modules/jobs/url-fetch.processor.js';

const candidateId = '10000000-0000-4000-8000-000000000001';
const documentId = '20000000-0000-4000-8000-000000000002';

function context(overrides = {}) {
  return {
    id: candidateId,
    canonicalUrl: 'https://www.example.test/ingresso/edital.pdf',
    status: DiscoveredUrlStatus.CANDIDATE,
    observations: [
      {
        source: {
          status: SourceStatus.ACTIVE,
          allowedDomain: {
            host: 'www.example.test',
            reviewedAt: new Date('2026-01-01T00:00:00Z'),
            collectionAllowed: true,
          },
        },
      },
    ],
    ...overrides,
  };
}

function processor(candidate, trace) {
  return new UrlFetchProcessor(
    { getFetchContext: async () => candidate },
    {
      recordFixtureSnapshot: async (input) => {
        trace.snapshot = input;
        return { id: documentId, sha256: 'a'.repeat(64) };
      },
    },
    { enqueueDocumentClassify: async (...args) => trace.classify.push(args) },
    (options) => {
      trace.options = options;
      return {
        fetch: async (url) => {
          trace.fetches.push(url);
          return {
            status: 200,
            headers: { 'content-type': 'application/pdf' },
            body: Buffer.from('%PDF-1.7 fixture'),
          };
        },
      };
    },
    1024 * 1024,
  );
}

test('URL fetch accepts only exact-host observations from an active reviewed source', async () => {
  const priorNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const trace = { fetches: [], classify: [] };
  const candidate = context({
    observations: [
      {
        source: {
          status: SourceStatus.ACTIVE,
          allowedDomain: {
            host: 'example.test',
            reviewedAt: new Date(),
            collectionAllowed: true,
          },
        },
      },
    ],
  });
  try {
    const result = await processor(candidate, trace).process({
      data: { candidateUrlId: candidateId },
    });
    assert.deepEqual(result, { status: 'SKIPPED_POLICY' });
    assert.deepEqual(trace.fetches, []);
  } finally {
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = priorNodeEnv;
  }
});

test('official bytes are not fetched before a production storage and retention review', async () => {
  const priorNodeEnv = process.env.NODE_ENV;
  delete process.env.NODE_ENV;
  const trace = { fetches: [], classify: [] };
  try {
    const candidate = context({
      canonicalUrl: 'https://www.university.edu.br/ingresso/edital.pdf',
      observations: [
        {
          source: {
            status: SourceStatus.ACTIVE,
            allowedDomain: {
              host: 'www.university.edu.br',
              reviewedAt: new Date(),
              collectionAllowed: true,
            },
          },
        },
      ],
    });
    const result = await processor(candidate, trace).process({
      data: { candidateUrlId: candidateId },
    });
    assert.deepEqual(result, { status: 'BLOCKED_STORAGE_REVIEW' });
    assert.deepEqual(trace.fetches, []);
  } finally {
    if (priorNodeEnv !== undefined) process.env.NODE_ENV = priorNodeEnv;
  }
});

test('test mode refuses non-reserved hosts before calling the HTTP client', async () => {
  const priorNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const trace = { fetches: [], classify: [] };
  try {
    const candidate = context({
      canonicalUrl: 'https://www.university.edu.br/notice.pdf',
      observations: [
        {
          source: {
            status: SourceStatus.ACTIVE,
            allowedDomain: {
              host: 'www.university.edu.br',
              reviewedAt: new Date(),
              collectionAllowed: true,
            },
          },
        },
      ],
    });
    const result = await processor(candidate, trace).process({
      data: { candidateUrlId: candidateId },
    });
    assert.deepEqual(result, { status: 'BLOCKED_NON_FIXTURE_HOST' });
    assert.deepEqual(trace.fetches, []);
  } finally {
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = priorNodeEnv;
  }
});

test('authorized fixture fetch records only local test bytes and enqueues classification', async () => {
  const priorNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const trace = { fetches: [], classify: [] };
  try {
    const result = await processor(context(), trace).process({
      data: { candidateUrlId: candidateId },
    });
    assert.deepEqual(result, { status: 'SNAPSHOTTED_FIXTURE', documentId });
    assert.deepEqual(trace.fetches, ['https://www.example.test/ingresso/edital.pdf']);
    assert.deepEqual(trace.classify, [[documentId, 'a'.repeat(64)]]);
    assert.equal(trace.snapshot.url, `fixture://local/candidate/${candidateId}`);
    assert.equal(trace.snapshot.discoveredUrlId, candidateId);
    assert.equal(trace.snapshot.mediaType, 'application/pdf');
    assert.equal(trace.snapshot.bytes.toString(), '%PDF-1.7 fixture');
  } finally {
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = priorNodeEnv;
  }
});

test('non-candidate discovery records do not trigger downloads', async () => {
  const priorNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const trace = { fetches: [], classify: [] };
  try {
    const result = await processor(context({ status: DiscoveredUrlStatus.IGNORED }), trace).process(
      { data: { candidateUrlId: candidateId } },
    );
    assert.deepEqual(result, { status: 'SKIPPED_NOT_CANDIDATE' });
    assert.deepEqual(trace.fetches, []);
  } finally {
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = priorNodeEnv;
  }
});
