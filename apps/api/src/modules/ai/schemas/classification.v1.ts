import { z } from 'zod';
import {
  EvidenceV1,
  requireEvidence,
  SchemaVersionV1,
  ScopeDecisionV1,
  SelectionTypeV1,
} from './taxonomy.v1.js';

export const ClassificationV1Object = z.strictObject({
  schema_version: SchemaVersionV1,
  scope_decision: ScopeDecisionV1,
  selection_type: SelectionTypeV1.nullable(),
  regular_sisu_flow: z.boolean().nullable(),
  requires_enem: z.boolean().nullable(),
  evidence: z.array(EvidenceV1),
});

export const ClassificationV1 = ClassificationV1Object.superRefine((value, context) => {
  const criticalValues: Array<[string, unknown]> = [
    ['scope_decision', value.scope_decision === 'UNKNOWN' ? null : value.scope_decision],
    ['selection_type', value.selection_type],
    ['regular_sisu_flow', value.regular_sisu_flow],
    ['requires_enem', value.requires_enem],
  ];
  for (const [field, fieldValue] of criticalValues) {
    requireEvidence(fieldValue, field, value.evidence, (missingField) => {
      context.addIssue({
        code: 'custom',
        path: ['evidence'],
        message: `Non-null critical field requires evidence: ${missingField}`,
      });
    });
  }
});

export type ClassificationV1 = z.infer<typeof ClassificationV1>;
