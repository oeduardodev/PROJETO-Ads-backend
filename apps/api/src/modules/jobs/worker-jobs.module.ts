import { Module } from '@nestjs/common';
import { loadWorkerConfig } from '../../config/environment.js';
import { ResponsibleHttpClient } from '../crawling/http/responsible-http.client.js';
import { CrawlingModule } from '../crawling/crawling.module.js';
import { DiscoveryModule } from '../discovery/discovery.module.js';
import { JobsModule } from './jobs.module.js';
import {
  SOURCE_REFRESH_HTTP_FACTORY,
  SOURCE_REFRESH_MAX_BYTES,
  SourceRefreshProcessor,
} from './source-refresh.processor.js';
import { SourcesModule } from '../sources/sources.module.js';
import { WorkerJobConsumers } from './worker-job-consumers.js';

@Module({
  imports: [JobsModule, SourcesModule, CrawlingModule, DiscoveryModule],
  providers: [
    {
      provide: SOURCE_REFRESH_HTTP_FACTORY,
      useValue: (options: ConstructorParameters<typeof ResponsibleHttpClient>[0]) =>
        new ResponsibleHttpClient(options),
    },
    {
      provide: SOURCE_REFRESH_MAX_BYTES,
      useFactory: () => loadWorkerConfig().maxPdfBytes,
    },
    SourceRefreshProcessor,
    WorkerJobConsumers,
  ],
  exports: [WorkerJobConsumers],
})
export class WorkerJobsModule {}
