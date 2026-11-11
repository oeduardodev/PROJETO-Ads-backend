import { Injectable } from '@nestjs/common';
import { CrawlErrorCode, CrawlRunStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../database/prisma.service.js';
import { logStructured } from '../../observability/structured-log.js';
import { observabilityMetrics } from '../../observability/metrics.registry.js';
import { sourceFailureAlert } from '../../observability/source-alert-policy.js';

function validHttpStatus(value: number | undefined): number | undefined {
  if (value !== undefined && (!Number.isInteger(value) || value < 100 || value > 599)) {
    throw new Error('HTTP status must be an integer from 100 to 599');
  }
  return value;
}

@Injectable()
export class CrawlRunsRepository {
  constructor(private readonly database: PrismaService) {}

  createRecord(sourceId: string, attempt = 1) {
    if (!Number.isInteger(attempt) || attempt < 1)
      throw new Error('Attempt must be a positive integer');
    return this.database.crawlRun
      .create({
        data: { source: { connect: { id: sourceId } }, attempt },
      })
      .then((run) => {
        logStructured('info', 'source.crawl.started', {
          sourceId,
          crawlRunId: run.id,
          attempt,
        });
        return run;
      });
  }

  async finishSuccess(id: string, httpStatus?: number) {
    const finishedAt = new Date();
    const status = validHttpStatus(httpStatus);
    const run = await this.database.$transaction(async (transaction) => {
      const run = await transaction.crawlRun.findUniqueOrThrow({
        where: { id },
        select: { sourceId: true },
      });
      const result = await transaction.crawlRun.updateMany({
        where: { id, status: CrawlRunStatus.RUNNING },
        data: {
          status: CrawlRunStatus.SUCCEEDED,
          finishedAt,
          success: true,
          httpStatus: status,
        },
      });
      if (result.count !== 1) throw new Error('Crawl run was not running');
      await transaction.source.update({
        where: { id: run.sourceId },
        data: { lastCheckedAt: finishedAt, lastSuccessAt: finishedAt },
      });
      return transaction.crawlRun.findUniqueOrThrow({ where: { id } });
    });
    const durationMs = Math.max(0, finishedAt.getTime() - run.startedAt.getTime());
    observabilityMetrics.increment('source_crawl_runs_total', 'Finished source crawl runs', {
      source_id: run.sourceId,
      result: 'succeeded',
    });
    logStructured('info', 'source.crawl.succeeded', {
      sourceId: run.sourceId,
      crawlRunId: run.id,
      status: run.status,
      httpStatus: run.httpStatus,
      durationMs,
    });
    return run;
  }

  async finishFailure(id: string, errorCode: CrawlErrorCode, httpStatus?: number) {
    const finishedAt = new Date();
    const status = validHttpStatus(httpStatus);
    const run = await this.database.$transaction(async (transaction) => {
      const run = await transaction.crawlRun.findUniqueOrThrow({
        where: { id },
        select: { sourceId: true },
      });
      const result = await transaction.crawlRun.updateMany({
        where: { id, status: CrawlRunStatus.RUNNING },
        data: {
          status: CrawlRunStatus.FAILED,
          finishedAt,
          success: false,
          errorCode,
          httpStatus: status,
        },
      });
      if (result.count !== 1) throw new Error('Crawl run was not running');
      await transaction.source.update({
        where: { id: run.sourceId },
        data: { lastCheckedAt: finishedAt },
      });
      return transaction.crawlRun.findUniqueOrThrow({ where: { id } });
    });
    const durationMs = Math.max(0, finishedAt.getTime() - run.startedAt.getTime());
    observabilityMetrics.increment('source_crawl_runs_total', 'Finished source crawl runs', {
      source_id: run.sourceId,
      result: 'failed',
    });
    const [source, recentRuns] = await Promise.all([
      this.database.source.findUnique({
        where: { id: run.sourceId },
        select: {
          status: true,
          frequencyMinutes: true,
          lastSuccessAt: true,
          allowedDomain: { select: { reviewedAt: true, collectionAllowed: true } },
        },
      }),
      this.database.crawlRun.findMany({
        where: { sourceId: run.sourceId, finishedAt: { not: null } },
        orderBy: { startedAt: 'desc' },
        take: 3,
        select: { success: true },
      }),
    ]);
    const consecutiveFailures = recentRuns.findIndex((item) => item.success === true);
    const failureStreak = consecutiveFailures === -1 ? recentRuns.length : consecutiveFailures;
    const alert = source
      ? sourceFailureAlert({
          active: source.status === 'ACTIVE',
          exactHostReviewed: Boolean(
            source.allowedDomain.reviewedAt && source.allowedDomain.collectionAllowed,
          ),
          consecutiveFailures: failureStreak,
          lastSuccessAt: source.lastSuccessAt,
          frequencyMinutes: source.frequencyMinutes,
          now: finishedAt,
        })
      : 'none';
    const level = alert === 'alert' ? 'error' : alert === 'warning' ? 'warn' : 'info';
    const event = alert === 'alert' ? 'source.alert.persistent_failure' : 'source.crawl.failed';
    logStructured(level, event, {
      sourceId: run.sourceId,
      crawlRunId: run.id,
      status: run.status,
      errorCode: run.errorCode ?? errorCode,
      httpStatus: run.httpStatus,
      durationMs,
      attempt: run.attempt,
    });
    return run;
  }
}
