import { Inject, Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { PrismaService } from '../database/prisma.service.js';
import { JOB_QUEUE_SET } from '../modules/jobs/jobs.service.js';
import type { JobQueueSet } from '../modules/jobs/job-queues.js';
import { observabilityMetrics } from './metrics.registry.js';

function label(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('"', '\\"');
}

@Injectable()
export class MetricsService {
  constructor(
    private readonly database: PrismaService,
    @Inject(JOB_QUEUE_SET) private readonly queues: JobQueueSet,
  ) {}

  async render(): Promise<string> {
    const now = Date.now();
    const since = new Date(now - 24 * 60 * 60 * 1000);
    const [sources, observations, failures, ...queueCounts] = await Promise.all([
      this.database.source.findMany({
        select: {
          id: true,
          status: true,
          health: true,
          lastSuccessAt: true,
          frequencyMinutes: true,
          allowedDomain: { select: { reviewedAt: true, collectionAllowed: true } },
          crawlRuns: {
            where: { finishedAt: { not: null } },
            orderBy: { startedAt: 'desc' },
            take: 3,
            select: { success: true },
          },
        },
      }),
      this.database.discoveryObservation.groupBy({
        by: ['sourceId'],
        where: { firstSeenAt: { gte: since } },
        _count: { _all: true },
      }),
      this.database.crawlRun.groupBy({
        by: ['sourceId'],
        where: { status: 'FAILED', finishedAt: { gte: since } },
        _count: { _all: true },
      }),
      ...Object.values(this.queues).map((queue) =>
        (queue as Queue).getJobCounts('waiting', 'active', 'delayed', 'failed'),
      ),
    ]);
    const lines = [observabilityMetrics.render()];
    lines.push('# HELP source_last_success_age_seconds Seconds since a source last succeeded');
    lines.push('# TYPE source_last_success_age_seconds gauge');
    lines.push('# HELP source_frequency_seconds Configured source polling frequency in seconds');
    lines.push('# TYPE source_frequency_seconds gauge');
    for (const source of sources) {
      if (source.lastSuccessAt) {
        lines.push(
          `source_last_success_age_seconds{source_id="${label(source.id)}"} ${Math.max(0, Math.floor((now - source.lastSuccessAt.getTime()) / 1000))}`,
        );
      }
      lines.push(
        `source_frequency_seconds{source_id="${label(source.id)}"} ${source.frequencyMinutes * 60}`,
      );
    }
    lines.push('# HELP source_new_observations_24h New URL observations in the last 24 hours');
    lines.push('# TYPE source_new_observations_24h gauge');
    const observationCounts = new Map(
      observations.map((item) => [item.sourceId, item._count._all]),
    );
    for (const source of sources) {
      lines.push(
        `source_new_observations_24h{source_id="${label(source.id)}"} ${observationCounts.get(source.id) ?? 0}`,
      );
    }
    lines.push('# HELP source_failed_crawl_runs_24h Failed source crawl runs in the last 24 hours');
    lines.push('# TYPE source_failed_crawl_runs_24h gauge');
    const failureCounts = new Map(failures.map((item) => [item.sourceId, item._count._all]));
    for (const source of sources) {
      lines.push(
        `source_failed_crawl_runs_24h{source_id="${label(source.id)}"} ${failureCounts.get(source.id) ?? 0}`,
      );
    }
    lines.push(
      '# HELP source_failure_streak Consecutive failed completed source runs, capped at three',
    );
    lines.push('# TYPE source_failure_streak gauge');
    for (const source of sources) {
      let streak = 0;
      for (const run of source.crawlRuns) {
        if (run.success !== false) break;
        streak += 1;
      }
      lines.push(`source_failure_streak{source_id="${label(source.id)}"} ${streak}`);
    }
    lines.push('# HELP source_info Current source status and health');
    lines.push('# TYPE source_info gauge');
    for (const source of sources) {
      lines.push(
        `source_info{source_id="${label(source.id)}",status="${source.status}",health="${source.health}",collection_authorized="${Boolean(source.allowedDomain.reviewedAt && source.allowedDomain.collectionAllowed)}"} 1`,
      );
    }
    lines.push('# HELP bullmq_jobs Current queue jobs by state');
    lines.push('# TYPE bullmq_jobs gauge');
    Object.keys(this.queues).forEach((name, index) => {
      const counts = queueCounts[index] as Record<string, number>;
      for (const [state, count] of Object.entries(counts)) {
        lines.push(`bullmq_jobs{queue="${name}",state="${state}"} ${count}`);
      }
    });
    return lines.join('\n').replace(/\n{3,}/gu, '\n\n');
  }
}
