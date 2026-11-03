import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { PrismaService } from '../../apps/api/dist/database/prisma.service.js';

if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const database = new PrismaService();
test.after(async () => database.$disconnect());

test('historical official demo seed is repeatable and never publishable', async () => {
  for (let index = 0; index < 2; index += 1) {
    execFileSync(process.execPath, ['apps/api/dist/database/seed.js'], { env: process.env });
  }
  const institution = await database.institution.findUniqueOrThrow({ where: { acronym: 'UFPB' } });
  const processes = await database.selectionProcess.findMany({
    where: { institutionId: institution.id, noticeCode: '23/2025', noticeYear: 2025 },
    include: { windows: true },
  });
  assert.equal(processes.length, 1);
  const historical = processes[0];
  assert.equal(historical.demoHistorical, true);
  assert.equal(historical.publicationStatus, 'RASCUNHO');
  assert.equal(historical.tuitionFree, null);
  assert.equal(
    historical.referenceUrl,
    'https://drive.ufpb.br/s/2NppXAfNrCKnDTC/download/Edital_PSIG_2025.2.pdf',
  );
  assert.equal(historical.windows.length, 1);
  assert.equal(historical.windows[0].endTime, '23:59');
  await assert.rejects(
    database.selectionProcess.update({
      where: { id: historical.id },
      data: { publicationStatus: 'PUBLICADO' },
    }),
    /processes_demo_never_published_check|check constraint/iu,
  );
});

test('query plans can use publication and trigram course indexes', async () => {
  await database.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL enable_seqscan = off`;
    const statusPlan =
      await tx.$queryRaw`EXPLAIN (FORMAT JSON) SELECT id FROM selection_processes WHERE publication_status = 'RASCUNHO'::"PublicationStatus" AND institution_id = '00000000-0000-0000-0000-000000000000'::uuid`;
    const coursePlan =
      await tx.$queryRaw`EXPLAIN (FORMAT JSON) SELECT id FROM offerings WHERE normalized_course_name ILIKE '%engenharia%'`;
    assert.match(JSON.stringify(statusPlan), /processes_publication_(?:institution|verified)_idx/u);
    assert.match(JSON.stringify(coursePlan), /offerings_course_trgm_idx/u);
  });
});
