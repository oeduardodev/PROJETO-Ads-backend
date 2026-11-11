import { Module } from '@nestjs/common';
import { AuthModule } from '../modules/auth/auth.module.js';
import { AuthzModule } from '../modules/authz/authz.module.js';
import { JobsModule } from '../modules/jobs/jobs.module.js';
import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';

@Module({
  imports: [AuthModule, AuthzModule, JobsModule],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class ObservabilityModule {}
