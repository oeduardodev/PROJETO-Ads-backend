import { Controller, Get, Query } from '@nestjs/common';
import { parseFilterQuery } from './filter-query.js';
import { FiltersService } from './filters.service.js';

@Controller('filters')
export class FiltersController {
  constructor(private readonly filters: FiltersService) {}

  @Get()
  list(@Query() query: Record<string, unknown>) {
    return this.filters.list(parseFilterQuery(query));
  }
}
