import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  OnApplicationShutdown,
  ServiceUnavailableException,
  Inject,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { loadAdminSourceRunCooldownSeconds, loadWorkerConfig } from '../../config/environment.js';
import { PrismaService } from '../../database/prisma.service.js';
import { SourceHealth, SourceKind, SourceStatus } from '../../generated/prisma/enums.js';
import { searchQuotaRedisKey, utcDayKey } from '../discovery/providers/search-quota.store.js';
import { sourceQueuePriority } from '../discovery/scheduler/schedule-window.js';
import { JobsService } from '../jobs/jobs.service.js';
import { normalizeAuthorizedHost, normalizeSourceUrl } from './source-url.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const RELEASE_COOLDOWN_SCRIPT =
  "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end";
export const ADMIN_SOURCE_REDIS = Symbol('ADMIN_SOURCE_REDIS');

export class ManualRunRateLimitException extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super({ message: 'Manual source run is rate limited', retryAfterSeconds }, 429);
  }
}

export interface SourceAdminActor {
  id: string;
  issuer: string;
  subject: string;
  requestId?: string;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Object body required');
  }
  return value as Record<string, unknown>;
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new BadRequestException(`${label} must be a UUID`);
  }
  return value.toLowerCase();
}

function text(value: unknown, label: string, max = 4000): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new BadRequestException(`${label} is required`);
  }
  return value.trim();
}

function integer(value: unknown, label: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw new BadRequestException(`${label} is out of range`);
  }
  return value as number;
}

function approvedActor(actor: SourceAdminActor): SourceAdminActor {
  return {
    id: uuid(actor.id, 'Admin actor'),
    issuer: text(actor.issuer, 'Issuer', 512),
    subject: text(actor.subject, 'Subject', 255),
    requestId: actor.requestId ? uuid(actor.requestId, 'Request id') : undefined,
  };
}

function audit(
  actorValue: SourceAdminActor,
  action: string,
  resourceType: string,
  resourceId: string,
  reason: string,
  before: Record<string, string | number | boolean | null>,
  after: Record<string, string | number | boolean | null>,
) {
  const actor = approvedActor(actorValue);
  return {
    actorAdminUserId: actor.id,
    actorIssuer: actor.issuer,
    actorSubject: actor.subject,
    action,
    resourceType,
    resourceId,
    reason,
    beforeJson: before,
    afterJson: after,
    requestId: actor.requestId ?? randomUUID(),
  };
}

function checkedSourceUrl(value: unknown): { url: string; host: string } {
  try {
    return normalizeSourceUrl(text(value, 'Source URL', 4096));
  } catch {
    throw new BadRequestException('A valid public HTTPS source URL is required');
  }
}

function checkedHost(value: unknown): string {
  try {
    return normalizeAuthorizedHost(text(value, 'Host', 253));
  } catch {
    throw new BadRequestException('A valid exact public host is required');
  }
}

@Injectable()
export class AdminSourcesService implements OnApplicationShutdown {
  constructor(
    private readonly database: PrismaService,
    private readonly jobs: JobsService,
    @Inject(ADMIN_SOURCE_REDIS) private readonly redis: Redis,
  ) {}

  onApplicationShutdown(): void {
    this.redis.disconnect();
  }

