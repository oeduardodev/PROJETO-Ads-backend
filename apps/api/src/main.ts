import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadApiConfig } from './config/environment.js';
import { ApiExceptionFilter } from './common/http/api-exception.filter.js';
import { exposePublicOpenApi } from './openapi/public-openapi.js';

const config = loadApiConfig();
const app = await NestFactory.create(AppModule);
app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready'] });
app.enableCors({ origin: config.corsOrigins });
app.useGlobalFilters(new ApiExceptionFilter());
exposePublicOpenApi(app);
await app.listen(config.port, config.host);
