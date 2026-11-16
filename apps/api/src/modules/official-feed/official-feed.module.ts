import { Module } from '@nestjs/common';
import { OfficialFeedController } from './official-feed.controller.js';
import { OfficialFeedService } from './official-feed.service.js';

@Module({ controllers: [OfficialFeedController], providers: [OfficialFeedService] })
export class OfficialFeedModule {}
