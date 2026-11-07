import { normalizeKey } from '../../institutions/normalization.js';

export interface ProcessIdentity {
  institutionId: string;
  noticeCode: string | null;
  noticeYear: number | null;
  primaryDocumentId: string;
  primaryDocumentSha256: string;
}

export interface ExistingProcessIdentity extends Omit<
  ProcessIdentity,
  'primaryDocumentId' | 'primaryDocumentSha256'
> {
  id: string;
  primaryDocumentIds: readonly string[];
  primaryDocumentHashes: readonly string[];
}

export type ReconciliationResult =
  | { action: 'MATCH'; processId: string; basis: 'NOTICE_YEAR' | 'DOCUMENT_ID' }
  | { action: 'CREATE' }
  | {
      action: 'REVIEW';
      reason: 'AMBIGUOUS_NOTICE' | 'AMBIGUOUS_DOCUMENT' | 'HASH_MATCH' | 'IDENTITY_CONFLICT';
      candidateIds: string[];
    };

function noticeKey(value: Pick<ProcessIdentity, 'noticeCode' | 'noticeYear'>): string | null {
  if (!value.noticeCode || !value.noticeYear) return null;
  return `${normalizeKey(value.noticeCode)}:${value.noticeYear}`;
}

export function reconcileProcessIdentity(
  incoming: ProcessIdentity,
  existing: readonly ExistingProcessIdentity[],
): ReconciliationResult {
  if (!/^[a-f0-9]{64}$/iu.test(incoming.primaryDocumentSha256)) {
    throw new Error('Primary document SHA-256 is invalid');
  }
  const sameInstitution = existing.filter(
    (candidate) => candidate.institutionId === incoming.institutionId,
  );
  const incomingNotice = noticeKey(incoming);
  const sharedDocument = sameInstitution.filter(
    (candidate) =>
      candidate.primaryDocumentIds.includes(incoming.primaryDocumentId) ||
      candidate.primaryDocumentHashes.some(
        (hash) => hash.toLowerCase() === incoming.primaryDocumentSha256.toLowerCase(),
      ),
  );
  if (incomingNotice !== null) {
    const noticeMatches = sameInstitution.filter(
      (candidate) => noticeKey(candidate) === incomingNotice,
    );
    if (noticeMatches.length > 1) {
      return {
        action: 'REVIEW',
        reason: 'AMBIGUOUS_NOTICE',
        candidateIds: noticeMatches.map((candidate) => candidate.id),
      };
    }
    if (noticeMatches.length === 1) {
      const matched = noticeMatches[0]!;
      const conflicting = sharedDocument.filter((candidate) => candidate.id !== matched.id);
      if (conflicting.length > 0) {
        return {
          action: 'REVIEW',
          reason: 'IDENTITY_CONFLICT',
          candidateIds: [matched.id, ...conflicting.map((candidate) => candidate.id)],
        };
      }
      return { action: 'MATCH', processId: matched.id, basis: 'NOTICE_YEAR' };
    }
  }

  const documentMatches = sameInstitution.filter((candidate) =>
    candidate.primaryDocumentIds.includes(incoming.primaryDocumentId),
  );
  if (documentMatches.length > 1) {
    return {
      action: 'REVIEW',
      reason: 'AMBIGUOUS_DOCUMENT',
      candidateIds: documentMatches.map((candidate) => candidate.id),
    };
  }
  if (documentMatches.length === 1) {
    const candidate = documentMatches[0]!;
    const candidateNotice = noticeKey(candidate);
    if (incomingNotice && candidateNotice && incomingNotice !== candidateNotice) {
      return { action: 'REVIEW', reason: 'IDENTITY_CONFLICT', candidateIds: [candidate.id] };
    }
    return { action: 'MATCH', processId: candidate.id, basis: 'DOCUMENT_ID' };
  }

  const hashMatches = sameInstitution.filter((candidate) =>
    candidate.primaryDocumentHashes.some(
      (hash) => hash.toLowerCase() === incoming.primaryDocumentSha256.toLowerCase(),
    ),
  );
  if (hashMatches.length > 0) {
    return {
      action: 'REVIEW',
      reason: 'HASH_MATCH',
      candidateIds: hashMatches.map((candidate) => candidate.id),
    };
  }
  return { action: 'CREATE' };
}
