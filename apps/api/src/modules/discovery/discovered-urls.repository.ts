import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { normalizeSourceUrl } from '../sources/source-url.js';

export interface DiscoveryInput {
  sourceId: string;
  crawlRunId: string;
  url: string;
  relevanceScore?: number;
}

@Injectable()
export class DiscoveredUrlsRepository {
  constructor(private readonly database: PrismaService) {}

  record(input: DiscoveryInput) {
    const { url: canonicalUrl } = normalizeSourceUrl(input.url);
    const score = input.relevanceScore;
    if (score !== undefined && (!Number.isFinite(score) || score < 0 || score > 1)) {
      throw new Error('Relevance score must be from 0 to 1');
    }
    const now = new Date();
    return this.database.$transaction(async (transaction) => {
      const candidate = await transaction.discoveredUrl.upsert({
        where: { canonicalUrl },
        create: { canonicalUrl, foundAt: now, lastSeenAt: now, relevanceScore: score },
        update: { lastSeenAt: now, seenCount: { increment: 1 } },
      });
      await transaction.discoveryObservation.upsert({
        where: {
          discoveredUrlId_crawlRunId: {
            discoveredUrlId: candidate.id,
            crawlRunId: input.crawlRunId,
          },
        },
        create: {
          discoveredUrlId: candidate.id,
          sourceId: input.sourceId,
          crawlRunId: input.crawlRunId,
          firstSeenAt: now,
          lastSeenAt: now,
        },
        update: { lastSeenAt: now, seenCount: { increment: 1 } },
      });
      return candidate;
    });
  }

  findByUrl(url: string) {
    const { url: canonicalUrl } = normalizeSourceUrl(url);
    return this.database.discoveredUrl.findUnique({
      where: { canonicalUrl },
      include: { observations: true },
    });
  }
}
