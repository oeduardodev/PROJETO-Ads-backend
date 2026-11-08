import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateIngestionTransition,
  validatePublicationTransition,
} from '../apps/api/dist/modules/review/workflow/state-machine.js';

const system = { id: 'worker-1', kind: 'SYSTEM', permissions: [] };
const curator = {
  id: 'curator-1',
  kind: 'HUMAN',
  permissions: ['process.verify', 'process.publish', 'process.reject'],
};

test('ingestion follows allowed transitions and records a nonblank reason', () => {
  assert.equal(
    validateIngestionTransition('CANDIDATE', 'FETCHED', system, {
      reason: 'Fetched official page',
    }),
    'Fetched official page',
  );
  assert.throws(() =>
    validateIngestionTransition('CANDIDATE', 'VERIFIED', curator, { reason: 'Review' }),
  );
  assert.throws(() =>
    validateIngestionTransition('FETCHED', 'EXTRACTED', system, { reason: 'Skip classification' }),
  );
  assert.throws(() =>
    validateIngestionTransition('CLASSIFIED', 'REJECTED', system, { reason: 'Out of scope' }),
  );
  assert.throws(() =>
    validateIngestionTransition('CLASSIFIED', 'REJECTED', curator, { reason: '  ' }),
  );
});

test('verification and rejection require a human actor and explicit permission', () => {
  assert.equal(
    validateIngestionTransition('NEEDS_REVIEW', 'VERIFIED', curator, {
      reason: 'Official scope and deadlines checked',
      officialSourceVerified: true,
      unresolvedCriticalFacts: false,
    }),
    'Official scope and deadlines checked',
  );
  assert.throws(() =>
    validateIngestionTransition('NEEDS_REVIEW', 'VERIFIED', curator, {
      reason: 'Missing source confirmation',
      officialSourceVerified: false,
    }),
  );
  assert.throws(() =>
    validateIngestionTransition('REJECTED', 'CANDIDATE', system, {
      reason: 'Retry without evidence',
    }),
  );
  assert.equal(
    validateIngestionTransition('REJECTED', 'CANDIDATE', system, {
      reason: 'New official notice version discovered',
      newEvidence: true,
    }),
    'New official notice version discovered',
  );
});

test('worker cannot publish and a curator needs verified state, source, scope, and clear facts', () => {
  assert.throws(() =>
    validatePublicationTransition('EM_REVISAO', 'PUBLICADO', system, {
      reason: 'Automated approval',
      verifiedState: 'VERIFIED',
      officialSourceVerified: true,
      scopeEligible: true,
    }),
  );
  assert.throws(() =>
    validatePublicationTransition('EM_REVISAO', 'PUBLICADO', curator, {
      reason: 'Publish despite missing deadline',
      verifiedState: 'VERIFIED',
      officialSourceVerified: true,
      scopeEligible: true,
      unresolvedCriticalFacts: true,
    }),
  );
  assert.equal(
    validatePublicationTransition('EM_REVISAO', 'PUBLICADO', curator, {
      reason: 'Curator approved evidence and scope',
      verifiedState: 'VERIFIED',
      officialSourceVerified: true,
      scopeEligible: true,
      unresolvedCriticalFacts: false,
    }),
    'Curator approved evidence and scope',
  );
});

test('critical revision hides only with an explicit system policy; otherwise a human permission is required', () => {
  assert.equal(
    validatePublicationTransition(
      'PUBLICADO',
      'OCULTO',
      { ...system, id: 'SYSTEM:REVISION_POLICY' },
      {
        reason: 'Official critical revision',
        officialSourceVerified: true,
        criticalRevision: true,
        criticalRevisionPolicy: 'HIDE',
      },
    ),
    'Official critical revision',
  );
  assert.throws(() =>
    validatePublicationTransition('PUBLICADO', 'OCULTO', system, {
      reason: 'Source failed to load',
      officialSourceVerified: false,
      criticalRevision: false,
    }),
  );
});

test('archived processes are terminal and cannot be published directly from draft', () => {
  assert.throws(() =>
    validatePublicationTransition('RASCUNHO', 'PUBLICADO', curator, {
      reason: 'Skip review',
      verifiedState: 'VERIFIED',
      officialSourceVerified: true,
      scopeEligible: true,
    }),
  );
  assert.throws(() =>
    validatePublicationTransition('ARQUIVADO', 'EM_REVISAO', curator, { reason: 'Reopen' }),
  );
});
