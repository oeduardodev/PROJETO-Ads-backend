import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import { normalizeLabel } from '../institutions/normalization.js';

export interface RequirementInput {
  processId: string;
  offeringId?: string;
  reservationId?: string;
  criterion: string;
  required?: boolean;
  valueJson?: Prisma.InputJsonValue;
}

@Injectable()
export class RequirementsRepository {
  constructor(private readonly database: PrismaService) {}

  create(input: RequirementInput) {
    if (input.reservationId && !input.offeringId) {
      throw new Error('Reservation requirement must identify its offering');
    }
    return this.database.requirement.create({
      data: {
        process: { connect: { id: input.processId } },
        offering: input.offeringId ? { connect: { id: input.offeringId } } : undefined,
        reservation: input.reservationId ? { connect: { id: input.reservationId } } : undefined,
        criterion: normalizeLabel(input.criterion),
        required: input.required,
        valueJson: input.valueJson,
      },
    });
  }
}
