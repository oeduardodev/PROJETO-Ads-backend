import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFilterQuery } from '../apps/api/dist/modules/processes/filters/filter-query.js';

test('facet query validates combined filters and ENEM unknown independently', () => {
  assert.deepEqual(parseFilterQuery({}), {
    uf: undefined,
    modality: undefined,
    selectionType: undefined,
    requiresEnem: undefined,
  });
  assert.deepEqual(
    parseFilterQuery({
      uf: 'pb',
      modality: 'presencial',
      selection_type: 'transfer',
      requires_enem: 'unknown',
    }),
    { uf: 'PB', modality: 'PRESENCIAL', selectionType: 'TRANSFER', requiresEnem: null },
  );
  assert.equal(parseFilterQuery({ requires_enem: 'false' }).requiresEnem, false);
  assert.equal(parseFilterQuery({ requires_enem: 'true' }).requiresEnem, true);
  for (const query of [
    { uf: 'XX' },
    { modality: '' },
    { selection_type: 'in valid' },
    { requires_enem: '0' },
    { uf: ['PB'] },
  ]) {
    assert.throws(() => parseFilterQuery(query), /Bad Request|BAD_REQUEST|BadRequestException/iu);
  }
});
