import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import test from 'node:test';
import { PrismaService } from '../../apps/api/dist/database/prisma.service.js';
import { PublicSearchService } from '../../apps/api/dist/modules/processes/public-search/public-search.service.js';
import { parseSearchQuery } from '../../apps/api/dist/modules/processes/public-search/search-query.js';

if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const database = new PrismaService();
test.after(async () => database.$disconnect());

const page = { page: 1, pageSize: 20, skip: 0 };
const now = new Date('2026-01-05T12:00:00.000Z');
const query = (extra = {}) => ({ openOnly: false, sort: 'recent', ...extra });

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  server.close();
  await once(server, 'close');
  return port;
}

test('GET /api/v1/processes returns an empty published catalog and rejects invalid input', async () => {
  const port = await freePort();
  const child = spawn(process.execPath, ['apps/api/dist/main.js'], {
    env: {
      ...process.env,
      PORT: String(port),
      CORS_ORIGINS: 'http://127.0.0.1:4200',
      REDIS_URL: process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6380',
    },
    stdio: 'ignore',
  });
  try {
    let response;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (child.exitCode !== null) throw new Error('API exited before search probe');
      try {
        response = await fetch(`http://127.0.0.1:${port}/api/v1/processes`);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    assert.ok(response, 'API did not start in 10 seconds');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      data: [],
      meta: { page: 1, pageSize: 20, total: 0 },
    });
    const invalid = await fetch(`http://127.0.0.1:${port}/api/v1/processes?sort=arbitrary`);
    assert.equal(invalid.status, 400);
  } finally {
    child.kill();
  }
});

test('published search handles accents, null ENEM, precise windows, sort and stable pages', async () => {
  assert.equal((await new PublicSearchService(database).search(query(), page, now)).meta.total, 0);
  await assert.rejects(
    database.$transaction(async (tx) => {
      const institution = await tx.institution.update({
        where: { acronym: 'UFPB' },
        data: { verifiedAt: new Date('2026-01-01T00:00:00.000Z') },
      });
      const domain = await tx.allowedDomain.create({
        data: {
          institutionId: institution.id,
          host: 'example.org',
          evidenceUrl: 'https://example.org/test-only',
          reviewedAt: now,
        },
      });
      await tx.source.create({
        data: {
          institutionId: institution.id,
          allowedDomainId: domain.id,
          url: 'https://example.org/test-only',
          kind: 'HTML_INDEX',
          status: 'ACTIVE',
        },
      });
      const campus = await tx.campus.create({
        data: {
          institutionId: institution.id,
          name: 'Campus sintético de teste',
          normalizedName: 'campus sintetico de teste',
          city: 'João Pessoa',
          normalizedCity: 'JOAO PESSOA',
          state: 'PB',
          timezone: 'America/Sao_Paulo',
          verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      });
      async function fixture(
        courseName,
        normalizedName,
        requiresEnem,
        verifiedAt,
        status,
        endTime,
        endDate = '2026-01-10',
      ) {
        const process = await tx.selectionProcess.create({
          data: {
            institutionId: institution.id,
            selectionType: 'TRANSFER',
            regularSisuFlow: false,
            tuitionFree: true,
            requiresEnem,
            verifiedAt: new Date(verifiedAt),
            referenceUrl: 'https://example.org/test-only',
            publicationStatus: status,
          },
        });
        if (status === 'PUBLICADO') {
          await tx.reviewDecision.create({
            data: {
              processId: process.id,
              reviewerId: 'fixture-only',
              decision: 'APPROVE',
              reason: 'Transação sintética revertida',
            },
          });
        }
        const offering = await tx.offering.create({
          data: {
            processId: process.id,
            institutionId: institution.id,
            campusId: campus.id,
            courseName,
            normalizedCourseName: normalizedName,
            degreeType: 'BACHARELADO',
            modality: 'PRESENCIAL',
          },
        });
        await tx.applicationWindow.create({
          data: {
            processId: process.id,
            offeringId: offering.id,
            startDate: new Date('2026-01-01T00:00:00.000Z'),
            startTime: '08:00',
            endDate: new Date(`${endDate}T00:00:00.000Z`),
            endTime,
            timezone: 'America/Sao_Paulo',
          },
        });
        return process;
      }
      const first = await fixture(
        'Engenharia Elétrica',
        'ENGENHARIA ELETRICA',
        false,
        '2026-01-04T00:00:00.000Z',
        'PUBLICADO',
        '17:00',
      );
      const second = await fixture(
        'Matemática',
        'MATEMATICA',
        true,
        '2026-01-03T00:00:00.000Z',
        'PUBLICADO',
        null,
      );
      const third = await fixture(
        'Engenharia Civil',
        'ENGENHARIA CIVIL',
        null,
        '2026-01-02T00:00:00.000Z',
        'PUBLICADO',
        '17:00',
        '2026-01-06',
      );
      await fixture(
        'Engenharia em rascunho',
        'ENGENHARIA RASCUNHO',
        false,
        '2026-01-05T00:00:00.000Z',
        'RASCUNHO',
        '17:00',
      );

      const search = new PublicSearchService(tx);
      const accented = await search.search(query({ q: 'ENGENHARIA' }), page, now);
      assert.equal(accented.meta.total, 2);
      assert.deepEqual(
        accented.data.map((item) => item.id),
        [first.id, third.id],
      );
      const withDiacritics = await search.search(parseSearchQuery({ q: 'ELÉTRICA' }), page, now);
      assert.deepEqual(
        withDiacritics.data.map((item) => item.id),
        [first.id],
      );
      const open = await search.search(query({ openOnly: true }), page, now);
      assert.equal(open.meta.total, 2);
      assert.ok(open.data.every((item) => item.id !== second.id));
      const unknownEnem = await search.search(query({ requiresEnem: null }), page, now);
      assert.deepEqual(
        unknownEnem.data.map((item) => item.id),
        [third.id],
      );
      const requiredEnem = await search.search(query({ requiresEnem: true }), page, now);
      assert.deepEqual(
        requiredEnem.data.map((item) => item.id),
        [second.id],
      );
      const noEnem = await search.search(query({ requiresEnem: false }), page, now);
      assert.deepEqual(
        noEnem.data.map((item) => item.id),
        [first.id],
      );
      const byCity = await search.search(
        query({ uf: 'PB', city: 'JOAO PESSOA', degree: 'BACHARELADO' }),
        page,
        now,
      );
      assert.equal(byCity.meta.total, 3);
      const course = await search.search(query({ q: 'ENGENHARIA', sort: 'course' }), page, now);
      assert.deepEqual(
        course.data.map((item) => item.id),
        [third.id, first.id],
      );
      const deadline = await search.search(query({ sort: 'deadline' }), page, now);
      assert.deepEqual(
        deadline.data.map((item) => item.id),
        [third.id, first.id, second.id],
      );
      const firstPage = await search.search(query(), { page: 1, pageSize: 1, skip: 0 }, now);
      const secondPage = await search.search(query(), { page: 2, pageSize: 1, skip: 1 }, now);
      assert.equal(firstPage.meta.total, 3);
      assert.notEqual(firstPage.data[0].id, secondPage.data[0].id);
      throw new Error('rollback synthetic public search fixtures');
    }),
    /rollback synthetic public search fixtures/iu,
  );
  assert.equal((await new PublicSearchService(database).search(query(), page, now)).meta.total, 0);
});
