import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { normalizeAuthorizedHost } from '../../sources/source-url.js';
import {
  nextUtcDayUnixSeconds,
  searchQuotaRedisKey,
  type SearchQuotaStore,
} from './search-quota.store.js';

export const SEARCH_QUOTA_REDIS = Symbol('SEARCH_QUOTA_REDIS');

const TRY_CONSUME_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(ARGV[1])
if current >= limit then return 0 end
local next = redis.call('INCR', KEYS[1])
if next == 1 then redis.call('EXPIREAT', KEYS[1], ARGV[2]) end
return 1
`;

@Injectable()
export class RedisSearchQuotaStore implements SearchQuotaStore, OnApplicationShutdown {
  constructor(@Inject(SEARCH_QUOTA_REDIS) private readonly redis: Redis) {}

  async tryConsume(hostValue: string, limit: number, now = new Date()): Promise<boolean> {
    const host = normalizeAuthorizedHost(hostValue);
    if (!Number.isSafeInteger(limit) || limit < 0) {
      throw new Error('Search quota must be a non-negative safe integer');
    }
    if (limit === 0) return false;

    const result = await this.redis.eval(
      TRY_CONSUME_SCRIPT,
      1,
      searchQuotaRedisKey(host, now),
      String(limit),
      String(nextUtcDayUnixSeconds(now)),
    );
    return Number(result) === 1;
  }

  onApplicationShutdown(): void {
    this.redis.disconnect();
  }
}
