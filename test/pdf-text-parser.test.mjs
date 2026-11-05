import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  PdfParseError,
  parsePdfText,
} from '../apps/api/dist/modules/documents/parsers/pdf/pdf-text.parser.js';

const fixture = await readFile(
  new URL('./fixtures/documents/pdf/table-schedule.v1.pdf', import.meta.url),
);
const limits = { maxBytes: 10_000, maxPages: 5, maxTextItemsPerPage: 100 };

test('preserves page references, table columns, timeline rows, and section candidates', async () => {
  const parsed = await parsePdfText(fixture, limits);

  assert.equal(parsed.pageCount, 3);
  assert.deepEqual(
    parsed.pages.map((page) => page.pageNumber),
    [1, 2, 3],
  );
  assert.deepEqual(
    parsed.pages[0].lines.map((line) => line.text),
    [
      'TABELA DE OFERTAS',
      'Curso  Campus  Vagas',
      'Matematica  Joao Pessoa  20',
      'Fisica  Sousa  12',
      'CRONOGRAMA',
      'Etapa  Inicio  Fim',
      'Inscricao  01/03/2027  10/03/2027',
      'Resultado  20/03/2027  20/03/2027',
    ],
  );
  assert.deepEqual(parsed.pages[0].sectionCandidates, [
    { title: 'TABELA DE OFERTAS', lineNumber: 1 },
    { title: 'CRONOGRAMA', lineNumber: 5 },
  ]);
  assert.deepEqual(parsed.pages[1].sectionCandidates, [{ title: 'ANEXO A', lineNumber: 1 }]);
  assert.equal(parsed.pages[1].text, 'ANEXO A\nPrazo de recurso  21/03/2027');

  const offerSegments = parsed.pages[0].lines[2].segments;
  assert.deepEqual(
    offerSegments.map((segment) => segment.text),
    ['Matematica', 'Joao Pessoa', '20'],
  );
  assert.ok(offerSegments[0].x < offerSegments[1].x);
  assert.ok(offerSegments[1].x < offerSegments[2].x);
  assert.equal(parsed.pages[0].rotationDegrees, 0);
  assert.equal(parsed.pages[0].quality.hasTextLayer, true);
  assert.equal(parsed.pages[2].quality.hasTextLayer, false);
  assert.equal(parsed.pages[2].text, '');
  assert.equal(parsed.quality.pagesWithoutText, 1);
  assert.equal(parsed.quality.replacementCharacters, 0);
});

test('enforces byte, page, and text item limits without returning partial evidence', async () => {
  for (const [limitName, value, failureCode, pageNumber] of [
    ['maxBytes', fixture.length - 1, 'BYTE_LIMIT', undefined],
    ['maxPages', 2, 'PAGE_LIMIT', undefined],
    ['maxTextItemsPerPage', 10, 'TEXT_ITEM_LIMIT', 1],
  ]) {
    await assert.rejects(
      () => parsePdfText(fixture, { ...limits, [limitName]: value }),
      (error) =>
        error instanceof PdfParseError &&
        error.failureCode === failureCode &&
        error.pageNumber === pageNumber,
    );
  }
});

test('rejects malformed PDF bytes without exposing their content in the error', async () => {
  const marker = 'PRIVATE_SYNTHETIC_MARKER';
  await assert.rejects(
    () => parsePdfText(Buffer.from(`%PDF-1.7\n${marker}`), limits),
    (error) =>
      error instanceof PdfParseError &&
      error.failureCode === 'PARSE_FAILED' &&
      !error.message.includes(marker),
  );
});
