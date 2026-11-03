import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { ReadinessController } from './readiness.controller.js';
import { ReadinessService } from './readiness.service.js';

@Module({ controllers: [HealthController, ReadinessController], providers: [ReadinessService] })
export class HealthModule {}
