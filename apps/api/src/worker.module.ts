import { Module } from '@nestjs/common';
import { SourcesModule } from './modules/sources/sources.module.js';
import { DiscoveryModule } from './modules/discovery/discovery.module.js';
import { CrawlingModule } from './modules/crawling/crawling.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { ExtractionModule } from './modules/extraction/extraction.module.js';
import { ValidationModule } from './modules/validation/validation.module.js';
import { ProcessesModule } from './modules/processes/processes.module.js';
import { DatabaseModule } from './database/database.module.js';

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
  ],
})
export class WorkerModule {}
