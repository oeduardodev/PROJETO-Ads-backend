import { Injectable } from '@nestjs/common';
import { CrawlErrorCode, CrawlRunStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../database/prisma.service.js';

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
    return this.database.crawlRun.create({
      data: { source: { connect: { id: sourceId } }, attempt },
    });
  }

  async finishSuccess(id: string, httpStatus?: number) {
    const result = await this.database.crawlRun.updateMany({
      where: { id, status: CrawlRunStatus.RUNNING },
      data: {
        status: CrawlRunStatus.SUCCEEDED,
        finishedAt: new Date(),
        success: true,
        httpStatus: validHttpStatus(httpStatus),
      },
    });
    if (result.count !== 1) throw new Error('Crawl run was not running');
    return this.database.crawlRun.findUniqueOrThrow({ where: { id } });
  }

  async finishFailure(id: string, errorCode: CrawlErrorCode, httpStatus?: number) {
    const result = await this.database.crawlRun.updateMany({
      where: { id, status: CrawlRunStatus.RUNNING },
      data: {
        status: CrawlRunStatus.FAILED,
        finishedAt: new Date(),
        success: false,
        errorCode,
        httpStatus: validHttpStatus(httpStatus),
      },
    });
    if (result.count !== 1) throw new Error('Crawl run was not running');
    return this.database.crawlRun.findUniqueOrThrow({ where: { id } });
  }
}
