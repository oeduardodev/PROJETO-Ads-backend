import { Module } from '@nestjs/common';
import { CampusesRepository } from './campuses.repository.js';

@Module({ providers: [CampusesRepository], exports: [CampusesRepository] })
export class CampusesModule {}
