import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { AdminAuthorizationGuard } from '../authz/admin-authorization.guard.js';
import { RequireAdminRoles } from '../authz/roles.decorator.js';
import { AdminRole, ProcessIngestionState } from '../../generated/prisma/enums.js';
import { AdminReviewQueueService } from './admin-review-queue.service.js';

@Controller('admin')
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthenticationGuard, AdminAuthorizationGuard)
@RequireAdminRoles(AdminRole.CURATOR, AdminRole.ADMIN)
export class AdminReviewController {
  constructor(private readonly reviews: AdminReviewQueueService) {}

  @Get('review-queue')
  @ApiOperation({
    operationId: 'listAdminReviewQueue',
    summary: 'Listar fila de revisão administrativa',
  })
  @ApiQuery({ name: 'state', required: false, enum: Object.values(ProcessIngestionState) })
  @ApiQuery({ name: 'institution_id', required: false, type: String, format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1, maximum: 10000 })
  @ApiQuery({ name: 'page_size', required: false, type: Number, minimum: 1, maximum: 100 })
  list(@Query() query: Record<string, unknown>) {
    return this.reviews.list(query);
  }

  @Get('processes/:id')
  @ApiOperation({
    operationId: 'getAdminReviewProcess',
    summary: 'Obter detalhes internos para revisão',
  })
  @ApiNotFoundResponse({ description: 'Processo não encontrado' })
  get(@Param('id') id: string) {
    return this.reviews.get(id);
  }
}
