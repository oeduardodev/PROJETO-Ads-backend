import {
  ForbiddenException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AdminRole } from '../../generated/prisma/enums.js';
import type { AuthPrincipal } from '../auth/auth-token.verifier.js';
import { REQUIRED_ADMIN_ROLES } from './roles.decorator.js';
import { AdminUserRepository } from './admin-user.repository.js';
import {
  ADMIN_WRITE_RATE_LIMIT_PER_MINUTE,
  ApiRateLimitService,
  ApiRateLimitUnavailableError,
} from '../../common/security/api-rate-limit.js';

interface AdminRequest {
  method?: string;
  auth?: AuthPrincipal;
  adminUser?: { id: string; issuer: string; subject: string; role: AdminRole };
}

@Injectable()
export class AdminAuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly admins: AdminUserRepository,
    private readonly rateLimiter: ApiRateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<AdminRole[]>(REQUIRED_ADMIN_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) throw new ForbiddenException('Administrative role is not declared');
    const request = context.switchToHttp().getRequest<AdminRequest>();
    if (!request.auth) throw new UnauthorizedException('Authenticated identity required');
    const adminUser = await this.admins.findAuthorized(
      { issuer: request.auth.issuer, subject: request.auth.subject },
      roles,
    );
    if (!adminUser) throw new ForbiddenException('Administrative role is not granted');
    request.adminUser = adminUser;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method?.toUpperCase() ?? '')) {
      try {
        const result = await this.rateLimiter.consume(
          'admin-write',
          `${adminUser.issuer}\u0000${adminUser.subject}`,
          ADMIN_WRITE_RATE_LIMIT_PER_MINUTE,
        );
        if (!result.allowed) {
          context
            .switchToHttp()
            .getResponse<{ setHeader(name: string, value: string): void }>()
            .setHeader('Retry-After', String(result.retryAfterSeconds));
          throw new HttpException('Too many requests', 429);
        }
      } catch (error) {
        if (error instanceof ApiRateLimitUnavailableError) throw new ServiceUnavailableException();
        throw error;
      }
    }
    return true;
  }
}
