import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProcessIngestionState } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../database/prisma.service.js';
import { parsePagination } from '../../common/http/pagination.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const INGESTION_STATES = new Set<string>(Object.values(ProcessIngestionState));

export interface ReviewQueueQuery {
  page?: unknown;
  page_size?: unknown;
  state?: unknown;
  institution_id?: unknown;
}

@Injectable()
export class AdminReviewQueueService {
  constructor(private readonly database: PrismaService) {}

  async list(query: ReviewQueueQuery) {
    const pagination = parsePagination(query);
    if (
      query.state !== undefined &&
      (typeof query.state !== 'string' || !INGESTION_STATES.has(query.state))
    ) {
      throw new BadRequestException();
    }
    if (
      query.institution_id !== undefined &&
      (typeof query.institution_id !== 'string' || !UUID.test(query.institution_id))
    ) {
      throw new BadRequestException();
    }
    const state =
      query.state === undefined
        ? ProcessIngestionState.NEEDS_REVIEW
        : (query.state as ProcessIngestionState);
    const where = {
      ingestionState: state,
      ...(query.institution_id ? { institutionId: query.institution_id as string } : {}),
    };
    const [total, items] = await Promise.all([
      this.database.selectionProcess.count({ where }),
      this.database.selectionProcess.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
        select: {
          id: true,
          noticeCode: true,
          noticeYear: true,
          publicationStatus: true,
          ingestionState: true,
          ingestionStateReason: true,
          createdAt: true,
          verifiedAt: true,
          institution: { select: { id: true, name: true, acronym: true } },
          _count: { select: { offerings: true, evidence: true, revisions: true } },
        },
      }),
    ]);
    return {
      data: items,
      meta: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: Math.ceil(total / pagination.pageSize),
      },
    };
  }

  async get(id: string) {
    if (!UUID.test(id)) throw new BadRequestException();
    const process = await this.database.selectionProcess.findUnique({
      where: { id },
      select: {
        id: true,
        institutionId: true,
        noticeCode: true,
        noticeYear: true,
        selectionType: true,
        regularSisuFlow: true,
        requiresEnem: true,
        tuitionFree: true,
        demoHistorical: true,
        referenceUrl: true,
        verifiedAt: true,
        ingestionState: true,
        ingestionStateReason: true,
        publicationStatus: true,
        createdAt: true,
        institution: { select: { id: true, name: true, acronym: true } },
        offerings: {
          orderBy: [{ normalizedCourseName: 'asc' }, { id: 'asc' }],
          include: { reservations: { orderBy: [{ normalizedCategory: 'asc' }, { id: 'asc' }] } },
        },
        windows: { orderBy: [{ startDate: 'asc' }, { id: 'asc' }] },
        requirements: { orderBy: [{ criterion: 'asc' }, { id: 'asc' }] },
        evidence: {
          orderBy: [{ fieldPath: 'asc' }, { id: 'asc' }],
          include: {
            document: {
              select: {
                id: true,
                url: true,
                sha256: true,
                mediaType: true,
                version: true,
                capturedAt: true,
                issuedAt: true,
              },
            },
          },
        },
        revisions: {
          orderBy: [{ detectedAt: 'asc' }, { id: 'asc' }],
          include: {
            document: {
              select: { id: true, url: true, sha256: true, version: true, capturedAt: true },
            },
          },
        },
        reviewDecisions: { orderBy: [{ reviewedAt: 'asc' }, { id: 'asc' }] },
      },
    });
    if (!process) throw new NotFoundException();
    return process;
  }
}
