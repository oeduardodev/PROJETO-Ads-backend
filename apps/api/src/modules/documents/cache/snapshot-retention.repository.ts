import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { isSnapshotBlobExpired } from './snapshot-retention.js';

export interface SnapshotByteDeleter {
  delete(storageKey: string): Promise<void>;
}

export interface SnapshotCleanupResult {
  examinedBlobs: number;
  expiredBlobs: number;
  nextCursor: string | null;
}

const SOURCE_RETENTION_INCLUDE = {
  documents: {
    include: {
      discoveredUrl: {
        include: {
          observations: {
            include: {
              source: { select: { snapshotRetentionDays: true, retentionReviewedAt: true } },
            },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class SnapshotRetentionRepository {
  constructor(private readonly database: PrismaService) {}

  async cleanupExpiredBlobs(
    now: Date,
    storage: SnapshotByteDeleter,
    batchSize = 100,
    afterSha256?: string,
  ): Promise<SnapshotCleanupResult> {
    if (!Number.isFinite(now.getTime())) throw new Error('now must be a valid date');
    if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1_000) {
      throw new Error('batchSize must be an integer from 1 to 1000');
    }
    if (afterSha256 !== undefined && !/^[0-9a-f]{64}$/iu.test(afterSha256)) {
      throw new Error('afterSha256 must contain 64 hexadecimal characters');
    }
    const candidates = await this.database.documentBlob.findMany({
      where: {
        expiredAt: null,
        ...(afterSha256 ? { sha256: { gt: afterSha256.toLowerCase() } } : {}),
      },
      include: SOURCE_RETENTION_INCLUDE,
      orderBy: { sha256: 'asc' },
      take: batchSize,
    });
    let expiredBlobs = 0;
    for (const candidate of candidates) {
      if (!isSnapshotBlobExpired(candidate, now)) continue;
      const expired = await this.database.$transaction(async (transaction) => {
        const locked = await transaction.$queryRaw<Array<{ expiredAt: Date | null }>>`
          SELECT "expired_at" AS "expiredAt"
          FROM "document_blobs"
          WHERE "sha256" = ${candidate.sha256}
          FOR UPDATE
        `;
        if (!locked[0] || locked[0].expiredAt !== null) return false;
        await transaction.$queryRaw`
          SELECT u."id"
          FROM "discovered_urls" u
          JOIN "documents" d ON d."discovered_url_id" = u."id"
          WHERE d."sha256" = ${candidate.sha256}
          FOR UPDATE OF u
        `;
        await transaction.$queryRaw`
          SELECT s."id"
          FROM "sources" s
          JOIN "discovery_observations" o ON o."source_id" = s."id"
          JOIN "discovered_urls" u ON u."id" = o."discovered_url_id"
          JOIN "documents" d ON d."discovered_url_id" = u."id"
          WHERE d."sha256" = ${candidate.sha256}
          FOR SHARE OF s
        `;
        const current = await transaction.documentBlob.findUnique({
          where: { sha256: candidate.sha256 },
          include: SOURCE_RETENTION_INCLUDE,
        });
        if (!current || !isSnapshotBlobExpired(current, now)) return false;
        await storage.delete(current.storageKey);
        await transaction.documentParseCache.deleteMany({ where: { sha256: current.sha256 } });
        await transaction.documentBlob.update({
          where: { sha256: current.sha256 },
          data: { expiredAt: now },
        });
        return true;
      });
      if (expired) expiredBlobs += 1;
    }
    return {
      examinedBlobs: candidates.length,
      expiredBlobs,
      nextCursor: candidates.length === batchSize ? (candidates.at(-1)?.sha256 ?? null) : null,
    };
  }
}
