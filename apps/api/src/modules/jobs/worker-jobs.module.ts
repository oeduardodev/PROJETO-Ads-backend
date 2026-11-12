import { Module } from '@nestjs/common';
import { loadWorkerConfig } from '../../config/environment.js';
import { ResponsibleHttpClient } from '../crawling/http/responsible-http.client.js';
import { CrawlingModule } from '../crawling/crawling.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { DiscoveryModule } from '../discovery/discovery.module.js';
import { JobsModule } from './jobs.module.js';
import {
  SOURCE_REFRESH_HTTP_FACTORY,
  SOURCE_REFRESH_MAX_BYTES,
  SourceRefreshProcessor,
} from './source-refresh.processor.js';
import { SourcesModule } from '../sources/sources.module.js';
import { WorkerJobConsumers } from './worker-job-consumers.js';
import {
  URL_FETCH_HTTP_FACTORY,
  URL_FETCH_MAX_BYTES,
  UrlFetchProcessor,
} from './url-fetch.processor.js';

function workerHttpClient(options: ConstructorParameters<typeof ResponsibleHttpClient>[0]) {
  if (process.env.NODE_ENV === 'test')
    throw new Error('Worker HTTP is disabled in test mode; inject an offline fixture transport');
  return new ResponsibleHttpClient(options);
}

@Module({
  imports: [JobsModule, SourcesModule, CrawlingModule, DiscoveryModule, DocumentsModule],
  providers: [
    {
      provide: SOURCE_REFRESH_HTTP_FACTORY,
      useValue: workerHttpClient,
    },
    {
      provide: SOURCE_REFRESH_MAX_BYTES,
      useFactory: () => loadWorkerConfig().maxPdfBytes,
    },
    SourceRefreshProcessor,
    {
      provide: URL_FETCH_HTTP_FACTORY,
      useValue: workerHttpClient,
    },
    {
      provide: URL_FETCH_MAX_BYTES,
      useFactory: () => loadWorkerConfig().maxPdfBytes,
    },
    UrlFetchProcessor,
    WorkerJobConsumers,
  ],
  exports: [WorkerJobConsumers],
})
export class WorkerJobsModule {}
