import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AdminRole } from '../../generated/prisma/enums.js';
import type { AuthPrincipal } from '../auth/auth-token.verifier.js';
import { REQUIRED_ADMIN_ROLES } from './roles.decorator.js';
import { AdminUserRepository } from './admin-user.repository.js';

interface AdminRequest {
  auth?: AuthPrincipal;
  adminUser?: { id: string; issuer: string; subject: string; role: AdminRole };
}

@Injectable()
export class AdminAuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly admins: AdminUserRepository,
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
    return true;
  }
}
