import { Module } from '@nestjs/common';
import { OfferingsRepository } from './offerings.repository.js';

@Module({ providers: [OfferingsRepository], exports: [OfferingsRepository] })
export class OfferingsModule {}
