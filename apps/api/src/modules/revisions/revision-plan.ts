import { isDeepStrictEqual } from 'node:util';
import type { NormalizedProcessDraft } from '../processes/normalization/normalized-process.js';

export interface FieldChange {
  path: string;
  before: unknown;
  after: unknown;
  beforePresent: boolean;
  afterPresent: boolean;
  critical: boolean;
}

export interface RevisionPlan {
  action: 'NO_CHANGE' | 'REVIEW_CANDIDATE';
  previousDocumentId: string;
  candidateDocumentId: string;
  changedFields: FieldChange[];
  requiresReview: boolean;
  blocksCurrentPublication: boolean;
  previous: NormalizedProcessDraft;
  candidate: NormalizedProcessDraft;
}

const CRITICAL_ROOTS = new Set([
  'noticeCode',
  'noticeYear',
  'selectionType',
  'regularSisuFlow',
  'requiresEnem',
  'tuitionFree',
  'applicationFeeBrl',
  'windows',
  'offerings',
  'requirements',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCritical(path: string): boolean {
  if (path.endsWith('.raw')) return false;
  const root = path.split(/[.[]/u, 1)[0];
  return CRITICAL_ROOTS.has(root ?? '');
}

function changesBetween(before: unknown, after: unknown): FieldChange[] {
  const changes: FieldChange[] = [];
  const visit = (
    oldValue: unknown,
    newValue: unknown,
    path: string,
    beforePresent: boolean,
    afterPresent: boolean,
  ) => {
    if (isDeepStrictEqual(oldValue, newValue) && beforePresent === afterPresent) return;
    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      for (let index = 0; index < Math.max(oldValue.length, newValue.length); index += 1) {
        visit(
          oldValue[index],
          newValue[index],
          `${path}[${index}]`,
          index < oldValue.length,
          index < newValue.length,
        );
      }
      return;
    }
    if (isRecord(oldValue) && isRecord(newValue)) {
      for (const key of new Set([...Object.keys(oldValue), ...Object.keys(newValue)])) {
        visit(
          oldValue[key],
          newValue[key],
          path ? `${path}.${key}` : key,
          key in oldValue,
          key in newValue,
        );
      }
      return;
    }
    changes.push({
      path,
      before: beforePresent ? structuredClone(oldValue) : null,
      after: afterPresent ? structuredClone(newValue) : null,
      beforePresent,
      afterPresent,
      critical: isCritical(path),
    });
  };
  visit(before, after, '', true, true);
  return changes;
}

export function planRevision(
  previous: NormalizedProcessDraft,
  candidate: NormalizedProcessDraft,
): RevisionPlan {
  if (previous.institutionId !== candidate.institutionId) {
    throw new Error('A revision cannot change institution identity');
  }
  const previousSnapshot = structuredClone(previous);
  const candidateSnapshot = structuredClone(candidate);
  const { institutionId: _oldInstitution, issues: _oldIssues, ...oldFields } = previousSnapshot;
  const { institutionId: _newInstitution, issues: _newIssues, ...newFields } = candidateSnapshot;
  void _oldInstitution;
  void _newInstitution;
  void _oldIssues;
  void _newIssues;
  const changedFields = changesBetween(oldFields, newFields);
  const requiresReview = changedFields.length > 0;
  return {
    action: requiresReview ? 'REVIEW_CANDIDATE' : 'NO_CHANGE',
    previousDocumentId: previous.primaryDocumentId,
    candidateDocumentId: candidate.primaryDocumentId,
    changedFields,
    requiresReview,
    blocksCurrentPublication: changedFields.some((change) => change.critical),
    previous: previousSnapshot,
    candidate: candidateSnapshot,
  };
}
