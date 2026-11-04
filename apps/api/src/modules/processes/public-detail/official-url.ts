import { Prisma } from '../../../generated/prisma/client.js';
import { normalizeSourceUrl } from '../../sources/source-url.js';

export const reviewedActiveSource: Prisma.SourceWhereInput = {
  status: 'ACTIVE',
  allowedDomain: { is: { reviewedAt: { not: null } } },
};

export const officialHostSources = {
  where: reviewedActiveSource,
  select: { allowedDomain: { select: { host: true } } },
} as const;

export type OfficialHostSource = { allowedDomain: { host: string } };

export function verifiedOfficialUrl(
  candidate: string | null,
  sources: OfficialHostSource[],
): string | null {
  if (candidate === null) return null;
  try {
    const { url, host } = normalizeSourceUrl(candidate);
    return sources.some((source) => source.allowedDomain.host === host) ? url : null;
  } catch {
    return null;
  }
}
