import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadApiConfig } from './config/environment.js';
import { ApiExceptionFilter } from './common/http/api-exception.filter.js';
import { apiSecurityHeadersMiddleware } from './common/security/api-security-headers.js';
import { ApiRateLimitService } from './common/security/api-rate-limit.js';
import {
  enforcePublicGetRateLimit,
  type PublicRateLimitRequest,
  type PublicRateLimitResponse,
} from './common/security/public-get-rate-limit.middleware.js';
import { exposePublicOpenApi } from './openapi/public-openapi.js';
import { requestObservabilityMiddleware } from './observability/request-observability.middleware.js';

const config = loadApiConfig();
const app = await NestFactory.create(AppModule);
app.enableShutdownHooks();
app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready'] });
app.use(apiSecurityHeadersMiddleware);
app.use(requestObservabilityMiddleware);
const rateLimiter = app.get(ApiRateLimitService);
app.use(
  (
    request: PublicRateLimitRequest,
    response: PublicRateLimitResponse,
    next: (error?: unknown) => void,
  ) => {
    void enforcePublicGetRateLimit(request, response, next, rateLimiter);
  },
);
app.enableCors({
  origin: config.corsOrigins,
  exposedHeaders: ['Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-Request-Id'],
});
app.useGlobalFilters(new ApiExceptionFilter());
exposePublicOpenApi(app);
await app.listen(config.port, config.host);
