import { Controller, Get, Param } from '@nestjs/common';
import { PublicDetailService } from './public-detail.service.js';

@Controller('processes')
export class PublicDetailController {
  constructor(private readonly detail: PublicDetailService) {}

  @Get(':id')
  get(@Param('id') id: string) {
    return this.detail.get(id);
  }
}
