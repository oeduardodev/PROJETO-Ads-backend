import { ExtractionV1 } from '../../ai/schemas/index.js';
import type { z } from 'zod';
import { normalizeKey } from '../../institutions/normalization.js';

type Extracted = z.infer<typeof ExtractionV1>;
type Requirement = NonNullable<Extracted['requirements']>[number];
type Reservation = NonNullable<NonNullable<Extracted['offerings']>[number]['reservations']>[number];
type Offering = NonNullable<Extracted['offerings']>[number];
type Window = NonNullable<Extracted['application_windows']>[number];

export interface NormalizedText {
  raw: string | null;
  display: string | null;
  key: string | null;
}

export interface NormalizationIssue {
  code: 'COURSE_UNKNOWN' | 'CAMPUS_UNRESOLVED' | 'DOCUMENT_UNKNOWN' | 'EMPTY_TEXT';
  fieldPath: string;
}

export interface NormalizedRequirement {
  criterion: NormalizedText;
  required: boolean | null;
  value: Requirement['value'];
}

export interface NormalizedReservation {
  category: NormalizedText;
  seats: number | null;
  requirements: NormalizedRequirement[] | null;
}

export interface NormalizedOffering {
  sourceIndex: number;
  course: NormalizedText;
  degreeType: NormalizedText;
  campus: NormalizedText;
  campusId: string | null;
  modality: NormalizedText;
  shift: NormalizedText;
  seats: number | null;
  reservations: NormalizedReservation[] | null;
  requirements: NormalizedRequirement[] | null;
  hasRequiredCourseName: boolean;
}

export interface NormalizedWindow {
  sourceIndex: number;
  label: NormalizedText;
  startDate: string | null;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  timezone: NormalizedText;
}

export interface NormalizedProcessDraft {
  institutionId: string;
  primaryDocumentId: string;
  documentIds: string[];
  noticeCode: NormalizedText;
  noticeYear: number | null;
  selectionType: Extracted['selection_type'];
  regularSisuFlow: boolean | null;
  requiresEnem: boolean | null;
  tuitionFree: boolean | null;
  applicationFeeBrl: number | null;
  windows: NormalizedWindow[] | null;
  offerings: NormalizedOffering[] | null;
  requirements: NormalizedRequirement[] | null;
  evidence: Array<{
    fieldPath: string;
    documentId: string;
    pageOrSection: string | null;
    quote: string;
  }>;
  issues: NormalizationIssue[];
}

export interface NormalizationContext {
  institutionId: string;
  primaryDocumentId: string;
  knownDocumentIds: readonly string[];
  reviewedCampuses?: readonly {
    id: string;
    institutionId: string;
    name: string;
    verifiedAt: Date | null;
  }[];
  campusAssignments?: readonly { sourceIndex: number; campusId: string }[];
}

function campusAssignmentIds(context: NormalizationContext): Map<number, string> {
  const assignments = new Map<number, string>();
  for (const assignment of context.campusAssignments ?? []) {
    if (!Number.isSafeInteger(assignment.sourceIndex) || assignment.sourceIndex < 0) {
      throw new Error('Campus assignment source index is invalid');
    }
    if (assignments.has(assignment.sourceIndex)) {
      throw new Error('Duplicate campus assignment source index');
    }
    assignments.set(assignment.sourceIndex, assignment.campusId);
  }
  return assignments;
}

function normalizedText(
  raw: string | null,
  path: string,
  issues: NormalizationIssue[],
): NormalizedText {
  if (raw === null) return { raw, display: null, key: null };
  const display = raw.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (!display) {
    issues.push({ code: 'EMPTY_TEXT', fieldPath: path });
    return { raw, display: null, key: null };
  }
  return { raw, display, key: normalizeKey(display) };
}

function normalizedRequirements(
  values: Requirement[] | null,
  path: string,
  issues: NormalizationIssue[],
): NormalizedRequirement[] | null {
  if (values === null) return null;
  return values.map((item, index) => ({
    criterion: normalizedText(item.criterion, `${path}[${index}].criterion`, issues),
    required: item.required,
    value: item.value === null ? null : structuredClone(item.value),
  }));
}

function normalizedReservations(
  values: Reservation[] | null,
  path: string,
  issues: NormalizationIssue[],
): NormalizedReservation[] | null {
  if (values === null) return null;
  return values.map((item, index) => ({
    category: normalizedText(item.category, `${path}[${index}].category`, issues),
    seats: item.seats,
    requirements: normalizedRequirements(
      item.requirements,
      `${path}[${index}].requirements`,
      issues,
    ),
  }));
}

