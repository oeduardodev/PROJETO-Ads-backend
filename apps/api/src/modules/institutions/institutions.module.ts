import { Module } from '@nestjs/common';
import { InstitutionsRepository } from './institutions.repository.js';

@Module({ providers: [InstitutionsRepository], exports: [InstitutionsRepository] })
export class InstitutionsModule {}
