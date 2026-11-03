import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Redis } from 'ioredis';
import { loadApiConfig } from '../../config/environment.js';
import { PrismaService } from '../../database/prisma.service.js';

function failureCode(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }
  return error instanceof Error ? error.name : 'UNKNOWN';
}

@Injectable()
export class ReadinessService {
  private readonly logger = new Logger(ReadinessService.name);

  constructor(private readonly database: PrismaService) {}

  async check(): Promise<{ status: 'ready'; dependencies: { database: 'up'; redis: 'up' } }> {
    const redis = new Redis(loadApiConfig().redisUrl, {
      lazyConnect: true,
      connectTimeout: 1000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
    redis.on('error', () => undefined);
    const [databaseResult, redisResult] = await Promise.allSettled([
      this.database.$queryRaw`SELECT 1`,
      redis.connect().then(() => redis.ping()),
    ]);
    redis.disconnect();
    if (databaseResult.status === 'rejected') {
      this.logger.error(`readiness database failed: ${failureCode(databaseResult.reason)}`);
    }
    if (redisResult.status === 'rejected') {
      this.logger.error(`readiness redis failed: ${failureCode(redisResult.reason)}`);
    }
    if (databaseResult.status === 'rejected' || redisResult.status === 'rejected') {
      throw new ServiceUnavailableException();
    }
    return { status: 'ready', dependencies: { database: 'up', redis: 'up' } };
  }
}
