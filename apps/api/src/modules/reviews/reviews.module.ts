import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuthzModule } from '../authz/authz.module.js';
import { AdminReviewController } from './admin.controller.js';
import { AdminReviewQueueService } from './admin-review-queue.service.js';
import { AdminReviewCommandsService } from './commands/admin-review-commands.service.js';
import { ReviewCommandsRepository } from './commands/review-commands.repository.js';
import { ReviewsRepository } from './reviews.repository.js';

@Module({
  imports: [AuthModule, AuthzModule],
  controllers: [AdminReviewController],
  providers: [
    ReviewsRepository,
    AdminReviewQueueService,
    AdminReviewCommandsService,
    ReviewCommandsRepository,
  ],
  exports: [ReviewsRepository, AdminReviewQueueService],
})
export class ReviewsModule {}
