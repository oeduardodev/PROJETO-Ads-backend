import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assessDiscoveryRelevance } from '../apps/api/dist/modules/discovery/relevance/relevance.classifier.js';

const goldenCsv = readFileSync(
  new URL('../docs/research/golden-dataset.csv', import.meta.url),
  'utf8',
);
const goldenRows = new Map(
  goldenCsv
    .trim()
    .split(/\r?\n/u)
    .slice(1)
    .map((line) => {
      const [id, institution, officialUrl, artifactKind, selectionType, scope, sisu, enem] =
        line.split(',');
      return [id, { institution, officialUrl, artifactKind, selectionType, scope, sisu, enem }];
    }),
);

function corpusRecord(id) {
  const record = goldenRows.get(id);
  assert.ok(record, `missing reviewed corpus record ${id}`);
  return record;
}

test('golden corpus keeps reviewed history, own ENEM, and special selections as candidates', () => {
  const historical = corpusRecord('UFPB-12');
  assert.equal(historical.scope, 'IN_SCOPE');
  assert.equal(assessDiscoveryRelevance('', historical.officialUrl).decision, 'REVIEW');

  const ownEnem = corpusRecord('IFPB-15');
  assert.equal(ownEnem.selectionType, 'ENEM_OWN_SELECTION');
  assert.equal(ownEnem.sisu, 'FALSE');
  assert.equal(ownEnem.enem, 'TRUE');
  assert.notEqual(assessDiscoveryRelevance('', ownEnem.officialUrl).decision, 'DISCARD');

  const special = corpusRecord('UFPB-06');
  assert.equal(special.selectionType, 'SPECIFIC_KNOWLEDGE');
  assert.equal(assessDiscoveryRelevance('', special.officialUrl).decision, 'PRIORITIZE');
});

test('false-positive corpus URLs alone cannot discard SISU records', () => {
  for (const id of ['UFPB-05', 'UFPB-07', 'UFCG-05']) {
    const record = corpusRecord(id);
    assert.equal(record.scope, 'OUT_OF_SCOPE');
    assert.notEqual(assessDiscoveryRelevance('', record.officialUrl).decision, 'DISCARD');
  }

  const remainingSeats = corpusRecord('UFCG-02');
  assert.equal(remainingSeats.scope, 'PENDING_REVIEW');
  assert.notEqual(assessDiscoveryRelevance('', remainingSeats.officialUrl).decision, 'DISCARD');
});

test('only explicit anchor context discards and contradictory positive evidence stays for review', () => {
  const sisu = assessDiscoveryRelevance(
    'Seleção regular do SiSU',
    'https://example.edu.br/notices/1',
  );
  assert.equal(sisu.decision, 'DISCARD');
  assert.match(sisu.exclusionReasons.join(' '), /SiSU regular/u);
  assert.equal(
    assessDiscoveryRelevance('Seleção SiSU+', 'https://example.edu.br/notices/1').decision,
    'DISCARD',
  );

  const postgraduate = assessDiscoveryRelevance(
    'Processo seletivo de pós-graduação em mestrado',
    'https://example.edu.br/notices/2',
  );
  assert.equal(postgraduate.decision, 'DISCARD');

  const technical = assessDiscoveryRelevance(
    'Processo seletivo para curso técnico integrado',
    'https://example.edu.br/notices/3',
  );
  assert.equal(technical.decision, 'DISCARD');

  const ambiguous = assessDiscoveryRelevance('SiSU', 'https://example.edu.br/sisu');
  assert.equal(ambiguous.decision, 'REVIEW');
  assert.equal(
    assessDiscoveryRelevance('Mestrado', 'https://example.edu.br/mestrado').decision,
    'REVIEW',
  );

  const contradictory = assessDiscoveryRelevance(
    'Vestibular próprio para bacharelado no SiSU regular',
    'https://example.edu.br/notices/4',
  );
  assert.equal(contradictory.decision, 'REVIEW');
});

test('positive keywords prioritize but do not prove eligibility', () => {
  const result = assessDiscoveryRelevance(
    'Processo seletivo específico para ingresso em bacharelado',
    'https://example.edu.br/edital',
  );
  assert.equal(result.decision, 'PRIORITIZE');
  assert.equal(result.score, 0.5);
  assert.deepEqual(result.positiveSignals, ['processo seletivo especifico', 'bacharelado']);

  const technologist = assessDiscoveryRelevance(
    'Curso superior de tecnólogo',
    'https://example.edu.br/curso',
  );
  assert.equal(technologist.decision, 'PRIORITIZE');
});
