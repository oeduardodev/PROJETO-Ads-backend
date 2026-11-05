export interface SourceRetentionDecision {
  snapshotRetentionDays: number | null;
  retentionReviewedAt: Date | null;
}

export interface SnapshotRetentionDocument {
  capturedAt: Date;
  discoveredUrl: {
    observations: Array<{ source: SourceRetentionDecision }>;
  } | null;
}

export interface SnapshotRetentionBlob {
  expiredAt: Date | null;
  documents: SnapshotRetentionDocument[];
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;

export function snapshotBlobRetentionDeadline(blob: SnapshotRetentionBlob): Date | undefined {
  if (blob.expiredAt || blob.documents.length === 0) return undefined;
  let blobDeadline = 0;
  for (const document of blob.documents) {
    if (!Number.isFinite(document.capturedAt.getTime())) return undefined;
    const sources = document.discoveredUrl?.observations.map(({ source }) => source) ?? [];
    if (sources.length === 0) return undefined;
    let documentDeadline = 0;
    for (const source of sources) {
      const reviewedAt = source.retentionReviewedAt;
      const days = source.snapshotRetentionDays;
      if (
        !reviewedAt ||
        !Number.isFinite(reviewedAt.getTime()) ||
        !Number.isSafeInteger(days) ||
        days === null ||
        days < 1
      ) {
        return undefined;
      }
      const retentionStart = Math.max(document.capturedAt.getTime(), reviewedAt.getTime());
      const deadline = retentionStart + days * MILLISECONDS_PER_DAY;
      if (!Number.isFinite(deadline)) return undefined;
      documentDeadline = Math.max(documentDeadline, deadline);
    }
    blobDeadline = Math.max(blobDeadline, documentDeadline);
  }
  return new Date(blobDeadline);
}

export function isSnapshotBlobExpired(blob: SnapshotRetentionBlob, now: Date): boolean {
  if (!Number.isFinite(now.getTime())) throw new Error('now must be a valid date');
  const deadline = snapshotBlobRetentionDeadline(blob);
  return deadline !== undefined && deadline.getTime() <= now.getTime();
}
