import { z } from 'zod';
import { ClassificationV1Object } from './classification.v1.js';
import { ExtractionV1Object } from './extraction.v1.js';

export { ClassificationV1 } from './classification.v1.js';
export {
  ApplicationWindowV1,
  ExtractionV1,
  OfferingV1,
  RequirementV1,
  ReservationV1,
} from './extraction.v1.js';
export { EvidenceV1, ScopeDecisionV1, SelectionTypeV1 } from './taxonomy.v1.js';

export const ClassificationV1JsonSchema = z.toJSONSchema(ClassificationV1Object, {
  target: 'draft-2020-12',
});
export const ExtractionV1JsonSchema = z.toJSONSchema(ExtractionV1Object, {
  target: 'draft-2020-12',
});
