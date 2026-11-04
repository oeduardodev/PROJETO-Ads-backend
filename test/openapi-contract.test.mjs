import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const contract = JSON.parse(
  await readFile(new URL('../apps/api/openapi/public-v1.json', import.meta.url), 'utf8'),
);

test('public v1 contract keeps stable operations and request parameters', () => {
  assert.deepEqual(Object.keys(contract.paths).sort(), [
    '/api/v1/filters',
    '/api/v1/institutions',
    '/api/v1/processes',
    '/api/v1/processes/{id}',
  ]);
  assert.equal(contract.paths['/api/v1/institutions'].get.operationId, 'listInstitutions');
  assert.equal(contract.paths['/api/v1/filters'].get.operationId, 'listFilters');
  assert.equal(contract.paths['/api/v1/processes'].get.operationId, 'searchProcesses');
  assert.equal(contract.paths['/api/v1/processes/{id}'].get.operationId, 'getProcess');

  const searchParameters = contract.paths['/api/v1/processes'].get.parameters;
  assert.deepEqual(searchParameters.map((parameter) => parameter.name).sort(), [
    'city',
    'degree',
    'modality',
    'open_only',
    'page',
    'page_size',
    'q',
    'requires_enem',
    'selection_type',
    'sort',
    'uf',
  ]);
  assert.deepEqual(searchParameters.find((parameter) => parameter.name === 'sort').schema.enum, [
    'recent',
    'deadline',
    'course',
  ]);
});

test('public schemas retain required fields and exclude editorial internals', () => {
  const schemas = contract.components.schemas;
  assert.ok(schemas.ProcessCard.required.includes('applicationStatus'));
  assert.ok(schemas.ProcessDetail.required.includes('evidence'));
  assert.ok(schemas.Institution.required.includes('monitoring'));
  assert.equal(schemas.ProcessDetail.properties.reviewNotes, undefined);
  assert.equal(schemas.ProcessDetail.properties.storageKey, undefined);
  assert.equal(schemas.ProcessDetail.properties.publicationStatus, undefined);
});
