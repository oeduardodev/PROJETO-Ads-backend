import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { parsePagination } from '../../../common/http/pagination.js';
import { schemaRef } from '../../../openapi/public-schemas.js';
import { parseSearchQuery } from './search-query.js';
import { PublicSearchService } from './public-search.service.js';

@Controller('processes')
@ApiTags('public')
export class PublicSearchController {
  constructor(private readonly search: PublicSearchService) {}

  @Get()
  @ApiOperation({ operationId: 'searchProcesses', summary: 'Pesquisar processos publicados' })
  @ApiQuery({ name: 'q', required: false, type: String, maxLength: 120 })
  @ApiQuery({ name: 'uf', required: false, type: String, minLength: 2, maxLength: 2 })
  @ApiQuery({ name: 'city', required: false, type: String, maxLength: 150 })
  @ApiQuery({ name: 'degree', required: false, type: String, maxLength: 32 })
  @ApiQuery({ name: 'modality', required: false, type: String, maxLength: 64 })
  @ApiQuery({ name: 'requires_enem', required: false, enum: ['true', 'false', 'unknown'] })
  @ApiQuery({ name: 'selection_type', required: false, type: String, maxLength: 64 })
  @ApiQuery({ name: 'open_only', required: false, enum: ['true', 'false'] })
  @ApiQuery({ name: 'sort', required: false, enum: ['recent', 'deadline', 'course'] })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1, maximum: 10000 })
  @ApiQuery({ name: 'page_size', required: false, type: Number, minimum: 1, maximum: 100 })
  @ApiOkResponse({ schema: schemaRef('ProcessList') })
  @ApiBadRequestResponse({ schema: schemaRef('ApiError') })
  list(@Query() query: Record<string, unknown>) {
    return this.search.search(parseSearchQuery(query), parsePagination(query));
  }
}
