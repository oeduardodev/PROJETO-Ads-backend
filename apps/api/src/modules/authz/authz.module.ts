import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminAuthorizationGuard } from './admin-authorization.guard.js';
import { AdminUserRepository } from './admin-user.repository.js';
import { ApiRateLimitModule } from '../../common/security/api-rate-limit.module.js';

@Module({
  imports: [AuthModule, ApiRateLimitModule],
  providers: [AdminAuthorizationGuard, AdminUserRepository],
  exports: [AdminAuthorizationGuard, AdminUserRepository],
})
export class AuthzModule {}
