import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  getPilotHtmlConnector,
  parseInstitutionIndexHtml,
  PILOT_HTML_CONNECTORS,
} from '../apps/api/dist/modules/discovery/connectors/institution-connectors.js';

function csvRows(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
    .trim()
    .split(/\r?\n/u)
    .slice(1)
    .map((line) => line.split(','));
}

const sourceMatrix = new Map(
  csvRows('../docs/research/source-matrix.csv').map(([institution, sourceUrl, exactHost]) => [
    institution,
    { sourceUrl, exactHost },
  ]),
);
const manifestUrls = new Map(
  csvRows('./fixtures/institutions/candidate-manifest.csv').reduce(
    (entries, [, institution, url]) => {
      const current = entries.get(institution) ?? new Set();
      current.add(url);
      entries.set(institution, current);
      return entries;
    },
    new Map(),
  ),
);

test('UFPB and UFCG connector configs match reviewed URLs and remain disabled pending source review', () => {
  assert.deepEqual(
    PILOT_HTML_CONNECTORS.map((connector) => connector.institutionCode),
    ['UFPB', 'UFCG'],
  );

  for (const connector of PILOT_HTML_CONNECTORS) {
    const reviewed = sourceMatrix.get(connector.institutionCode);
    assert.ok(reviewed);
    assert.equal(connector.sourceUrl, reviewed.sourceUrl);
    assert.equal(connector.exactHost, reviewed.exactHost);
    assert.equal(connector.sourceKind, 'HTML_INDEX');
    assert.equal(connector.selector, 'a[href]');
    assert.equal(connector.frequencyMinutes, 1440);
    assert.equal(connector.sourceStatus, 'DRAFT');
    assert.equal(connector.collectionAllowed, false);
    assert.equal(connector.permissionStatus, 'PENDING_REVIEW');
  }
});

test('versioned UFPB fixture yields only reviewed URLs on the exact configured host', () => {
  const html = readFileSync(
    new URL('./fixtures/institutions/ufpb/index.v1.html', import.meta.url),
    'utf8',
  );
  const connector = getPilotHtmlConnector('UFPB');
  const candidates = parseInstitutionIndexHtml('UFPB', html);
  const knownUrls = manifestUrls.get('UFPB');

  assert.equal(candidates.length, 3);
  assert.deepEqual(
    candidates.map((candidate) => candidate.canonicalUrl),
    [
      'https://www.prg.ufpb.br/edital/processo-seletivo-para-ingresso-de-graduados-nos-cursos-de-graduacao-presenciais-psig-2026-2/',
      'https://www.prg.ufpb.br/edital/sistema-de-selecao-unificada-sisu-2026-2/',
      'https://www.prg.ufpb.br/edital/processo-seletivo-de-conhecimento-especifico-psce/',
    ],
  );
  assert.ok(
    candidates.every(
      (candidate) => new URL(candidate.canonicalUrl).hostname === connector.exactHost,
    ),
  );
  assert.ok(candidates.every((candidate) => knownUrls.has(candidate.canonicalUrl)));
  assert.equal(
    candidates.some((candidate) => candidate.canonicalUrl.includes('drive.ufpb.br')),
    false,
  );
});

test('versioned UFCG fixture yields only reviewed URLs on its exact configured host', () => {
  const html = readFileSync(
    new URL('./fixtures/institutions/ufcg/index.v1.html', import.meta.url),
    'utf8',
  );
  const connector = getPilotHtmlConnector('UFCG');
  const candidates = parseInstitutionIndexHtml('UFCG', html);
  const knownUrls = manifestUrls.get('UFCG');

  assert.equal(candidates.length, 4);
  assert.ok(
    candidates.every(
      (candidate) => new URL(candidate.canonicalUrl).hostname === connector.exactHost,
    ),
  );
  assert.ok(candidates.every((candidate) => knownUrls.has(candidate.canonicalUrl)));
  assert.equal(
    candidates.some((candidate) => candidate.canonicalUrl.includes('/SiSU/')),
    true,
    'offline discovery leaves scope classification to the relevance and review stages',
  );
});

test('unsupported institution codes are rejected without network access', () => {
  assert.throws(() => getPilotHtmlConnector('UEPB'), /No HTML connector configured/u);
});
