import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { normalizeSourceUrl } from '../sources/source-url.js';
import { hashObservedUrl, logStructured } from '../../observability/structured-log.js';
import { observabilityMetrics } from '../../observability/metrics.registry.js';

export interface DiscoveryInput {
  sourceId: string;
  crawlRunId: string;
  url: string;
  relevanceScore?: number;
}

@Injectable()
export class DiscoveredUrlsRepository {
  constructor(private readonly database: PrismaService) {}

  async record(input: DiscoveryInput) {
    const { url: canonicalUrl } = normalizeSourceUrl(input.url);
    const score = input.relevanceScore;
    if (score !== undefined && (!Number.isFinite(score) || score < 0 || score > 1)) {
      throw new Error('Relevance score must be from 0 to 1');
    }
    const now = new Date();
    const candidate = await this.database.$transaction(async (transaction) => {
      // Serialize writes for this canonical URL so a repeated run cannot race the
      // observation check and increment counters more than once per crawl run.
      await transaction.$queryRaw`SELECT 1::int AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${canonicalUrl}, 0))) AS advisory_lock`;

      const existingCandidate = await transaction.discoveredUrl.findUnique({
        where: { canonicalUrl },
      });
      if (existingCandidate) {
        const existingObservation = await transaction.discoveryObservation.findUnique({
          where: {
            discoveredUrlId_crawlRunId: {
              discoveredUrlId: existingCandidate.id,
              crawlRunId: input.crawlRunId,
            },
          },
        });
        if (existingObservation) return existingCandidate;

        const observation = await transaction.discoveryObservation.createMany({
          data: [
            {
              discoveredUrlId: existingCandidate.id,
              sourceId: input.sourceId,
              crawlRunId: input.crawlRunId,
              firstSeenAt: now,
              lastSeenAt: now,
            },
          ],
          skipDuplicates: true,
        });
        if (observation.count === 0) return existingCandidate;

        return transaction.discoveredUrl.update({
          where: { id: existingCandidate.id },
          data: { lastSeenAt: now, seenCount: { increment: 1 } },
        });
      }

      const candidate = await transaction.discoveredUrl.create({
        data: {
          canonicalUrl,
          foundAt: now,
          lastSeenAt: now,
          seenCount: 1,
          ...(score === undefined ? {} : { relevanceScore: score }),
        },
      });
      await transaction.discoveryObservation.create({
        data: {
          discoveredUrlId: candidate.id,
          sourceId: input.sourceId,
          crawlRunId: input.crawlRunId,
          firstSeenAt: now,
          lastSeenAt: now,
        },
      });
      return candidate;
    });
    observabilityMetrics.increment(
      'source_url_observation_attempts_total',
      'Idempotent URL observation attempts by source',
      { source_id: input.sourceId },
    );
    logStructured('info', 'discovery.url.observed', {
      sourceId: input.sourceId,
      crawlRunId: input.crawlRunId,
      discoveredUrlId: candidate.id,
      urlHash: hashObservedUrl(normalizeSourceUrl(input.url).url),
    });
    return candidate;
  }

  findByUrl(url: string) {
    const { url: canonicalUrl } = normalizeSourceUrl(url);
    return this.database.discoveredUrl.findUnique({
      where: { canonicalUrl },
      include: { observations: true },
    });
  }

  getFetchContext(id: string) {
    return this.database.discoveredUrl.findUnique({
      where: { id },
      include: {
        observations: {
          include: {
            source: { include: { allowedDomain: true } },
          },
        },
      },
    });
  }
}
