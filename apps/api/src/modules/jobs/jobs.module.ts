import { Module } from '@nestjs/common';
import { loadWorkerConfig } from '../../config/environment.js';
import { createJobQueues } from './job-queues.js';
import { JOB_QUEUE_SET, JobsService } from './jobs.service.js';

@Module({
  providers: [
    {
      provide: JOB_QUEUE_SET,
      useFactory: () => createJobQueues(loadWorkerConfig().redisUrl),
    },
    JobsService,
  ],
  exports: [JobsService],
})
export class JobsModule {}
