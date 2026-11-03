import { Module } from '@nestjs/common';
import { ApplicationWindowsRepository } from './application-windows.repository.js';
import { ProcessesRepository } from './processes.repository.js';
import { RequirementsRepository } from './requirements.repository.js';

@Module({
  providers: [ProcessesRepository, ApplicationWindowsRepository, RequirementsRepository],
  exports: [ProcessesRepository, ApplicationWindowsRepository, RequirementsRepository],
})
export class ProcessesModule {}
