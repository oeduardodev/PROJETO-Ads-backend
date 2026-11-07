import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeExtractedProcess } from '../apps/api/dist/modules/processes/normalization/normalized-process.js';

const institutionId = '1b250f17-5a3c-4850-9998-e9bb414df017';
const primaryDocumentId = 'bbdd9299-3d13-41ef-9e73-e7d8ddf36753';
const attachmentId = '0ccda87d-c31a-446e-b187-f21cb449c7fe';
const campusId = 'e3882d22-600d-4fee-bca4-e9ae6ced27e8';
const context = {
  institutionId,
  primaryDocumentId,
  knownDocumentIds: [primaryDocumentId, attachmentId],
};

function fixture() {
  const output = {
    schema_version: 1,
    institution_id: institutionId,
    notice_number: '  PS  01/2026 ',
    notice_year: 2026,
    selection_type: 'TRANSFER',
    regular_sisu_flow: false,
    requires_enem: null,
    tuition_free: null,
    application_fee_brl: null,
    application_windows: [
      {
        label: ' Inscrições ',
        start_date: '2026-07-30',
        start_time: null,
        end_date: '2026-08-03',
        end_time: null,
        timezone: null,
      },
    ],
    offerings: [
      {
        course: '  Matemática  ',
        degree_type: ' Bacharelado ',
        campus: 'Centro',
        modality: null,
        shift: 'Noturno',
        seats: 25,
        reservations: [
          {
            category: ' Cota social ',
            seats: 5,
            requirements: [{ criterion: 'Renda', required: true, value: { max: 2 } }],
          },
        ],
        requirements: [{ criterion: 'Diploma', required: true, value: null }],
      },
      {
        course: ' Física ',
        degree_type: null,
        campus: null,
        modality: null,
        shift: null,
        seats: 10,
        reservations: [],
        requirements: null,
      },
      {
        course: null,
        degree_type: null,
        campus: null,
        modality: null,
        shift: null,
        seats: null,
        reservations: null,
        requirements: null,
      },
    ],
    requirements: [{ criterion: 'Graduação anterior', required: true, value: null }],
    evidence: [],
  };
  const addEvidence = (field, documentId = primaryDocumentId) => {
    output.evidence.push({
      field,
      document_id: documentId,
      page_or_section: 'p. 1',
      excerpt: field,
    });
  };
  for (const field of ['notice_number', 'notice_year', 'selection_type', 'regular_sisu_flow']) {
    addEvidence(field);
  }
  for (const field of ['label', 'start_date', 'end_date']) {
    addEvidence(`application_windows[0].${field}`);
  }
  for (const field of ['course', 'degree_type', 'campus', 'shift', 'seats']) {
    addEvidence(`offerings[0].${field}`, attachmentId);
  }
  for (const field of ['category', 'seats']) {
    addEvidence(`offerings[0].reservations[0].${field}`, attachmentId);
  }
  for (const field of ['criterion', 'required', 'value']) {
    if (field !== 'value') addEvidence(`offerings[0].requirements[0].${field}`, attachmentId);
    addEvidence(`offerings[0].reservations[0].requirements[0].${field}`, attachmentId);
    if (field !== 'value') addEvidence(`requirements[0].${field}`);
  }
  for (const field of ['course', 'seats']) addEvidence(`offerings[1].${field}`);
  return output;
}

test('normalizes every offering without losing reservations, requirements or source documents', () => {
  const draft = normalizeExtractedProcess(fixture(), context);
  assert.equal(draft.noticeCode.raw, '  PS  01/2026 ');
  assert.equal(draft.noticeCode.display, 'PS 01/2026');
  assert.equal(draft.offerings.length, 3);
  assert.deepEqual(
    draft.offerings.map((item) => item.sourceIndex),
    [0, 1, 2],
  );
  assert.equal(draft.offerings[0].course.raw, '  Matemática  ');
  assert.equal(draft.offerings[0].course.key, 'MATEMATICA');
  assert.equal(draft.offerings[0].reservations[0].requirements[0].value.max, 2);
  assert.equal(draft.offerings[0].requirements[0].criterion.display, 'Diploma');
  assert.deepEqual(draft.offerings[1].reservations, []);
  assert.equal(draft.offerings[1].requirements, null);
  assert.equal(draft.offerings[2].hasRequiredCourseName, false);
  assert.equal(draft.offerings[2].course.display, null);
  assert.equal(draft.offerings[2].campusId, null);
  assert.deepEqual(draft.documentIds, [primaryDocumentId, attachmentId]);
  assert.equal(draft.windows[0].endTime, null);
  assert.ok(draft.issues.some((item) => item.code === 'COURSE_UNKNOWN'));
});

test('rejects a mismatched institution context and unknown primary document', () => {
  assert.throws(() =>
    normalizeExtractedProcess(fixture(), { ...context, institutionId: attachmentId }),
  );
  assert.throws(() =>
    normalizeExtractedProcess(fixture(), { ...context, primaryDocumentId: institutionId }),
  );
});

test('keeps unrecognized evidence document visible as an issue', () => {
  const value = fixture();
  value.evidence.push({
    field: 'external_reference',
    document_id: institutionId,
    page_or_section: null,
    excerpt: 'unrecognized document',
  });
  const draft = normalizeExtractedProcess(value, context);
  assert.ok(draft.issues.some((item) => item.code === 'DOCUMENT_UNKNOWN'));
  assert.equal(draft.evidence.at(-1).documentId, institutionId);
  assert.ok(!draft.documentIds.includes(institutionId));
});

test('links only an explicitly assigned verified campus matching the extracted name and institution', () => {
  const withAssignment = {
    ...context,
    reviewedCampuses: [{ id: campusId, institutionId, name: ' Centro ', verifiedAt: new Date() }],
    campusAssignments: [{ sourceIndex: 0, campusId }],
  };
  const draft = normalizeExtractedProcess(fixture(), withAssignment);
  assert.equal(draft.offerings[0].campusId, campusId);
  assert.equal(draft.offerings[1].campusId, null);
  assert.ok(!draft.issues.some((item) => item.fieldPath === 'offerings[0].campus'));
  assert.throws(() =>
    normalizeExtractedProcess(fixture(), {
      ...withAssignment,
      reviewedCampuses: [{ ...withAssignment.reviewedCampuses[0], verifiedAt: null }],
    }),
  );
  assert.throws(() =>
    normalizeExtractedProcess(fixture(), {
      ...withAssignment,
      reviewedCampuses: [{ ...withAssignment.reviewedCampuses[0], institutionId: attachmentId }],
    }),
  );
  assert.throws(() =>
    normalizeExtractedProcess(fixture(), {
      ...withAssignment,
      reviewedCampuses: [{ ...withAssignment.reviewedCampuses[0], name: 'Outro campus' }],
    }),
  );
  assert.throws(() =>
    normalizeExtractedProcess(fixture(), {
      ...withAssignment,
      campusAssignments: [{ sourceIndex: 3, campusId }],
    }),
  );
});
