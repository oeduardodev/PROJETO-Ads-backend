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
  const ufpb = await database.institution.findUniqueOrThrow({ where: { acronym: 'UFPB' } });
  const historicalReference =
    'https://drive.ufpb.br/s/2NppXAfNrCKnDTC/download/Edital_PSIG_2025.2.pdf';
  const historical = await database.selectionProcess.upsert({
    where: {
      institutionId_noticeCode_noticeYear: {
        institutionId: ufpb.id,
        noticeCode: '23/2025',
        noticeYear: 2025,
      },
    },
    create: {
      institutionId: ufpb.id,
      noticeCode: '23/2025',
      noticeYear: 2025,
      selectionType: 'GRADUATE_ENTRY',
      regularSisuFlow: false,
      requiresEnem: false,
      demoHistorical: true,
      referenceUrl: historicalReference,
    },
    update: {},
  });
  if (!historical.demoHistorical || historical.referenceUrl !== historicalReference) {
    throw new Error('Historical demo identity conflicts with existing process');
  }
  await database.applicationWindow.upsert({
    where: { id: '5e4db0c3-716e-4b95-8a90-28df8731ac05' },
    create: {
      id: '5e4db0c3-716e-4b95-8a90-28df8731ac05',
      processId: historical.id,
      startDate: new Date('2025-09-18T00:00:00.000Z'),
      startTime: '08:00',
      endDate: new Date('2025-09-24T00:00:00.000Z'),
      endTime: '23:59',
      timezone: 'America/Sao_Paulo',
    },
    update: {},
  });
  console.log(
    `Local pilot seed checked ${pilotInstitutions.length} institutions and 1 historical draft`,
  );
} finally {
  await database.$disconnect();
}
