import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaService } from '../../../apps/api/dist/database/prisma.service.js';

if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const database = new PrismaService();
test.after(async () => database.$disconnect());

test('foreign keys restrict deletion until dependent records are explicitly removed', async () => {
  const institution = await database.institution.findUniqueOrThrow({ where: { acronym: 'UFPB' } });
  const process = await database.selectionProcess.create({
    data: { institutionId: institution.id },
  });
  let offering;
  let reservation;
  try {
    offering = await database.offering.create({
      data: {
        processId: process.id,
        institutionId: institution.id,
        courseName: 'Curso sintético de teste',
        normalizedCourseName: 'curso sintetico de teste',
      },
    });
    reservation = await database.offeringReservation.create({
      data: {
        offeringId: offering.id,
        category: 'Reserva sintética',
        normalizedCategory: 'reserva sintetica',
      },
    });
    await assert.rejects(
      database.selectionProcess.delete({ where: { id: process.id } }),
      /foreign key|constraint/iu,
    );
    await assert.rejects(
      database.offering.delete({ where: { id: offering.id } }),
      /foreign key|constraint/iu,
    );
    assert.equal(
      await database.offeringReservation.count({ where: { offeringId: offering.id } }),
      1,
    );
  } finally {
    if (reservation) await database.offeringReservation.delete({ where: { id: reservation.id } });
    if (offering) await database.offering.delete({ where: { id: offering.id } });
    await database.selectionProcess.delete({ where: { id: process.id } });
  }
  assert.equal(await database.selectionProcess.count({ where: { id: process.id } }), 0);
});

test('critical SQL checks reject negative seats and non-HTTPS process references', async () => {
  const institution = await database.institution.findUniqueOrThrow({ where: { acronym: 'UEPB' } });
  await assert.rejects(
    database.selectionProcess.create({
      data: { institutionId: institution.id, referenceUrl: 'http://invalid.local/fixture' },
    }),
    /processes_reference_https_check|check constraint/iu,
  );
  const process = await database.selectionProcess.create({
    data: { institutionId: institution.id },
  });
  try {
    await assert.rejects(
      database.offering.create({
        data: {
          processId: process.id,
          institutionId: institution.id,
          courseName: 'Curso sintético',
          normalizedCourseName: 'curso sintetico',
          seats: -1,
        },
      }),
      /offerings_seats_nonnegative_check|check constraint/iu,
    );
  } finally {
    await database.selectionProcess.delete({ where: { id: process.id } });
  }
});
