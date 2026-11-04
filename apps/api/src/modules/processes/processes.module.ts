import { Module } from '@nestjs/common';
import { ApplicationWindowsRepository } from './application-windows.repository.js';
import { ProcessesRepository } from './processes.repository.js';
import { RequirementsRepository } from './requirements.repository.js';
import { FiltersController } from './filters/filters.controller.js';
import { FiltersService } from './filters/filters.service.js';
import { PublicSearchController } from './public-search/public-search.controller.js';
import { PublicSearchService } from './public-search/public-search.service.js';
import { PublicDetailController } from './public-detail/public-detail.controller.js';
import { PublicDetailService } from './public-detail/public-detail.service.js';

@Module({
  controllers: [FiltersController, PublicSearchController, PublicDetailController],
  providers: [
    ProcessesRepository,
    ApplicationWindowsRepository,
    RequirementsRepository,
    FiltersService,
    PublicSearchService,
    PublicDetailService,
  ],
  exports: [ProcessesRepository, ApplicationWindowsRepository, RequirementsRepository],
})
export class ProcessesModule {}
