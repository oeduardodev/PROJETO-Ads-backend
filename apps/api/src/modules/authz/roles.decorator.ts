import { SetMetadata } from '@nestjs/common';
import type { AdminRole } from '../../generated/prisma/enums.js';

export const REQUIRED_ADMIN_ROLES = 'required-admin-roles';

export const RequireAdminRoles = (...roles: AdminRole[]) =>
  SetMetadata(REQUIRED_ADMIN_ROLES, roles);
