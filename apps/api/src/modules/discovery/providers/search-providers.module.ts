import { Module } from '@nestjs/common';
import { Redis } from 'ioredis';
import { loadWorkerConfig } from '../../../config/environment.js';
import {
  SEARCH_DAILY_QUOTA,
  SEARCH_QUOTA_STORE,
  SearchProviderService,
} from './search-provider.service.js';
import { RedisSearchQuotaStore, SEARCH_QUOTA_REDIS } from './redis-search-quota.store.js';

@Module({
  providers: [
    {
      provide: SEARCH_QUOTA_REDIS,
      useFactory: () =>
        new Redis(loadWorkerConfig().redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: null,
        }),
    },
    { provide: SEARCH_QUOTA_STORE, useClass: RedisSearchQuotaStore },
    { provide: SEARCH_DAILY_QUOTA, useFactory: () => loadWorkerConfig().searchDailyQuotaPerHost },
    SearchProviderService,
  ],
  exports: [SearchProviderService],
})
export class SearchProvidersModule {}
