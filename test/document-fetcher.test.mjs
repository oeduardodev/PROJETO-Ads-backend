import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  HttpFetchError,
  ResponsibleHttpClient,
} from '../apps/api/dist/modules/crawling/http/responsible-http.client.js';
import {
  DocumentFetchError,
  fetchTypedArtifact,
} from '../apps/api/dist/modules/documents/fetch/secure-artifact-fetcher.js';

const host = 'source.example.edu.br';
const agent = 'AlemDoSiSU-Test/1.0';
const capturedAt = new Date('2026-11-05T15:30:00.000Z');

function response(status, body = '', headers = {}) {
  return { status, headers, body: Buffer.isBuffer(body) ? body : Buffer.from(body) };
}

function createClient({
  status = 200,
  body,
  headers = {},
  maxBytes = 1_024 * 1_024,
  robotsStatus = 404,
}) {
  const calls = [];
  const transport = {
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    request: async (url) => {
      calls.push(url.pathname);
      if (url.pathname === '/robots.txt') return response(robotsStatus);
      return response(status, body, headers);
    },
    sleep: async () => undefined,
    random: () => 0,
  };
  const client = new ResponsibleHttpClient({
    allowedHosts: [host],
    collectionAllowed: true,
    userAgent: agent,
    maxBytes,
    transport,
  });
  return { client, calls };
}

test('fetches HTML, fingerprints bytes, and retains source response metadata', async () => {
  const sourceUrl = `https://${host}/notices/index.html#latest`;
  const body = Buffer.from('<!doctype html><html><body>synthetic fixture</body></html>');
  const { client, calls } = createClient({
    body,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      etag: '"revision-1"',
      'last-modified': 'Wed, 04 Nov 2026 10:00:00 GMT',
    },
  });
  const artifact = await fetchTypedArtifact(client, sourceUrl, {
    maxBytes: 1_024,
    capturedAt,
  });

  assert.equal(artifact.sourceUrl, `https://${host}/notices/index.html`);
  assert.equal(artifact.mediaType, 'text/html');
  assert.equal(artifact.sha256, createHash('sha256').update(body).digest('hex'));
  assert.equal(artifact.byteLength, body.length);
  assert.equal(artifact.capturedAt.toISOString(), capturedAt.toISOString());
  assert.equal(artifact.etag, '"revision-1"');
  assert.equal(artifact.lastModified, 'Wed, 04 Nov 2026 10:00:00 GMT');
  assert.deepEqual(artifact.bytes, body);
  assert.deepEqual(calls, ['/robots.txt', '/notices/index.html']);
});

test('detects a PDF by signature even when response MIME is generic', async () => {
  const sourceUrl = `https://${host}/files/notice.pdf?download=1`;
  const body = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
  const { client } = createClient({
    body,
    headers: { 'content-type': 'application/octet-stream' },
  });
  const artifact = await fetchTypedArtifact(client, sourceUrl, { maxBytes: 1_024, capturedAt });

  assert.equal(artifact.mediaType, 'application/pdf');
  assert.equal(artifact.sha256, createHash('sha256').update(body).digest('hex'));
  assert.equal(artifact.sourceUrl, sourceUrl);
});

test('rejects HTML served under a PDF extension with a traceable MIME mismatch', async () => {
  const sourceUrl = `https://${host}/files/notice.pdf`;
  const { client } = createClient({
    body: '<!doctype html><html><body>synthetic error page</body></html>',
    headers: { 'content-type': 'text/html' },
  });

  await assert.rejects(
    fetchTypedArtifact(client, sourceUrl, { maxBytes: 1_024, capturedAt }),
    (error) =>
      error instanceof DocumentFetchError &&
      error.failureCode === 'MIME_MISMATCH' &&
      error.sourceUrl === sourceUrl &&
      error.httpStatus === 200,
  );
});

test('rejects a declared PDF MIME when bytes contain HTML', async () => {
  const sourceUrl = `https://${host}/notices/current`;
  const { client } = createClient({
    body: '<html><body>synthetic content</body></html>',
    headers: { 'content-type': 'application/pdf' },
  });

  await assert.rejects(
    fetchTypedArtifact(client, sourceUrl, { maxBytes: 1_024, capturedAt }),
    (error) => error instanceof DocumentFetchError && error.failureCode === 'MIME_MISMATCH',
  );
});

test('rejects a response above the configured limit with source and status evidence', async () => {
  const sourceUrl = `https://${host}/notices/large.html`;
  const body = Buffer.from(`<!doctype html><html><body>${'x'.repeat(256)}</body></html>`);
  const { client } = createClient({ body, headers: { 'content-type': 'text/html' } });

  await assert.rejects(
    fetchTypedArtifact(client, sourceUrl, { maxBytes: 64, capturedAt }),
    (error) =>
      error instanceof DocumentFetchError &&
      error.failureCode === 'SIZE_LIMIT' &&
      error.sourceUrl === sourceUrl &&
      error.httpStatus === 200,
  );
});

test('maps a robots or HTTP block to a traceable failure without exposing the body', async () => {
  const sourceUrl = `https://${host}/notices/blocked.html`;
  const { client, calls } = createClient({
    status: 403,
    body: '<html>blocked</html>',
    headers: { 'content-type': 'text/html' },
  });

  await assert.rejects(
    fetchTypedArtifact(client, sourceUrl, { maxBytes: 1_024, capturedAt }),
    (error) =>
      error instanceof DocumentFetchError &&
      error.failureCode === 'SOURCE_BLOCKED' &&
      error.sourceUrl === sourceUrl &&
      error.httpStatus === 403 &&
      !error.message.includes('blocked</html>') &&
      error.cause instanceof HttpFetchError,
  );
  assert.deepEqual(calls, ['/robots.txt', '/notices/blocked.html']);
});

test('maps a robots denial to a traceable block without requesting the page', async () => {
  const sourceUrl = `https://${host}/notices/robots-blocked.html`;
  const { client, calls } = createClient({ robotsStatus: 403 });

  await assert.rejects(
    fetchTypedArtifact(client, sourceUrl, { maxBytes: 1_024, capturedAt }),
    (error) =>
      error instanceof DocumentFetchError &&
      error.failureCode === 'SOURCE_BLOCKED' &&
      error.sourceUrl === sourceUrl &&
      error.httpStatus === 403 &&
      error.cause instanceof HttpFetchError,
  );
  assert.deepEqual(calls, ['/robots.txt']);
});

test('invalid source URLs fail without echoing credentials', async () => {
  await assert.rejects(
    fetchTypedArtifact(
      { fetch: async () => assert.fail('must not fetch') },
      'https://user:secret@host.edu.br/a.pdf',
      {
        maxBytes: 1_024,
        capturedAt,
      },
    ),
    (error) =>
      error instanceof DocumentFetchError &&
      error.failureCode === 'INVALID_SOURCE_URL' &&
      !error.message.includes('secret'),
  );
});

test('unknown binary formats and invalid size options are rejected', async () => {
  const sourceUrl = `https://${host}/notices/file.bin`;
  const { client } = createClient({
    body: Buffer.from([0, 1, 2, 3, 4]),
    headers: { 'content-type': 'application/octet-stream' },
  });
  await assert.rejects(
    fetchTypedArtifact(client, sourceUrl, { maxBytes: 1_024, capturedAt }),
    (error) => error instanceof DocumentFetchError && error.failureCode === 'UNSUPPORTED_MEDIA',
  );
  await assert.rejects(
    fetchTypedArtifact(client, sourceUrl, { maxBytes: 0, capturedAt }),
    /maxBytes/,
  );
});
