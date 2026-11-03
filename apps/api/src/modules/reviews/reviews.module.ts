import { Module } from '@nestjs/common';
import { ReviewsRepository } from './reviews.repository.js';

@Module({ providers: [ReviewsRepository], exports: [ReviewsRepository] })
export class ReviewsModule {}