function normalizedOfferings(
  values: Offering[] | null,
  issues: NormalizationIssue[],
  context: NormalizationContext,
): NormalizedOffering[] | null {
  const assignments = campusAssignmentIds(context);
  if (values === null) {
    if (assignments.size > 0) throw new Error('Campus assignment has no matching offering');
    return null;
  }
  const offerings = values.map((item, sourceIndex) => {
    const path = `offerings[${sourceIndex}]`;
    const course = normalizedText(item.course, `${path}.course`, issues);
    const campus = normalizedText(item.campus, `${path}.campus`, issues);
    if (course.display === null)
      issues.push({ code: 'COURSE_UNKNOWN', fieldPath: `${path}.course` });
    let campusId: string | null = null;
    const assignedId = assignments.get(sourceIndex);
    if (assignedId !== undefined) {
      const reviewed = context.reviewedCampuses?.find((candidate) => candidate.id === assignedId);
      if (
        !reviewed ||
        reviewed.institutionId !== context.institutionId ||
        reviewed.verifiedAt === null ||
        campus.key === null ||
        normalizeKey(reviewed.name) !== campus.key
      ) {
        throw new Error('Campus assignment must match a verified campus in the institution');
      }
      campusId = reviewed.id;
    } else if (campus.display !== null) {
      issues.push({ code: 'CAMPUS_UNRESOLVED', fieldPath: `${path}.campus` });
    }
    return {
      sourceIndex,
      course,
      degreeType: normalizedText(item.degree_type, `${path}.degree_type`, issues),
      campus,
      campusId,
      modality: normalizedText(item.modality, `${path}.modality`, issues),
      shift: normalizedText(item.shift, `${path}.shift`, issues),
      seats: item.seats,
      reservations: normalizedReservations(item.reservations, `${path}.reservations`, issues),
      requirements: normalizedRequirements(item.requirements, `${path}.requirements`, issues),
      hasRequiredCourseName: course.display !== null,
    };
  });
  if ([...assignments.keys()].some((index) => index >= offerings.length)) {
    throw new Error('Campus assignment has no matching offering');
  }
  return offerings;
}

function normalizedWindows(
  values: Window[] | null,
  issues: NormalizationIssue[],
): NormalizedWindow[] | null {
  if (values === null) return null;
  return values.map((item, sourceIndex) => ({
    sourceIndex,
    label: normalizedText(item.label, `application_windows[${sourceIndex}].label`, issues),
    startDate: item.start_date,
    startTime: item.start_time,
    endDate: item.end_date,
    endTime: item.end_time,
    timezone: normalizedText(item.timezone, `application_windows[${sourceIndex}].timezone`, issues),
  }));
}

export function normalizeExtractedProcess(
  raw: unknown,
  context: NormalizationContext,
): NormalizedProcessDraft {
  const extracted = ExtractionV1.parse(raw);
  if (extracted.institution_id !== context.institutionId) {
    throw new Error('Extracted institution_id differs from the verified context');
  }
  if (!context.knownDocumentIds.includes(context.primaryDocumentId)) {
    throw new Error('Primary document must be in the known document set');
  }
  const issues: NormalizationIssue[] = [];
  const known = new Set(context.knownDocumentIds);
  const documentIds = [context.primaryDocumentId];
  const evidence = extracted.evidence.map((item) => {
    if (!known.has(item.document_id)) {
      issues.push({ code: 'DOCUMENT_UNKNOWN', fieldPath: item.field });
    } else if (!documentIds.includes(item.document_id)) {
      documentIds.push(item.document_id);
    }
    return {
      fieldPath: item.field,
      documentId: item.document_id,
      pageOrSection: item.page_or_section,
      quote: item.excerpt,
    };
  });
  return {
    institutionId: context.institutionId,
    primaryDocumentId: context.primaryDocumentId,
    documentIds,
    noticeCode: normalizedText(extracted.notice_number, 'notice_number', issues),
    noticeYear: extracted.notice_year,
    selectionType: extracted.selection_type,
    regularSisuFlow: extracted.regular_sisu_flow,
    requiresEnem: extracted.requires_enem,
    tuitionFree: extracted.tuition_free,
    applicationFeeBrl: extracted.application_fee_brl,
    windows: normalizedWindows(extracted.application_windows, issues),
    offerings: normalizedOfferings(extracted.offerings, issues, context),
    requirements: normalizedRequirements(extracted.requirements, 'requirements', issues),
    evidence,
    issues,
  };
}
