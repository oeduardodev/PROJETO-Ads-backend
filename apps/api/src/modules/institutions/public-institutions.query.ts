import { BadRequestException } from '@nestjs/common';
import { Jurisdiction } from '../../generated/prisma/enums.js';
import { normalizeState } from '../campuses/campuses.repository.js';
import { normalizeKey } from './normalization.js';

export interface PublicInstitutionQuery {
  q?: string;
  uf?: string;
  city?: string;
  jurisdiction?: Jurisdiction;
}

function optionalText(
  value: unknown,
  maximum: number,
  normalize: (value: string) => string,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > maximum) throw new BadRequestException();
  if (!value.trim()) return undefined;
  try {
    return normalize(value);
  } catch {
    throw new BadRequestException();
  }
}

export function parsePublicInstitutionQuery(
  query: Record<string, unknown>,
): PublicInstitutionQuery {
  const rawJurisdiction = query.jurisdiction;
  if (
    rawJurisdiction !== undefined &&
    rawJurisdiction !== Jurisdiction.FEDERAL &&
    rawJurisdiction !== Jurisdiction.ESTADUAL
  ) {
    throw new BadRequestException();
  }
  return {
    q: optionalText(query.q, 120, normalizeKey),
    uf: optionalText(query.uf, 2, normalizeState),
    city: optionalText(query.city, 150, normalizeKey),
    jurisdiction: rawJurisdiction,
  };
}
