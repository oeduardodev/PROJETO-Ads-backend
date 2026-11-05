import { Module } from '@nestjs/common';
import { DocumentsRepository } from './documents.repository.js';
import { DocumentRelationsRepository } from './versioning/document-relations.repository.js';

@Module({
  providers: [DocumentsRepository, DocumentRelationsRepository],
  exports: [DocumentsRepository, DocumentRelationsRepository],
})
export class DocumentsModule {}
