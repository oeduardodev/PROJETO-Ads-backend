import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  executeInstitutionConnector,
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

test('all four connector configs match reviewed URLs and remain disabled pending source review', () => {
  assert.deepEqual(
    PILOT_HTML_CONNECTORS.map((connector) => connector.institutionCode),
    ['UFPB', 'UFCG', 'UEPB', 'IFPB'],
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
  assert.equal(getPilotHtmlConnector('UEPB').accessReview, 'ROBOTS_403_MANUAL_ONLY');
  assert.equal(getPilotHtmlConnector('IFPB').accessReview, 'TERMS_PENDING');
  assert.equal(getPilotHtmlConnector('UFCG').accessReview, 'LICENSE_RETENTION_PENDING');
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

test('fragile UEPB and IFPB fixtures remain separate and trace only reviewed URLs', () => {
  for (const code of ['UEPB', 'IFPB']) {
    const html = readFileSync(
      new URL(`./fixtures/institutions/${code.toLowerCase()}/index.v1.html`, import.meta.url),
      'utf8',
    );
    const connector = getPilotHtmlConnector(code);
    const candidates = parseInstitutionIndexHtml(code, html);
    const knownUrls = manifestUrls.get(code);

    assert.equal(candidates.length, 4);
    assert.ok(
      candidates.every(
        (candidate) => new URL(candidate.canonicalUrl).hostname === connector.exactHost,
      ),
    );
    assert.ok(candidates.every((candidate) => knownUrls.has(candidate.canonicalUrl)));
    assert.ok(candidates.every((candidate) => candidate.sourceUrl === connector.sourceUrl));
  }
});

test('unsupported institution codes are rejected without network access', () => {
  assert.throws(() => getPilotHtmlConnector('OTHER'), /No HTML connector configured/u);
});

test('offline connector runs report source trace, success/failure metrics, and last-check markers', () => {
  const checkedAt = new Date('2026-11-05T12:00:00.000Z');
  for (const code of ['UFPB', 'UFCG', 'UEPB', 'IFPB']) {
    const html = readFileSync(
      new URL(`./fixtures/institutions/${code.toLowerCase()}/index.v1.html`, import.meta.url),
      'utf8',
    );
    const succeeded = executeInstitutionConnector(code, html, checkedAt);
    assert.equal(succeeded.status, 'SUCCEEDED');
    assert.equal(succeeded.sourceUrl, getPilotHtmlConnector(code).sourceUrl);
    assert.equal(succeeded.metrics.candidatesDiscovered, succeeded.candidates.length);
    assert.equal(succeeded.lastCheckedAt.toISOString(), checkedAt.toISOString());
    assert.equal(succeeded.lastSuccessAt.toISOString(), checkedAt.toISOString());
    assert.ok(
      succeeded.candidates.every((candidate) => candidate.sourceUrl === succeeded.sourceUrl),
    );

    const failed = executeInstitutionConnector(code, null, checkedAt);
    assert.equal(failed.status, 'FAILED');
    assert.equal(failed.sourceUrl, getPilotHtmlConnector(code).sourceUrl);
    assert.equal(failed.failureCode, 'CONNECTOR_PARSE_FAILED');
    assert.equal(failed.metrics.candidatesDiscovered, 0);
    assert.equal(failed.lastCheckedAt.toISOString(), checkedAt.toISOString());
    assert.equal('lastSuccessAt' in failed, false);
  }
});
