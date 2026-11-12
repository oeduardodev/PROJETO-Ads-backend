import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentProcessingReviewStatus,
  PublicationStatus,
  SourceStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../database/prisma.service.js';
import { parsePagination } from '../../common/http/pagination.js';
import { normalizeSourceUrl } from '../sources/source-url.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const MAX_REVIEW_VERSION = 2_147_483_646;
const UNPUBLISHED_STATUSES = new Set<PublicationStatus>([
  PublicationStatus.RASCUNHO,
  PublicationStatus.EM_REVISAO,
]);

export interface ProcessingReviewResolution {
  expectedReviewVersion?: unknown;
  reason?: unknown;
  processId?: unknown;
  institutionId?: unknown;
}

@Injectable()
export class ProcessingReviewService {
  constructor(private readonly database: PrismaService) {}

  async list(query: Record<string, unknown>) {
    const pagination = parsePagination(query);
    const where = { status: DocumentProcessingReviewStatus.OPEN };
    const [total, data] = await Promise.all([
      this.database.documentProcessingReviewItem.count({ where }),
      this.database.documentProcessingReviewItem.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
        select: {
          id: true,
          sha256: true,
          status: true,
          reviewVersion: true,
          createdAt: true,
          discoveredUrl: { select: { id: true, canonicalUrl: true } },
          process: { select: { id: true, noticeCode: true, publicationStatus: true } },
          document: {
            select: {
              id: true,
              url: true,
              mediaType: true,
              version: true,
              capturedAt: true,
              processingResults: {
                orderBy: [{ processorKind: 'asc' }, { schemaVersion: 'asc' }],
                select: {
                  processorKind: true,
                  schemaVersion: true,
                  status: true,
                  resultJson: true,
                  createdAt: true,
                },
              },
              discoveredUrl: {
                select: {
                  observations: {
                    select: {
                      source: {
                        select: {
                          status: true,
                          allowedDomain: {
                            select: { host: true, reviewedAt: true, collectionAllowed: true },
                          },
                          institution: {
                            select: {
                              id: true,
                              name: true,
                              acronym: true,
                              verifiedAt: true,
                              publicFlag: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);
    return {
      data: data.map((item) => {
        const candidateUrl = item.discoveredUrl?.canonicalUrl;
        const host = candidateUrl ? normalizeSourceUrl(candidateUrl).host : null;
        const institutions = new Map<string, { id: string; name: string; acronym: string }>();
        for (const observation of item.document.discoveredUrl?.observations ?? []) {
          const source = observation.source;
          if (
            host &&
            source.status === SourceStatus.ACTIVE &&
            source.institution.verifiedAt &&
            source.institution.publicFlag &&
            source.allowedDomain.reviewedAt &&
            source.allowedDomain.collectionAllowed &&
            source.allowedDomain.host.toLowerCase() === host
          ) {
            institutions.set(source.institution.id, {
              id: source.institution.id,
              name: source.institution.name,
              acronym: source.institution.acronym,
            });
          }
        }
        return {
          id: item.id,
          sha256: item.sha256,
          status: item.status,
          reviewVersion: item.reviewVersion,
          createdAt: item.createdAt,
          document: item.document,
          discoveredUrl: item.discoveredUrl,
          process: item.process,
          eligibleInstitutions: [...institutions.values()],
        };
      }),
      meta: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: Math.ceil(total / pagination.pageSize),
      },
    };
  }

  async processOptions(id: string, institutionId?: unknown) {
    if (!UUID.test(id)) throw new BadRequestException();
    if (
      institutionId !== undefined &&
      (typeof institutionId !== 'string' || !UUID.test(institutionId))
    ) {
      throw new BadRequestException();
    }
    const item = await this.database.documentProcessingReviewItem.findUnique({
      where: { id },
      select: {
        status: true,
        discoveredUrl: {
          select: {
            canonicalUrl: true,
            observations: {
              select: {
                source: {
                  select: {
                    status: true,
                    institutionId: true,
                    allowedDomain: {
                      select: { host: true, reviewedAt: true, collectionAllowed: true },
                    },
                    institution: { select: { verifiedAt: true, publicFlag: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!item) throw new NotFoundException();
    if (item.status !== DocumentProcessingReviewStatus.OPEN || !item.discoveredUrl) return [];
    const host = normalizeSourceUrl(item.discoveredUrl.canonicalUrl).host;
    const institutionIds = item.discoveredUrl.observations
      .filter(
        ({ source }) =>
          source.status === SourceStatus.ACTIVE &&
          source.institution.verifiedAt &&
          source.institution.publicFlag &&
          source.allowedDomain.reviewedAt &&
          source.allowedDomain.collectionAllowed &&
          source.allowedDomain.host.toLowerCase() === host,
      )
      .map(({ source }) => source.institutionId)
      .filter((candidateId) => institutionId === undefined || candidateId === institutionId);
    return this.database.selectionProcess.findMany({
      where: {
        institutionId: { in: [...new Set(institutionIds)] },
        publicationStatus: { in: [PublicationStatus.RASCUNHO, PublicationStatus.EM_REVISAO] },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        institutionId: true,
        noticeCode: true,
        noticeYear: true,
        institution: { select: { acronym: true, name: true } },
      },
    });
  }

  async resolve(
    id: string,
    body: ProcessingReviewResolution,
    actor: { id: string; issuer: string; subject: string; requestId: string },
  ) {
    if (!UUID.test(id)) throw new BadRequestException();
    const expected = body.expectedReviewVersion;
    if (
      !Number.isSafeInteger(expected) ||
      (expected as number) < 0 ||
      (expected as number) > MAX_REVIEW_VERSION
    ) {
      throw new BadRequestException('expectedReviewVersion is required');
    }
    if (
      typeof body.reason !== 'string' ||
      !body.reason.trim() ||
      body.reason.trim().length > 4_000
    ) {
      throw new BadRequestException('A review reason is required');
    }
    const reason = body.reason.trim();
    const linking = body.processId !== undefined;
    if (
      linking
        ? !UUID.test(String(body.processId)) || body.institutionId !== undefined
        : !UUID.test(String(body.institutionId))
    ) {
      throw new BadRequestException('Choose exactly one existing process or institution');
    }

    return this.database.$transaction(async (transaction) => {
      const item = await transaction.documentProcessingReviewItem.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          reviewVersion: true,
          processId: true,
          discoveredUrl: {
            select: {
              canonicalUrl: true,
              observations: {
                select: {
                  source: {
                    select: {
                      status: true,
                      institutionId: true,
                      allowedDomain: {
                        select: { host: true, reviewedAt: true, collectionAllowed: true },
                      },
                      institution: { select: { id: true, verifiedAt: true, publicFlag: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!item) throw new NotFoundException();
      if (item.status !== DocumentProcessingReviewStatus.OPEN || item.reviewVersion !== expected) {
        throw new ConflictException('Processing review version is stale or already resolved');
      }
      if (!item.discoveredUrl)
        throw new BadRequestException('Candidate has no reviewed source provenance');
      const candidate = normalizeSourceUrl(item.discoveredUrl.canonicalUrl);
      const institutionIds = new Set(
        item.discoveredUrl.observations
          .filter(
            ({ source }) =>
              source.status === SourceStatus.ACTIVE &&
              source.institution.verifiedAt !== null &&
              source.institution.publicFlag &&
              source.allowedDomain.reviewedAt !== null &&
              source.allowedDomain.collectionAllowed &&
              candidate.host === source.allowedDomain.host.toLowerCase(),
          )
          .map(({ source }) => source.institutionId),
      );
      if (!institutionIds.size)
        throw new BadRequestException('Candidate has no active reviewed official host');

      let processId: string;
      if (linking) {
        const process = await transaction.selectionProcess.findUnique({
          where: { id: String(body.processId) },
          select: { id: true, institutionId: true, publicationStatus: true },
        });
        if (!process) throw new NotFoundException('Process was not found');
        if (
          !institutionIds.has(process.institutionId) ||
          !UNPUBLISHED_STATUSES.has(process.publicationStatus)
        ) {
          throw new BadRequestException(
            'Process must belong to the reviewed source institution and remain unpublished',
          );
        }
        processId = process.id;
      } else {
        const institutionId = String(body.institutionId);
        if (!institutionIds.has(institutionId))
          throw new BadRequestException('Institution does not match the reviewed source');
        const process = await transaction.selectionProcess.create({
          data: {
            institutionId,
            referenceUrl: candidate.url,
            ingestionState: 'NEEDS_REVIEW',
            ingestionStateReason:
              'Rascunho criado explicitamente durante revisão de artefato de processamento.',
            publicationStatus: PublicationStatus.RASCUNHO,
          },
          select: { id: true },
        });
        processId = process.id;
      }

      const updated = await transaction.documentProcessingReviewItem.updateMany({
        where: {
          id,
          status: DocumentProcessingReviewStatus.OPEN,
          reviewVersion: expected as number,
        },
        data: {
          status: DocumentProcessingReviewStatus.RESOLVED,
          processId,
          reviewVersion: { increment: 1 },
          resolvedAt: new Date(),
          resolvedByAdminUserId: actor.id,
        },
      });
      if (updated.count !== 1) throw new ConflictException('Processing review version is stale');
      await transaction.auditEvent.create({
        data: {
          actorAdminUserId: actor.id,
          actorIssuer: actor.issuer,
          actorSubject: actor.subject,
          action: linking ? 'processing_review.associate' : 'processing_review.create_draft',
          resourceType: 'DocumentProcessingReviewItem',
          resourceId: id,
          reason,
          beforeJson: {
            status: item.status,
            reviewVersion: item.reviewVersion,
            processId: item.processId,
          },
          afterJson: {
            status: DocumentProcessingReviewStatus.RESOLVED,
            reviewVersion: item.reviewVersion + 1,
            processId,
          },
          requestId: actor.requestId,
        },
      });
      return {
        id,
        status: DocumentProcessingReviewStatus.RESOLVED,
        processId,
        reviewVersion: item.reviewVersion + 1,
      };
    });
  }
}
