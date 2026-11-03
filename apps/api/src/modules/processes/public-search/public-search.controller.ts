import { Controller, Get, Query } from '@nestjs/common';
import { parsePagination } from '../../../common/http/pagination.js';
import { parseSearchQuery } from './search-query.js';
import { PublicSearchService } from './public-search.service.js';

@Controller('processes')
export class PublicSearchController {
  constructor(private readonly search: PublicSearchService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.search.search(parseSearchQuery(query), parsePagination(query));
  }
}
