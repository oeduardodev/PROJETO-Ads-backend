import { Queue } from 'bullmq';
import type { DefaultJobOptions } from 'bullmq';

export const JOB_QUEUE_NAMES = [
  'source.refresh',
  'url.fetch',
  'document.classify',
  'document.extract',
  'process.validate',
  'process.recheck',
] as const;

export type JobQueueName = (typeof JOB_QUEUE_NAMES)[number];

export interface JobPayloads {
  'source.refresh': { sourceId: string; scheduleVersion: number };
  'url.fetch': { candidateUrlId: string };
  'document.classify': { documentId: string; sha256: string };
  'document.extract': { documentId: string; schemaVersion: number };
  'process.validate': { processId: string; revision: number };
  'process.recheck': { processId: string; dueAt: string };
}

export type JobQueueSet = Record<JobQueueName, Queue>;

export const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1_000, jitter: 0.5 },
  removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1_000 },
  removeOnFail: false,
};

export function createJobQueues(redisUrl: string, prefix = 'alem-do-sisu'): JobQueueSet {
  const connection = { url: redisUrl };
  const queues = Object.fromEntries(
    JOB_QUEUE_NAMES.map((name) => [
      name,
      new Queue(name, {
        connection,
        prefix,
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
        skipWaitingForReady: true,
      }),
    ]),
  );
  return queues as JobQueueSet;
}
