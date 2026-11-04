import assert from 'node:assert/strict';
import test from 'node:test';
import {
  scheduleWindowVersion,
  sourceQueuePriority,
} from '../apps/api/dist/modules/discovery/scheduler/schedule-window.js';

test('source frequency is measured from the last check in UTC windows', () => {
  const lastCheckedAt = new Date('2026-11-04T12:15:00.000Z');
  assert.equal(
    scheduleWindowVersion(
      { frequencyMinutes: 60, lastCheckedAt },
      new Date('2026-11-04T13:14:59.999Z'),
    ),
    null,
  );
  const firstDueWindow = scheduleWindowVersion(
    { frequencyMinutes: 60, lastCheckedAt },
    new Date('2026-11-04T13:15:00.000Z'),
  );
  assert.equal(
    scheduleWindowVersion(
      { frequencyMinutes: 60, lastCheckedAt },
      new Date('2026-11-04T14:00:00.000Z'),
    ),
    firstDueWindow,
  );
  assert.equal(
    scheduleWindowVersion(
      { frequencyMinutes: 60, lastCheckedAt },
      new Date('2026-11-04T14:15:00.000Z'),
    ),
    firstDueWindow + 60,
  );
});

test('never-checked sources are immediately due and window identity is stable', () => {
  const now = new Date('2026-11-04T13:15:45.000Z');
  const version = scheduleWindowVersion({ frequencyMinutes: 60, lastCheckedAt: null }, now);
  assert.ok(version);
  assert.equal(
    scheduleWindowVersion(
      { frequencyMinutes: 60, lastCheckedAt: null },
      new Date('2026-11-04T13:59:59.000Z'),
    ),
    version,
  );
  assert.equal(
    scheduleWindowVersion(
      { frequencyMinutes: 60, lastCheckedAt: null },
      new Date('2026-11-04T14:00:00.000Z'),
    ),
    version + 60,
  );
});

test('degraded sources receive lower queue priority than every healthy source', () => {
  assert.ok(sourceQueuePriority(0, 'HEALTHY') < sourceQueuePriority(0, 'DEGRADED'));
  assert.ok(sourceQueuePriority(1_000_000, 'HEALTHY') < sourceQueuePriority(0, 'DEGRADED'));
  assert.throws(() => sourceQueuePriority(-1, 'HEALTHY'), /nonnegative safe integer/u);
});
