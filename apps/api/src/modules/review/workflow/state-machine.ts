export type IngestionState =
  | 'CANDIDATE'
  | 'FETCHED'
  | 'CLASSIFIED'
  | 'EXTRACTED'
  | 'NEEDS_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'SUPERSEDED';

export type PublicationState = 'RASCUNHO' | 'EM_REVISAO' | 'PUBLICADO' | 'OCULTO' | 'ARQUIVADO';

export interface WorkflowActor {
  id: string;
  kind: 'HUMAN' | 'SYSTEM';
  permissions: readonly string[];
  adminIdentity?: { id: string; issuer: string; subject: string; requestId?: string };
}

export interface IngestionTransitionFacts {
  reason: string;
  newEvidence?: boolean;
  officialSourceVerified?: boolean;
  unresolvedCriticalFacts?: boolean;
}

export interface PublicationTransitionFacts extends IngestionTransitionFacts {
  verifiedState?: IngestionState;
  scopeEligible?: boolean;
  criticalRevision?: boolean;
  criticalRevisionPolicy?: 'HIDE' | 'KEEP_PREVIOUS';
}

const INGESTION_EDGES: Readonly<Record<IngestionState, readonly IngestionState[]>> = {
  CANDIDATE: ['FETCHED'],
  FETCHED: ['CLASSIFIED'],
  CLASSIFIED: ['EXTRACTED', 'NEEDS_REVIEW', 'REJECTED'],
  EXTRACTED: ['NEEDS_REVIEW'],
  NEEDS_REVIEW: ['VERIFIED', 'REJECTED'],
  VERIFIED: ['NEEDS_REVIEW', 'SUPERSEDED'],
  REJECTED: ['CANDIDATE'],
  SUPERSEDED: [],
};

const PUBLICATION_EDGES: Readonly<Record<PublicationState, readonly PublicationState[]>> = {
  RASCUNHO: ['EM_REVISAO', 'ARQUIVADO'],
  EM_REVISAO: ['RASCUNHO', 'PUBLICADO', 'ARQUIVADO'],
  PUBLICADO: ['OCULTO', 'ARQUIVADO'],
  OCULTO: ['EM_REVISAO', 'ARQUIVADO'],
  ARQUIVADO: [],
};

function requiredReason(reason: string): string {
  const normalized = reason.trim();
  if (!normalized) throw new Error('A workflow transition requires a reason');
  return normalized;
}

function requireHumanPermission(actor: WorkflowActor, permission: string): void {
  if (actor.kind !== 'HUMAN' || !actor.permissions.includes(permission)) {
    throw new Error(`Transition requires human permission ${permission}`);
  }
}

export function validateIngestionTransition(
  from: IngestionState,
  to: IngestionState,
  actor: WorkflowActor,
  facts: IngestionTransitionFacts,
): string {
  const reason = requiredReason(facts.reason);
  if (!INGESTION_EDGES[from].includes(to))
    throw new Error(`Illegal ingestion transition ${from} -> ${to}`);
  if (to === 'VERIFIED') {
    requireHumanPermission(actor, 'process.verify');
    if (!facts.officialSourceVerified || facts.unresolvedCriticalFacts !== false) {
      throw new Error(
        'Verification requires a verified official source and no unresolved critical facts',
      );
    }
  }
  if (to === 'REJECTED') requireHumanPermission(actor, 'process.reject');
  if (to === 'SUPERSEDED') requireHumanPermission(actor, 'process.supersede');
  if (from === 'REJECTED' && to === 'CANDIDATE' && !facts.newEvidence) {
    throw new Error('Rejected process can be reopened only with new evidence');
  }
  return reason;
}

export function validatePublicationTransition(
  from: PublicationState,
  to: PublicationState,
  actor: WorkflowActor,
  facts: PublicationTransitionFacts,
): string {
  const reason = requiredReason(facts.reason);
  if (!PUBLICATION_EDGES[from].includes(to))
    throw new Error(`Illegal publication transition ${from} -> ${to}`);
  if (to === 'PUBLICADO') {
    requireHumanPermission(actor, 'process.publish');
    if (
      facts.verifiedState !== 'VERIFIED' ||
      facts.officialSourceVerified !== true ||
      facts.scopeEligible !== true ||
      facts.unresolvedCriticalFacts !== false
    ) {
      throw new Error(
        'Publishing requires human-verified scope, official source and critical facts',
      );
    }
  } else if (from === 'OCULTO' && to === 'EM_REVISAO') {
    requireHumanPermission(actor, 'process.review');
  } else if (from === 'PUBLICADO' && to === 'OCULTO') {
    const authorizedSystemHide =
      actor.kind === 'SYSTEM' &&
      facts.criticalRevision === true &&
      facts.officialSourceVerified === true &&
      facts.criticalRevisionPolicy === 'HIDE';
    if (!authorizedSystemHide) requireHumanPermission(actor, 'process.hide');
  } else if (to === 'ARQUIVADO') {
    requireHumanPermission(actor, 'process.archive');
  }
  return reason;
}
