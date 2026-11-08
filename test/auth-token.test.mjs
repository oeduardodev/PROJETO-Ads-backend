import assert from 'node:assert/strict';
import test from 'node:test';
import {
  exportJWK,
  generateKeyPair,
  SignJWT,
} from '../apps/api/node_modules/jose/dist/webapi/index.js';
import { AuthTokenVerifier } from '../apps/api/dist/modules/auth/auth-token.verifier.js';

const issuer = 'https://auth.example.test/auth/v1';
const audience = 'authenticated';
const jwksUrl = `${issuer}/.well-known/jwks.json`;
const env = {
  ADMIN_AUTH_ISSUER: issuer,
  ADMIN_AUTH_AUDIENCE: audience,
  ADMIN_AUTH_JWKS_URL: jwksUrl,
};

const unauthorized = (error) => error?.status === 401;
const unavailable = (error) => error?.status === 503;

async function setup() {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'key-1', alg: 'ES256', use: 'sig' };
  const fetcher = async (input) => {
    assert.equal(String(input), jwksUrl);
    return new Response(JSON.stringify({ keys: [jwk] }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=600' },
    });
  };
  return {
    privateKey,
    fetcher,
    verifier: new AuthTokenVerifier(),
  };
}

function issueToken(privateKey, claims = {}) {
  const { exp = Math.floor(Date.now() / 1000) + 120, ...rest } = claims;
  return new SignJWT({ role: 'authenticated', ...rest })
    .setProtectedHeader({ alg: 'ES256', kid: 'key-1', typ: 'JWT' })
    .setIssuer(claims.iss ?? issuer)
    .setAudience(claims.aud ?? audience)
    .setSubject(claims.sub ?? 'user-123')
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(privateKey);
}

test('verifies an asymmetric token with issuer, audience, subject, expiration and cached JWKS', async () => {
  const { privateKey, fetcher, verifier } = await setup();
  const token = await issueToken(privateKey);
  const principal = await verifier.verifyAuthorizationHeader(`Bearer ${token}`, env, fetcher);
  assert.equal(principal.subject, 'user-123');
  assert.equal(principal.issuer, issuer);
  assert.equal(principal.audience, audience);
  assert.equal(principal.claims.role, 'authenticated');
  await verifier.verifyAuthorizationHeader(`Bearer ${token}`, env, fetcher);
});

test('rejects missing, malformed and oversized bearer tokens', async () => {
  const { verifier } = await setup();
  await assert.rejects(verifier.verifyAuthorizationHeader(undefined, env), unauthorized);
  await assert.rejects(verifier.verifyAuthorizationHeader('Basic token', env), unauthorized);
  await assert.rejects(
    verifier.verifyAuthorizationHeader(`Bearer ${'a'.repeat(16_385)}`, env),
    unauthorized,
  );
});

test('rejects invalid issuer, audience, expiration, algorithm and signature', async () => {
  const first = await setup();
  await assert.rejects(
    first.verifier.verifyAuthorizationHeader(
      `Bearer ${await issueToken(first.privateKey, { iss: 'https://other.test' })}`,
      env,
      first.fetcher,
    ),
    unauthorized,
  );
  await assert.rejects(
    first.verifier.verifyAuthorizationHeader(
      `Bearer ${await issueToken(first.privateKey, { aud: 'other-audience' })}`,
      env,
      first.fetcher,
    ),
    unauthorized,
  );
  await assert.rejects(
    first.verifier.verifyAuthorizationHeader(
      `Bearer ${await issueToken(first.privateKey, { exp: Math.floor(Date.now() / 1000) - 1 })}`,
      env,
      first.fetcher,
    ),
    unauthorized,
  );
  const missingExpirationToken = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: 'key-1' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject('user-123')
    .sign(first.privateKey);
  await assert.rejects(
    first.verifier.verifyAuthorizationHeader(
      `Bearer ${missingExpirationToken}`,
      env,
      first.fetcher,
    ),
    unauthorized,
  );

  const hmacToken = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', kid: 'key-1' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject('user-123')
    .setExpirationTime('2m')
    .sign(new TextEncoder().encode('not-an-auth-secret'));
  await assert.rejects(
    first.verifier.verifyAuthorizationHeader(`Bearer ${hmacToken}`, env, first.fetcher),
    unauthorized,
  );

  const { privateKey: otherPrivateKey } = await generateKeyPair('ES256');
  await assert.rejects(
    first.verifier.verifyAuthorizationHeader(
      `Bearer ${await issueToken(otherPrivateKey)}`,
      env,
      first.fetcher,
    ),
    unauthorized,
  );
});

test('does not require auth configuration for public service startup, but fails closed when guard is invoked', async () => {
  const { privateKey, verifier } = await setup();
  const token = await issueToken(privateKey);
  await assert.rejects(verifier.verifyAuthorizationHeader(`Bearer ${token}`, {}), unavailable);
});
