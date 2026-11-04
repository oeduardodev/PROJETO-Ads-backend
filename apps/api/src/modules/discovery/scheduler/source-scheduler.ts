import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { JOB_QUEUE_SET } from '../../jobs/jobs.service.js';
import { JobsService } from '../../jobs/jobs.service.js';
import type { JobQueueSet } from '../../jobs/job-queues.js';
import { SourcesRepository } from '../../sources/sources.repository.js';
import { scheduleWindowVersion, sourceQueuePriority } from './schedule-window.js';

export const SOURCE_SCHEDULER_REDIS = Symbol('SOURCE_SCHEDULER_REDIS');
export const CRAWL_CONCURRENCY = Symbol('CRAWL_CONCURRENCY');

const SCHEDULER_INTERVAL_MS = 60_000;
const LOCK_TTL_MS = 30_000;
const LOCK_RENEW_INTERVAL_MS = 10_000;
const LOCK_KEY = 'alem-do-sisu:source-scheduler:lock';
const RENEW_LOCK_SCRIPT =
  "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE', KEYS[1], ARGV[2]) else return 0 end";
const RELEASE_LOCK_SCRIPT =
  "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end";
const IN_FLIGHT_STATES = [
  'active',
  'waiting',
  'delayed',
  'prioritized',
  'waiting-children',
] as const;

@Injectable()
export class SourceScheduler implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(SourceScheduler.name);
  private timer: NodeJS.Timeout | undefined;
  private currentRun: Promise<number> | undefined;

  constructor(
    private readonly sources: SourcesRepository,
    private readonly jobs: JobsService,
    @Inject(JOB_QUEUE_SET) private readonly queues: JobQueueSet,
    @Inject(SOURCE_SCHEDULER_REDIS) private readonly redis: Redis,
    @Inject(CRAWL_CONCURRENCY) private readonly crawlConcurrency: number,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      if (this.currentRun) return;
      const run = this.runOnce();
      this.currentRun = run;
      void run
        .catch((error: unknown) => {
          const code = error instanceof Error ? error.name : 'UNKNOWN';
          this.logger.error(`source scheduler failed: ${code}`);
        })
        .finally(() => {
          if (this.currentRun === run) this.currentRun = undefined;
        });
    }, SCHEDULER_INTERVAL_MS);
    this.timer.unref();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.currentRun?.catch(() => undefined);
    this.redis.disconnect();
  }

  async runOnce(now = new Date()): Promise<number> {
    const token = randomUUID();
    const acquired = await this.redis.set(LOCK_KEY, token, 'PX', LOCK_TTL_MS, 'NX');
    if (acquired !== 'OK') return 0;

    let lockLost = false;
    let renewalInFlight = false;
    const renewTimer = setInterval(() => {
      if (renewalInFlight) return;
      renewalInFlight = true;
      void this.redis
        .eval(RENEW_LOCK_SCRIPT, 1, LOCK_KEY, token, String(LOCK_TTL_MS))
        .then((result) => {
          if (result !== 1) lockLost = true;
        })
        .catch(() => {
          lockLost = true;
        })
        .finally(() => {
          renewalInFlight = false;
        });
    }, LOCK_RENEW_INTERVAL_MS);
    renewTimer.unref();

    try {
      const schedulable = await this.sources.listSchedulable();
      if (schedulable.length === 0) return 0;

      const queue = this.queues['source.refresh'];
      const inFlight = await queue.getJobs([...IN_FLIGHT_STATES], 0, -1, true);
      const sourceIds = [
        ...new Set(
          inFlight
            .map((job) => job.data.sourceId)
            .filter((sourceId): sourceId is string => typeof sourceId === 'string'),
        ),
      ];
      const hostBySourceId = await this.sources.mapHostsBySourceIds(sourceIds);
      const inFlightSourceIds = new Set<string>();
      const domainCounts = new Map<string, number>();
      for (const job of inFlight) {
        const sourceId: unknown = job.data.sourceId;
        if (typeof sourceId !== 'string') continue;
        inFlightSourceIds.add(sourceId);
        const host = hostBySourceId.get(sourceId);
        if (host) domainCounts.set(host, (domainCounts.get(host) ?? 0) + 1);
      }

      const candidates = schedulable
        .map((source) => ({
          ...source,
          scheduleVersion: scheduleWindowVersion(source, now),
        }))
        .filter((source) => source.scheduleVersion !== null)
        .sort((left, right) => {
          const healthOrder =
            Number(left.health === 'DEGRADED') - Number(right.health === 'DEGRADED');
          if (healthOrder !== 0) return healthOrder;
          if (left.priority !== right.priority) return left.priority - right.priority;
          const leftChecked = left.lastCheckedAt?.getTime() ?? 0;
          const rightChecked = right.lastCheckedAt?.getTime() ?? 0;
          if (leftChecked !== rightChecked) return leftChecked - rightChecked;
          return left.id.localeCompare(right.id);
        });

      let enqueued = 0;
      for (const source of candidates) {
        if (lockLost) break;
        if (inFlightSourceIds.has(source.id) || source.scheduleVersion === null) continue;
        const host = source.allowedDomain.host;
        const inFlightForHost = domainCounts.get(host) ?? 0;
        if (inFlightForHost >= this.crawlConcurrency) continue;

        await this.jobs.enqueueSourceRefresh(
          { sourceId: source.id, scheduleVersion: source.scheduleVersion },
          sourceQueuePriority(source.priority, source.health),
        );
        inFlightSourceIds.add(source.id);
        domainCounts.set(host, inFlightForHost + 1);
        enqueued += 1;
      }
      return enqueued;
    } finally {
      clearInterval(renewTimer);
      await this.redis.eval(RELEASE_LOCK_SCRIPT, 1, LOCK_KEY, token).catch(() => undefined);
    }
  }
}
