import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import {
  createRemoteJWKSet,
  customFetch,
  jwtVerify,
  type FetchImplementation,
  type JWTPayload,
  type RemoteJWKSet,
} from 'jose';
import { loadAdminAuthConfig } from '../../config/environment.js';

export interface AuthPrincipal {
  subject: string;
  issuer: string;
  audience: string | string[];
  claims: JWTPayload;
}

const AUTHORIZED_ALGORITHMS = ['RS256', 'ES256', 'EdDSA'] as const;
const TOKEN_PATTERN = /^Bearer ([A-Za-z0-9._~-]+)$/u;
const MAX_TOKEN_LENGTH = 16_384;

@Injectable()
export class AuthTokenVerifier {
  private readonly jwks = new Map<string, RemoteJWKSet>();

  async verifyAuthorizationHeader(
    authorization: string | string[] | undefined,
    env: NodeJS.ProcessEnv = process.env,
    fetcher: typeof fetch = fetch,
  ): Promise<AuthPrincipal> {
    if (typeof authorization !== 'string') throw new UnauthorizedException('Bearer token required');
    const match = TOKEN_PATTERN.exec(authorization);
    const token = match?.[1];
    if (!token || token.length > MAX_TOKEN_LENGTH) {
      throw new UnauthorizedException('Bearer token is malformed');
    }
    const config = loadAdminAuthConfig(env);
    if (!config)
      throw new ServiceUnavailableException('Administrative authentication is not configured');

    const resolver = this.getJwks(config.jwksUrl, fetcher);
    try {
      const { payload } = await jwtVerify(token, resolver, {
        algorithms: [...AUTHORIZED_ALGORITHMS],
        issuer: config.issuer,
        audience: config.audience,
        requiredClaims: ['iss', 'aud', 'sub', 'exp'],
      });
      if (typeof payload.sub !== 'string' || !payload.sub.trim()) {
        throw new UnauthorizedException('Token subject is invalid');
      }
      if (typeof payload.iss !== 'string' || !payload.aud) {
        throw new UnauthorizedException('Token issuer or audience is invalid');
      }
      return {
        subject: payload.sub,
        issuer: payload.iss,
        audience: payload.aud,
        claims: payload,
      };
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired');
    }
  }

  private getJwks(url: string, fetcher: typeof fetch): RemoteJWKSet {
    const cached = this.jwks.get(url);
    if (cached) return cached;
    const resolver = createRemoteJWKSet(new URL(url), {
      cacheMaxAge: 10 * 60 * 1000,
      cooldownDuration: 30 * 1000,
      timeoutDuration: 5_000,
      [customFetch]: ((input, init) => fetcher(input, init)) as FetchImplementation,
    });
    this.jwks.set(url, resolver);
    return resolver;
  }
}
