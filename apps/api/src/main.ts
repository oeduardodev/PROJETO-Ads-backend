import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadApiConfig } from './config/environment.js';

const config = loadApiConfig();
const app = await NestFactory.create(AppModule);
app.enableCors({ origin: config.corsOrigins });
await app.listen(config.port, config.host);
