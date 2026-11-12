import { Module } from '@nestjs/common';
import { DocumentsRepository } from './documents.repository.js';
import { ParserCacheRepository } from './cache/parser-cache.repository.js';
import { SnapshotRetentionRepository } from './cache/snapshot-retention.repository.js';
import { DocumentRelationsRepository } from './versioning/document-relations.repository.js';
import { ProcessingResultsRepository } from './processing-results.repository.js';

@Module({
  providers: [
    DocumentsRepository,
    DocumentRelationsRepository,
    ParserCacheRepository,
    SnapshotRetentionRepository,
    ProcessingResultsRepository,
  ],
  exports: [
    DocumentsRepository,
    DocumentRelationsRepository,
    ParserCacheRepository,
    SnapshotRetentionRepository,
    ProcessingResultsRepository,
  ],
})
export class DocumentsModule {}
