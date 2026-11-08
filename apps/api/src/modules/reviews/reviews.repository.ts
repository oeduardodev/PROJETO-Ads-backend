import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  validateIngestionTransition,
  validatePublicationTransition,
  type IngestionState,
  type PublicationState,
  type WorkflowActor,
} from '../review/workflow/state-machine.js';
import type { RevisionPlan } from '../revisions/revision-plan.js';

export interface EvidenceInput {
  processId: string;
  documentId: string;
  fieldPath: string;
  pageOrSection?: string;
  quote: string;
  checkedAt?: Date;
}

export interface RevisionInput {
  processId: string;
  documentId: string;
  changedFields: Record<string, unknown>;
  supersedesId?: string;
}

export interface RevisionCandidateInput {
  processId: string;
  plan: RevisionPlan;
  supersedesId?: string;
  officialSourceVerified: boolean;
  criticalRevisionPolicy: 'HIDE' | 'KEEP_PREVIOUS';
}

export interface ReviewDecisionInput {
  processId: string;
  reviewerId: string;
  decision: string;
  reason: string;
}

function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

@Injectable()
export class ReviewsRepository {
  constructor(private readonly database: PrismaService) {}

  addEvidence(input: EvidenceInput) {
    return this.database.evidence.create({
      data: {
        process: { connect: { id: input.processId } },
        document: { connect: { id: input.documentId } },
        fieldPath: requiredText(input.fieldPath, 'Field path'),
        pageOrSection: input.pageOrSection?.trim() || undefined,
        quote: requiredText(input.quote, 'Quote'),
        checkedAt: input.checkedAt,
      },
    });
  }

  addRevision(input: RevisionInput) {
    if (Object.keys(input.changedFields).length === 0)
      throw new Error('Changed fields are required');
    return this.database.revision.create({
      data: {
        process: { connect: { id: input.processId } },
        document: { connect: { id: input.documentId } },
        changedFieldsJson: input.changedFields as Prisma.InputJsonValue,
        supersedes: input.supersedesId ? { connect: { id: input.supersedesId } } : undefined,
      },
    });
  }

  recordRevisionCandidate(input: RevisionCandidateInput) {
    if (input.plan.action === 'NO_CHANGE') {
      return Promise.resolve({ status: 'UNCHANGED' as const, revision: null });
    }
    if (input.plan.previous.institutionId !== input.plan.candidate.institutionId) {
      throw new Error('Revision candidate changes institution identity');
    }
    if (!input.plan.candidate.documentIds.includes(input.plan.candidateDocumentId)) {
      throw new Error('Candidate document must be linked to the normalized process');
    }
    if (
      input.plan.candidate.evidence.some(
        (item) => !input.plan.candidate.documentIds.includes(item.documentId),
      )
    ) {
      throw new Error('Candidate evidence references an unknown document');
    }

    return this.database.$transaction(async (transaction) => {
      const existing = await transaction.revision.findFirst({
        where: { processId: input.processId, documentId: input.plan.candidateDocumentId },
      });
      if (existing) return { status: 'REPLAY' as const, revision: existing };

      if (input.supersedesId) {
        const predecessor = await transaction.revision.findUnique({
          where: { id_processId: { id: input.supersedesId, processId: input.processId } },
        });
        if (!predecessor) throw new Error('Superseded revision must belong to this process');
      }

      const revision = await transaction.revision.create({
        data: {
          process: { connect: { id: input.processId } },
          document: { connect: { id: input.plan.candidateDocumentId } },
          changedFieldsJson: {
            schemaVersion: 1,
            changedFields: input.plan.changedFields,
            previousSnapshot: input.plan.previous,
            candidateSnapshot: input.plan.candidate,
            requiresReview: input.plan.requiresReview,
            blocksCurrentPublication: input.plan.blocksCurrentPublication,
          } as unknown as Prisma.InputJsonValue,
          supersedes: input.supersedesId
            ? { connect: { id_processId: { id: input.supersedesId, processId: input.processId } } }
            : undefined,
        },
      });
      if (input.plan.candidate.evidence.length > 0) {
        await transaction.evidence.createMany({
          data: input.plan.candidate.evidence.map((evidence) => ({
            processId: input.processId,
            documentId: evidence.documentId,
            fieldPath: evidence.fieldPath,
            pageOrSection: evidence.pageOrSection,
            quote: evidence.quote,
          })),
        });
      }
      if (input.plan.blocksCurrentPublication && input.officialSourceVerified) {
        const process = await transaction.selectionProcess.findUnique({
          where: { id: input.processId },
          select: { publicationStatus: true },
        });
        if (process?.publicationStatus === 'PUBLICADO') {
          const hide = input.criticalRevisionPolicy === 'HIDE';
          if (hide) {
            const reason = validatePublicationTransition(
              'PUBLICADO',
              'OCULTO',
              { id: 'SYSTEM:REVISION_POLICY', kind: 'SYSTEM', permissions: [] },
              {
                reason: 'Official critical revision detected; hidden pending human approval.',
                officialSourceVerified: true,
                criticalRevision: true,
                criticalRevisionPolicy: 'HIDE',
              },
            );
            const updated = await transaction.selectionProcess.updateMany({
              where: { id: input.processId, publicationStatus: 'PUBLICADO' },
              data: { publicationStatus: 'OCULTO' },
            });
            if (updated.count !== 1)
              throw new Error('Process publication state changed concurrently');
            await transaction.reviewDecision.create({
              data: {
                processId: input.processId,
                reviewerId: 'SYSTEM:REVISION_POLICY',
                decision: 'HIDE_CRITICAL_REVISION',
                reason,
              },
            });
          } else {
            const current = await transaction.selectionProcess.updateMany({
              where: { id: input.processId, publicationStatus: 'PUBLICADO' },
              data: { publicationStatus: 'PUBLICADO' },
            });
            if (current.count !== 1)
              throw new Error('Process publication state changed concurrently');
            await transaction.reviewDecision.create({
              data: {
                processId: input.processId,
                reviewerId: 'SYSTEM:REVISION_POLICY',
                decision: 'KEEP_PREVIOUS_VERSION',
                reason:
                  'Official critical revision detected; previous public version remains visible pending human review.',
              },
            });
          }
        }
      }
      return { status: 'RECORDED' as const, revision };
    });
  }

