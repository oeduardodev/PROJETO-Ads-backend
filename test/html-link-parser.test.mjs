import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseHtmlLinkCandidates } from '../apps/api/dist/modules/discovery/parsers/html-link.parser.js';

const html = readFileSync(new URL('./fixtures/discovery/links.html', import.meta.url), 'utf8');
const sourceUrl = 'https://source.example.edu.br/notices/index.html';

test('resolves relative links, deduplicates canonical tracking variants, and retains provenance', () => {
  const candidates = parseHtmlLinkCandidates(html, sourceUrl, ['source.example.edu.br']);

  assert.equal(candidates.length, 3);
  assert.deepEqual(
    candidates.map((candidate) => candidate.canonicalUrl),
    [
      'https://source.example.edu.br/edital?id=42',
      'https://source.example.edu.br/vestibular/transferencia-externa?campus=joao-pessoa',
      'https://source.example.edu.br/sisu',
    ],
  );
  assert.equal(candidates[0].sourceUrl, sourceUrl);
  assert.equal(
    candidates[0].anchorText,
    'Processo seletivo específico para ingresso em bacharelado',
  );
  assert.equal(candidates[0].relevanceScore, 0.5);
  assert.equal(candidates[1].relevanceScore, 0.25);
  assert.equal(candidates[2].relevanceScore, 0);
  assert.equal(
    candidates.some((candidate) => candidate.canonicalUrl.includes('tecnico-integrado')),
    false,
  );
  assert.equal(
    candidates.some((candidate) => candidate.canonicalUrl.endsWith('/sisu-regular')),
    false,
  );
  assert.equal(
    candidates.some((candidate) => candidate.canonicalUrl.endsWith('/pos-graduacao')),
    false,
  );
});

test('requires an authorized exact source host and never follows a non-allowlisted host', () => {
  assert.throws(
    () => parseHtmlLinkCandidates(html, sourceUrl, ['www.source.example.edu.br']),
    /Source host is not in the exact-host allowlist/u,
  );
  const candidates = parseHtmlLinkCandidates(html, sourceUrl, ['source.example.edu.br']);
  assert.equal(
    candidates.some((candidate) => candidate.canonicalUrl.includes('www.source.example.edu.br')),
    false,
  );
});

test('rejects unsafe or malformed source URLs', () => {
  for (const url of [
    'http://source.example.edu.br/notices',
    'https://user:pass@source.example.edu.br/notices',
    'https://source.example.edu.br:8443/notices',
  ]) {
    assert.throws(() => parseHtmlLinkCandidates(html, url, ['source.example.edu.br']));
  }
});
