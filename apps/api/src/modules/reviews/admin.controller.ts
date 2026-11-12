import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticationGuard } from '../auth/authentication.guard.js';
import { AdminAuthorizationGuard } from '../authz/admin-authorization.guard.js';
import { RequireAdminRoles } from '../authz/roles.decorator.js';
import { AdminRole, ProcessIngestionState } from '../../generated/prisma/enums.js';
import type { WorkflowActor } from '../review/workflow/state-machine.js';
import { AdminReviewQueueService } from './admin-review-queue.service.js';
import { AdminReviewCommandsService } from './commands/admin-review-commands.service.js';
import { logStructured } from '../../observability/structured-log.js';
import { observabilityMetrics } from '../../observability/metrics.registry.js';
import {
  ProcessingReviewService,
  type ProcessingReviewResolution,
} from './processing-review.service.js';

interface AuthenticatedAdminRequest {
  requestId?: string;
  adminUser?: { id: string; issuer: string; subject: string; role: AdminRole };
}

function actorFrom(request: AuthenticatedAdminRequest): WorkflowActor {
  const admin = request.adminUser;
  if (!admin) throw new UnauthorizedException();
  const adminIdentity = {
    id: admin.id,
    issuer: admin.issuer,
    subject: admin.subject,
    requestId: request.requestId ?? randomUUID(),
  };
  return {
    id: admin.id,
    kind: 'HUMAN',
    permissions: [
      'process.verify',
      'process.publish',
      'process.reject',
      'process.correct',
      'process.hide',
    ],
    adminIdentity,
  };
}

@Controller('admin')
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthenticationGuard, AdminAuthorizationGuard)
@RequireAdminRoles(AdminRole.CURATOR, AdminRole.ADMIN)
export class AdminReviewController {
  constructor(
    private readonly reviews: AdminReviewQueueService,
    private readonly commands: AdminReviewCommandsService,
    private readonly processingReviews: ProcessingReviewService,
  ) {}

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

  @Get('processing-review-queue')
  @ApiOperation({
    operationId: 'listAdminProcessingReviewQueue',
    summary: 'Listar artefatos pendentes de revisao humana',
  })
  listProcessingArtifacts(@Query() query: Record<string, unknown>) {
    return this.processingReviews.list(query);
  }

  @Post('processing-review-queue/:id/resolve')
  @ApiOperation({
    operationId: 'resolveAdminProcessingReviewItem',
    summary: 'Associar artefato a processo ou criar rascunho',
  })
  @ApiBadRequestResponse({ description: 'Proveniencia, instituicao ou justificativa invalida' })
  @ApiConflictResponse({ description: 'Versao desatualizada ou item ja resolvido' })
  resolveProcessingArtifact(
    @Param('id') id: string,
    @Body() body: ProcessingReviewResolution,
    @Req() request: AuthenticatedAdminRequest,
  ) {
    const admin = request.adminUser;
    if (!admin) throw new UnauthorizedException();
    return this.processingReviews.resolve(id, body, {
      id: admin.id,
      issuer: admin.issuer,
      subject: admin.subject,
      requestId: request.requestId ?? randomUUID(),
    });
  }

  @Get('processing-review-queue/:id/process-options')
  @ApiOperation({
    operationId: 'listAdminProcessingReviewProcessOptions',
    summary: 'Listar processos nao publicados compativeis com a proveniencia',
  })
  processingReviewProcessOptions(
    @Param('id') id: string,
    @Query('institution_id') institutionId?: string,
  ) {
    return this.processingReviews.processOptions(id, institutionId);
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

  @Post('processes/:id/approve')
  @ApiOperation({
    operationId: 'approveAdminProcess',
    summary: 'Aprovar e publicar processo revisado',
  })
  @ApiBadRequestResponse({ description: 'Justificativa, evidencias ou confirmacoes invalidas' })
  @ApiConflictResponse({ description: 'Versao desatualizada ou processo em estado incompativel' })
  approve(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: AuthenticatedAdminRequest,
  ) {
    const actor = actorFrom(request);
    return this.commands.approve(id, body, actor).then((result) => {
      this.recordDecision('approved', id, actor.adminIdentity?.requestId, result.reviewVersion);
      return result;
    });
  }

  @Post('processes/:id/reject')
  @ApiOperation({
    operationId: 'rejectAdminProcess',
    summary: 'Rejeitar processo com justificativa',
  })
  @ApiConflictResponse({ description: 'Versao desatualizada ou processo em estado incompativel' })
  reject(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: AuthenticatedAdminRequest,
  ) {
    const actor = actorFrom(request);
    return this.commands.reject(id, body, actor).then((result) => {
      this.recordDecision('rejected', id, actor.adminIdentity?.requestId, result.reviewVersion);
      return result;
    });
  }

  @Post('processes/:id/hide')
  @ApiOperation({ operationId: 'hideAdminProcess', summary: 'Ocultar processo publicado' })
  @ApiBadRequestResponse({ description: 'Justificativa ou evidencia invalida' })
  @ApiConflictResponse({ description: 'Versao desatualizada ou processo em estado incompativel' })
  hide(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: AuthenticatedAdminRequest,
  ) {
    const actor = actorFrom(request);
    return this.commands.hide(id, body, actor).then((result) => {
      this.recordDecision('hidden', id, actor.adminIdentity?.requestId, result.reviewVersion);
      return result;
    });
  }

  @Patch('processes/:id/correct')
  @ApiOperation({
    operationId: 'correctAdminProcess',
    summary: 'Corrigir fatos de processo com evidencia oficial',
  })
  @ApiBadRequestResponse({ description: 'Correcao, justificativa ou evidencia invalida' })
  @ApiConflictResponse({ description: 'Versao desatualizada ou processo fora da revisao' })
  correct(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: AuthenticatedAdminRequest,
  ) {
    const actor = actorFrom(request);
    return this.commands.correct(id, body, actor).then((result) => {
      this.recordDecision('corrected', id, actor.adminIdentity?.requestId, result.reviewVersion);
      return result;
    });
  }

  private recordDecision(
    action: string,
    processId: string,
    requestId: string | undefined,
    reviewVersion: number,
  ): void {
    observabilityMetrics.increment('review_decisions_total', 'Successful human review decisions', {
      action,
    });
    logStructured('info', 'review.decision.completed', {
      action,
      processId,
      requestId,
      reviewVersion,
    });
  }
}
