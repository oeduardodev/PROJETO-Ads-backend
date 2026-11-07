import assert from 'node:assert/strict';
import test from 'node:test';
import { validateNormalizedProcess } from '../apps/api/dist/modules/validation/rules/process-rules.js';

const label = (display) => ({ raw: display, display, key: display });
const context = {
  institutionPublic: true,
  institutionVerified: true,
  officialSourceVerified: true,
};

function draft(overrides = {}) {
  return {
    institutionId: 'institution-1',
    primaryDocumentId: 'document-1',
    documentIds: ['document-1'],
    noticeCode: label('PS-1/2026'),
    noticeYear: 2026,
    selectionType: 'ENEM_OWN_SELECTION',
    regularSisuFlow: false,
    requiresEnem: true,
    tuitionFree: true,
    applicationFeeBrl: 40,
    windows: [
      {
        sourceIndex: 0,
        label: label('Inscrições'),
        startDate: '2026-07-01',
        startTime: '08:00',
        endDate: '2026-07-15',
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
        modality: label('PRESENCIAL'),
        shift: label('NOTURNO'),
        seats: 20,
        reservations: null,
        requirements: null,
        hasRequiredCourseName: true,
      },
    ],
    requirements: null,
    evidence: [],
    issues: [],
    ...overrides,
  };
}

function codes(result) {
  return result.issues.map((issue) => issue.code);
}

test('ENEM outside regular SiSU and a separate application fee stay in human review', () => {
  const result = validateNormalizedProcess(draft(), context);
  assert.equal(result.disposition, 'NEEDS_REVIEW');
  assert.equal(result.publishable, false);
  assert.ok(codes(result).includes('FEE_WAIVER_UNMODELED'));
  assert.ok(!codes(result).includes('REGULAR_SISU_FLOW'));
  assert.ok(!codes(result).includes('PAID_TUITION'));
});

test('SiSU, private institution, paid tuition, and postgraduate offerings exclude', () => {
  const postgraduate = { ...draft().offerings[0], degreeType: label('MESTRADO') };
  const result = validateNormalizedProcess(
    draft({
      selectionType: 'SISU',
      regularSisuFlow: false,
      tuitionFree: false,
      offerings: [postgraduate],
    }),
    { ...context, institutionPublic: false },
  );
  assert.equal(result.disposition, 'OUT_OF_SCOPE');
  assert.equal(result.publishable, false);
  for (const code of [
    'REGULAR_SISU_TYPE',
    'SISU_TYPE_FLOW_CONFLICT',
    'PRIVATE_INSTITUTION',
    'PAID_TUITION',
    'NO_CONFIRMED_GRADUATION',
  ]) {
    assert.ok(codes(result).includes(code), code);
  }
});

test('a mixed notice retains the graduation offering for review', () => {
  const technical = {
    ...draft().offerings[0],
    sourceIndex: 1,
    course: label('Técnico em Agropecuária'),
    degreeType: label('TECNICO'),
  };
  const result = validateNormalizedProcess(
    draft({ offerings: [...draft().offerings, technical], applicationFeeBrl: null }),
    context,
  );
  assert.equal(result.disposition, 'NEEDS_REVIEW');
  assert.ok(codes(result).includes('NON_GRADUATION_OFFERING'));
});

test('reversed and partial deadlines, unknown source, and missing course require review', () => {
  const result = validateNormalizedProcess(
    draft({
      windows: [
        {
          ...draft().windows[0],
          startDate: '2026-07-15',
          endDate: '2026-07-01',
          endTime: null,
        },
      ],
      offerings: [{ ...draft().offerings[0], course: label(null), seats: null }],
      requiresEnem: false,
      issues: [{ code: 'DOCUMENT_UNKNOWN', fieldPath: 'offerings[0].course' }],
    }),
    { ...context, officialSourceVerified: false },
  );
  assert.equal(result.disposition, 'NEEDS_REVIEW');
  for (const code of [
    'APPLICATION_WINDOW_REVERSED',
    'APPLICATION_WINDOW_PARTIAL',
    'COURSE_UNKNOWN',
    'SEATS_UNKNOWN',
    'ENEM_TYPE_REQUIREMENT_CONFLICT',
    'OFFICIAL_SOURCE_UNVERIFIED',
    'NORMALIZATION_DOCUMENT_UNKNOWN',
  ]) {
    assert.ok(codes(result).includes(code), code);
  }
});

test('unknown SiSU flow, tuition, and missing application window never publish', () => {
  const result = validateNormalizedProcess(
    draft({ regularSisuFlow: null, tuitionFree: null, windows: null, applicationFeeBrl: null }),
    context,
  );
  assert.equal(result.publishable, false);
  for (const code of ['SISU_FLOW_UNKNOWN', 'TUITION_UNKNOWN', 'APPLICATION_WINDOW_UNKNOWN']) {
    assert.ok(codes(result).includes(code), code);
  }
});
