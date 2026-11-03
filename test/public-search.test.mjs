import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSearchQuery } from '../apps/api/dist/modules/processes/public-search/search-query.js';
import {
  completeWindowInterval,
  isWindowOpen,
  nextConfirmedDeadline,
} from '../apps/api/dist/modules/processes/public-search/window-time.js';

test('search query validates sorting, booleans, accents and optional text', () => {
  assert.deepEqual(parseSearchQuery({}).sort, 'recent');
  const query = parseSearchQuery({
    q: ' Engenhária ',
    uf: 'pb',
    city: 'João Pessoa',
    degree: 'bacharelado',
    open_only: 'true',
    sort: 'course',
  });
  assert.equal(query.q, 'ENGENHARIA');
  assert.equal(query.city, 'JOAO PESSOA');
  assert.equal(query.degree, 'BACHARELADO');
  assert.equal(query.openOnly, true);
  assert.equal(query.sort, 'course');
  assert.equal(parseSearchQuery({ q: '  ' }).q, undefined);
  for (const invalid of [
    { sort: 'random' },
    { open_only: '1' },
    { city: ['A'] },
    { q: 'x'.repeat(121) },
  ]) {
    assert.throws(() => parseSearchQuery(invalid), /Bad Request|BadRequestException/iu);
  }
});

test('only complete unambiguous timezone windows can be open', () => {
  const window = {
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    startTime: '08:00',
    endDate: new Date('2026-01-01T00:00:00.000Z'),
    endTime: '10:00',
    timezone: 'America/Sao_Paulo',
  };
  assert.equal(isWindowOpen(window, Date.parse('2026-01-01T10:59:59.000Z')), false);
  assert.equal(isWindowOpen(window, Date.parse('2026-01-01T11:00:00.000Z')), true);
  assert.equal(isWindowOpen(window, Date.parse('2026-01-01T13:00:00.000Z')), false);
  assert.equal(
    isWindowOpen({ ...window, endTime: null }, Date.parse('2026-01-01T12:00:00.000Z')),
    false,
  );
  assert.equal(
    nextConfirmedDeadline([window], Date.parse('2026-01-01T12:00:00.000Z')),
    Date.parse('2026-01-01T13:00:00.000Z'),
  );
  const ambiguous = {
    ...window,
    startDate: new Date('2024-11-03T00:00:00.000Z'),
    endDate: new Date('2024-11-03T00:00:00.000Z'),
    startTime: '01:30',
    endTime: '02:30',
    timezone: 'America/New_York',
  };
  assert.equal(completeWindowInterval(ambiguous), null);
});
