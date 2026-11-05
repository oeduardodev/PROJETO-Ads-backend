import { z } from 'zod';

export const SchemaVersionV1 = z.literal(1);

export const ScopeDecisionV1 = z.enum(['IN_SCOPE', 'OUT_OF_SCOPE', 'PENDING_REVIEW', 'UNKNOWN']);

// Codes are the controlled corpus taxonomy in docs/domain/glossary.md.
export const SelectionTypeV1 = z.enum([
  'GRADUATE_ENTRY',
  'TRANSFER',
  'COURSE_CHANGE',
  'SPECIFIC_KNOWLEDGE',
  'REMAINING_SEATS',
  'FIELD_EDUCATION',
  'ENEM_OWN_SELECTION',
  'SCHOOL_RECORD',
  'OLYMPIAD_ENTRY',
  'PRONERA_GRADUATION',
  'SISU',
  'SISU_PLUS',
]);

export const EvidenceV1 = z.strictObject({
  field: z.string().min(1),
  document_id: z.uuid(),
  page_or_section: z.string().nullable(),
  excerpt: z.string().min(1),
});

export type EvidenceV1 = z.infer<typeof EvidenceV1>;

export function requireEvidence(
  value: unknown,
  field: string,
  evidence: readonly EvidenceV1[],
  addIssue: (field: string) => void,
): void {
  if (value !== null && value !== undefined && !evidence.some((item) => item.field === field)) {
    addIssue(field);
  }
}
