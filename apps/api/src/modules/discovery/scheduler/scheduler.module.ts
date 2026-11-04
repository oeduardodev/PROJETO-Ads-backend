import { Module } from '@nestjs/common';
import { Redis } from 'ioredis';
import { loadWorkerConfig } from '../../../config/environment.js';
import { JobsModule } from '../../jobs/jobs.module.js';
import { SourcesModule } from '../../sources/sources.module.js';
import { CRAWL_CONCURRENCY, SOURCE_SCHEDULER_REDIS, SourceScheduler } from './source-scheduler.js';

@Module({
  imports: [JobsModule, SourcesModule],
  providers: [
    {
      provide: SOURCE_SCHEDULER_REDIS,
      useFactory: () =>
        new Redis(loadWorkerConfig().redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: null,
        }),
    },
    { provide: CRAWL_CONCURRENCY, useFactory: () => loadWorkerConfig().crawlConcurrency },
    SourceScheduler,
  ],
})
export class SchedulerModule {}
