import assert from 'node:assert/strict';
import test from 'node:test';
import { SourceKind, SourceStatus } from '../apps/api/dist/generated/prisma/enums.js';
import { SourceRefreshProcessor } from '../apps/api/dist/modules/jobs/source-refresh.processor.js';

const sourceId = 'c7e0ca61-3f26-4b2a-8d0f-6dafc8f40d33';
const host = 'www.prg.ufpb.br';
const indexUrl = `https://${host}/editais/ingressantes/`;
const source = {
  id: sourceId,
  url: indexUrl,
  kind: SourceKind.HTML_INDEX,
  status: SourceStatus.ACTIVE,
  allowedDomain: {
    host,
    collectionAllowed: true,
    reviewedAt: new Date('2026-11-01T00:00:00.000Z'),
  },
};

function makeJob(overrides = {}) {
  return {
    id: 'source-refresh-' + sourceId + '-v42',
    data: { sourceId, scheduleVersion: 42 },
    attemptsMade: 0,
    opts: { attempts: 3 },
    timestamp: 1_794_000_000_000,
    ...overrides,
  };
}

function fixtureProcessor({ currentSource = source, response } = {}) {
  const calls = { requestedUrls: [], httpOptions: [], runs: [], discovered: [], fetched: [] };
  const jobs = {
    enqueueUrlFetch: async (id) => {
      calls.fetched.push(id);
      return { id: 'url-fetch-' + id };
    },
  };
  const processor = new SourceRefreshProcessor(
    { getRefreshContext: async () => currentSource },
    {
      startOrResumeRecord: async (id, idSource, attempt) => {
        calls.runs.push({ id, sourceId: idSource, attempt });
        return { id };
      },
      finishSuccess: async (id, status) => calls.runs.push({ finished: id, status }),
      finishFailure: async (id, code, status) => calls.runs.push({ failed: id, code, status }),
    },
    {
      record: async (candidate) => {
        calls.discovered.push(candidate);
        return {
          id: 'candidate-' + calls.discovered.length,
          status: 'CANDIDATE',
        };
      },
    },
    jobs,
    (options) => {
      calls.httpOptions.push(options);
      return {
        fetch: async (url) => {
          calls.requestedUrls.push(url);
          return response;
        },
      };
    },
    1024 * 1024,
  );
  return { processor, calls };
}

test('source refresh uses only a reviewed exact host and records canonical candidates idempotently', async () => {
  const html = Buffer.from(`
    <html><body>
      <a href="/psig/2027/?utm_source=feed">Processo seletivo para ingresso de graduados 2027</a>
      <a href="/psig/2027/">Processo seletivo para ingresso de graduados 2027</a>
      <a href="https://drive.ufpb.br/edital.pdf">Edital de graduação</a>
      <a href="/sisu/">SiSU regular</a>
    </body></html>`);
  const { processor, calls } = fixtureProcessor({
    response: {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: html,
    },
  });

  const result = await processor.process(makeJob());

  assert.deepEqual(result, { status: 'SUCCEEDED', discovered: 1 });
  assert.deepEqual(calls.requestedUrls, [indexUrl]);
  assert.deepEqual(calls.httpOptions[0].allowedHosts, [host]);
  assert.equal(calls.httpOptions[0].collectionAllowed, true);
  assert.equal(calls.runs[0].attempt, 1);
  assert.equal(calls.runs[0].id, calls.runs[1].finished);
  assert.deepEqual(
    calls.discovered.map(({ url }) => url),
    [`https://${host}/psig/2027/`],
  );
  assert.equal(calls.discovered[0].crawlRunId, calls.runs[0].id);
  assert.equal(calls.fetched.length, 1);
});

test('source refresh does not request or create a crawl run for a source awaiting review', async () => {
  const { processor, calls } = fixtureProcessor({
    currentSource: {
      ...source,
      status: SourceStatus.DRAFT,
      allowedDomain: { ...source.allowedDomain, collectionAllowed: false, reviewedAt: null },
    },
    response: undefined,
  });

  const result = await processor.process(makeJob());

  assert.deepEqual(result, { status: 'SKIPPED_POLICY', discovered: 0 });
  assert.deepEqual(calls.requestedUrls, []);
  assert.deepEqual(calls.runs, []);
});

test('source refresh reuses the same crawl run ID on a retried queue job', async () => {
  const { processor, calls } = fixtureProcessor({
    response: {
      status: 200,
      headers: { 'content-type': 'text/html' },
      body: Buffer.from('<html><body><main>No links in this synthetic index.</main></body></html>'),
    },
  });

  await processor.process(makeJob());
  await processor.process(makeJob({ attemptsMade: 1 }));

  assert.equal(calls.runs[0].id, calls.runs[2].id);
  assert.equal(calls.runs[0].attempt, 1);
  assert.equal(calls.runs[2].attempt, 2);
});
