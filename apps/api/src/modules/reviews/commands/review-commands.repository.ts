import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { normalizeKey, normalizeLabel } from '../../institutions/normalization.js';
import {
  validateIngestionTransition,
  validatePublicationTransition,
  type WorkflowActor,
} from '../../review/workflow/state-machine.js';
import { adminAuditData } from '../reviews.repository.js';

export interface ReviewEvidenceRef {
  id: string;
  fieldPath: string;
  pageOrSection: string | null;
  url: string;
  sha256: string;
}

export interface CorrectionPatch {
  target: 'process' | 'offering' | 'window' | 'requirement' | 'reservation';
  targetId?: string;
  field: string;
  value: unknown;
  evidenceId: string;
}

export interface ReviewCommandBase {
  processId: string;
  expectedReviewVersion: number;
  actor: WorkflowActor;
  reason: string;
  evidence: ReviewEvidenceRef[];
}

function checkedVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 2_147_483_646) {
    throw new BadRequestException();
  }
  return value;
}

function checkedReason(value: string): string {
  const reason = value.trim();
  if (!reason || reason.length > 4_000) throw new BadRequestException();
  return reason;
}

function conflictIfStale(current: number, expected: number): void {
  if (current !== expected) throw new ConflictException('Process review version is stale');
}

function requireEvidence(evidence: readonly ReviewEvidenceRef[]): void {
  if (!evidence.length || evidence.length > 100) throw new BadRequestException();
  const ids = new Set(evidence.map((item) => item.id));
  if (ids.size !== evidence.length) throw new BadRequestException();
}

function versionWhere(processId: string, reviewVersion: number) {
  return { id: processId, reviewVersion };
}

function auditEvidence(evidence: readonly ReviewEvidenceRef[]) {
  return evidence.map(({ fieldPath, pageOrSection, url, sha256 }) => ({
    fieldPath,
    pageOrSection,
    url,
    sha256,
  }));
}

@Injectable()
export class ReviewCommandsRepository {
  constructor(private readonly database: PrismaService) {}

