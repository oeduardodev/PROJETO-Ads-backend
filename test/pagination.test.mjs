import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePagination } from '../apps/api/dist/common/http/pagination.js';

test('pagination has bounded positive page and page size', () => {
  assert.deepEqual(parsePagination({}), { page: 1, pageSize: 20, skip: 0 });
  assert.deepEqual(parsePagination({ page: '3', page_size: '10' }), {
    page: 3,
    pageSize: 10,
    skip: 20,
  });
  for (const input of [
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { page_size: '101' },
    { page: ['1', '2'] },
  ]) {
    assert.throws(() => parsePagination(input), /Bad Request|BAD_REQUEST|BadRequestException/iu);
  }
});
