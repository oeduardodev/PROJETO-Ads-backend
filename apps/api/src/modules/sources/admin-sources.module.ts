import { Module } from '@nestjs/common';
import { Redis } from 'ioredis';
import { loadApiConfig } from '../../config/environment.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuthzModule } from '../authz/authz.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { AdminSourcesService, ADMIN_SOURCE_REDIS } from './admin-sources.service.js';
import { AdminSourcesController } from './admin.controller.js';

@Module({
  imports: [AuthModule, AuthzModule, JobsModule],
  controllers: [AdminSourcesController],
  providers: [
    {
      provide: ADMIN_SOURCE_REDIS,
      useFactory: () =>
        new Redis(loadApiConfig().redisUrl, {
          lazyConnect: true,
          connectTimeout: 1_000,
          maxRetriesPerRequest: 1,
          retryStrategy: () => null,
        }),
    },
    AdminSourcesService,
  ],
})
export class AdminSourcesModule {}
