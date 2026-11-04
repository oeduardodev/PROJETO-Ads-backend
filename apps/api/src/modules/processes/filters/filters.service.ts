import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { FilterQuery } from './filter-query.js';
import { matchingOffering, publishedProcessWhere } from './published-query.js';
import { officialHostSources, verifiedOfficialUrl } from '../public-detail/official-url.js';

type FacetValue = { value: string; count: number };

function addValues(counts: Map<string, number>, values: Iterable<string>): void {
  for (const value of new Set(values)) counts.set(value, (counts.get(value) ?? 0) + 1);
}

function facet(counts: Map<string, number>): FacetValue[] {
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value));
}

@Injectable()
export class FiltersService {
  constructor(private readonly database: PrismaService) {}

  async list(query: FilterQuery) {
    const processes = await this.database.selectionProcess.findMany({
      where: publishedProcessWhere(query),
      select: {
        selectionType: true,
        requiresEnem: true,
        referenceUrl: true,
        institution: { select: { sources: officialHostSources } },
        offerings: {
          where: matchingOffering(query),
          select: { modality: true, campus: { select: { state: true, verifiedAt: true } } },
        },
      },
    });
    const states = new Map<string, number>();
    const modalities = new Map<string, number>();
    const types = new Map<string, number>();
    const enem = new Map<string, number>();
    let total = 0;
    for (const process of processes) {
      if (!verifiedOfficialUrl(process.referenceUrl, process.institution.sources)) continue;
      total += 1;
      addValues(
        states,
        process.offerings.map((offering) =>
          offering.campus?.verifiedAt ? offering.campus.state : 'UNKNOWN',
        ),
      );
      addValues(
        modalities,
        process.offerings.map((offering) => offering.modality ?? 'UNKNOWN'),
      );
      addValues(types, [process.selectionType ?? 'UNKNOWN']);
      addValues(enem, [process.requiresEnem === null ? 'unknown' : String(process.requiresEnem)]);
    }
    return {
      total,
      facets: {
        uf: facet(states),
        modality: facet(modalities),
        selectionType: facet(types),
        requiresEnem: ['true', 'false', 'unknown'].flatMap((value) =>
          enem.has(value) ? [{ value, count: enem.get(value)! }] : [],
        ),
      },
    };
  }
}
