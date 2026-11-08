import assert from 'node:assert/strict';
import test from 'node:test';
import { planRevision } from '../apps/api/dist/modules/revisions/revision-plan.js';

const label = (raw) => ({ raw, display: raw, key: raw });

function draft() {
  return {
    institutionId: 'institution-1',
    primaryDocumentId: 'document-v1',
    documentIds: ['document-v1'],
    noticeCode: label('PS 01/2026'),
    noticeYear: 2026,
    selectionType: 'TRANSFER',
    regularSisuFlow: false,
    requiresEnem: null,
    tuitionFree: true,
    applicationFeeBrl: null,
    windows: [
      {
        sourceIndex: 0,
        label: label('Inscrições'),
        startDate: '2026-07-01',
        startTime: '08:00',
        endDate: '2026-07-27',
        endTime: '18:00',
        timezone: label('America/Sao_Paulo'),
      },
    ],
    offerings: [
      {
        sourceIndex: 0,
        course: label('Matemática'),
        degreeType: label('BACHARELADO'),
        campus: label('Centro'),
        campusId: null,
        modality: null,
        shift: null,
        seats: 20,
        reservations: [],
        requirements: [{ criterion: label('Diploma'), required: true, value: null }],
        hasRequiredCourseName: true,
      },
    ],
    requirements: null,
    evidence: [
      {
        fieldPath: 'windows[0].endDate',
        documentId: 'document-v1',
        pageOrSection: 'p. 2',
        quote: '27/07',
      },
    ],
    issues: [],
  };
}

test('critical deadline retification preserves old evidence and requires review', () => {
  const oldDraft = draft();
  const nextDraft = structuredClone(oldDraft);
  nextDraft.primaryDocumentId = 'document-v2';
  nextDraft.documentIds.push('document-v2');
  nextDraft.windows[0].endDate = '2026-07-20';
  nextDraft.evidence = [
    {
      fieldPath: 'windows[0].endDate',
      documentId: 'document-v2',
      pageOrSection: 'p. 3',
      quote: '20/07',
    },
  ];
  const plan = planRevision(oldDraft, nextDraft);
  assert.equal(plan.action, 'REVIEW_CANDIDATE');
  assert.equal(plan.blocksCurrentPublication, true);
  assert.equal(plan.requiresReview, true);
  assert.ok(
    plan.changedFields.some((change) => change.path === 'windows[0].endDate' && change.critical),
  );
  assert.equal(plan.previous.windows[0].endDate, '2026-07-27');
  assert.equal(plan.candidate.windows[0].endDate, '2026-07-20');
  assert.equal(plan.previous.evidence[0].quote, '27/07');
  assert.equal(plan.candidate.evidence[0].quote, '20/07');
  nextDraft.evidence[0].quote = 'mutated';
  assert.equal(plan.candidate.evidence[0].quote, '20/07');
});

test('requirement change is critical while another document with identical fields still needs review', () => {
  const oldDraft = draft();
  const changed = structuredClone(oldDraft);
  changed.offerings[0].requirements[0].criterion = label('Diploma e histórico');
  assert.equal(planRevision(oldDraft, changed).blocksCurrentPublication, true);
  const documentOnly = structuredClone(oldDraft);
  documentOnly.primaryDocumentId = 'document-v2';
  documentOnly.documentIds.push('document-v2');
  const plan = planRevision(oldDraft, documentOnly);
  assert.equal(plan.action, 'REVIEW_CANDIDATE');
  assert.equal(plan.blocksCurrentPublication, false);
});

test('same version replay has no changes and cannot publish', () => {
  const plan = planRevision(draft(), draft());
  assert.equal(plan.action, 'NO_CHANGE');
  assert.equal(plan.requiresReview, false);
  assert.equal(plan.blocksCurrentPublication, false);
  assert.deepEqual(plan.changedFields, []);
});

test('institution identity cannot change in a retification', () => {
  assert.throws(() => planRevision(draft(), { ...draft(), institutionId: 'institution-2' }));
});
