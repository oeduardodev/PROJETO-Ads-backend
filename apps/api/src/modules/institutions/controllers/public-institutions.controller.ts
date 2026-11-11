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
import { PublicInstitutionsService } from '../public-institutions.service.js';
import { parsePublicInstitutionQuery } from '../public-institutions.query.js';

@Controller('institutions')
@ApiTags('public')
export class PublicInstitutionsController {
  constructor(private readonly institutions: PublicInstitutionsService) {}

  @Get()
  @ApiOperation({
    operationId: 'listInstitutions',
    summary: 'Listar instituições públicas verificadas',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1, maximum: 10000 })
  @ApiQuery({ name: 'page_size', required: false, type: Number, minimum: 1, maximum: 100 })
  @ApiQuery({ name: 'q', required: false, type: String, maxLength: 120 })
  @ApiQuery({ name: 'uf', required: false, type: String, minLength: 2, maxLength: 2 })
  @ApiQuery({ name: 'city', required: false, type: String, maxLength: 150 })
  @ApiQuery({ name: 'jurisdiction', required: false, enum: ['FEDERAL', 'ESTADUAL'] })
  @ApiOkResponse({ schema: schemaRef('InstitutionList') })
  @ApiBadRequestResponse({ schema: schemaRef('ApiError') })
  list(@Query() query: Record<string, unknown>) {
    return this.institutions.list(parsePublicInstitutionQuery(query), parsePagination(query));
  }
}
