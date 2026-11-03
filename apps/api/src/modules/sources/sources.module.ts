import { Module } from '@nestjs/common';
import { AllowedDomainsRepository, SourcesRepository } from './sources.repository.js';

@Module({
  providers: [AllowedDomainsRepository, SourcesRepository],
  exports: [AllowedDomainsRepository, SourcesRepository],
})
export class SourcesModule {}
