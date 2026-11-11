import { ServiceUnavailableException } from '@nestjs/common';
import type { ApiRateLimitService } from './api-rate-limit.js';
import {
  ApiRateLimitUnavailableError,
  PUBLIC_GET_RATE_LIMIT_PER_MINUTE,
  publicClientIdentity,
} from './api-rate-limit.js';

export interface PublicRateLimitRequest {
  method: string;
  originalUrl?: string;
  socket?: { remoteAddress?: string };
}

export interface PublicRateLimitResponse {
  setHeader(name: string, value: string): void;
  status(code: number): PublicRateLimitResponse;
  json(body: unknown): void;
}

export function isPublicGet(request: PublicRateLimitRequest): boolean {
  if (request.method.toUpperCase() !== 'GET') return false;
  const path = (request.originalUrl?.split('?')[0] ?? '').replace(/\/$/u, '');
  return (
    path === '/api/v1/filters' ||
    path === '/api/v1/institutions' ||
    path === '/api/v1/processes' ||
    /^\/api\/v1\/processes\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      path,
    )
  );
}

export async function enforcePublicGetRateLimit(
  request: PublicRateLimitRequest,
  response: PublicRateLimitResponse,
  next: (error?: unknown) => void,
  limiter: ApiRateLimitService,
): Promise<void> {
  if (!isPublicGet(request)) {
    next();
    return;
  }
  try {
    const result = await limiter.consume(
      'public-get',
      publicClientIdentity(request),
      PUBLIC_GET_RATE_LIMIT_PER_MINUTE,
    );
    if (result.allowed) {
      response.setHeader('X-RateLimit-Limit', String(PUBLIC_GET_RATE_LIMIT_PER_MINUTE));
      response.setHeader('X-RateLimit-Remaining', String(result.remaining));
      next();
      return;
    }
    response.setHeader('Retry-After', String(result.retryAfterSeconds));
    response
      .status(429)
      .json({ statusCode: 429, message: 'Too many requests', error: 'Too Many Requests' });
  } catch (error) {
    next(error instanceof ApiRateLimitUnavailableError ? new ServiceUnavailableException() : error);
  }
}