  async approve(
    input: ReviewCommandBase & {
      scopeEligible: true;
      unresolvedCriticalFacts: false;
    },
  ) {
    const version = checkedVersion(input.expectedReviewVersion);
    const reason = checkedReason(input.reason);
    requireEvidence(input.evidence);
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.selectionProcess.findUnique({
        where: { id: input.processId },
        select: {
          id: true,
          ingestionState: true,
          publicationStatus: true,
          ingestionStateReason: true,
          reviewVersion: true,
          verifiedAt: true,
        },
      });
      if (!current) throw new NotFoundException();
      conflictIfStale(current.reviewVersion, version);
      if (current.ingestionState !== 'NEEDS_REVIEW' || current.publicationStatus !== 'EM_REVISAO') {
        throw new ConflictException('Process is not ready for approval');
      }
      const ingestionReason = validateIngestionTransition(
        current.ingestionState,
        'VERIFIED',
        input.actor,
        { reason, officialSourceVerified: true, unresolvedCriticalFacts: false },
      );
      const publicationReason = validatePublicationTransition(
        current.publicationStatus,
        'PUBLICADO',
        input.actor,
        {
          reason,
          verifiedState: 'VERIFIED',
          officialSourceVerified: true,
          scopeEligible: input.scopeEligible,
          unresolvedCriticalFacts: input.unresolvedCriticalFacts,
        },
      );
      const updated = await transaction.selectionProcess.updateMany({
        where: {
          ...versionWhere(input.processId, version),
          ingestionState: current.ingestionState,
          publicationStatus: current.publicationStatus,
        },
        data: {
          ingestionState: 'VERIFIED',
          ingestionStateReason: ingestionReason,
          publicationStatus: 'PUBLICADO',
          verifiedAt: new Date(),
          reviewVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new ConflictException('Process review version is stale');
      await transaction.reviewDecision.create({
        data: {
          processId: input.processId,
          reviewerId: input.actor.id,
          decision: 'APPROVED_AND_PUBLISHED',
          reason: publicationReason,
        },
      });
      const audit = adminAuditData(
        input.actor.adminIdentity,
        'process.approve',
        input.processId,
        publicationReason,
        {
          ingestionState: current.ingestionState,
          publicationStatus: current.publicationStatus,
          reviewVersion: version,
        },
        {
          ingestionState: 'VERIFIED',
          publicationStatus: 'PUBLICADO',
          reviewVersion: version + 1,
          evidence: auditEvidence(input.evidence),
        },
      );
      if (!audit) throw new BadRequestException('Trusted administrative actor is required');
      await transaction.auditEvent.create({ data: audit });
      return {
        processId: input.processId,
        ingestionState: 'VERIFIED',
        publicationStatus: 'PUBLICADO',
        reviewVersion: version + 1,
      };
    });
  }

  async reject(input: ReviewCommandBase) {
    const version = checkedVersion(input.expectedReviewVersion);
    const reason = checkedReason(input.reason);
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.selectionProcess.findUnique({
        where: { id: input.processId },
        select: { ingestionState: true, publicationStatus: true, reviewVersion: true },
      });
      if (!current) throw new NotFoundException();
      conflictIfStale(current.reviewVersion, version);
      if (current.ingestionState !== 'NEEDS_REVIEW') {
        throw new ConflictException('Only processes pending review can be rejected');
      }
      const ingestionReason = validateIngestionTransition(
        current.ingestionState,
        'REJECTED',
        input.actor,
        {
          reason,
        },
      );
      const publicationStatus =
        current.publicationStatus === 'PUBLICADO'
          ? (validatePublicationTransition('PUBLICADO', 'OCULTO', input.actor, { reason }),
            'OCULTO')
          : current.publicationStatus;
      const updated = await transaction.selectionProcess.updateMany({
        where: {
          ...versionWhere(input.processId, version),
          ingestionState: current.ingestionState,
          publicationStatus: current.publicationStatus,
        },
        data: {
          ingestionState: 'REJECTED',
          ingestionStateReason: ingestionReason,
          publicationStatus,
          reviewVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new ConflictException('Process review version is stale');
      await transaction.reviewDecision.create({
        data: {
          processId: input.processId,
          reviewerId: input.actor.id,
          decision: 'REJECTED',
          reason,
        },
      });
      const audit = adminAuditData(
        input.actor.adminIdentity,
        'process.reject',
        input.processId,
        reason,
        {
          ingestionState: current.ingestionState,
          publicationStatus: current.publicationStatus,
          reviewVersion: version,
        },
        { ingestionState: 'REJECTED', publicationStatus, reviewVersion: version + 1 },
      );
      if (!audit) throw new BadRequestException('Trusted administrative actor is required');
      await transaction.auditEvent.create({ data: audit });
      return {
        processId: input.processId,
        ingestionState: 'REJECTED',
        publicationStatus,
        reviewVersion: version + 1,
      };
    });
  }

  async hide(input: ReviewCommandBase) {
    const version = checkedVersion(input.expectedReviewVersion);
    const reason = checkedReason(input.reason);
    requireEvidence(input.evidence);
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.selectionProcess.findUnique({
        where: { id: input.processId },
        select: { publicationStatus: true, ingestionState: true, reviewVersion: true },
      });
      if (!current) throw new NotFoundException();
      conflictIfStale(current.reviewVersion, version);
      if (current.publicationStatus !== 'PUBLICADO') {
        throw new ConflictException('Only a published process can be hidden');
      }
      const decisionReason = validatePublicationTransition(
        current.publicationStatus,
        'OCULTO',
        input.actor,
        { reason },
      );
      const updated = await transaction.selectionProcess.updateMany({
        where: {
          ...versionWhere(input.processId, version),
          publicationStatus: current.publicationStatus,
        },
        data: { publicationStatus: 'OCULTO', reviewVersion: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException('Process review version is stale');
      await transaction.reviewDecision.create({
        data: {
          processId: input.processId,
          reviewerId: input.actor.id,
          decision: 'HIDDEN',
          reason: decisionReason,
        },
      });
      const audit = adminAuditData(
        input.actor.adminIdentity,
        'process.hide',
        input.processId,
        decisionReason,
        {
          publicationStatus: current.publicationStatus,
          ingestionState: current.ingestionState,
          reviewVersion: version,
        },
        {
          publicationStatus: 'OCULTO',
          ingestionState: current.ingestionState,
          reviewVersion: version + 1,
          evidence: auditEvidence(input.evidence),
        },
      );
      if (!audit) throw new BadRequestException('Trusted administrative actor is required');
      await transaction.auditEvent.create({ data: audit });
      return {
        processId: input.processId,
        publicationStatus: 'OCULTO',
        reviewVersion: version + 1,
      };
    });
  }

  async correct(input: ReviewCommandBase & { patches: CorrectionPatch[] }) {
    const version = checkedVersion(input.expectedReviewVersion);
    const reason = checkedReason(input.reason);
    if (input.patches.length < 1 || input.patches.length > 25) throw new BadRequestException();
    requireEvidence(input.evidence);
    const evidenceIds = new Set(input.evidence.map((item) => item.id));
    const patchKeys = new Set<string>();
    for (const patch of input.patches) {
      if (!evidenceIds.has(patch.evidenceId)) throw new BadRequestException();
      const key = `${patch.target}:${patch.targetId ?? input.processId}:${patch.field}`;
      if (patchKeys.has(key)) throw new BadRequestException();
      patchKeys.add(key);
      validateCorrectionValue(patch);
    }

    return this.database.$transaction(async (transaction) => {
      const current = await transaction.selectionProcess.findUnique({
        where: { id: input.processId },
        select: {
          reviewVersion: true,
          ingestionState: true,
          publicationStatus: true,
          ingestionStateReason: true,
        },
      });
      if (!current) throw new NotFoundException();
      conflictIfStale(current.reviewVersion, version);
      if (!['NEEDS_REVIEW', 'VERIFIED'].includes(current.ingestionState)) {
        throw new ConflictException('Process must be in review before correction');
      }
      const storedEvidence = await transaction.evidence.findMany({
        where: { processId: input.processId, id: { in: [...evidenceIds] } },
        select: {
          id: true,
          fieldPath: true,
          pageOrSection: true,
          document: { select: { url: true, sha256: true } },
        },
      });
      if (storedEvidence.length !== evidenceIds.size)
        throw new BadRequestException('Evidence must belong to the process');
      const updated = await transaction.selectionProcess.updateMany({
        where: {
          ...versionWhere(input.processId, version),
          ingestionState: current.ingestionState,
          publicationStatus: current.publicationStatus,
        },
        data: {
          ingestionState: 'NEEDS_REVIEW',
          ingestionStateReason: reason,
          publicationStatus:
            current.publicationStatus === 'PUBLICADO' ? 'OCULTO' : current.publicationStatus,
          reviewVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new ConflictException('Process review version is stale');

      const before: Record<string, unknown>[] = [];
      const after: Record<string, unknown>[] = [];
      for (const patch of input.patches) {
        const pair = await applyPatch(transaction, input.processId, patch);
        before.push({
          ...pair.before,
          evidence: evidenceSnapshot(storedEvidence, patch.evidenceId),
        });
        after.push({ ...pair.after, evidence: evidenceSnapshot(storedEvidence, patch.evidenceId) });
      }
      const beforeState = {
        ingestionState: current.ingestionState,
        publicationStatus: current.publicationStatus,
        reviewVersion: version,
        fields: before,
      };
      const afterState = {
        ingestionState: 'NEEDS_REVIEW',
        publicationStatus:
          current.publicationStatus === 'PUBLICADO' ? 'OCULTO' : current.publicationStatus,
        reviewVersion: version + 1,
        fields: after,
      };
      await transaction.reviewDecision.create({
        data: {
          processId: input.processId,
          reviewerId: input.actor.id,
          decision: 'CORRECTED',
          reason,
        },
      });
      const audit = adminAuditData(
        input.actor.adminIdentity,
        'process.correct',
        input.processId,
        reason,
        beforeState,
        afterState,
      );
      if (!audit) throw new BadRequestException('Trusted administrative actor is required');
      await transaction.auditEvent.create({ data: audit });
      return {
        processId: input.processId,
        ingestionState: 'NEEDS_REVIEW',
        publicationStatus: afterState.publicationStatus,
        reviewVersion: version + 1,
      };
    });
  }
}

type Target = CorrectionPatch['target'];

const FIELDS: Record<Target, readonly string[]> = {
  process: [
    'noticeCode',
    'noticeYear',
    'selectionType',
    'regularSisuFlow',
    'requiresEnem',
    'tuitionFree',
    'referenceUrl',
  ],
  offering: ['courseName', 'degreeType', 'modality', 'shift', 'seats', 'campusId'],
  window: ['label', 'startDate', 'startTime', 'endDate', 'endTime', 'timezone', 'instructionsUrl'],
  requirement: ['criterion', 'required', 'valueJson'],
  reservation: ['category', 'seats'],
};

function validateCorrectionValue(patch: CorrectionPatch): void {
  if (!FIELDS[patch.target]?.includes(patch.field)) throw new BadRequestException();
  if (patch.target !== 'process' && (!patch.targetId || !UUID.test(patch.targetId))) {
    throw new BadRequestException();
  }
  if (!UUID.test(patch.evidenceId)) throw new BadRequestException();
  const value = patch.value;
  if (['noticeYear', 'seats'].includes(patch.field)) {
    if (
      value !== null &&
      (!Number.isSafeInteger(value) ||
        (value as number) < 0 ||
        (patch.field === 'noticeYear' && (value as number) < 1900))
    ) {
      throw new BadRequestException();
    }
    return;
  }
  if (['regularSisuFlow', 'requiresEnem', 'tuitionFree', 'required'].includes(patch.field)) {
    if (value !== null && typeof value !== 'boolean') throw new BadRequestException();
    return;
  }
  if (patch.field === 'valueJson') {
    try {
      if (JSON.stringify(value).length > 16_384) throw new Error();
    } catch {
      throw new BadRequestException();
    }
    return;
  }
  if (patch.field === 'startDate' || patch.field === 'endDate') {
    if (
      value !== null &&
      (typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/u.test(value) ||
        !Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)))
    ) {
      throw new BadRequestException();
    }
    return;
  }
  if (patch.field === 'startTime' || patch.field === 'endTime') {
    if (
      value !== null &&
      (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/u.test(value))
    ) {
      throw new BadRequestException();
    }
    return;
  }
  if (typeof value !== 'string' || !value.trim() || value.length > 2_000) {
    if (
      value === null &&
      [
        'noticeCode',
        'degreeType',
        'modality',
        'shift',
        'campusId',
        'label',
        'timezone',
        'instructionsUrl',
        'referenceUrl',
      ].includes(patch.field)
    )
      return;
    throw new BadRequestException();
  }
  if (patch.field === 'noticeYear' || patch.field === 'seats') throw new BadRequestException();
  if (patch.field === 'courseName' && normalizeLabel(value).length < 2)
    throw new BadRequestException();
  if (patch.field === 'selectionType' && !/^[A-Z][A-Z0-9_]{1,63}$/u.test(value))
    throw new BadRequestException();
  if (patch.field === 'timezone') {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
    } catch {
      throw new BadRequestException();
    }
  }
  if (patch.field === 'campusId' && !UUID.test(value)) throw new BadRequestException();
  const limits: Record<string, number> = {
    noticeCode: 100,
    selectionType: 64,
    referenceUrl: 2_000,
    courseName: 250,
    degreeType: 32,
    modality: 64,
    shift: 64,
    label: 150,
    timezone: 64,
    instructionsUrl: 2_000,
    criterion: 200,
    category: 150,
  };
  if (value.length > (limits[patch.field] ?? 150)) throw new BadRequestException();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function evidenceSnapshot(
  evidence: Array<{
    id: string;
    fieldPath: string;
    pageOrSection: string | null;
    document: { url: string; sha256: string };
  }>,
  id: string,
) {
  const item = evidence.find((candidate) => candidate.id === id);
  if (!item) throw new BadRequestException();
  return {
    fieldPath: item.fieldPath,
    pageOrSection: item.pageOrSection,
    url: item.document.url,
    sha256: item.document.sha256,
  };
}

function normalizePatch(patch: CorrectionPatch): Record<string, unknown> {
  const data: Record<string, unknown> = { [patch.field]: patch.value };
  if (
    patch.target === 'process' &&
    patch.field === 'selectionType' &&
    typeof patch.value === 'string'
  ) {
    data.selectionType = normalizeLabel(patch.value).toUpperCase();
  }
  if (
    patch.target === 'offering' &&
    patch.field === 'courseName' &&
    typeof patch.value === 'string'
  ) {
    data.courseName = normalizeLabel(patch.value);
    data.normalizedCourseName = normalizeKey(patch.value);
  }
  if (
    patch.target === 'reservation' &&
    patch.field === 'category' &&
    typeof patch.value === 'string'
  ) {
    data.category = normalizeLabel(patch.value);
    data.normalizedCategory = normalizeKey(patch.value);
  }
  if (
    (patch.field === 'startDate' || patch.field === 'endDate') &&
    typeof patch.value === 'string'
  ) {
    data[patch.field] = new Date(`${patch.value}T00:00:00.000Z`);
  }
  if (patch.field === 'valueJson') {
    data.valueJson = patch.value === null ? Prisma.DbNull : (patch.value as Prisma.InputJsonValue);
  }
  return data;
}

async function applyPatch(
  transaction: Prisma.TransactionClient,
  processId: string,
  patch: CorrectionPatch,
): Promise<{ before: Record<string, unknown>; after: Record<string, unknown> }> {
  const data = normalizePatch(patch);
  const field = patch.field;
  const targetId = patch.targetId;
  let row: Record<string, unknown> | null;
  let update: (data: Record<string, unknown>) => Promise<unknown>;
  switch (patch.target) {
    case 'process': {
      const found = await transaction.selectionProcess.findUnique({ where: { id: processId } });
      row = found as unknown as Record<string, unknown> | null;
      update = (values) =>
        transaction.selectionProcess.update({
          where: { id: processId },
          data: values as Prisma.SelectionProcessUpdateInput,
        });
      break;
    }
    case 'offering': {
      const found = await transaction.offering.findFirst({ where: { id: targetId, processId } });
      row = found as unknown as Record<string, unknown> | null;
      if (found && patch.field === 'campusId' && typeof patch.value === 'string') {
        const campus = await transaction.campus.findFirst({
          where: { id: patch.value, institutionId: found.institutionId, verifiedAt: { not: null } },
          select: { id: true },
        });
        if (!campus)
          throw new BadRequestException(
            'Campus must be verified and belong to the offering institution',
          );
      }
      update = (values) =>
        transaction.offering.update({
          where: { id: targetId },
          data: values as Prisma.OfferingUpdateInput,
        });
      break;
    }
    case 'window': {
      const found = await transaction.applicationWindow.findFirst({
        where: { id: targetId, processId },
      });
      row = found as unknown as Record<string, unknown> | null;
      update = (values) =>
        transaction.applicationWindow.update({
          where: { id: targetId },
          data: values as Prisma.ApplicationWindowUpdateInput,
        });
      break;
    }
    case 'requirement': {
      const found = await transaction.requirement.findFirst({ where: { id: targetId, processId } });
      row = found as unknown as Record<string, unknown> | null;
      update = (values) =>
        transaction.requirement.update({
          where: { id: targetId },
          data: values as Prisma.RequirementUpdateInput,
        });
      break;
    }
    case 'reservation': {
      const found = await transaction.offeringReservation.findUnique({
        where: { id: targetId },
        include: { offering: { select: { processId: true } } },
      });
      row =
        found && found.offering.processId === processId
          ? (found as unknown as Record<string, unknown>)
          : null;
      update = (values) =>
        transaction.offeringReservation.update({
          where: { id: targetId },
          data: values as Prisma.OfferingReservationUpdateInput,
        });
      break;
    }
  }
  if (!row) throw new NotFoundException('Correction target was not found in this process');
  const beforeValue = row[field];
  await update(data);
  return {
    before: { target: patch.target, targetId: targetId ?? processId, field, value: beforeValue },
    after: { target: patch.target, targetId: targetId ?? processId, field, value: patch.value },
  };
}
