import { Module } from '@nestjs/common';
import { InstitutionsRepository } from './institutions.repository.js';
import { PublicInstitutionsController } from './controllers/public-institutions.controller.js';
import { PublicInstitutionsService } from './public-institutions.service.js';

@Module({
  controllers: [PublicInstitutionsController],
  providers: [InstitutionsRepository, PublicInstitutionsService],
  exports: [InstitutionsRepository],
})
export class InstitutionsModule {}
