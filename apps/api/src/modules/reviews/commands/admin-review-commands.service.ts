import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SourceStatus } from '../../../generated/prisma/enums.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { WorkflowActor } from '../../review/workflow/state-machine.js';
import { normalizeSourceUrl } from '../../sources/source-url.js';
import {
  ReviewCommandsRepository,
  type CorrectionPatch,
  type ReviewEvidenceRef,
} from './review-commands.repository.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

interface CommandBody {
  expectedReviewVersion?: unknown;
  reason?: unknown;
  evidenceIds?: unknown;
  scopeEligible?: unknown;
  unresolvedCriticalFacts?: unknown;
  patches?: unknown;
}

function base(body: CommandBody, processId: string, actor: WorkflowActor) {
  if (!UUID.test(processId) || !actor.adminIdentity || actor.adminIdentity.id !== actor.id) {
    throw new BadRequestException();
  }
  if (
    !Number.isSafeInteger(body.expectedReviewVersion) ||
    (body.expectedReviewVersion as number) < 0 ||
    (body.expectedReviewVersion as number) > 2_147_483_646
  ) {
    throw new BadRequestException();
  }
  if (typeof body.reason !== 'string' || !body.reason.trim() || body.reason.trim().length > 4_000) {
    throw new BadRequestException();
  }
  return {
    processId,
    expectedReviewVersion: body.expectedReviewVersion as number,
    actor,
    reason: body.reason,
  };
}

function evidenceIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100)
    throw new BadRequestException();
  if (
    value.some((id) => typeof id !== 'string' || !UUID.test(id)) ||
    new Set(value).size !== value.length
  ) {
    throw new BadRequestException();
  }
  return value as string[];
}

function exactHttpsHost(value: string): string {
  try {
    return normalizeSourceUrl(value).host;
  } catch {
    throw new BadRequestException('Official evidence URL is invalid');
  }
}

@Injectable()
export class AdminReviewCommandsService {
  constructor(
    private readonly database: PrismaService,
    private readonly commands: ReviewCommandsRepository,
  ) {}

  async approve(processId: string, body: CommandBody, actor: WorkflowActor) {
    const input = base(body, processId, actor);
    if (body.scopeEligible !== true || body.unresolvedCriticalFacts !== false) {
      throw new BadRequestException(
        'Approval requires explicit scope and critical-fact confirmation',
      );
    }
    const evidence = await this.loadOfficialEvidence(processId, evidenceIds(body.evidenceIds));
    return this.commands.approve({
      ...input,
      evidence,
      scopeEligible: true,
      unresolvedCriticalFacts: false,
    });
  }

  reject(processId: string, body: CommandBody, actor: WorkflowActor) {
    return this.commands.reject({ ...base(body, processId, actor), evidence: [] });
  }

  async hide(processId: string, body: CommandBody, actor: WorkflowActor) {
    const input = base(body, processId, actor);
    const evidence = await this.loadOfficialEvidence(processId, evidenceIds(body.evidenceIds));
    return this.commands.hide({ ...input, evidence });
  }

  async correct(processId: string, body: CommandBody, actor: WorkflowActor) {
    const input = base(body, processId, actor);
    if (!Array.isArray(body.patches) || body.patches.length < 1 || body.patches.length > 25) {
      throw new BadRequestException();
    }
    const patches = body.patches as CorrectionPatch[];
    if (
      patches.some(
        (patch) =>
          !patch ||
          typeof patch !== 'object' ||
          typeof patch.evidenceId !== 'string' ||
          !UUID.test(patch.evidenceId),
      )
    ) {
      throw new BadRequestException();
    }
    const evidence = await this.loadOfficialEvidence(processId, [
      ...new Set(patches.map((patch) => patch.evidenceId)),
    ]);
    const hosts = new Set(evidence.map((item) => exactHttpsHost(item.url)));
    for (const patch of patches) {
      if (
        typeof patch.value === 'string' &&
        ['referenceUrl', 'instructionsUrl'].includes(patch.field)
      ) {
        const normalized = normalizeSourceUrl(patch.value);
        if (!hosts.has(normalized.host)) {
          throw new BadRequestException(
            'Corrected official URL must use the host of reviewed evidence',
          );
        }
        patch.value = normalized.url;
      }
    }
    return this.commands.correct({ ...input, evidence, patches });
  }

  private async loadOfficialEvidence(
    processId: string,
    ids: string[],
  ): Promise<ReviewEvidenceRef[]> {
    const process = await this.database.selectionProcess.findUnique({
      where: { id: processId },
      select: {
        referenceUrl: true,
        institution: {
          select: {
            sources: {
              where: { status: SourceStatus.ACTIVE },
              select: { allowedDomain: { select: { host: true, reviewedAt: true } } },
            },
          },
        },
      },
    });
    if (!process) throw new NotFoundException();
    const allowedHosts = new Set(
      process.institution.sources
        .filter((source) => source.allowedDomain.reviewedAt)
        .map((source) => source.allowedDomain.host.toLowerCase()),
    );
    if (!process.referenceUrl || !allowedHosts.has(exactHttpsHost(process.referenceUrl))) {
      throw new BadRequestException('Process has no verified active official URL');
    }
    const items = await this.database.evidence.findMany({
      where: { processId, id: { in: ids } },
      select: {
        id: true,
        fieldPath: true,
        pageOrSection: true,
        document: { select: { url: true, sha256: true } },
      },
    });
    if (items.length !== ids.length)
      throw new BadRequestException('Evidence must belong to the process');
    const evidence = items.map((item) => ({
      id: item.id,
      fieldPath: item.fieldPath,
      pageOrSection: item.pageOrSection,
      url: item.document.url,
      sha256: item.document.sha256,
    }));
    if (evidence.some((item) => !allowedHosts.has(exactHttpsHost(item.url)))) {
      throw new BadRequestException(
        'Evidence must use the exact host of an active reviewed source',
      );
    }
    return evidence;
  }
}
