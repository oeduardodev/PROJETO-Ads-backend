import { Controller, Get, Query } from '@nestjs/common';
import { parsePagination } from '../../../common/http/pagination.js';
import { PublicInstitutionsService } from '../public-institutions.service.js';

@Controller('institutions')
export class PublicInstitutionsController {
  constructor(private readonly institutions: PublicInstitutionsService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.institutions.list(parsePagination(query));
  }
}
