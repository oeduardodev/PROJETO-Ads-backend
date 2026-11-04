import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { JobPayloads, JobQueueName, JobQueueSet } from './job-queues.js';

export const JOB_QUEUE_SET = Symbol('JOB_QUEUE_SET');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/iu;
const DATE_TIME_WITH_ZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/iu;

function uuid(value: string, field: string): string {
  if (!UUID.test(value)) throw new TypeError(field + ' must be a UUID');
  return value.toLowerCase();
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(field + ' must be a positive safe integer');
  }
  return value;
}

function jobId(value: string): string {
  if (value.includes(':')) throw new TypeError('jobId cannot contain a colon');
  return value;
}

@Injectable()
export class JobsService implements OnApplicationShutdown {
  constructor(@Inject(JOB_QUEUE_SET) private readonly queues: JobQueueSet) {}

  enqueueSourceRefresh(data: JobPayloads['source.refresh']) {
    const sourceId = uuid(data.sourceId, 'sourceId');
    const scheduleVersion = positiveInteger(data.scheduleVersion, 'scheduleVersion');
    return this.add(
      'source.refresh',
      { sourceId, scheduleVersion },
      'source-refresh-' + sourceId + '-v' + scheduleVersion,
    );
  }

  enqueueUrlFetch(candidateUrlId: string) {
    const payload = { candidateUrlId: uuid(candidateUrlId, 'candidateUrlId') };
    return this.add('url.fetch', payload, 'url-fetch-' + payload.candidateUrlId);
  }

  enqueueDocumentClassify(documentId: string, sha256: string) {
    const normalizedId = uuid(documentId, 'documentId');
    if (!SHA256.test(sha256)) throw new TypeError('sha256 must contain 64 hexadecimal characters');
    const payload = { documentId: normalizedId, sha256: sha256.toLowerCase() };
    return this.add(
      'document.classify',
      payload,
      'document-classify-' + normalizedId + '-' + payload.sha256,
    );
  }

  enqueueDocumentExtract(documentId: string, schemaVersion: number) {
    const normalizedId = uuid(documentId, 'documentId');
    const version = positiveInteger(schemaVersion, 'schemaVersion');
    return this.add(
      'document.extract',
      { documentId: normalizedId, schemaVersion: version },
      'document-extract-' + normalizedId + '-v' + version,
    );
  }

  enqueueProcessValidate(processId: string, revision: number) {
    const normalizedId = uuid(processId, 'processId');
    const processRevision = positiveInteger(revision, 'revision');
    return this.add(
      'process.validate',
      { processId: normalizedId, revision: processRevision },
      'process-validate-' + normalizedId + '-r' + processRevision,
    );
  }

  enqueueProcessRecheck(processId: string, dueAt: string) {
    const normalizedId = uuid(processId, 'processId');
    if (!DATE_TIME_WITH_ZONE.test(dueAt)) {
      throw new TypeError('dueAt must include an explicit timezone');
    }
    const timestamp = Date.parse(dueAt);
    if (!Number.isFinite(timestamp)) throw new TypeError('dueAt must be a valid date-time');
    const normalizedDueAt = new Date(timestamp).toISOString();
    return this.add(
      'process.recheck',
      { processId: normalizedId, dueAt: normalizedDueAt },
      'process-recheck-' + normalizedId + '-' + timestamp,
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(Object.values(this.queues).map((queue) => queue.close()));
  }

  private add<Name extends JobQueueName>(name: Name, payload: JobPayloads[Name], id: string) {
    const queue = this.queues[name] as Queue;
    return queue.add(name, payload, { jobId: jobId(id) });
  }
}
