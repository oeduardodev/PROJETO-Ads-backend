import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { CrawlErrorCode, SourceKind, SourceStatus } from '../../generated/prisma/enums.js';
import type { JobPayloads } from './job-queues.js';
import { CrawlRunsRepository } from '../crawling/crawl-runs.repository.js';
import { HttpFetchError } from '../crawling/http/responsible-http.client.js';
import type {
  HttpResponse,
  ResponsibleHttpOptions,
} from '../crawling/http/responsible-http.client.js';
import { DiscoveredUrlsRepository } from '../discovery/discovered-urls.repository.js';
import { parseHtmlLinkCandidates } from '../discovery/parsers/html-link.parser.js';
import { assessDiscoveryRelevance } from '../discovery/relevance/relevance.classifier.js';
import { parseRssIncrementally } from '../discovery/strategies/rss.strategy.js';
import { parseSitemapIncrementally } from '../discovery/strategies/sitemap.strategy.js';
import type { DiscoveryStrategyCursor } from '../discovery/strategies/strategy-cursor.js';
import { JobsService } from './jobs.service.js';
import { SourcesRepository } from '../sources/sources.repository.js';
import { normalizeSourceUrl } from '../sources/source-url.js';
import { logStructured } from '../../observability/structured-log.js';

export const SOURCE_REFRESH_HTTP_FACTORY = Symbol('SOURCE_REFRESH_HTTP_FACTORY');
export const SOURCE_REFRESH_MAX_BYTES = Symbol('SOURCE_REFRESH_MAX_BYTES');

export type SourceRefreshHttpClient = { fetch(url: string): Promise<HttpResponse> };
export type SourceRefreshHttpFactory = (options: ResponsibleHttpOptions) => SourceRefreshHttpClient;

