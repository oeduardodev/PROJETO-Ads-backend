import { Injectable } from '@nestjs/common';
import { Jurisdiction } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../database/prisma.service.js';
import { normalizeAcronym, normalizeKey, normalizeLabel } from './normalization.js';

export interface InstitutionInput {
  name: string;
  acronym: string;
  jurisdiction: Jurisdiction;
  publicFlag: boolean;
  referenceUrl?: string;
}

@Injectable()
export class InstitutionsRepository {
  constructor(private readonly database: PrismaService) {}

  create(input: InstitutionInput) {
    const name = normalizeLabel(input.name);
    return this.database.institution.create({
      data: {
        name,
        normalizedName: normalizeKey(name),
        acronym: normalizeAcronym(input.acronym),
        jurisdiction: input.jurisdiction,
        publicFlag: input.publicFlag,
        referenceUrl: input.referenceUrl,
      },
    });
  }

  list() {
    return this.database.institution.findMany({ orderBy: { acronym: 'asc' } });
  }
}
