import assert from 'node:assert/strict';
import test from 'node:test';
import {
  processStatus,
  publicApplicationStatus,
  windowStatus,
} from '../apps/api/dist/modules/processes/deadlines/deadline-state.js';

test('civil dates and timezone decide exact start and end boundaries', () => {
  const window = {
    startDate: new Date('2026-01-10T00:00:00.000Z'),
    startTime: '09:00',
    endDate: new Date('2026-01-10T00:00:00.000Z'),
    endTime: '17:00',
    timezone: 'America/Sao_Paulo',
  };
  assert.equal(windowStatus(window, Date.parse('2026-01-10T11:59:59.999Z')), 'UPCOMING');
  assert.equal(windowStatus(window, Date.parse('2026-01-10T12:00:00.000Z')), 'OPEN');
  assert.equal(windowStatus(window, Date.parse('2026-01-10T19:59:59.999Z')), 'OPEN');
  assert.equal(windowStatus(window, Date.parse('2026-01-10T20:00:00.000Z')), 'CLOSED');
  assert.equal(
    windowStatus({ ...window, endTime: null }, Date.parse('2026-01-10T13:00:00Z')),
    'UNKNOWN',
  );
  assert.equal(
    windowStatus({ ...window, timezone: null }, Date.parse('2026-01-10T13:00:00Z')),
    'UNKNOWN',
  );
});

test('ambiguous daylight saving transitions are unknown', () => {
  const window = {
    startDate: new Date('2024-11-03T00:00:00.000Z'),
    startTime: '01:30',
    endDate: new Date('2024-11-03T00:00:00.000Z'),
    endTime: '02:30',
    timezone: 'America/New_York',
  };
  assert.equal(windowStatus(window, Date.parse('2024-11-03T06:00:00Z')), 'UNKNOWN');
});

test('process status preserves uncertainty across multiple windows', () => {
  const now = Date.parse('2026-01-10T14:00:00.000Z');
  const base = {
    startDate: new Date('2026-01-10T00:00:00.000Z'),
    startTime: '09:00',
    endDate: new Date('2026-01-10T00:00:00.000Z'),
    endTime: '17:00',
    timezone: 'America/Sao_Paulo',
  };
  const partial = { ...base, endTime: null };
  const past = {
    ...base,
    endDate: new Date('2026-01-09T00:00:00.000Z'),
    startDate: new Date('2026-01-09T00:00:00.000Z'),
  };
  const future = {
    ...base,
    startDate: new Date('2026-01-11T00:00:00.000Z'),
    endDate: new Date('2026-01-11T00:00:00.000Z'),
  };
  assert.equal(processStatus([], now), 'UNKNOWN');
  assert.equal(processStatus([base, partial], now), 'OPEN');
  assert.equal(processStatus([past, partial], now), 'UNKNOWN');
  assert.equal(processStatus([future, partial], now), 'UNKNOWN');
  assert.equal(processStatus([past, future], now), 'UPCOMING');
  assert.equal(processStatus([past], now), 'CLOSED');
  assert.equal(publicApplicationStatus('OPEN'), 'ABERTA');
  assert.equal(publicApplicationStatus('CLOSED'), 'ENCERRADA');
  assert.equal(publicApplicationStatus('UPCOMING'), 'PREVISTA');
  assert.equal(publicApplicationStatus('UNKNOWN'), 'INDETERMINADA');
});
