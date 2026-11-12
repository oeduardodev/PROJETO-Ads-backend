import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { DocumentProcessorKind } from '../../generated/prisma/enums.js';
import { ProcessingResultsRepository } from '../documents/processing-results.repository.js';
import type { JobPayloads } from './job-queues.js';

@Injectable()
export class DocumentProcessingProcessor {
  constructor(private readonly results: ProcessingResultsRepository) {}

  async classify(job: Job<JobPayloads['document.classify']>) {
    return this.results.recordImmutable({
      documentId: job.data.documentId,
      sha256: job.data.sha256,
      processorKind: DocumentProcessorKind.CLASSIFICATION,
      schemaVersion: 1,
      status: 'PENDING_REVIEW',
      result: {
        processor_kind: 'CLASSIFICATION',
        schema_version: 1,
        status: 'PENDING_REVIEW',
        result: null,
        reason: 'CLASSIFICATION_CONNECTOR_NOT_CONFIGURED',
      },
    });
  }

  async extract(job: Job<JobPayloads['document.extract']>) {
    const sha256 = await this.results.documentHash(job.data.documentId);
    if (!sha256) throw new Error('Extraction requires an existing document');
    return this.results.recordImmutable({
      documentId: job.data.documentId,
      sha256,
      processorKind: DocumentProcessorKind.EXTRACTION,
      schemaVersion: job.data.schemaVersion,
      status: 'PENDING_REVIEW',
      result: {
        processor_kind: 'EXTRACTION',
        schema_version: job.data.schemaVersion,
        status: 'PENDING_REVIEW',
        result: null,
        reason: 'EXTRACTION_CONNECTOR_NOT_CONFIGURED',
      },
    });
  }
}
