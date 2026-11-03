import { Injectable } from '@nestjs/common';
import { Pagination } from '../../../common/http/pagination.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { normalizeKey } from '../../institutions/normalization.js';
import { publishedProcessWhere } from '../filters/published-query.js';
import { SearchQuery } from './search-query.js';
import { isWindowOpen, nextConfirmedDeadline } from './window-time.js';

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/gu, '\\$&');
}

function offeringWhere(query: SearchQuery): Prisma.OfferingWhereInput {
  const campus = {
    verifiedAt: { not: null },
    ...(query.uf !== undefined ? { state: query.uf } : {}),
    ...(query.city !== undefined ? { normalizedCity: query.city } : {}),
  };
  return {
    ...(query.modality !== undefined ? { modality: query.modality } : {}),
    ...(query.degree !== undefined ? { degreeType: query.degree } : {}),
    ...(query.uf !== undefined || query.city !== undefined ? { campus: { is: campus } } : {}),
  };
}

function processWhere(query: SearchQuery): Prisma.SelectionProcessWhereInput {
  const offer = offeringWhere(query);
  const clauses: Prisma.SelectionProcessWhereInput[] = [
    publishedProcessWhere({ selectionType: query.selectionType, requiresEnem: query.requiresEnem }),
  ];
  if (Object.keys(offer).length) clauses.push({ offerings: { some: offer } });
  if (query.q !== undefined) {
    const q = escapeLike(query.q);
    clauses.push({
      OR: [
        {
          institution: {
            is: { OR: [{ normalizedName: { contains: q } }, { acronym: { contains: q } }] },
          },
        },
        { noticeCode: { contains: q, mode: 'insensitive' } },
        { offerings: { some: { ...offer, normalizedCourseName: { contains: q } } } },
      ],
    });
  }
  return { AND: clauses };
}

function compareNullableNumber(a: number | null, b: number | null): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return a - b;
}

@Injectable()
export class PublicSearchService {
  constructor(private readonly database: PrismaService) {}

  async search(query: SearchQuery, pagination: Pagination, now = new Date()) {
    const rows = await this.database.selectionProcess.findMany({
      where: processWhere(query),
      select: {
        id: true,
        noticeCode: true,
        selectionType: true,
        requiresEnem: true,
        referenceUrl: true,
        verifiedAt: true,
        institution: { select: { id: true, name: true, acronym: true, normalizedName: true } },
        offerings: {
          where: offeringWhere(query),
          select: { id: true, courseName: true, normalizedCourseName: true },
        },
        windows: {
          select: {
            offeringId: true,
            startDate: true,
            startTime: true,
            endDate: true,
            endTime: true,
            timezone: true,
          },
        },
      },
    });
    const nowMs = now.getTime();
    const candidates = rows.flatMap((row) => {
      const processTextMatches =
        query.q === undefined ||
        row.institution.normalizedName.includes(query.q) ||
        row.institution.acronym.includes(query.q) ||
        (row.noticeCode !== null && normalizeKey(row.noticeCode).includes(query.q));
      const offerings = processTextMatches
        ? row.offerings
        : row.offerings.filter((offering) => offering.normalizedCourseName.includes(query.q!));
      const offeringIds = new Set(offerings.map((offering) => offering.id));
      const windows = row.windows.filter(
        (window) => window.offeringId === null || offeringIds.has(window.offeringId),
      );
      if (query.openOnly && !windows.some((window) => isWindowOpen(window, nowMs))) return [];
      const deadline = nextConfirmedDeadline(windows, nowMs);
      const courses = [
        ...new Map(
          offerings.map((offering) => [offering.normalizedCourseName, offering.courseName]),
        ).entries(),
      ].sort(([a], [b]) => a.localeCompare(b));
      return [
        {
          id: row.id,
          noticeCode: row.noticeCode,
          selectionType: row.selectionType,
          requiresEnem: row.requiresEnem,
          verifiedAt: row.verifiedAt,
          officialNoticeUrl: row.referenceUrl,
          institution: {
            id: row.institution.id,
            name: row.institution.name,
            acronym: row.institution.acronym,
          },
          offeringCount: offerings.length,
          coursePreview: courses.slice(0, 3).map(([, name]) => name),
          courseSortKey: courses[0]?.[0] ?? null,
          deadline,
          nextDeadlineAt: deadline === null ? null : new Date(deadline).toISOString(),
        },
      ];
    });
    candidates.sort((a, b) => {
      if (query.sort === 'deadline')
        return compareNullableNumber(a.deadline, b.deadline) || a.id.localeCompare(b.id);
      if (query.sort === 'course') {
        const courseOrder =
          a.courseSortKey === null
            ? b.courseSortKey === null
              ? 0
              : 1
            : b.courseSortKey === null
              ? -1
              : a.courseSortKey.localeCompare(b.courseSortKey);
        return courseOrder || a.id.localeCompare(b.id);
      }
      return (
        (b.verifiedAt?.getTime() ?? 0) - (a.verifiedAt?.getTime() ?? 0) || a.id.localeCompare(b.id)
      );
    });
    const total = candidates.length;
    return {
      data: candidates
        .slice(pagination.skip, pagination.skip + pagination.pageSize)
        .map((item) => ({
          id: item.id,
          noticeCode: item.noticeCode,
          selectionType: item.selectionType,
          requiresEnem: item.requiresEnem,
          verifiedAt: item.verifiedAt,
          officialNoticeUrl: item.officialNoticeUrl,
          institution: item.institution,
          offeringCount: item.offeringCount,
          coursePreview: item.coursePreview,
          nextDeadlineAt: item.nextDeadlineAt,
        })),
      meta: { page: pagination.page, pageSize: pagination.pageSize, total },
    };
  }
}
