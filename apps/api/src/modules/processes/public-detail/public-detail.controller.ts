import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { schemaRef } from '../../../openapi/public-schemas.js';
import { PublicDetailService } from './public-detail.service.js';

@Controller('processes')
@ApiTags('public')
export class PublicDetailController {
  constructor(private readonly detail: PublicDetailService) {}

  @Get(':id')
  @ApiOperation({ operationId: 'getProcess', summary: 'Detalhar processo publicado' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ schema: schemaRef('ProcessDetail') })
  @ApiBadRequestResponse({ schema: schemaRef('ApiError') })
  @ApiNotFoundResponse({ schema: schemaRef('ApiError') })
  get(@Param('id') id: string) {
    return this.detail.get(id);
  }
}
