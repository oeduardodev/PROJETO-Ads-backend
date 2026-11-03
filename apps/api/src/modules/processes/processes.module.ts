import { Module } from '@nestjs/common';
import { ApplicationWindowsRepository } from './application-windows.repository.js';
import { ProcessesRepository } from './processes.repository.js';
import { RequirementsRepository } from './requirements.repository.js';
import { FiltersController } from './filters/filters.controller.js';
import { FiltersService } from './filters/filters.service.js';
import { PublicSearchController } from './public-search/public-search.controller.js';
import { PublicSearchService } from './public-search/public-search.service.js';

@Module({
  controllers: [FiltersController, PublicSearchController],
  providers: [
    ProcessesRepository,
    ApplicationWindowsRepository,
    RequirementsRepository,
    FiltersService,
    PublicSearchService,
  ],
  exports: [ProcessesRepository, ApplicationWindowsRepository, RequirementsRepository],
})
export class ProcessesModule {}
