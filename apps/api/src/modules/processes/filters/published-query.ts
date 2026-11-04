import { Prisma } from '../../../generated/prisma/client.js';
import { FilterQuery } from './filter-query.js';
import { reviewedActiveSource } from '../public-detail/official-url.js';

export function matchingOffering(query: FilterQuery): Prisma.OfferingWhereInput {
  return {
    ...(query.modality !== undefined ? { modality: query.modality } : {}),
    ...(query.uf !== undefined
      ? { campus: { is: { state: query.uf, verifiedAt: { not: null } } } }
      : {}),
  };
}

export function publishedProcessWhere(query: FilterQuery): Prisma.SelectionProcessWhereInput {
  const offeringFilter = matchingOffering(query);
  return {
    publicationStatus: 'PUBLICADO',
    demoHistorical: false,
    regularSisuFlow: false,
    tuitionFree: true,
    referenceUrl: { not: null },
    selectionType: { not: null },
    verifiedAt: { not: null },
    reviewDecisions: { some: { decision: 'APPROVE' } },
    institution: {
      is: {
        publicFlag: true,
        verifiedAt: { not: null },
        sources: { some: reviewedActiveSource },
      },
    },
    ...(query.selectionType !== undefined ? { selectionType: query.selectionType } : {}),
    ...(query.requiresEnem !== undefined ? { requiresEnem: query.requiresEnem } : {}),
    ...(Object.keys(offeringFilter).length ? { offerings: { some: offeringFilter } } : {}),
  };
}
