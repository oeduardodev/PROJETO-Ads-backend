import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { normalizeLabel } from '../institutions/normalization.js';

export interface ProcessInput {
  institutionId: string;
  noticeCode?: string;
  noticeYear?: number;
  selectionType?: string;
  regularSisuFlow?: boolean;
  requiresEnem?: boolean;
  tuitionFree?: boolean;
}

@Injectable()
export class ProcessesRepository {
  constructor(private readonly database: PrismaService) {}

  create(input: ProcessInput) {
    if (
      input.noticeYear !== undefined &&
      (!Number.isInteger(input.noticeYear) || input.noticeYear < 1900 || input.noticeYear > 9999)
    ) {
      throw new Error('Notice year must be a four-digit year');
    }
    const selectionType =
      input.selectionType === undefined
        ? undefined
        : normalizeLabel(input.selectionType).toUpperCase();
    if (selectionType && !/^[A-Z][A-Z0-9_]{1,63}$/u.test(selectionType)) {
      throw new Error('Selection type must be an uppercase code');
    }
    return this.database.selectionProcess.create({
      data: {
        institution: { connect: { id: input.institutionId } },
        noticeCode: input.noticeCode ? normalizeLabel(input.noticeCode) : undefined,
        noticeYear: input.noticeYear,
        selectionType,
        regularSisuFlow: input.regularSisuFlow,
        requiresEnem: input.requiresEnem,
        tuitionFree: input.tuitionFree,
      },
    });
  }

  findDetails(id: string) {
    return this.database.selectionProcess.findUnique({
      where: { id },
      include: {
        offerings: { include: { reservations: true } },
        windows: true,
        requirements: true,
      },
    });
  }
}
