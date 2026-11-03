import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeAcronym,
  normalizeKey,
  normalizeLabel,
} from '../apps/api/dist/modules/institutions/normalization.js';
import {
  normalizeState,
  validateTimezone,
} from '../apps/api/dist/modules/campuses/campuses.repository.js';

test('institution and city names normalize spacing, case and accents', () => {
  assert.equal(
    normalizeLabel('  Universidade   Estadual  da  Paraíba '),
    'Universidade Estadual da Paraíba',
  );
  assert.equal(normalizeKey('  João   Pessoa  '), 'JOAO PESSOA');
  assert.equal(normalizeAcronym(' uepb '), 'UEPB');
  assert.throws(() => normalizeLabel('   '), /Name must not be empty/);
});

test('campus state and timezone reject invalid input', () => {
  assert.equal(normalizeState(' pb '), 'PB');
  assert.throws(() => normalizeState('XX'), /valid Brazilian UF/);
  assert.equal(validateTimezone('America/Sao_Paulo'), 'America/Sao_Paulo');
  assert.throws(() => validateTimezone('Not/A_Zone'), /valid IANA/);
});
