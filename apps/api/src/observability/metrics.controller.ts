import { Controller, Get, Header, HttpException, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { AdminRole } from '../generated/prisma/enums.js';
import { AuthenticationGuard } from '../modules/auth/authentication.guard.js';
import { AdminAuthorizationGuard } from '../modules/authz/admin-authorization.guard.js';
import { RequireAdminRoles } from '../modules/authz/roles.decorator.js';
import { MetricsService } from './metrics.service.js';

interface MetricsRequest {
  adminUser?: { role: AdminRole };
}

@Controller('internal')
@UseGuards(AuthenticationGuard, AdminAuthorizationGuard)
@RequireAdminRoles(AdminRole.CURATOR, AdminRole.ADMIN)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(@Req() request: MetricsRequest): Promise<string> {
    if (!request.adminUser) throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    return this.metrics.render();
  }
}
