import { BadRequestException } from '@nestjs/common';
import { normalizeLabel } from '../../institutions/normalization.js';
import { normalizeState } from '../../campuses/campuses.repository.js';

export interface FilterQuery {
  uf?: string;
  modality?: string;
  selectionType?: string;
  requiresEnem?: boolean | null;
}

function optionalText(value: unknown, maximum: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > maximum) throw new BadRequestException();
  try {
    return normalizeLabel(value).toUpperCase();
  } catch {
    throw new BadRequestException();
  }
}

export function parseFilterQuery(query: Record<string, unknown>): FilterQuery {
  const ufValue = optionalText(query.uf, 2);
  let uf: string | undefined;
  if (ufValue !== undefined) {
    try {
      uf = normalizeState(ufValue);
    } catch {
      throw new BadRequestException();
    }
  }
  const modality = optionalText(query.modality, 64);
  const selectionType = optionalText(query.selection_type, 64);
  if (selectionType !== undefined && !/^[A-Z][A-Z0-9_]{1,63}$/u.test(selectionType)) {
    throw new BadRequestException();
  }
  let requiresEnem: boolean | null | undefined;
  if (query.requires_enem !== undefined) {
    if (query.requires_enem === 'true') requiresEnem = true;
    else if (query.requires_enem === 'false') requiresEnem = false;
    else if (query.requires_enem === 'unknown') requiresEnem = null;
    else throw new BadRequestException();
  }
  return { uf, modality, selectionType, requiresEnem };
}
