import { createHash } from 'node:crypto';
import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type { Redis } from 'ioredis';

export const API_RATE_LIMIT_REDIS = Symbol('API_RATE_LIMIT_REDIS');
export const PUBLIC_GET_RATE_LIMIT_PER_MINUTE = 120;
export const ADMIN_WRITE_RATE_LIMIT_PER_MINUTE = 30;
export const RATE_LIMIT_WINDOW_MS = 60_000;

const CONSUME_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return { count, redis.call('TTL', KEYS[1]) }
`;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

export function rateLimitIdentityHash(identity: string): string {
  return createHash('sha256').update(identity, 'utf8').digest('hex');
}

export function publicClientIdentity(request: { socket?: { remoteAddress?: string } }): string {
  return request.socket?.remoteAddress || 'unknown';
}

export class ApiRateLimitUnavailableError extends Error {
  constructor() {
    super('API rate limiter unavailable');
    this.name = 'ApiRateLimitUnavailableError';
  }
}

@Injectable()
export class ApiRateLimitService implements OnApplicationShutdown {
  constructor(
    @Inject(API_RATE_LIMIT_REDIS) private readonly redis: Pick<Redis, 'eval'> & Partial<Redis>,
  ) {}

  async consume(
    scope: 'public-get' | 'admin-write',
    identity: string,
    limit: number,
    now = Date.now(),
  ): Promise<RateLimitResult> {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Rate limit must be positive');
    const window = Math.floor(now / RATE_LIMIT_WINDOW_MS);
    const key = `alem-do-sisu:api-rate:${scope}:${window}:${rateLimitIdentityHash(identity)}`;
    let result: unknown;
    try {
      result = await this.redis.eval(CONSUME_SCRIPT, 1, key, '60');
    } catch {
      throw new ApiRateLimitUnavailableError();
    }
    if (!Array.isArray(result) || result.length !== 2) throw new ApiRateLimitUnavailableError();
    const count = Number(result[0]);
    const ttl = Number(result[1]);
    if (!Number.isSafeInteger(count) || count < 1 || !Number.isFinite(ttl) || ttl < 0) {
      throw new ApiRateLimitUnavailableError();
    }
    return {
      allowed: count <= limit,
      retryAfterSeconds: Math.max(1, ttl),
      remaining: Math.max(0, limit - count),
    };
  }

  onApplicationShutdown(): void {
    this.redis.disconnect?.();
  }
}
