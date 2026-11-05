import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { enqueueOcrFallback } from '../apps/api/dist/modules/documents/ocr/ocr-admission.js';
import {
  OCR_PIPELINE_VERSION,
  RedisOcrBudgetStore,
  ocrBudgetKeys,
  validateOcrPageIdentity,
} from '../apps/api/dist/modules/documents/ocr/ocr-budget.store.js';
import { findOcrCandidatePages } from '../apps/api/dist/modules/documents/ocr/ocr-eligibility.js';
import {
  OcrRecognitionError,
  recognizePdfPage,
} from '../apps/api/dist/modules/documents/ocr/ocr-recognizer.js';
import { parsePdfText } from '../apps/api/dist/modules/documents/parsers/pdf/pdf-text.parser.js';

const scannedPdf = await readFile(
  new URL('./fixtures/documents/pdf/scanned-text.v1.pdf', import.meta.url),
);
const scannedSixPagesPdf = await readFile(
  new URL('./fixtures/documents/pdf/scanned-six-pages.v1.pdf', import.meta.url),
);
const textualPdf = await readFile(
  new URL('./fixtures/documents/pdf/table-schedule.v1.pdf', import.meta.url),
);
const scanLimits = { maxBytes: 10 * 1024 * 1024, maxPages: 10, maxTextItemsPerPage: 100 };
const documentId = '80fc8a31-cf6f-4d81-9a4a-f86af0aad456';
const sha256 = 'a'.repeat(64);
const now = new Date('2026-11-05T23:59:59.000Z');

test('recognizes a synthetic scanned Portuguese page with the packaged local model', async () => {
  const parsed = await parsePdfText(scannedPdf, scanLimits);
  assert.equal(parsed.pageCount, 1);
  assert.equal(parsed.pages[0].quality.usefulCharacters, 0);
  assert.deepEqual(await findOcrCandidatePages(scannedPdf, parsed), [1]);

  const result = await recognizePdfPage(scannedPdf, 1, {
    maxBytes: scanLimits.maxBytes,
    maxPages: scanLimits.maxPages,
  });
  assert.match(result.text, /TESTE OCR SINTETICO/u);
  assert.match(result.text, /PAGINA ESCANEADA/u);
  assert.equal(result.pageNumber, 1);
  assert.equal(result.language, 'por');
  assert.equal(result.engine, 'tesseract.js');
  assert.ok(Number.isFinite(result.confidence));
  assert.equal(result.pipelineVersion, OCR_PIPELINE_VERSION);
});

test('textual PDF pages and blank non-image pages do not become OCR candidates', async () => {
  const parsed = await parsePdfText(textualPdf, {
    maxBytes: 10_000,
    maxPages: 5,
    maxTextItemsPerPage: 100,
  });
  assert.equal(parsed.pages[0].quality.usefulCharacters > 40, true);
  assert.equal(parsed.pages[2].quality.usefulCharacters, 0);
  assert.deepEqual(await findOcrCandidatePages(textualPdf, parsed), []);

  let enqueued = 0;
  const admission = await enqueueOcrFallback(
    textualPdf,
    parsed,
    documentId,
    sha256,
    { tryReserve: async () => 'NEW' },
    {
      enqueueDocumentOcr: async () => {
        enqueued += 1;
      },
    },
    { dailyPageBudget: 10, maxPagesPerDocument: 5 },
  );
  assert.deepEqual(admission.candidatePages, []);
  assert.equal(enqueued, 0);
});

test('default zero budget defers OCR without reserving a page or creating a job', async () => {
  const parsed = await parsePdfText(scannedPdf, scanLimits);
  let reservations = 0;
  let enqueued = 0;
  const admission = await enqueueOcrFallback(
    scannedPdf,
    parsed,
    documentId,
    sha256,
    {
      tryReserve: async () => {
        reservations += 1;
        return 'NEW';
      },
    },
    {
      enqueueDocumentOcr: async () => {
        enqueued += 1;
      },
    },
    { dailyPageBudget: 0, maxPagesPerDocument: 5 },
  );
  assert.deepEqual(admission.candidatePages, [1]);
  assert.deepEqual(admission.queuedPages, []);
  assert.deepEqual(admission.budgetDeferredPages, [1]);
  assert.equal(reservations, 0);
  assert.equal(enqueued, 0);
});

