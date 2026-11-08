import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import { AuthTokenVerifier, type AuthPrincipal } from './auth-token.verifier.js';

interface AuthenticatedRequest {
  headers: IncomingHttpHeaders;
  auth?: AuthPrincipal;
}

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(private readonly tokens: AuthTokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.auth = await this.tokens.verifyAuthorizationHeader(request.headers.authorization);
    return true;
  }
}
