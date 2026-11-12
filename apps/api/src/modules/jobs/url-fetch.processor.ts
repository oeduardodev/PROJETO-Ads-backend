import { Inject, Injectable } from '@nestjs/common';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Job } from 'bullmq';
import { DiscoveredUrlStatus, SourceStatus } from '../../generated/prisma/enums.js';
import type { JobPayloads } from './job-queues.js';
import { DiscoveredUrlsRepository } from '../discovery/discovered-urls.repository.js';
import {
  DocumentFetchError,
  fetchTypedArtifact,
} from '../documents/fetch/secure-artifact-fetcher.js';
import { FixtureLocalStorage } from '../documents/fixture-local-storage.js';
import { DocumentsRepository } from '../documents/documents.repository.js';
import type {
  HttpResponse,
  ResponsibleHttpOptions,
} from '../crawling/http/responsible-http.client.js';
import { HttpFetchError } from '../crawling/http/responsible-http.client.js';
import { normalizeSourceUrl } from '../sources/source-url.js';
import { JobsService } from './jobs.service.js';
import { logStructured } from '../../observability/structured-log.js';

export const URL_FETCH_HTTP_FACTORY = Symbol('URL_FETCH_HTTP_FACTORY');
export const URL_FETCH_MAX_BYTES = Symbol('URL_FETCH_MAX_BYTES');

export type UrlFetchHttpClient = { fetch(url: string): Promise<HttpResponse> };
export type UrlFetchHttpFactory = (options: ResponsibleHttpOptions) => UrlFetchHttpClient;

function isAuthorizedObservation(
  observation: {
    source: {
      status: SourceStatus;
      allowedDomain: { host: string; reviewedAt: Date | null; collectionAllowed: boolean };
    };
  },
  host: string,
): boolean {
  const { source } = observation;
  return (
    source.status === SourceStatus.ACTIVE &&
    source.allowedDomain.collectionAllowed &&
    source.allowedDomain.reviewedAt !== null &&
    source.allowedDomain.host === host
  );
}

function errorReason(error: unknown): string {
  if (error instanceof DocumentFetchError) return error.failureCode;
  if (error instanceof HttpFetchError) return error.code;
  return 'UNKNOWN';
}

@Injectable()
export class UrlFetchProcessor {
  constructor(
    private readonly discoveredUrls: DiscoveredUrlsRepository,
    private readonly documents: DocumentsRepository,
    private readonly jobs: JobsService,
    @Inject(URL_FETCH_HTTP_FACTORY) private readonly createHttpClient: UrlFetchHttpFactory,
    @Inject(URL_FETCH_MAX_BYTES) private readonly maxBytes: number,
  ) {}

  async process(job: Job<JobPayloads['url.fetch']>) {
    const candidate = await this.discoveredUrls.getFetchContext(job.data.candidateUrlId);
    if (!candidate || candidate.status !== DiscoveredUrlStatus.CANDIDATE) {
      return { status: 'SKIPPED_NOT_CANDIDATE' as const };
    }

    const normalized = normalizeSourceUrl(candidate.canonicalUrl);
    const authorized = candidate.observations.some((observation) =>
      isAuthorizedObservation(observation, normalized.host),
    );
    if (!authorized) {
      logStructured('warn', 'document.fetch.skipped_unreviewed', {
        candidateUrlId: candidate.id,
      });
      return { status: 'SKIPPED_POLICY' as const };
    }

    // Official bytes remain blocked until a reviewed retention rule and a production
    // storage adapter are selected. Test-only artifacts use the approved local fixture store.
    if (process.env.NODE_ENV !== 'test') {
      return { status: 'BLOCKED_STORAGE_REVIEW' as const };
    }
    if (!normalized.host.endsWith('.test') && !normalized.host.endsWith('.example')) {
      return { status: 'BLOCKED_NON_FIXTURE_HOST' as const };
    }

    try {
      const artifact = await fetchTypedArtifact(
        this.createHttpClient({
          allowedHosts: [normalized.host],
          collectionAllowed: true,
          userAgent: 'AlemDoSiSU-Bot/1.0',
          maxBytes: this.maxBytes,
        }),
        candidate.canonicalUrl,
        { maxBytes: this.maxBytes },
      );
      const storage = new FixtureLocalStorage(
        join(tmpdir(), 'alem-do-sisu-worker-fixtures', String(process.pid)),
      );
      const document = await this.documents.recordFixtureSnapshot({
        url: `fixture://local/candidate/${candidate.id}`,
        discoveredUrlId: candidate.id,
        mediaType: artifact.mediaType,
        bytes: artifact.bytes,
        storage,
      });
      await this.jobs.enqueueDocumentClassify(document.id, document.sha256);
      return { status: 'SNAPSHOTTED_FIXTURE' as const, documentId: document.id };
    } catch (error) {
      logStructured('warn', 'document.fetch.failed', {
        candidateUrlId: candidate.id,
        failureCode: errorReason(error),
      });
      throw error;
    }
  }
}