test('page cap, budget result, and stable page identity govern OCR queue admission', async () => {
  const parsed = await parsePdfText(scannedSixPagesPdf, scanLimits);
  const enqueued = [];
  const admissions = [];
  const admission = await enqueueOcrFallback(
    scannedSixPagesPdf,
    parsed,
    documentId,
    sha256,
    {
      tryReserve: async (identity, dailyPageBudget, reservationDate) => {
        admissions.push({ identity, dailyPageBudget, reservationDate });
        return identity.pageNumber === 2 ? 'EXHAUSTED' : 'NEW';
      },
    },
    {
      enqueueDocumentOcr: async (identity) => {
        enqueued.push(identity);
      },
    },
    { dailyPageBudget: 20, maxPagesPerDocument: 5, now },
  );
  assert.deepEqual(admission.candidatePages, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(admission.queuedPages, [1, 3, 4, 5]);
  assert.deepEqual(admission.budgetDeferredPages, [2]);
  assert.deepEqual(admission.pageLimitSkipped, [6]);
  assert.deepEqual(
    enqueued.map(({ pageNumber }) => pageNumber),
    [1, 3, 4, 5],
  );
  assert.equal(admissions.length, 5);
  assert.ok(
    admissions.every((entry) => entry.dailyPageBudget === 20 && entry.reservationDate === now),
  );
  assert.ok(enqueued.every((identity) => identity.pipelineVersion === OCR_PIPELINE_VERSION));
});

test('Redis budget keys use UTC day and reserve duplicate page identity only once', async () => {
  const identity = validateOcrPageIdentity({
    documentId: documentId.toUpperCase(),
    sha256: sha256.toUpperCase(),
    pageNumber: 3,
    pipelineVersion: OCR_PIPELINE_VERSION,
  });
  const keys = ocrBudgetKeys(identity, new Date('2026-11-06T02:59:00.000Z'));
  assert.equal(keys.daily, 'alem-do-sisu:ocr:pages:2026-11-06');
  assert.equal(keys.reservation, `alem-do-sisu:ocr:reserved:${documentId}:${sha256}:p3:v1`);
  assert.equal(keys.nextMidnightSeconds, Date.parse('2026-11-07T00:00:00.000Z') / 1_000);

  const evalCalls = [];
  const responses = [1, 2, 0];
  const store = new RedisOcrBudgetStore({
    eval: async (...args) => {
      evalCalls.push(args);
      return responses.shift();
    },
  });
  assert.equal(await store.tryReserve(identity, 4, now), 'NEW');
  assert.equal(await store.tryReserve(identity, 4, now), 'EXISTING');
  assert.equal(await store.tryReserve(identity, 4, now), 'EXHAUSTED');
  assert.equal(evalCalls.length, 3);
  assert.equal(await store.tryReserve(identity, 0, now), 'EXHAUSTED');
  assert.equal(evalCalls.length, 3);
});

test('OCR rejects oversized files and pages before recognition', async () => {
  await assert.rejects(
    () => recognizePdfPage(scannedPdf, 1, { maxBytes: scannedPdf.length - 1, maxPages: 10 }),
    (error) => error instanceof OcrRecognitionError && error.failureCode === 'BYTE_LIMIT',
  );
  await assert.rejects(
    () =>
      recognizePdfPage(scannedPdf, 1, {
        maxBytes: 10 * 1024 * 1024,
        maxPages: 10,
        maxPixelsPerPage: 1,
      }),
    (error) => error instanceof OcrRecognitionError && error.failureCode === 'PIXEL_LIMIT',
  );
  await assert.rejects(
    () =>
      recognizePdfPage(scannedPdf, 1, {
        maxBytes: 10 * 1024 * 1024,
        maxPages: 10,
        timeoutMs: 1,
      }),
    (error) => error instanceof OcrRecognitionError && error.failureCode === 'TIMEOUT',
  );
});
