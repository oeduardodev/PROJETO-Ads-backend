import { DocumentRelationType } from '../../../generated/prisma/enums.js';

export interface DocumentRelationInput {
  originDocumentId: string;
  relatedDocumentId: string;
  relationType: DocumentRelationType;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const RELATION_TYPES = new Set<string>(Object.values(DocumentRelationType));

export function validateDocumentRelation(input: DocumentRelationInput): DocumentRelationInput {
  if (!UUID.test(input.originDocumentId)) {
    throw new TypeError('originDocumentId must be a UUID');
  }
  if (!UUID.test(input.relatedDocumentId)) {
    throw new TypeError('relatedDocumentId must be a UUID');
  }
  const originDocumentId = input.originDocumentId.toLowerCase();
  const relatedDocumentId = input.relatedDocumentId.toLowerCase();
  if (originDocumentId === relatedDocumentId) {
    throw new TypeError('A document cannot be related to itself');
  }
  if (!RELATION_TYPES.has(input.relationType)) {
    throw new TypeError('relationType is not supported');
  }
  return { originDocumentId, relatedDocumentId, relationType: input.relationType };
}
