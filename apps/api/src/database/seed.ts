import { Jurisdiction } from '../generated/prisma/enums.js';
import {
  normalizeAcronym,
  normalizeKey,
  normalizeLabel,
} from '../modules/institutions/normalization.js';
import { PrismaService } from './prisma.service.js';

const pilotInstitutions = [
  {
    acronym: 'UFPB',
    name: 'Universidade Federal da Paraíba',
    jurisdiction: Jurisdiction.FEDERAL,
    referenceUrl: 'https://www.ufpb.br/apresentacao/',
  },
  {
    acronym: 'UFCG',
    name: 'Universidade Federal de Campina Grande',
    jurisdiction: Jurisdiction.FEDERAL,
    referenceUrl: 'https://sods.ufcg.edu.br/index.php/legislacao/estatuto/estatuto-ufcg',
  },
  {
    acronym: 'UEPB',
    name: 'Universidade Estadual da Paraíba',
    jurisdiction: Jurisdiction.ESTADUAL,
    referenceUrl: 'https://uepb.edu.br/',
  },
  {
    acronym: 'IFPB',
    name: 'Instituto Federal de Educação, Ciência e Tecnologia da Paraíba',
    jurisdiction: Jurisdiction.FEDERAL,
    referenceUrl: 'https://pdi.ifpb.edu.br/capitulos/capitulo-01.html',
  },
] as const;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(databaseUrl).hostname)) {
  throw new Error('Local seed requires DATABASE_URL on a loopback host');
}

const database = new PrismaService();
try {
  for (const institution of pilotInstitutions) {
    const name = normalizeLabel(institution.name);
    await database.institution.upsert({
      where: { acronym: institution.acronym },
      create: {
        name,
        normalizedName: normalizeKey(name),
        acronym: normalizeAcronym(institution.acronym),
        jurisdiction: institution.jurisdiction,
        publicFlag: true,
        referenceUrl: institution.referenceUrl,
      },
      update: {},
    });
  }
  console.log(`Local pilot seed checked ${pilotInstitutions.length} institutions`);
} finally {
  await database.$disconnect();
}
