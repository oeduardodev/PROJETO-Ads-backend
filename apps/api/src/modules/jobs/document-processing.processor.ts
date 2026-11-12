import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { DocumentProcessorKind } from '../../generated/prisma/enums.js';
import { ProcessingResultsRepository } from '../documents/processing-results.repository.js';
import { DocumentProcessingContentService } from './document-processing-content.service.js';
import { JobsService } from './jobs.service.js';
import type { JobPayloads } from './job-queues.js';

@Injectable()
export class DocumentProcessingProcessor {
  constructor(
    private readonly results: ProcessingResultsRepository,
    private readonly jobs: JobsService,
    private readonly content: DocumentProcessingContentService,
  ) {}

  async classify(job: Job<JobPayloads['document.classify']>) {
    let classification: {
      schema_version: 1;
      scope_decision: 'PENDING_REVIEW';
      selection_type: null;
      regular_sisu_flow: null;
      requires_enem: null;
      evidence: Array<{
        field: string;
        document_id: string;
        page_or_section: string | null;
        excerpt: string;
      }>;
    } | null = null;
    let reason: string;
    try {
      const parsed = await this.content.parseFixture(job.data.documentId, job.data.sha256);
      const source = parsed.excerpts.find((excerpt) => excerpt.text.trim());
      if (source) {
        classification = {
          schema_version: 1,
          scope_decision: 'PENDING_REVIEW',
          selection_type: null,
          regular_sisu_flow: null,
          requires_enem: null,
          evidence: [
            {
              field: 'scope_decision',
              document_id: job.data.documentId,
              page_or_section: source.pageOrSection,
              excerpt: source.text.slice(0, 500),
            },
          ],
        };
        reason = 'SCOPE_REQUIRES_HUMAN_REVIEW';
      } else {
        reason = 'NO_REVIEWABLE_TEXT_FOUND';
      }
    } catch {
      reason =
        process.env.NODE_ENV === 'test'
          ? 'FIXTURE_PARSING_UNAVAILABLE'
          : 'OFFICIAL_STORAGE_REVIEW_REQUIRED';
    }
    const result = await this.results.recordImmutable({
      documentId: job.data.documentId,
      sha256: job.data.sha256,
      processorKind: DocumentProcessorKind.CLASSIFICATION,
      schemaVersion: 1,
      status: 'PENDING_REVIEW',
      result: {
        processor_kind: 'CLASSIFICATION',
        schema_version: 1,
        status: 'PENDING_REVIEW',
        result: classification,
        reason,
      },
    });
    await this.jobs.enqueueDocumentExtract(job.data.documentId, 1);
    return result;
  }

  async extract(job: Job<JobPayloads['document.extract']>) {
    const sha256 = await this.results.documentHash(job.data.documentId);
    if (!sha256) throw new Error('Extraction requires an existing document');
    let reason = 'AI_PROVIDER_DISABLED';
    try {
      const parsed = await this.content.parseFixture(job.data.documentId, sha256);
      if (parsed.excerpts.length === 0) reason = 'NO_REVIEWABLE_TEXT_FOUND';
    } catch {
      reason =
        process.env.NODE_ENV === 'test'
          ? 'FIXTURE_PARSING_UNAVAILABLE'
          : 'OFFICIAL_STORAGE_REVIEW_REQUIRED';
    }
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
        reason,
      },
    });
  }
}
