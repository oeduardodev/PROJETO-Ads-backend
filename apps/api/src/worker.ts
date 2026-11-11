import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module.js';
import { loadWorkerConfig } from './config/environment.js';
import { logStructured } from './observability/structured-log.js';

loadWorkerConfig();
const worker = await NestFactory.createApplicationContext(WorkerModule);
worker.enableShutdownHooks();
process.on('message', async (message) => {
  if (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'shutdown'
  ) {
    await worker.close();
    if (process.connected) process.disconnect();
  }
});
logStructured('info', 'worker.initialized');
