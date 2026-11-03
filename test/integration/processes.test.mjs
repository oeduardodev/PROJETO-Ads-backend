import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaService } from '../../apps/api/dist/database/prisma.service.js';
import { CampusesRepository } from '../../apps/api/dist/modules/campuses/campuses.repository.js';
import { OfferingsRepository } from '../../apps/api/dist/modules/offerings/offerings.repository.js';
import { ApplicationWindowsRepository } from '../../apps/api/dist/modules/processes/application-windows.repository.js';
import { ProcessesRepository } from '../../apps/api/dist/modules/processes/processes.repository.js';
import { RequirementsRepository } from '../../apps/api/dist/modules/processes/requirements.repository.js';

if (!process.env.TEST_DATABASE_URL)
  throw new Error('TEST_DATABASE_URL is required for local integration tests');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const database = new PrismaService();
const campuses = new CampusesRepository(database);
const processes = new ProcessesRepository(database);
const offerings = new OfferingsRepository(database);
const windows = new ApplicationWindowsRepository(database);
const requirements = new RequirementsRepository(database);

test.after(async () => database.$disconnect());

test('a synthetic process retains multiple offerings, reservations and precise or incomplete windows', async () => {
  const ufpb = await database.institution.findUniqueOrThrow({ where: { acronym: 'UFPB' } });
  const ufcg = await database.institution.findUniqueOrThrow({ where: { acronym: 'UFCG' } });
  const campusA = await campuses.create({
    institutionId: ufpb.id,
    name: 'Campus de teste A',
    city: 'João Pessoa',
    state: 'PB',
    timezone: 'America/Sao_Paulo',
  });
  const campusB = await campuses.create({
    institutionId: ufpb.id,
    name: 'Campus de teste B',
    city: 'Campina Grande',
    state: 'PB',
    timezone: 'America/Sao_Paulo',
  });
  const foreignCampus = await campuses.create({
    institutionId: ufcg.id,
    name: 'Campus de teste externo',
    city: 'Campina Grande',
    state: 'PB',
    timezone: 'America/Sao_Paulo',
  });
  let process;
  try {
    process = await processes.create({
      institutionId: ufpb.id,
      noticeCode: 'TESTE-LOCAL-001',
      noticeYear: 2026,
    });
    assert.equal(process.regularSisuFlow, null);
    assert.equal(process.requiresEnem, null);
    const first = await offerings.create({
      processId: process.id,
      campusId: campusA.id,
      courseName: 'Curso de teste A',
      degreeType: 'BACHARELADO',
      seats: 10,
    });
    const second = await offerings.create({
      processId: process.id,
      campusId: campusB.id,
      courseName: 'Curso de teste B',
      degreeType: 'LICENCIATURA',
    });
    await offerings.addReservation({ offeringId: first.id, category: 'Teste ampla', seats: 7 });
    const reservation = await offerings.addReservation({
      offeringId: first.id,
      category: 'Teste reserva',
      seats: 3,
    });
    const dateOnly = await windows.create({
      processId: process.id,
      offeringId: first.id,
      startDate: '2026-08-13',
      endDate: '2026-08-24',
    });
    const exact = await windows.create({
      processId: process.id,
      offeringId: second.id,
      startDate: '2026-09-01',
      startTime: '08:00',
      endDate: '2026-09-02',
      endTime: '17:00',
      timezone: 'America/Sao_Paulo',
    });
    await requirements.create({
      processId: process.id,
      criterion: 'Requisito sintético do processo',
    });
    await requirements.create({
      processId: process.id,
      offeringId: first.id,
      reservationId: reservation.id,
      criterion: 'Requisito sintético da reserva',
      valueJson: { fixture: true },
    });

    const detail = await processes.findDetails(process.id);
    assert.equal(detail.offerings.length, 2);
    assert.equal(detail.offerings.find((item) => item.id === first.id).reservations.length, 2);
    assert.equal(detail.windows.length, 2);
    assert.equal(detail.requirements.length, 2);
    assert.equal(dateOnly.endTime, null);
    assert.equal(dateOnly.timezone, null);
    assert.equal(exact.endTime, '17:00');
    assert.equal(second.seats, null);

    await assert.rejects(
      offerings.create({ processId: process.id, courseName: 'Teste negativo', seats: -1 }),
      /nonnegative/iu,
    );
    await assert.rejects(
      database.offering.update({ where: { id: first.id }, data: { seats: -1 } }),
      /offerings_seats_nonnegative_check|check constraint/iu,
    );
    await assert.rejects(
      offerings.create({
        processId: process.id,
        campusId: foreignCampus.id,
        courseName: 'Teste de vínculo',
      }),
      /foreign key|offerings_campus_id_institution_id_fkey/iu,
    );
    assert.throws(
      () => windows.create({ processId: process.id, endDate: '2026-08-24', endTime: '25:00' }),
      /HH:mm/iu,
    );
  } finally {
    if (process) {
      await database.requirement.deleteMany({ where: { processId: process.id } });
      await database.applicationWindow.deleteMany({ where: { processId: process.id } });
      await database.offeringReservation.deleteMany({
        where: { offering: { processId: process.id } },
      });
      await database.offering.deleteMany({ where: { processId: process.id } });
      await database.selectionProcess.delete({ where: { id: process.id } });
    }
    await database.campus.deleteMany({
      where: { id: { in: [campusA.id, campusB.id, foreignCampus.id] } },
    });
  }
});