function crawlRunId(sourceId: string, queueJobId: string): string {
  const bytes = createHash('sha256')
    .update(`alem-do-sisu:crawl-run:v1:${sourceId}:${queueJobId}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function crawlError(error: unknown): CrawlErrorCode {
  if (!(error instanceof HttpFetchError)) return CrawlErrorCode.UNKNOWN;
  if (error.status === 429) return CrawlErrorCode.RATE_LIMITED;
  if (error.status === 401 || error.status === 403 || error.code === 'ROBOTS') {
    return CrawlErrorCode.ACCESS_DENIED;
  }
  if (error.code === 'TIMEOUT') return CrawlErrorCode.TIMEOUT;
  if (error.code === 'NETWORK') return CrawlErrorCode.NETWORK;
  if (error.status !== undefined && error.status >= 500) return CrawlErrorCode.HTTP_5XX;
  if (error.status !== undefined && error.status >= 400) return CrawlErrorCode.HTTP_4XX;
  if (error.code === 'POLICY' || error.code === 'SSRF') return CrawlErrorCode.ACCESS_DENIED;
  return CrawlErrorCode.UNKNOWN;
}

function httpStatus(error: unknown): number | undefined {
  return error instanceof HttpFetchError ? error.status : undefined;
}

function expectedContentType(kind: SourceKind, contentType: string | undefined): boolean {
  const normalized = contentType?.split(';', 1)[0]?.trim().toLowerCase();
  if (kind === SourceKind.HTML_INDEX) {
    return normalized === 'text/html' || normalized === 'application/xhtml+xml';
  }
  return (
    normalized === 'application/xml' ||
    normalized === 'text/xml' ||
    normalized === 'application/rss+xml' ||
    normalized === 'application/atom+xml'
  );
}

@Injectable()
export class SourceRefreshProcessor {
  constructor(
    private readonly sources: SourcesRepository,
    private readonly crawlRuns: CrawlRunsRepository,
    private readonly discoveredUrls: DiscoveredUrlsRepository,
    private readonly jobs: JobsService,
    @Inject(SOURCE_REFRESH_HTTP_FACTORY)
    private readonly createHttpClient: SourceRefreshHttpFactory,
    @Inject(SOURCE_REFRESH_MAX_BYTES) private readonly maxBytes: number,
  ) {}

  async process(job: Job<JobPayloads['source.refresh']>) {
    const { sourceId } = job.data;
    const source = await this.sources.getRefreshContext(sourceId);
    if (!source) throw new Error('Source does not exist');
    if (
      source.status !== SourceStatus.ACTIVE ||
      !source.allowedDomain.collectionAllowed ||
      source.allowedDomain.reviewedAt === null
    ) {
      logStructured('warn', 'source.crawl.skipped_unreviewed', { sourceId });
      return { status: 'SKIPPED_POLICY' as const, discovered: 0 };
    }

    const sourceUrl = normalizeSourceUrl(source.url);
    if (sourceUrl.host !== source.allowedDomain.host) {
      throw new Error('Source URL host does not match its reviewed exact host');
    }
    const id = job.id ? crawlRunId(sourceId, job.id) : crawlRunId(sourceId, String(job.timestamp));
    const attempt = job.attemptsMade + 1;
    const run = await this.crawlRuns.startOrResumeRecord(id, sourceId, attempt);
    try {
      const client = this.createHttpClient({
        allowedHosts: [source.allowedDomain.host],
        collectionAllowed: true,
        userAgent: 'AlemDoSiSU-Bot/1.0',
        maxBytes: this.maxBytes,
      });
      const response = await client.fetch(sourceUrl.url);
      if (response.status !== 200) {
        throw new HttpFetchError(
          'Source index returned a non-success status',
          'HTTP',
          response.status,
        );
      }
      if (!expectedContentType(source.kind, response.headers['content-type'])) {
        throw new HttpFetchError('Source index returned an unexpected content type', 'POLICY');
      }

      const body = response.body.toString('utf8');
      let urls: Array<{ url: string; relevanceScore: number }>;
      let nextCursor: DiscoveryStrategyCursor | undefined;
      if (source.kind === SourceKind.HTML_INDEX) {
        urls = parseHtmlLinkCandidates(body, sourceUrl.url, [source.allowedDomain.host]).map(
          (candidate) => ({
            url: candidate.canonicalUrl,
            relevanceScore: candidate.relevanceScore,
          }),
        );
      } else if (source.kind === SourceKind.RSS) {
        const state = await this.sources.getStrategyState(sourceId);
        const result = parseRssIncrementally(
          body,
          sourceUrl.url,
          [source.allowedDomain.host],
          state.discoveryCursor,
        );
        nextCursor = result.cursor;
        urls = result.urls.map((url) => ({
          url,
          relevanceScore: assessDiscoveryRelevance('', url).score,
        }));
      } else {
        const state = await this.sources.getStrategyState(sourceId);
        const result = parseSitemapIncrementally(
          body,
          sourceUrl.url,
          [source.allowedDomain.host],
          state.discoveryCursor,
        );
        nextCursor = result.cursor;
        urls = result.urls.map((url) => ({
          url,
          relevanceScore: assessDiscoveryRelevance('', url).score,
        }));
      }

      let discovered = 0;
      for (const candidate of urls) {
        const recorded = await this.discoveredUrls.record({
          sourceId,
          crawlRunId: run.id,
          url: candidate.url,
          relevanceScore: candidate.relevanceScore,
        });
        discovered += 1;
        if (recorded.status === 'CANDIDATE') await this.jobs.enqueueUrlFetch(recorded.id);
      }
      if (nextCursor !== undefined) await this.sources.saveStrategyState(sourceId, nextCursor);
      await this.crawlRuns.finishSuccess(run.id, response.status);
      return { status: 'SUCCEEDED' as const, discovered };
    } catch (error) {
      const attempts = job.opts.attempts ?? 1;
      const isFinalAttempt = attempt >= attempts;
      if (isFinalAttempt)
        await this.crawlRuns.finishFailure(run.id, crawlError(error), httpStatus(error));
      throw error;
    }
  }
}
