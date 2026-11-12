import { Injectable } from '@nestjs/common';
import { SourceHealth, SourceKind, SourceStatus } from '../../generated/prisma/enums.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { DiscoveryStrategyCursor } from '../discovery/strategies/strategy-cursor.js';
import { normalizeAuthorizedHost, normalizeSourceUrl } from './source-url.js';

@Injectable()
export class AllowedDomainsRepository {
  constructor(private readonly database: PrismaService) {}

  create(input: { institutionId: string; host: string; evidenceUrl: string }) {
    const host = normalizeAuthorizedHost(input.host);
    const evidence = normalizeSourceUrl(input.evidenceUrl);
    if (evidence.host !== host) throw new Error('Domain evidence must use the same exact host');
    return this.database.allowedDomain.create({
      data: {
        institution: { connect: { id: input.institutionId } },
        host,
        evidenceUrl: evidence.url,
      },
    });
  }

  listByInstitution(institutionId: string) {
    return this.database.allowedDomain.findMany({
      where: { institutionId },
      orderBy: { host: 'asc' },
    });
  }
}

export interface SourceInput {
  institutionId: string;
  url: string;
  kind: SourceKind;
  selector?: string;
  frequencyMinutes?: number;
  priority?: number;
}

@Injectable()
export class SourcesRepository {
  constructor(private readonly database: PrismaService) {}

  async create(input: SourceInput) {
    const source = normalizeSourceUrl(input.url);
    const domain = await this.database.allowedDomain.findUnique({
      where: { institutionId_host: { institutionId: input.institutionId, host: source.host } },
    });
    if (!domain) throw new Error('Source host is not allowlisted for this institution');
    const frequencyMinutes = input.frequencyMinutes ?? 1440;
    const priority = input.priority ?? 100;
    if (!Number.isInteger(frequencyMinutes) || frequencyMinutes < 1) {
      throw new Error('Source frequency must be a positive integer');
    }
    if (!Number.isInteger(priority) || priority < 0) {
      throw new Error('Source priority must be a nonnegative integer');
    }
    return this.database.source.create({
      data: {
        institution: { connect: { id: input.institutionId } },
        allowedDomain: { connect: { id: domain.id } },
        url: source.url,
        kind: input.kind,
        selector: input.selector,
        frequencyMinutes,
        priority,
      },
    });
  }

  listByInstitution(institutionId: string) {
    return this.database.source.findMany({
      where: { institutionId },
      orderBy: [{ priority: 'asc' }, { url: 'asc' }],
    });
  }

  listSchedulable() {
    return this.database.source.findMany({
      where: {
        status: SourceStatus.ACTIVE,
        health: { not: SourceHealth.BLOCKED },
        allowedDomain: {
          is: { collectionAllowed: true, reviewedAt: { not: null } },
        },
      },
      select: {
        id: true,
        frequencyMinutes: true,
        priority: true,
        health: true,
        lastCheckedAt: true,
        allowedDomain: { select: { host: true } },
      },
    });
  }

  getRefreshContext(sourceId: string) {
    return this.database.source.findUnique({
      where: { id: sourceId },
      include: { allowedDomain: true },
    });
  }

  setSnapshotRetentionPolicy(
    sourceId: string,
    snapshotRetentionDays: number | null,
    retentionReviewedAt: Date | null,
    now = new Date(),
  ) {
    if (!Number.isFinite(now.getTime())) throw new Error('now must be a valid date');
    if (snapshotRetentionDays === null && retentionReviewedAt === null) {
      return this.database.source.update({
        where: { id: sourceId },
        data: { snapshotRetentionDays: null, retentionReviewedAt: null },
      });
    }
    if (
      !Number.isSafeInteger(snapshotRetentionDays) ||
      snapshotRetentionDays === null ||
      snapshotRetentionDays < 1
    ) {
      throw new Error('Snapshot retention requires a positive number of days');
    }
    if (!retentionReviewedAt || !Number.isFinite(retentionReviewedAt.getTime())) {
      throw new Error('Snapshot retention requires a valid review date');
    }
    if (retentionReviewedAt.getTime() > now.getTime()) {
      throw new Error('Snapshot retention review date cannot be in the future');
    }
    return this.database.source.update({
      where: { id: sourceId },
      data: { snapshotRetentionDays, retentionReviewedAt },
    });
  }

  async mapHostsBySourceIds(sourceIds: string[]): Promise<Map<string, string>> {
    if (sourceIds.length === 0) return new Map();
    const sources = await this.database.source.findMany({
      where: { id: { in: sourceIds } },
      select: { id: true, allowedDomain: { select: { host: true } } },
    });
    return new Map(sources.map((source) => [source.id, source.allowedDomain.host]));
  }

  getStrategyState(sourceId: string) {
    return this.database.source.findUniqueOrThrow({
      where: { id: sourceId },
      select: { kind: true, discoveryCursor: true, strategyLastExecutedAt: true },
    });
  }

  async saveStrategyState(
    sourceId: string,
    cursor: DiscoveryStrategyCursor,
    executedAt = new Date(),
  ) {
    if (!Number.isFinite(executedAt.getTime())) {
      throw new Error('Strategy execution date must be valid');
    }
    const kind = cursor.strategy === 'RSS' ? SourceKind.RSS : SourceKind.SITEMAP;
    const result = await this.database.source.updateMany({
      where: { id: sourceId, kind },
      data: {
        discoveryCursor: cursor as unknown as Prisma.InputJsonValue,
        strategyLastExecutedAt: executedAt,
      },
    });
    if (result.count !== 1) {
      throw new Error('Source not found or strategy cursor does not match source kind');
    }
    return this.getStrategyState(sourceId);
  }
}
