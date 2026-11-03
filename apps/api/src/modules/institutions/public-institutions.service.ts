import { Injectable } from '@nestjs/common';
import { Pagination } from '../../common/http/pagination.js';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';

function latest(values: Array<Date | null>): Date | null {
  const known = values.filter((value): value is Date => value !== null);
  return known.length ? new Date(Math.max(...known.map((value) => value.getTime()))) : null;
}

const reviewedSource: Prisma.SourceWhereInput = {
  status: 'ACTIVE',
  allowedDomain: { is: { reviewedAt: { not: null } } },
};

const publicInstitution: Prisma.InstitutionWhereInput = {
  publicFlag: true,
  verifiedAt: { not: null },
  jurisdiction: { in: ['FEDERAL', 'ESTADUAL'] },
  sources: { some: reviewedSource },
};

@Injectable()
export class PublicInstitutionsService {
  constructor(private readonly database: PrismaService) {}

  async list(pagination: Pagination) {
    const [total, institutions] = await Promise.all([
      this.database.institution.count({ where: publicInstitution }),
      this.database.institution.findMany({
        where: publicInstitution,
        orderBy: [{ normalizedName: 'asc' }, { id: 'asc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
        select: {
          id: true,
          name: true,
          acronym: true,
          jurisdiction: true,
          verifiedAt: true,
          referenceUrl: true,
          campuses: {
            where: { verifiedAt: { not: null } },
            orderBy: [{ normalizedCity: 'asc' }, { normalizedName: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              name: true,
              city: true,
              state: true,
              timezone: true,
              verifiedAt: true,
            },
          },
          sources: {
            where: reviewedSource,
            select: { lastCheckedAt: true, lastSuccessAt: true },
          },
        },
      }),
    ]);
    return {
      data: institutions.map(({ sources, ...institution }) => ({
        ...institution,
        monitoring: {
          activeSourceCount: sources.length,
          lastCheckedAt: latest(sources.map((source) => source.lastCheckedAt)),
          lastSuccessAt: latest(sources.map((source) => source.lastSuccessAt)),
        },
      })),
      meta: { page: pagination.page, pageSize: pagination.pageSize, total },
    };
  }
}
