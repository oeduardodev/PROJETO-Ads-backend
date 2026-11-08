import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';

export interface AuditEventInput {
  actorAdminUserId: string;
  actorIssuer: string;
  actorSubject: string;
  action: string;
  resourceType: string;
  resourceId: string;
  reason: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  requestId?: string;
}

const SECRET_FIELD = /token|password|secret|authorization|cookie|api.?key/iu;

function requiredText(value: string, field: string, maximum: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) throw new Error(`Invalid audit ${field}`);
  return normalized;
}

function snapshot(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  const json = JSON.stringify(value);
  if (json.length > 32_768) throw new Error('Audit snapshot exceeds the size limit');
  const parsed: unknown = JSON.parse(json);
  const inspect = (item: unknown): boolean => {
    if (!item || typeof item !== 'object') return true;
    if (Array.isArray(item)) return item.every(inspect);
    return Object.entries(item).every(([key, child]) => !SECRET_FIELD.test(key) && inspect(child));
  };
  if (!inspect(parsed)) throw new Error('Audit snapshot contains a secret field');
  return parsed as Prisma.InputJsonValue;
}

@Injectable()
export class AuditRepository {
  constructor(private readonly database: PrismaService) {}

  record(input: AuditEventInput) {
    return this.database.auditEvent.create({
      data: {
        actor: { connect: { id: requiredText(input.actorAdminUserId, 'actor id', 64) } },
        actorIssuer: requiredText(input.actorIssuer, 'issuer', 512),
        actorSubject: requiredText(input.actorSubject, 'subject', 255),
        action: requiredText(input.action, 'action', 100),
        resourceType: requiredText(input.resourceType, 'resource type', 100),
        resourceId: requiredText(input.resourceId, 'resource id', 255),
        reason: requiredText(input.reason, 'reason', 4_000),
        beforeJson: snapshot(input.before),
        afterJson: snapshot(input.after),
        requestId: input.requestId ? requiredText(input.requestId, 'request id', 128) : undefined,
      },
    });
  }
}
