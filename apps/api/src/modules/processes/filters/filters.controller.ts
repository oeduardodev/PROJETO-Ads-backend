import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { schemaRef } from '../../../openapi/public-schemas.js';
import { parseFilterQuery } from './filter-query.js';
import { FiltersService } from './filters.service.js';

@Controller('filters')
@ApiTags('public')
export class FiltersController {
  constructor(private readonly filters: FiltersService) {}

  @Get()
  @ApiOperation({ operationId: 'listFilters', summary: 'Listar facetas dos processos publicados' })
  @ApiQuery({ name: 'uf', required: false, type: String, minLength: 2, maxLength: 2 })
  @ApiQuery({ name: 'modality', required: false, type: String, maxLength: 64 })
  @ApiQuery({ name: 'selection_type', required: false, type: String, maxLength: 64 })
  @ApiQuery({ name: 'requires_enem', required: false, enum: ['true', 'false', 'unknown'] })
  @ApiOkResponse({ schema: schemaRef('Filters') })
  @ApiBadRequestResponse({ schema: schemaRef('ApiError') })
  list(@Query() query: Record<string, unknown>) {
    return this.filters.list(parseFilterQuery(query));
  }
}
