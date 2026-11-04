import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { publishedProcessWhere } from '../filters/published-query.js';
import { officialHostSources, verifiedOfficialUrl } from './official-url.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function civilDate(value: Date | null): string | null {
  return value?.toISOString().slice(0, 10) ?? null;
}

@Injectable()
export class PublicDetailService {
  constructor(private readonly database: PrismaService) {}

  async get(id: string) {
    if (!UUID.test(id)) throw new BadRequestException();
    const process = await this.database.selectionProcess.findFirst({
      where: { AND: [{ id }, publishedProcessWhere({})] },
      select: {
        id: true,
        noticeCode: true,
        noticeYear: true,
        selectionType: true,
        requiresEnem: true,
        tuitionFree: true,
        referenceUrl: true,
        verifiedAt: true,
        institution: {
          select: {
            id: true,
            name: true,
            acronym: true,
            jurisdiction: true,
            sources: officialHostSources,
          },
        },
        offerings: {
          orderBy: [{ normalizedCourseName: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            courseName: true,
            degreeType: true,
            modality: true,
            shift: true,
            seats: true,
            campus: {
              select: {
                id: true,
                name: true,
                city: true,
                state: true,
                timezone: true,
                verifiedAt: true,
              },
            },
            reservations: {
              orderBy: [{ normalizedCategory: 'asc' }, { id: 'asc' }],
              select: { id: true, category: true, seats: true },
            },
          },
        },
        windows: {
          orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            offeringId: true,
            label: true,
            startDate: true,
            startTime: true,
            endDate: true,
            endTime: true,
            timezone: true,
            instructionsUrl: true,
          },
        },
        requirements: {
          orderBy: [{ criterion: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            offeringId: true,
            reservationId: true,
            criterion: true,
            required: true,
            valueJson: true,
          },
        },
        evidence: {
          orderBy: [{ fieldPath: 'asc' }, { id: 'asc' }],
          select: {
            fieldPath: true,
            pageOrSection: true,
            quote: true,
            checkedAt: true,
            document: { select: { url: true, issuedAt: true } },
          },
        },
      },
    });
    if (!process) throw new NotFoundException();
    const sources = process.institution.sources;
    const officialNoticeUrl = verifiedOfficialUrl(process.referenceUrl, sources);
    if (!officialNoticeUrl) throw new NotFoundException();
    return {
      id: process.id,
      noticeCode: process.noticeCode,
      noticeYear: process.noticeYear,
      selectionType: process.selectionType,
      requiresEnem: process.requiresEnem,
      tuitionFree: process.tuitionFree,
      verifiedAt: process.verifiedAt,
      officialNoticeUrl,
      institution: {
        id: process.institution.id,
        name: process.institution.name,
        acronym: process.institution.acronym,
        jurisdiction: process.institution.jurisdiction,
      },
      offerings: process.offerings.map(({ campus, ...offering }) => ({
        ...offering,
        campus: campus?.verifiedAt
          ? {
              id: campus.id,
              name: campus.name,
              city: campus.city,
              state: campus.state,
              timezone: campus.timezone,
              verifiedAt: campus.verifiedAt,
            }
          : null,
      })),
      windows: process.windows.map((window) => ({
        id: window.id,
        offeringId: window.offeringId,
        label: window.label,
        startDate: civilDate(window.startDate),
        startTime: window.startTime,
        endDate: civilDate(window.endDate),
        endTime: window.endTime,
        timezone: window.timezone,
        instructionsUrl: verifiedOfficialUrl(window.instructionsUrl, sources),
      })),
      requirements: process.requirements.map(({ valueJson, ...requirement }) => ({
        ...requirement,
        value: valueJson,
      })),
      evidence: process.evidence.flatMap((item) => {
        const documentUrl = verifiedOfficialUrl(item.document.url, sources);
        return documentUrl
          ? [
              {
                fieldPath: item.fieldPath,
                pageOrSection: item.pageOrSection,
                quote: item.quote,
                checkedAt: item.checkedAt,
                documentUrl,
                documentIssuedAt: item.document.issuedAt,
              },
            ]
          : [];
      }),
    };
  }
}
