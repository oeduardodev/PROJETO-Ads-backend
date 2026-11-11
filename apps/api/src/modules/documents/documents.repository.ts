import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { FixtureLocalStorage } from './fixture-local-storage.js';
import { hashObservedUrl, logStructured } from '../../observability/structured-log.js';
import { observabilityMetrics } from '../../observability/metrics.registry.js';

export interface FixtureSnapshotInput {
  url: string;
  mediaType: 'text/html' | 'application/pdf';
  bytes: Uint8Array;
  storage: FixtureLocalStorage;
}

@Injectable()
export class DocumentsRepository {
  constructor(private readonly database: PrismaService) {}

  async recordFixtureSnapshot(input: FixtureSnapshotInput) {
    if (process.env.NODE_ENV !== 'test' || !/^fixture:\/\/local\/[a-z0-9/_-]+$/u.test(input.url)) {
      throw new Error('Official snapshots require a reviewed retention policy');
    }
    if (!['text/html', 'application/pdf'].includes(input.mediaType)) {
      throw new Error('Unsupported snapshot MIME type');
    }
    const stored = input.storage.identify(input.bytes);
    const now = new Date();
    const document = await this.database.$transaction(async (transaction) => {
      const blob = await transaction.documentBlob.upsert({
        where: { sha256: stored.sha256 },
        create: { ...stored, expiredAt: null },
        update: { expiredAt: null },
      });
      if (blob.storageKey !== stored.storageKey || blob.byteLength !== stored.byteLength) {
        throw new Error('Snapshot hash identity conflicts with stored metadata');
      }
      const written = await input.storage.write(input.bytes);
      if (
        written.sha256 !== stored.sha256 ||
        written.storageKey !== stored.storageKey ||
        written.byteLength !== stored.byteLength
      ) {
        throw new Error('Snapshot bytes do not match their prepared identity');
      }
      const latest = await transaction.document.findFirst({
        where: { url: input.url },
        orderBy: { version: 'desc' },
      });
      if (latest?.sha256 === stored.sha256) {
        return transaction.document.update({ where: { id: latest.id }, data: { lastSeenAt: now } });
      }
      return transaction.document.create({
        data: {
          url: input.url,
          sha256: stored.sha256,
          storageKey: stored.storageKey,
          mediaType: input.mediaType,
          version: (latest?.version ?? 0) + 1,
          capturedAt: now,
          lastSeenAt: now,
        },
      });
    });
    observabilityMetrics.increment(
      'document_snapshots_recorded_total',
      'Fixture document snapshots recorded',
      {
        media_type: input.mediaType,
      },
    );
    logStructured('info', 'document.snapshot.recorded', {
      documentId: document.id,
      urlHash: hashObservedUrl(input.url),
    });
    return document;
  }

  listVersions(url: string) {
    return this.database.document.findMany({ where: { url }, orderBy: { version: 'asc' } });
  }
}