  list(query: Record<string, unknown>) {
    const institutionId =
      query.institution_id === undefined ? undefined : uuid(query.institution_id, 'institution_id');
    const page = query.page === undefined ? 1 : integer(Number(query.page), 'page', 1, 10_000);
    const pageSize =
      query.page_size === undefined ? 25 : integer(Number(query.page_size), 'page_size', 1, 100);
    return this.database.source.findMany({
      where: institutionId ? { institutionId } : undefined,
      orderBy: [{ priority: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        allowedDomain: { select: { host: true, collectionAllowed: true, reviewedAt: true } },
      },
    });
  }

  listDomains(institutionIdValue: string) {
    const institutionId = uuid(institutionIdValue, 'institution id');
    return this.database.allowedDomain.findMany({
      where: { institutionId },
      orderBy: { host: 'asc' },
    });
  }

  async get(idValue: string) {
    const id = uuid(idValue, 'source id');
    const source = await this.database.source.findUnique({
      where: { id },
      include: {
        allowedDomain: true,
        crawlRuns: { orderBy: { startedAt: 'desc' }, take: 5 },
      },
    });
    if (!source) throw new NotFoundException('Source not found');
    const host = source.allowedDomain.host;
    const now = new Date();
    const quotaLimit = loadWorkerConfig().searchDailyQuotaPerHost;
    try {
      const [usedRaw, backoff] = await Promise.all([
        quotaLimit === 0 ? Promise.resolve(null) : this.redis.get(searchQuotaRedisKey(host, now)),
        this.jobs.sourceRefreshBackoff(id),
      ]);
      const used = usedRaw === null ? 0 : Number(usedRaw);
      return {
        ...source,
        backoff,
        searchQuota: {
          host,
          dayUTC: utcDayKey(now),
          limit: quotaLimit,
          used,
          remaining: Math.max(0, quotaLimit - used),
        },
      };
    } catch {
      throw new ServiceUnavailableException('Source health dependencies unavailable');
    }
  }

  async run(idValue: string, bodyValue: unknown, actorValue: SourceAdminActor) {
    const id = uuid(idValue, 'source id');
    const body = record(bodyValue);
    const reason = text(body.reason, 'Reason');
    const actor = approvedActor(actorValue);
    const source = await this.database.source.findUnique({
      where: { id },
      include: { allowedDomain: true, institution: true },
    });
    if (!source) throw new NotFoundException('Source not found');
    const normalized = checkedSourceUrl(source.url);
    if (
      source.status !== SourceStatus.ACTIVE ||
      source.health === SourceHealth.BLOCKED ||
      !source.institution.publicFlag ||
      !source.institution.verifiedAt ||
      !source.allowedDomain.collectionAllowed ||
      !source.allowedDomain.reviewedAt ||
      normalized.host !== source.allowedDomain.host
    ) {
      throw new ConflictException('Source is not eligible for a manual run');
    }

    const cooldown = loadAdminSourceRunCooldownSeconds();
    const key = `alem-do-sisu:admin-source-run:${normalized.host}`;
    const token = randomUUID();
    let admitted: string | null;
    try {
      admitted = await this.redis.set(key, token, 'EX', cooldown, 'NX');
    } catch {
      throw new ServiceUnavailableException('Manual run rate limiter unavailable');
    }
    if (admitted !== 'OK') {
      let ttl: number;
      try {
        ttl = await this.redis.ttl(key);
      } catch {
        throw new ServiceUnavailableException('Manual run rate limiter unavailable');
      }
      throw new ManualRunRateLimitException(Math.max(1, ttl));
    }

    const requestId = actor.requestId ?? randomUUID();
    try {
      await this.database.auditEvent.create({
        data: audit(
          actor,
          'source.run.request',
          'source',
          id,
          reason,
          {},
          {
            sourceId: id,
            host: normalized.host,
            status: 'ADMITTED',
          },
        ),
      });
      const job = await this.jobs.enqueueManualSourceRefresh(
        id,
        requestId,
        sourceQueuePriority(source.priority, source.health),
      );
      return { sourceId: id, jobId: job.id, state: 'queued' as const };
    } catch (error) {
      await this.redis.eval(RELEASE_COOLDOWN_SCRIPT, 1, key, token).catch(() => undefined);
      throw new ServiceUnavailableException('Manual source run could not be queued', {
        cause: error,
      });
    }
  }

  async registerDomain(bodyValue: unknown, actor: SourceAdminActor) {
    const body = record(bodyValue);
    const institutionId = uuid(body.institutionId, 'institutionId');
    const host = checkedHost(body.host);
    const evidence = checkedSourceUrl(body.evidenceUrl);
    if (evidence.host !== host) {
      throw new BadRequestException('Domain evidence must use the same exact host');
    }
    const reason = text(body.reason, 'Reason');
    return this.database.$transaction(async (tx) => {
      const institution = await tx.institution.findUnique({ where: { id: institutionId } });
      if (!institution) throw new NotFoundException('Institution not found');
      const existing = await tx.allowedDomain.findUnique({
        where: { institutionId_host: { institutionId, host } },
      });
      if (existing) throw new ConflictException('Domain already registered');
      const created = await tx.allowedDomain.create({
        data: { institutionId, host, evidenceUrl: evidence.url },
      });
      await tx.auditEvent.create({
        data: audit(
          actor,
          'source.domain.register',
          'allowed_domain',
          created.id,
          reason,
          {},
          {
            institutionId,
            host,
            evidenceUrl: evidence.url,
            collectionAllowed: false,
          },
        ),
      });
      return created;
    });
  }

  async reviewDomain(idValue: string, bodyValue: unknown, actor: SourceAdminActor) {
    const id = uuid(idValue, 'domain id');
    const body = record(bodyValue);
    const reason = text(body.reason, 'Reason');
    if (typeof body.collectionAllowed !== 'boolean') {
      throw new BadRequestException('collectionAllowed must be a boolean');
    }
    if (
      body.collectionAllowed &&
      (body.officialSourceVerified !== true || body.accessPolicyReviewed !== true)
    ) {
      throw new BadRequestException('Official source and access policy must be reviewed');
    }
    return this.database.$transaction(async (tx) => {
      const domain = await tx.allowedDomain.findUnique({ where: { id } });
      if (!domain) throw new NotFoundException('Domain not found');
      const updated = await tx.allowedDomain.update({
        where: { id },
        data: {
          collectionAllowed: body.collectionAllowed as boolean,
          reviewedAt: body.collectionAllowed ? new Date() : domain.reviewedAt,
        },
      });
      await tx.auditEvent.create({
        data: audit(
          actor,
          'source.domain.review',
          'allowed_domain',
          id,
          reason,
          {
            collectionAllowed: domain.collectionAllowed,
            reviewedAt: domain.reviewedAt?.toISOString() ?? null,
          },
          {
            collectionAllowed: updated.collectionAllowed,
            reviewedAt: updated.reviewedAt?.toISOString() ?? null,
            officialSourceVerified: body.officialSourceVerified === true,
            accessPolicyReviewed: body.accessPolicyReviewed === true,
          },
        ),
      });
      return updated;
    });
  }

  async registerSource(bodyValue: unknown, actor: SourceAdminActor) {
    const body = record(bodyValue);
    const institutionId = uuid(body.institutionId, 'institutionId');
    const sourceUrl = checkedSourceUrl(body.url);
    if (
      typeof body.kind !== 'string' ||
      !Object.values(SourceKind).includes(body.kind as SourceKind)
    ) {
      throw new BadRequestException('Unsupported source kind');
    }
    const frequencyMinutes =
      body.frequencyMinutes === undefined
        ? 1440
        : integer(body.frequencyMinutes, 'frequencyMinutes', 1, 525_600);
    const priority =
      body.priority === undefined ? 100 : integer(body.priority, 'priority', 0, 1_000_000);
    const selector =
      body.selector === undefined || body.selector === null
        ? null
        : text(body.selector, 'Selector', 2000);
    const reason = text(body.reason, 'Reason');
    return this.database.$transaction(async (tx) => {
      const domain = await tx.allowedDomain.findUnique({
        where: { institutionId_host: { institutionId, host: sourceUrl.host } },
      });
      if (!domain)
        throw new BadRequestException('Source host is not registered for this institution');
      const existing = await tx.source.findUnique({
        where: { institutionId_url: { institutionId, url: sourceUrl.url } },
      });
      if (existing) throw new ConflictException('Source already registered');
      const created = await tx.source.create({
        data: {
          institutionId,
          allowedDomainId: domain.id,
          url: sourceUrl.url,
          kind: body.kind as SourceKind,
          selector,
          frequencyMinutes,
          priority,
          status: SourceStatus.DRAFT,
        },
      });
      await tx.auditEvent.create({
        data: audit(
          actor,
          'source.register',
          'source',
          created.id,
          reason,
          {},
          {
            institutionId,
            host: sourceUrl.host,
            url: sourceUrl.url,
            kind: created.kind,
            frequencyMinutes,
            priority,
            status: created.status,
          },
        ),
      });
      return created;
    });
  }

  async configureSource(idValue: string, bodyValue: unknown, actor: SourceAdminActor) {
    const id = uuid(idValue, 'source id');
    const body = record(bodyValue);
    const reason = text(body.reason, 'Reason');
    const allowed = new Set(['reason', 'status', 'frequencyMinutes', 'priority', 'selector']);
    if (
      Object.keys(body).some((key) => !allowed.has(key)) ||
      Object.keys(body).every((key) => key === 'reason')
    ) {
      throw new BadRequestException('No supported source configuration provided');
    }
    const status = body.status === undefined ? undefined : body.status;
    if (status !== undefined && status !== SourceStatus.ACTIVE && status !== SourceStatus.PAUSED) {
      throw new BadRequestException('Source status must be ACTIVE or PAUSED');
    }
    const frequencyMinutes =
      body.frequencyMinutes === undefined
        ? undefined
        : integer(body.frequencyMinutes, 'frequencyMinutes', 1, 525_600);
    const priority =
      body.priority === undefined ? undefined : integer(body.priority, 'priority', 0, 1_000_000);
    const selector =
      body.selector === undefined
        ? undefined
        : body.selector === null
          ? null
          : text(body.selector, 'Selector', 2000);
    return this.database.$transaction(async (tx) => {
      const source = await tx.source.findUnique({
        where: { id },
        include: { allowedDomain: true, institution: true },
      });
      if (!source) throw new NotFoundException('Source not found');
      if (
        status === SourceStatus.ACTIVE &&
        (!source.institution.publicFlag ||
          !source.institution.verifiedAt ||
          !source.allowedDomain.collectionAllowed ||
          !source.allowedDomain.reviewedAt ||
          source.health === SourceHealth.BLOCKED)
      ) {
        throw new ConflictException('Source is not eligible for activation');
      }
      const updated = await tx.source.update({
        where: { id },
        data: { status: status as SourceStatus | undefined, frequencyMinutes, priority, selector },
      });
      await tx.auditEvent.create({
        data: audit(
          actor,
          'source.configure',
          'source',
          id,
          reason,
          {
            status: source.status,
            frequencyMinutes: source.frequencyMinutes,
            priority: source.priority,
            selector: source.selector,
          },
          {
            status: updated.status,
            frequencyMinutes: updated.frequencyMinutes,
            priority: updated.priority,
            selector: updated.selector,
          },
        ),
      });
      return updated;
    });
  }
}
