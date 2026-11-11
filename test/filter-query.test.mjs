import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFilterQuery } from '../apps/api/dist/modules/processes/filters/filter-query.js';
import { parsePublicInstitutionQuery } from '../apps/api/dist/modules/institutions/public-institutions.query.js';
import { PublicInstitutionsService } from '../apps/api/dist/modules/institutions/public-institutions.service.js';

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

test('public institution query normalizes text and validates jurisdiction and verified-campus filters', () => {
  assert.deepEqual(parsePublicInstitutionQuery({}), {
    q: undefined,
    uf: undefined,
    city: undefined,
    jurisdiction: undefined,
  });
  assert.deepEqual(
    parsePublicInstitutionQuery({
      q: '  Universidade Federal da Paraíba ',
      uf: 'pb',
      city: 'João Pessoa',
      jurisdiction: 'FEDERAL',
    }),
    {
      q: 'UNIVERSIDADE FEDERAL DA PARAIBA',
      uf: 'PB',
      city: 'JOAO PESSOA',
      jurisdiction: 'FEDERAL',
    },
  );
  assert.deepEqual(parsePublicInstitutionQuery({ q: '  ' }), {
    q: undefined,
    uf: undefined,
    city: undefined,
    jurisdiction: undefined,
  });
  for (const query of [
    { q: 'x'.repeat(121) },
    { uf: 'XX' },
    { city: ['João Pessoa'] },
    { jurisdiction: 'MUNICIPAL' },
  ]) {
    assert.throws(
      () => parsePublicInstitutionQuery(query),
      /Bad Request|BAD_REQUEST|BadRequestException/iu,
    );
  }
});

test('public institution filters constrain count and page before pagination', async () => {
  let countWhere;
  let listArguments;
  const database = {
    institution: {
      count: async ({ where }) => {
        countWhere = where;
        return 0;
      },
      findMany: async (args) => {
        listArguments = args;
        return [];
      },
    },
  };
  const service = new PublicInstitutionsService(database);
  const query = parsePublicInstitutionQuery({
    q: 'UFPB',
    uf: 'PB',
    city: 'João Pessoa',
    jurisdiction: 'FEDERAL',
  });
  const pagination = { page: 2, pageSize: 25, skip: 25 };

  const response = await service.list(query, pagination);

  assert.equal(countWhere.jurisdiction, 'FEDERAL');
  assert.deepEqual(countWhere.OR, [
    { normalizedName: { contains: 'UFPB' } },
    { acronym: { contains: 'UFPB' } },
  ]);
  assert.deepEqual(countWhere.campuses, {
    some: {
      verifiedAt: { not: null },
      state: 'PB',
      normalizedCity: { contains: 'JOAO PESSOA' },
    },
  });
  assert.equal(listArguments.where, countWhere);
  assert.equal(listArguments.skip, 25);
  assert.equal(listArguments.take, 25);
  assert.equal(response.meta.total, 0);
});
