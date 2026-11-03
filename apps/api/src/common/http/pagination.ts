import { BadRequestException } from '@nestjs/common';

export interface Pagination {
  page: number;
  pageSize: number;
  skip: number;
}

function boundedInteger(value: unknown, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/u.test(value)) {
    throw new BadRequestException();
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) throw new BadRequestException();
  return parsed;
}

export function parsePagination(query: { page?: unknown; page_size?: unknown }): Pagination {
  const page = boundedInteger(query.page, 1, 10000);
  const pageSize = boundedInteger(query.page_size, 20, 100);
  return { page, pageSize, skip: (page - 1) * pageSize };
}
