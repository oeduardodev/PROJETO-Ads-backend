import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { normalizeKey, normalizeLabel } from '../institutions/normalization.js';

const BRAZILIAN_STATES = new Set([
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]);

export function normalizeState(value: string): string {
  const state = value.trim().toUpperCase();
  if (!BRAZILIAN_STATES.has(state)) throw new Error('State must be a valid Brazilian UF');
  return state;
}

export function validateTimezone(value: string): string {
  const timezone = value.trim();
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: timezone });
  } catch {
    throw new Error('Timezone must be a valid IANA identifier');
  }
  if (!timezone.includes('/')) throw new Error('Timezone must be a valid IANA identifier');
  return timezone;
}

export interface CampusInput {
  institutionId: string;
  name: string;
  city: string;
  state: string;
  timezone: string;
}

@Injectable()
export class CampusesRepository {
  constructor(private readonly database: PrismaService) {}

  create(input: CampusInput) {
    const name = normalizeLabel(input.name);
    const city = normalizeLabel(input.city);
    return this.database.campus.create({
      data: {
        institution: { connect: { id: input.institutionId } },
        name,
        normalizedName: normalizeKey(name),
        city,
        normalizedCity: normalizeKey(city),
        state: normalizeState(input.state),
        timezone: validateTimezone(input.timezone),
      },
    });
  }

  listByInstitution(institutionId: string) {
    return this.database.campus.findMany({
      where: { institutionId },
      orderBy: [{ normalizedCity: 'asc' }, { normalizedName: 'asc' }],
    });
  }
}
