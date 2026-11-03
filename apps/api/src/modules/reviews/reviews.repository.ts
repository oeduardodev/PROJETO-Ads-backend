import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';

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
