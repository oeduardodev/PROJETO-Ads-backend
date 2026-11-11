import assert from 'node:assert/strict';
import test from 'node:test';
import { MetricsRegistry } from '../apps/api/dist/observability/metrics.registry.js';
import {
  noCandidateWarning,
  sourceFailureAlert,
} from '../apps/api/dist/observability/source-alert-policy.js';
import { structuredLogEntry } from '../apps/api/dist/observability/structured-log.js';

test('structured logs keep correlation fields and discard URL, query, body, and secret fields', () => {
  const entry = structuredLogEntry(
    'info',
    'review.decision.completed',
    {
      requestId: '123e4567-e89b-42d3-a456-426614174000',
      processId: '123e4567-e89b-42d3-a456-426614174001',
      action: 'approved',
      url: 'https://source.example/notice?email=person@example.org',
      query: 'email=person@example.org',
      authorization: 'Bearer secret',
      reason: 'personal data must not enter logs',
      unsafeRequestId: 'person@example.org',
    },
    new Date('2026-11-11T12:00:00Z'),
  );
  assert.equal(entry.requestId, '123e4567-e89b-42d3-a456-426614174000');
  assert.equal(entry.action, 'approved');
  assert.equal('url' in entry, false);
  assert.equal('query' in entry, false);
  assert.equal('authorization' in entry, false);
  assert.equal('reason' in entry, false);
  assert.equal('unsafeRequestId' in entry, false);
  assert.equal(JSON.stringify(entry).includes('person@example.org'), false);
  assert.equal(
    'requestId' in
      structuredLogEntry('info', 'test', {
        requestId: 'request-for-person@example.org',
      }),
    false,
  );
});

test('Prometheus metrics escape labels and reject invalid values', () => {
  const registry = new MetricsRegistry();
  registry.increment('review_decisions_total', 'Review decisions', { action: 'approved"\n' });
  registry.set('worker_up', 'Worker availability', 1);
  assert.match(registry.render(), /action="approved\\"\\n"/u);
  assert.match(registry.render(), /worker_up 1/u);
  assert.throws(() => registry.increment('bad metric', 'invalid'), /Invalid metric name/u);
  assert.throws(() => registry.set('worker_up', 'Worker availability', Number.NaN), /finite/u);
});

test('persistent source alerts follow ADR 0023 and ignore inactive or unreviewed sources', () => {
  const now = new Date('2026-11-11T12:00:00Z');
  const base = {
    active: true,
    exactHostReviewed: true,
    consecutiveFailures: 1,
    lastSuccessAt: new Date('2026-11-11T11:00:00Z'),
    frequencyMinutes: 60,
    now,
  };
  assert.equal(sourceFailureAlert(base), 'warning');
  assert.equal(sourceFailureAlert({ ...base, consecutiveFailures: 3 }), 'alert');
  assert.equal(sourceFailureAlert({ ...base, consecutiveFailures: 2 }), 'none');
  assert.equal(
    sourceFailureAlert({
      ...base,
      consecutiveFailures: 1,
      lastSuccessAt: new Date('2026-11-11T09:59:00Z'),
    }),
    'alert',
  );
  assert.equal(sourceFailureAlert({ ...base, active: false, consecutiveFailures: 3 }), 'none');
  assert.equal(
    sourceFailureAlert({ ...base, exactHostReviewed: false, consecutiveFailures: 3 }),
    'none',
  );
  assert.equal(
    sourceFailureAlert({ ...base, lastSuccessAt: null, consecutiveFailures: 2 }),
    'none',
  );
  assert.equal(noCandidateWarning(0), true);
  assert.equal(noCandidateWarning(1), false);
});
