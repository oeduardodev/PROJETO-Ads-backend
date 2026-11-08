import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '../../generated/prisma/enums.js';
import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { AdminAuthorizationGuard } from '../authz/admin-authorization.guard.js';
import { RequireAdminRoles } from '../authz/roles.decorator.js';
import {
  AdminSourcesService,
  ManualRunRateLimitException,
  type SourceAdminActor,
} from './admin-sources.service.js';

interface AdminRequest {
  adminUser?: { id: string; issuer: string; subject: string; role: AdminRole };
}

function actorFrom(request: AdminRequest): SourceAdminActor {
  if (!request.adminUser) throw new UnauthorizedException();
  return {
    id: request.adminUser.id,
    issuer: request.adminUser.issuer,
    subject: request.adminUser.subject,
    requestId: randomUUID(),
  };
}

@Controller('admin')
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthenticationGuard, AdminAuthorizationGuard)
@RequireAdminRoles(AdminRole.CURATOR, AdminRole.ADMIN)
export class AdminSourcesController {
  constructor(private readonly sources: AdminSourcesService) {}

  @Get('sources')
  @ApiOperation({ operationId: 'listAdminSources', summary: 'Listar fontes administrativas' })
  list(@Query() query: Record<string, unknown>) {
    return this.sources.list(query);
  }

  @Get('sources/:id')
  @ApiOperation({ operationId: 'getAdminSource', summary: 'Consultar saude e execucoes da fonte' })
  get(@Param('id') id: string) {
    return this.sources.get(id);
  }

  @Get('institutions/:institutionId/allowed-domains')
  @ApiOperation({ operationId: 'listAdminAllowedDomains', summary: 'Listar dominios cadastrados' })
  listDomains(@Param('institutionId') institutionId: string) {
    return this.sources.listDomains(institutionId);
  }

  @Post('allowed-domains')
  @RequireAdminRoles(AdminRole.ADMIN)
  @ApiOperation({
    operationId: 'registerAdminAllowedDomain',
    summary: 'Cadastrar dominio sem coleta',
  })
  registerDomain(@Body() body: Record<string, unknown>, @Req() request: AdminRequest) {
    return this.sources.registerDomain(body, actorFrom(request));
  }

  @Patch('allowed-domains/:id/review')
  @RequireAdminRoles(AdminRole.ADMIN)
  @ApiOperation({
    operationId: 'reviewAdminAllowedDomain',
    summary: 'Revisar politica de coleta do dominio',
  })
  reviewDomain(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: AdminRequest,
  ) {
    return this.sources.reviewDomain(id, body, actorFrom(request));
  }

  @Post('sources')
  @RequireAdminRoles(AdminRole.ADMIN)
  @ApiOperation({ operationId: 'registerAdminSource', summary: 'Cadastrar fonte em rascunho' })
  register(@Body() body: Record<string, unknown>, @Req() request: AdminRequest) {
    return this.sources.registerSource(body, actorFrom(request));
  }

  @Patch('sources/:id')
  @RequireAdminRoles(AdminRole.ADMIN)
  @ApiOperation({
    operationId: 'configureAdminSource',
    summary: 'Ativar pausar ou configurar fonte',
  })
  configure(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: AdminRequest,
  ) {
    return this.sources.configureSource(id, body, actorFrom(request));
  }

  @Post('sources/:id/run')
  @HttpCode(202)
  @ApiOperation({ operationId: 'runAdminSource', summary: 'Agendar execucao manual controlada' })
  async run(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void },
  ) {
    try {
      return await this.sources.run(id, body, actorFrom(request));
    } catch (error) {
      if (error instanceof ManualRunRateLimitException) {
        response.setHeader('Retry-After', String(error.retryAfterSeconds));
      }
      throw error;
    }
  }
}
