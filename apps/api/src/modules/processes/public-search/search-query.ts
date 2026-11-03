import { BadRequestException } from '@nestjs/common';
import { normalizeKey, normalizeLabel } from '../../institutions/normalization.js';
import { FilterQuery, parseFilterQuery } from '../filters/filter-query.js';

export type SearchSort = 'recent' | 'deadline' | 'course';

export interface SearchQuery extends FilterQuery {
  q?: string;
  city?: string;
  degree?: string;
  openOnly: boolean;
  sort: SearchSort;
}

function optionalLabel(
  value: unknown,
  maximum: number,
  normalize: (value: string) => string,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > maximum) throw new BadRequestException();
  if (value.trim() === '') return undefined;
  try {
    return normalize(value);
  } catch {
    throw new BadRequestException();
  }
}

export function parseSearchQuery(query: Record<string, unknown>): SearchQuery {
  const filters = parseFilterQuery(query);
  const rawSort = query.sort ?? 'recent';
  if (rawSort !== 'recent' && rawSort !== 'deadline' && rawSort !== 'course') {
    throw new BadRequestException();
  }
  const rawOpen = query.open_only ?? 'false';
  if (rawOpen !== 'true' && rawOpen !== 'false') throw new BadRequestException();
  return {
    ...filters,
    q: optionalLabel(query.q, 120, normalizeKey),
    city: optionalLabel(query.city, 150, normalizeKey),
    degree: optionalLabel(query.degree, 32, (value) => normalizeLabel(value).toUpperCase()),
    openOnly: rawOpen === 'true',
    sort: rawSort,
  };
}
