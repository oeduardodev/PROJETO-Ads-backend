import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { normalizeKey, normalizeLabel } from '../institutions/normalization.js';

function optionalSeats(value: number | undefined): number | undefined {
  if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
    throw new Error('Seats must be a nonnegative integer or unknown');
  }
  return value;
}

export interface OfferingInput {
  processId: string;
  campusId?: string;
  courseName: string;
  degreeType?: string;
  modality?: string;
  shift?: string;
  seats?: number;
}

@Injectable()
export class OfferingsRepository {
  constructor(private readonly database: PrismaService) {}

  async create(input: OfferingInput) {
    const process = await this.database.selectionProcess.findUniqueOrThrow({
      where: { id: input.processId },
    });
    const courseName = normalizeLabel(input.courseName);
    return this.database.offering.create({
      data: {
        processId: process.id,
        institutionId: process.institutionId,
        campusId: input.campusId,
        courseName,
        normalizedCourseName: normalizeKey(courseName),
        degreeType: input.degreeType ? normalizeLabel(input.degreeType).toUpperCase() : undefined,
        modality: input.modality ? normalizeLabel(input.modality).toUpperCase() : undefined,
        shift: input.shift ? normalizeLabel(input.shift).toUpperCase() : undefined,
        seats: optionalSeats(input.seats),
      },
    });
  }

  addReservation(input: { offeringId: string; category: string; seats?: number }) {
    const category = normalizeLabel(input.category);
    return this.database.offeringReservation.create({
      data: {
        offering: { connect: { id: input.offeringId } },
        category,
        normalizedCategory: normalizeKey(category),
        seats: optionalSeats(input.seats),
      },
    });
  }
}
