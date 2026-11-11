import { Global, Module } from '@nestjs/common';
import { Redis } from 'ioredis';
import { loadApiConfig } from '../../config/environment.js';
import { API_RATE_LIMIT_REDIS, ApiRateLimitService } from './api-rate-limit.js';

@Global()
@Module({
  providers: [
    {
      provide: API_RATE_LIMIT_REDIS,
      useFactory: () =>
        new Redis(loadApiConfig().redisUrl, {
          lazyConnect: true,
          connectTimeout: 1_000,
          maxRetriesPerRequest: 1,
          retryStrategy: () => null,
        }),
    },
    ApiRateLimitService,
  ],
  exports: [ApiRateLimitService],
})
export class ApiRateLimitModule {}
