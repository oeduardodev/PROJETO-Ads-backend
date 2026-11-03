import { Injectable } from '@nestjs/common';
import { SourceKind } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../database/prisma.service.js';
import { normalizeAuthorizedHost, normalizeSourceUrl } from './source-url.js';

@Injectable()
export class AllowedDomainsRepository {
  constructor(private readonly database: PrismaService) {}

  create(input: { institutionId: string; host: string; evidenceUrl: string }) {
    const host = normalizeAuthorizedHost(input.host);
    const evidence = normalizeSourceUrl(input.evidenceUrl);
    if (evidence.host !== host) throw new Error('Domain evidence must use the same exact host');
    return this.database.allowedDomain.create({
      data: {
        institution: { connect: { id: input.institutionId } },
        host,
        evidenceUrl: evidence.url,
      },
    });
  }

  listByInstitution(institutionId: string) {
    return this.database.allowedDomain.findMany({
      where: { institutionId },
      orderBy: { host: 'asc' },
    });
  }
}

export interface SourceInput {
  institutionId: string;
  url: string;
  kind: SourceKind;
  selector?: string;
  frequencyMinutes?: number;
  priority?: number;
}

@Injectable()
export class SourcesRepository {
  constructor(private readonly database: PrismaService) {}

  async create(input: SourceInput) {
    const source = normalizeSourceUrl(input.url);
    const domain = await this.database.allowedDomain.findUnique({
      where: { institutionId_host: { institutionId: input.institutionId, host: source.host } },
    });
    if (!domain) throw new Error('Source host is not allowlisted for this institution');
    const frequencyMinutes = input.frequencyMinutes ?? 1440;
    const priority = input.priority ?? 100;
    if (!Number.isInteger(frequencyMinutes) || frequencyMinutes < 1) {
      throw new Error('Source frequency must be a positive integer');
    }
    if (!Number.isInteger(priority) || priority < 0) {
      throw new Error('Source priority must be a nonnegative integer');
    }
    return this.database.source.create({
      data: {
        institution: { connect: { id: input.institutionId } },
        allowedDomain: { connect: { id: domain.id } },
        url: source.url,
        kind: input.kind,
        selector: input.selector,
        frequencyMinutes,
        priority,
      },
    });
  }

  listByInstitution(institutionId: string) {
    return this.database.source.findMany({
      where: { institutionId },
      orderBy: [{ priority: 'asc' }, { url: 'asc' }],
    });
  }
}
