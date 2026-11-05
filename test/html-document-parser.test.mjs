import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { normalizeHtmlDocument } from '../apps/api/dist/modules/documents/parsers/html/html-document.parser.js';

const html = await readFile(
  new URL('./fixtures/documents/html/long-menu.v1.html', import.meta.url),
  'utf8',
);
const sourceUrl = 'https://source.example.org/admissao/selecoes#topo';
const allowedHosts = ['source.example.org', 'files.example.org'];

test('removes long navigation and footer while retaining notice context and official link candidates', () => {
  const result = normalizeHtmlDocument(html, sourceUrl, allowedHosts, 100_000);

  assert.equal(result.sourceUrl, 'https://source.example.org/admissao/selecoes');
  assert.equal(result.title, 'Página sintética de ingresso');
  assert.deepEqual(
    result.sections.map((section) => section.heading),
    ['Página sintética de ingresso', 'Cronograma', 'Documentos'],
  );
  assert.equal(result.sections[0].headingLevel, 1);
  assert.equal(result.sections[1].headingLevel, 2);
  assert.match(result.text, /Exemplo de teste sem edital real ou prazo confirmado/u);
  assert.match(result.text, /Etapa \| Situação\nInscrição \| Consultar anexo/u);
  assert.match(result.text, /Atualização editorial sintética para contexto do artigo/u);
  assert.doesNotMatch(
    result.text,
    /Menu 01|Menu 30|Rodapé institucional|Notícias relacionadas|Não extrair o script/u,
  );
  assert.deepEqual(result.documentLinks, [
    {
      url: 'https://source.example.org/docs/anexo-i.pdf?download=1',
      label: 'Anexo I — cronograma',
      sectionHeading: 'Cronograma',
      kindHint: 'ANNEX',
    },
    {
      url: 'https://files.example.org/docs/anexo-ii.pdf',
      label: 'Anexo II — tabela',
      sectionHeading: 'Documentos',
      kindHint: 'ANNEX',
    },
  ]);
});

test('rejects oversized HTML and a source host outside the exact-host allowlist', () => {
  assert.throws(
    () => normalizeHtmlDocument(html, sourceUrl, allowedHosts, html.length - 1),
    /input character limit/u,
  );
  assert.throws(
    () => normalizeHtmlDocument(html, sourceUrl, ['files.example.org'], 100_000),
    /exact-host allowlist/u,
  );
});
