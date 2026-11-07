import type { NormalizedProcessDraft } from '../../processes/normalization/normalized-process.js';

export type ValidationSeverity = 'EXCLUDE' | 'REVIEW';

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  fieldPath: string;
}

export interface ValidationContext {
  institutionPublic: boolean | null;
  institutionVerified: boolean;
  officialSourceVerified: boolean;
}

export interface ValidationResult {
  disposition: 'OUT_OF_SCOPE' | 'NEEDS_REVIEW';
  publishable: false;
  issues: ValidationIssue[];
}

const GRADUATION_DEGREES = new Set([
  'BACHARELADO',
  'LICENCIATURA',
  'TECNOLOGO',
  'TECNOLOGIA',
  'CURSO SUPERIOR DE TECNOLOGIA',
]);

const NON_GRADUATION_DEGREES = new Set([
  'ENSINO MEDIO',
  'TECNICO',
  'TECNICO INTEGRADO',
  'ESPECIALIZACAO',
  'MESTRADO',
  'DOUTORADO',
]);

function validateWindows(
  draft: NormalizedProcessDraft,
  add: (code: string, severity: ValidationSeverity, fieldPath: string) => void,
): void {
  if (!draft.windows?.length) {
    add('APPLICATION_WINDOW_UNKNOWN', 'REVIEW', 'windows');
    return;
  }
  for (const window of draft.windows) {
    const path = `windows[${window.sourceIndex}]`;
    if (
      !window.startDate ||
      !window.endDate ||
      !window.startTime ||
      !window.endTime ||
      !window.timezone.key
    ) {
      add('APPLICATION_WINDOW_PARTIAL', 'REVIEW', path);
    }
    if (
      window.startDate &&
      window.endDate &&
      (window.endDate < window.startDate ||
        (window.endDate === window.startDate &&
          window.startTime &&
          window.endTime &&
          window.endTime <= window.startTime))
    ) {
      add('APPLICATION_WINDOW_REVERSED', 'REVIEW', path);
    }
  }
}

function validateOfferings(
  draft: NormalizedProcessDraft,
  add: (code: string, severity: ValidationSeverity, fieldPath: string) => void,
): void {
  if (!draft.offerings?.length) {
    add('OFFERINGS_UNKNOWN', 'REVIEW', 'offerings');
    return;
  }
  let graduationCount = 0;
  let nonGraduationCount = 0;
  for (const offering of draft.offerings) {
    const path = `offerings[${offering.sourceIndex}]`;
    if (!offering.course.display) add('COURSE_UNKNOWN', 'REVIEW', `${path}.course`);
    if (!offering.degreeType.key) {
      add('DEGREE_UNKNOWN', 'REVIEW', `${path}.degreeType`);
    } else if (GRADUATION_DEGREES.has(offering.degreeType.key)) {
      graduationCount += 1;
    } else if (NON_GRADUATION_DEGREES.has(offering.degreeType.key)) {
      nonGraduationCount += 1;
      add('NON_GRADUATION_OFFERING', 'REVIEW', `${path}.degreeType`);
    } else {
      add('DEGREE_UNRECOGNIZED', 'REVIEW', `${path}.degreeType`);
    }
    if (offering.seats === null) add('SEATS_UNKNOWN', 'REVIEW', `${path}.seats`);
  }
  if (graduationCount === 0) {
    add(
      'NO_CONFIRMED_GRADUATION',
      nonGraduationCount === draft.offerings.length ? 'EXCLUDE' : 'REVIEW',
      'offerings',
    );
  }
}

export function validateNormalizedProcess(
  draft: NormalizedProcessDraft,
  context: ValidationContext,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const add = (code: string, severity: ValidationSeverity, fieldPath: string) => {
    issues.push({ code, severity, fieldPath });
  };

  if (context.institutionPublic === false) add('PRIVATE_INSTITUTION', 'EXCLUDE', 'institution');
  else if (context.institutionPublic === null)
    add('INSTITUTION_TYPE_UNKNOWN', 'REVIEW', 'institution');
  if (!context.institutionVerified) add('INSTITUTION_UNVERIFIED', 'REVIEW', 'institution');
  if (!context.officialSourceVerified) add('OFFICIAL_SOURCE_UNVERIFIED', 'REVIEW', 'documents');

  if (draft.selectionType === 'SISU' || draft.selectionType === 'SISU_PLUS') {
    add('REGULAR_SISU_TYPE', 'EXCLUDE', 'selectionType');
  }
  if (draft.regularSisuFlow === true) add('REGULAR_SISU_FLOW', 'EXCLUDE', 'regularSisuFlow');
  else if (draft.regularSisuFlow === null) add('SISU_FLOW_UNKNOWN', 'REVIEW', 'regularSisuFlow');
  if (
    (draft.selectionType === 'SISU' || draft.selectionType === 'SISU_PLUS') &&
    draft.regularSisuFlow === false
  ) {
    add('SISU_TYPE_FLOW_CONFLICT', 'REVIEW', 'regularSisuFlow');
  }
  if (draft.selectionType === 'REMAINING_SEATS') {
    add('REMAINING_SEATS_SCOPE_REVIEW', 'REVIEW', 'selectionType');
  }
  if (draft.selectionType === null) add('SELECTION_TYPE_UNKNOWN', 'REVIEW', 'selectionType');
  if (draft.selectionType === 'ENEM_OWN_SELECTION' && draft.requiresEnem === false) {
    add('ENEM_TYPE_REQUIREMENT_CONFLICT', 'REVIEW', 'requiresEnem');
  }
  if (draft.tuitionFree === false) add('PAID_TUITION', 'EXCLUDE', 'tuitionFree');
  else if (draft.tuitionFree === null) add('TUITION_UNKNOWN', 'REVIEW', 'tuitionFree');
  if (draft.applicationFeeBrl !== null && draft.applicationFeeBrl > 0) {
    add('FEE_WAIVER_UNMODELED', 'REVIEW', 'applicationFeeBrl');
  }

  validateWindows(draft, add);
  validateOfferings(draft, add);
  for (const issue of draft.issues) {
    add(`NORMALIZATION_${issue.code}`, 'REVIEW', issue.fieldPath);
  }

  return {
    disposition: issues.some((issue) => issue.severity === 'EXCLUDE')
      ? 'OUT_OF_SCOPE'
      : 'NEEDS_REVIEW',
    publishable: false,
    issues,
  };
}