  transitionIngestion(input: {
    processId: string;
    to: IngestionState;
    actor: WorkflowActor;
    reason: string;
    newEvidence?: boolean;
    officialSourceVerified?: boolean;
    unresolvedCriticalFacts?: boolean;
  }) {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.selectionProcess.findUnique({
        where: { id: input.processId },
        select: { ingestionState: true },
      });
      if (!current) throw new Error('Process was not found');
      const reason = validateIngestionTransition(
        current.ingestionState,
        input.to,
        input.actor,
        input,
      );
      const updated = await transaction.selectionProcess.updateMany({
        where: { id: input.processId, ingestionState: current.ingestionState },
        data: { ingestionState: input.to, ingestionStateReason: reason },
      });
      if (updated.count !== 1) throw new Error('Process ingestion state changed concurrently');
      await transaction.reviewDecision.create({
        data: {
          processId: input.processId,
          reviewerId: requiredText(input.actor.id, 'Actor'),
          decision: `INGESTION_${current.ingestionState}_TO_${input.to}`,
          reason,
        },
      });
      return { from: current.ingestionState, to: input.to, reason };
    });
  }

  transitionPublication(input: {
    processId: string;
    to: PublicationState;
    actor: WorkflowActor;
    reason: string;
    officialSourceVerified?: boolean;
    scopeEligible?: boolean;
    unresolvedCriticalFacts?: boolean;
  }) {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.selectionProcess.findUnique({
        where: { id: input.processId },
        select: { publicationStatus: true, ingestionState: true },
      });
      if (!current) throw new Error('Process was not found');
      const reason = validatePublicationTransition(
        current.publicationStatus,
        input.to,
        input.actor,
        { ...input, verifiedState: current.ingestionState },
      );
      const updated = await transaction.selectionProcess.updateMany({
        where: { id: input.processId, publicationStatus: current.publicationStatus },
        data: { publicationStatus: input.to },
      });
      if (updated.count !== 1) throw new Error('Process publication state changed concurrently');
      await transaction.reviewDecision.create({
        data: {
          processId: input.processId,
          reviewerId: requiredText(input.actor.id, 'Actor'),
          decision: `PUBLICATION_${current.publicationStatus}_TO_${input.to}`,
          reason,
        },
      });
      return { from: current.publicationStatus, to: input.to, reason };
    });
  }

  recordDecision(input: ReviewDecisionInput) {
    return this.database.reviewDecision.create({
      data: {
        process: { connect: { id: input.processId } },
        reviewerId: requiredText(input.reviewerId, 'Reviewer'),
        decision: requiredText(input.decision, 'Decision'),
        reason: requiredText(input.reason, 'Reason'),
      },
    });
  }

  listHistory(processId: string) {
    return Promise.all([
      this.database.evidence.findMany({ where: { processId }, orderBy: { id: 'asc' } }),
      this.database.revision.findMany({ where: { processId }, orderBy: { detectedAt: 'asc' } }),
      this.database.reviewDecision.findMany({
        where: { processId },
        orderBy: { reviewedAt: 'asc' },
      }),
    ]);
  }
}
