import { Module } from '@nestjs/common';
import { CrawlRunsRepository } from './crawl-runs.repository.js';

@Module({ providers: [CrawlRunsRepository], exports: [CrawlRunsRepository] })
export class CrawlingModule {}
