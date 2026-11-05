import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { validateDocumentRelation, type DocumentRelationInput } from './document-relation.js';

@Injectable()
export class DocumentRelationsRepository {
  constructor(private readonly database: PrismaService) {}

  linkDocuments(input: DocumentRelationInput) {
    const relation = validateDocumentRelation(input);
    return this.database.documentRelation.upsert({
      where: {
        originDocumentId_relatedDocumentId_relationType: relation,
      },
      create: relation,
      update: {},
    });
  }

  listRelatedDocuments(originDocumentId: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(originDocumentId)
    ) {
      throw new TypeError('originDocumentId must be a UUID');
    }
    return this.database.documentRelation.findMany({
      where: { originDocumentId: originDocumentId.toLowerCase() },
      include: { relatedDocument: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }
}
