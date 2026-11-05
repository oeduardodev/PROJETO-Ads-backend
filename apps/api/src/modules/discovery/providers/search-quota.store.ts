import { normalizeAuthorizedHost } from '../../sources/source-url.js';

export interface SearchQuotaStore {
  tryConsume(host: string, limit: number, now?: Date): Promise<boolean>;
}

export function utcDayKey(now: Date): string {
  if (!Number.isFinite(now.getTime())) throw new Error('Quota date must be valid');
  return now.toISOString().slice(0, 10);
}

export function nextUtcDayUnixSeconds(now: Date): number {
  const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((dayStart + 24 * 60 * 60 * 1000) / 1000);
}

export function searchQuotaRedisKey(hostValue: string, now: Date): string {
  const host = normalizeAuthorizedHost(hostValue);
  return `alem-do-sisu:search-quota:${utcDayKey(now)}:${host}`;
}
