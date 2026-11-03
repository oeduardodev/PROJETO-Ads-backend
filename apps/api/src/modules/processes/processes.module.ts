import { Module } from '@nestjs/common';
import { ApplicationWindowsRepository } from './application-windows.repository.js';
import { ProcessesRepository } from './processes.repository.js';
import { RequirementsRepository } from './requirements.repository.js';
import { FiltersController } from './filters/filters.controller.js';
import { FiltersService } from './filters/filters.service.js';

@Module({
  controllers: [FiltersController],
  providers: [
    ProcessesRepository,
    ApplicationWindowsRepository,
    RequirementsRepository,
    FiltersService,
  ],
  exports: [ProcessesRepository, ApplicationWindowsRepository, RequirementsRepository],
})
export class ProcessesModule {}
