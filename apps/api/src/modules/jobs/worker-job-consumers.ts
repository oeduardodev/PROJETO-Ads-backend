import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import { loadWorkerConfig } from '../../config/environment.js';
import { logStructured } from '../../observability/structured-log.js';
import { SourceRefreshProcessor } from './source-refresh.processor.js';
import { UrlFetchProcessor } from './url-fetch.processor.js';

@Injectable()
export class WorkerJobConsumers implements OnModuleInit, OnApplicationShutdown {
  private readonly workers: Worker[] = [];

  constructor(
    private readonly sourceRefresh: SourceRefreshProcessor,
    private readonly urlFetch: UrlFetchProcessor,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' && !process.env.TEST_REDIS_URL) {
      logStructured('info', 'worker.consumers.skipped', { reason: 'TEST_REDIS_URL not set' });
      return;
    }

    const config = loadWorkerConfig();
    const worker = new Worker('source.refresh', (job) => this.sourceRefresh.process(job), {
      connection: { url: config.redisUrl, maxRetriesPerRequest: null },
      prefix: 'alem-do-sisu',
      concurrency: config.crawlConcurrency,
    });
    worker.on('ready', () =>
      logStructured('info', 'worker.queue.ready', { queue: 'source.refresh' }),
    );
    worker.on('error', (error: Error) =>
      logStructured('error', 'worker.queue.error', {
        queue: 'source.refresh',
        errorName: error.name,
      }),
    );
    worker.on('failed', (job, error) =>
      logStructured('error', 'worker.job.failed', {
        queue: 'source.refresh',
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
        errorName: error.name,
      }),
    );
    this.workers.push(worker);

    const fetchWorker = new Worker('url.fetch', (job) => this.urlFetch.process(job), {
      connection: { url: config.redisUrl, maxRetriesPerRequest: null },
      prefix: 'alem-do-sisu',
      concurrency: config.crawlConcurrency,
    });
    fetchWorker.on('ready', () =>
      logStructured('info', 'worker.queue.ready', { queue: 'url.fetch' }),
    );
    fetchWorker.on('error', (error: Error) =>
      logStructured('error', 'worker.queue.error', { queue: 'url.fetch', errorName: error.name }),
    );
    fetchWorker.on('failed', (job, error) =>
      logStructured('error', 'worker.job.failed', {
        queue: 'url.fetch',
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
        errorName: error.name,
      }),
    );
    this.workers.push(fetchWorker);
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.close()));
    this.workers.length = 0;
  }
}
