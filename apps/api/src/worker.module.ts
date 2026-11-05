import { Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import { SourcesModule } from './modules/sources/sources.module.js';
import { DiscoveryModule } from './modules/discovery/discovery.module.js';
import { CrawlingModule } from './modules/crawling/crawling.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { ExtractionModule } from './modules/extraction/extraction.module.js';
import { ValidationModule } from './modules/validation/validation.module.js';
import { ProcessesModule } from './modules/processes/processes.module.js';
import { JobsModule } from './modules/jobs/jobs.module.js';
import { SchedulerModule } from './modules/discovery/scheduler/scheduler.module.js';
import { SearchProvidersModule } from './modules/discovery/providers/search-providers.module.js';
import { DatabaseModule } from './database/database.module.js';

@Injectable()
class WorkerRuntime implements OnApplicationShutdown {
  private readonly keepAlive = setInterval(() => undefined, 60_000);

  onApplicationShutdown(): void {
    clearInterval(this.keepAlive);
  }
}

@Module({
  imports: [
    DatabaseModule,
    SourcesModule,
    DiscoveryModule,
    CrawlingModule,
    DocumentsModule,
    ExtractionModule,
    ValidationModule,
    ProcessesModule,
    JobsModule,
    SchedulerModule,
    SearchProvidersModule,
  ],
  providers: [WorkerRuntime],
})
export class WorkerModule {}
