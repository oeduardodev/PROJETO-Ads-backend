import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_WRITE_RATE_LIMIT_PER_MINUTE,
  ApiRateLimitService,
  ApiRateLimitUnavailableError,
  PUBLIC_GET_RATE_LIMIT_PER_MINUTE,
  publicClientIdentity,
  rateLimitIdentityHash,
} from '../apps/api/dist/common/security/api-rate-limit.js';
import {
  enforcePublicGetRateLimit,
  isPublicGet,
} from '../apps/api/dist/common/security/public-get-rate-limit.middleware.js';
import { AdminAuthorizationGuard } from '../apps/api/dist/modules/authz/admin-authorization.guard.js';

test('API rate limit scopes use socket IP and hashed identities, never forwarded headers', () => {
  const request = {
    socket: { remoteAddress: '203.0.113.10' },
    headers: { 'x-forwarded-for': '198.51.100.42' },
  };
  assert.equal(publicClientIdentity(request), '203.0.113.10');
  assert.notEqual(
    rateLimitIdentityHash(publicClientIdentity(request)),
    request.socket.remoteAddress,
  );
  assert.equal(PUBLIC_GET_RATE_LIMIT_PER_MINUTE, 120);
  assert.equal(ADMIN_WRITE_RATE_LIMIT_PER_MINUTE, 30);
});

test('public GET limiter applies only to public API GET routes', () => {
  assert.equal(isPublicGet({ method: 'GET', originalUrl: '/api/v1/processes?q=x' }), true);
  assert.equal(isPublicGet({ method: 'POST', originalUrl: '/api/v1/processes' }), false);
  assert.equal(isPublicGet({ method: 'GET', originalUrl: '/api/v1/admin/sources' }), false);
  assert.equal(isPublicGet({ method: 'GET', originalUrl: '/api/v1/internal/metrics' }), false);
  assert.equal(isPublicGet({ method: 'GET', originalUrl: '/api/v1/openapi.json' }), false);
  assert.equal(isPublicGet({ method: 'GET', originalUrl: '/api/v1/missing' }), false);
  assert.equal(isPublicGet({ method: 'GET', originalUrl: '/health' }), false);
});

test('Redis fixed-window limiter is atomic, returns retry metadata, and fails closed', async () => {
  const keys = [];
  let count = 0;
  const limiter = new ApiRateLimitService({
    eval: async (_script, keyCount, key, windowSeconds) => {
      keys.push(key);
      assert.equal(keyCount, 1);
      assert.equal(windowSeconds, '60');
      count += 1;
      return [count, 37];
    },
  });
  const first = await limiter.consume('public-get', '203.0.113.10', 1, 60_000);
  const second = await limiter.consume('public-get', '203.0.113.10', 1, 60_001);
  assert.deepEqual(first, { allowed: true, retryAfterSeconds: 37, remaining: 0 });
  assert.deepEqual(second, { allowed: false, retryAfterSeconds: 37, remaining: 0 });
  assert.equal(keys[0], keys[1]);
  assert.equal(keys[0].includes('203.0.113.10'), false);
  const unavailable = new ApiRateLimitService({
    eval: async () => Promise.reject(new Error('down')),
  });
  await assert.rejects(
    unavailable.consume('admin-write', 'issuer\0subject', 30),
    ApiRateLimitUnavailableError,
  );
});

test('public limiter sets Retry-After on 429 and delegates when under limit', async () => {
  const calls = [];
  const request = {
    method: 'GET',
    originalUrl: '/api/v1/processes',
    socket: { remoteAddress: '127.0.0.1' },
  };
  const response = {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
  await enforcePublicGetRateLimit(request, response, (error) => calls.push(error ?? 'next'), {
    consume: async () => ({ allowed: false, retryAfterSeconds: 23, remaining: 0 }),
  });
  assert.equal(response.statusCode, 429);
  assert.equal(response.headers['Retry-After'], '23');
  assert.equal(response.body.statusCode, 429);
  assert.deepEqual(calls, []);
  await enforcePublicGetRateLimit(request, response, (error) => calls.push(error ?? 'next'), {
    consume: async () => ({ allowed: true, retryAfterSeconds: 60, remaining: 119 }),
  });
  assert.equal(response.headers['X-RateLimit-Limit'], '120');
  assert.deepEqual(calls, ['next']);
});

test('admin mutations are limited by the server-mapped issuer and subject', async () => {
  const keys = [];
  const limiter = {
    consume: async (scope, identity, limit) => {
      keys.push({ scope, identity, limit });
      return { allowed: false, retryAfterSeconds: 12, remaining: 0 };
    },
  };
  const guard = new AdminAuthorizationGuard(
    { getAllAndOverride: () => ['CURATOR'] },
    {
      findAuthorized: async () => ({
        id: 'admin',
        issuer: 'https://issuer.example',
        subject: 'curator-1',
        role: 'CURATOR',
      }),
    },
    limiter,
  );
  const headers = {};
  const request = {
    auth: { issuer: 'https://issuer.example', subject: 'curator-1' },
    method: 'PATCH',
  };
  const executionContext = {
    getHandler: () => 'handler',
    getClass: () => 'controller',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({
        setHeader: (name, value) => {
          headers[name] = value;
        },
      }),
    }),
  };
  await assert.rejects(guard.canActivate(executionContext), (error) => error.getStatus() === 429);
  assert.equal(headers['Retry-After'], '12');
  assert.deepEqual(keys, [
    { scope: 'admin-write', identity: 'https://issuer.example\0curator-1', limit: 30 },
  ]);
});
