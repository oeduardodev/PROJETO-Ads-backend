import { Injectable } from '@nestjs/common';
import { AdminRole } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class AdminUserRepository {
  constructor(private readonly database: PrismaService) {}

  findAuthorized(identity: { issuer: string; subject: string }, roles: readonly AdminRole[]) {
    return this.database.adminUser.findFirst({
      where: {
        issuer: identity.issuer,
        subject: identity.subject,
        active: true,
        role: { in: [...roles] },
      },
      select: { id: true, issuer: true, subject: true, role: true },
    });
  }
}
