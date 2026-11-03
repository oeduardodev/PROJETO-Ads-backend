import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PrismaService } from '../../apps/api/dist/database/prisma.service.js';
import { CampusesRepository } from '../../apps/api/dist/modules/campuses/campuses.repository.js';

if (!process.env.TEST_DATABASE_URL)
  throw new Error('TEST_DATABASE_URL is required for local integration tests');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const database = new PrismaService();
const campuses = new CampusesRepository(database);

test.after(async () => database.$disconnect());

test('pilot seed has four sourced, unverified public institutions', async () => {
  const institutions = await database.institution.findMany({ orderBy: { acronym: 'asc' } });
  assert.deepEqual(
    institutions.map((item) => item.acronym),
    ['IFPB', 'UEPB', 'UFCG', 'UFPB'],
  );
  for (const institution of institutions) {
    assert.equal(institution.publicFlag, true);
    assert.equal(institution.verifiedAt, null);
    assert.match(institution.referenceUrl, /^https:\/\//u);
  }
});

test('campus requires a parent institution and a valid UF, including at SQL level', async () => {
  const institution = await database.institution.findUniqueOrThrow({ where: { acronym: 'IFPB' } });
  const campus = await campuses.create({
    institutionId: institution.id,
    name: 'Campus de teste',
    city: 'João Pessoa',
    state: 'pb',
    timezone: 'America/Sao_Paulo',
  });
  try {
    assert.equal(campus.state, 'PB');
    await assert.rejects(
      campuses.create({
        institutionId: institution.id,
        name: '  CAMPUS  DE TESTE ',
        city: 'JOÃO PESSOA',
        state: 'PB',
        timezone: 'America/Sao_Paulo',
      }),
      /Unique constraint|campuses_institution_name_city_key/iu,
    );
    assert.throws(() => campuses.create({ ...campus, state: 'XX' }), /valid Brazilian UF/);
    await assert.rejects(
      database.$executeRaw`INSERT INTO campuses (id, institution_id, name, normalized_name, city, normalized_city, state, timezone)
        VALUES (${randomUUID()}::uuid, ${randomUUID()}::uuid, 'Teste', 'TESTE', 'João Pessoa', 'JOAO PESSOA', 'PB', 'America/Sao_Paulo')`,
      /foreign key|campuses_institution_id_fkey/iu,
    );
    await assert.rejects(
      database.$executeRaw`INSERT INTO campuses (id, institution_id, name, normalized_name, city, normalized_city, state, timezone)
        VALUES (${randomUUID()}::uuid, ${institution.id}::uuid, 'Teste 2', 'TESTE 2', 'João Pessoa', 'JOAO PESSOA', 'XX', 'America/Sao_Paulo')`,
      /check constraint|campuses_state_valid_check/iu,
    );
  } finally {
    await database.campus.delete({ where: { id: campus.id } });
  }
});
