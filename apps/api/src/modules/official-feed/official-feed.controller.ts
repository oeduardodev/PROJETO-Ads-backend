import { Controller, Get } from '@nestjs/common';
import { OfficialFeedService } from './official-feed.service.js';

@Controller('official-feed')
export class OfficialFeedController {
  constructor(private readonly feed: OfficialFeedService) {}

  @Get()
  list() {
    return this.feed.snapshot();
  }
}
