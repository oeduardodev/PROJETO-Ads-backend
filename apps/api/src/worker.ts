import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module.js';
import { loadWorkerConfig } from './config/environment.js';

loadWorkerConfig();
const worker = await NestFactory.createApplicationContext(WorkerModule);
worker.enableShutdownHooks();
console.log('Worker initialized without an HTTP listener');
