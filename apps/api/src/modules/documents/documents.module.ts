import { Module } from '@nestjs/common';
import { DocumentsRepository } from './documents.repository.js';
import { ParserCacheRepository } from './cache/parser-cache.repository.js';
import { SnapshotRetentionRepository } from './cache/snapshot-retention.repository.js';
import { DocumentRelationsRepository } from './versioning/document-relations.repository.js';

@Module({
  providers: [
    DocumentsRepository,
    DocumentRelationsRepository,
    ParserCacheRepository,
    SnapshotRetentionRepository,
  ],
  exports: [
    DocumentsRepository,
    DocumentRelationsRepository,
    ParserCacheRepository,
    SnapshotRetentionRepository,
  ],
})
export class DocumentsModule {}
