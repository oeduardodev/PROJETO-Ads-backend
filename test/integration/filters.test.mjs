import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import test from 'node:test';
import { PrismaService } from '../../apps/api/dist/database/prisma.service.js';
import { FiltersService } from '../../apps/api/dist/modules/processes/filters/filters.service.js';

if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const database = new PrismaService();
test.after(async () => database.$disconnect());

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  server.close();
  await once(server, 'close');
  return port;
}

test('GET /api/v1/filters exposes no draft or historical seed', async () => {
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
      if (child.exitCode !== null) throw new Error('API exited before filters probe');
      try {
        response = await fetch(`http://127.0.0.1:${port}/api/v1/filters`);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    assert.ok(response, 'API did not start in 10 seconds');
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.total, 0);
    assert.deepEqual(result.facets, { uf: [], modality: [], selectionType: [], requiresEnem: [] });
    const invalid = await fetch(`http://127.0.0.1:${port}/api/v1/filters?requires_enem=maybe`);
    assert.equal(invalid.status, 400);
  } finally {
    child.kill();
  }
});

test('facets count distinct published processes under combined filters and hide drafts', async () => {
  const empty = await new FiltersService(database).list({});
  assert.equal(empty.total, 0);
  await assert.rejects(
    database.$transaction(async (tx) => {
      const verifiedAt = new Date('2026-11-02T12:00:00.000Z');
      const institutions = new Map();
      for (const acronym of ['UFPB', 'UFCG', 'UEPB']) {
        const institution = await tx.institution.update({
          where: { acronym },
          data: { verifiedAt },
        });
        institutions.set(acronym, institution);
        const domain = await tx.allowedDomain.create({
          data: {
            institutionId: institution.id,
            host: 'example.org',
            evidenceUrl: 'https://example.org/test-only',
            reviewedAt: verifiedAt,
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
      }
      const campuses = new Map();
      for (const [acronym, state] of [
        ['UFPB', 'PB'],
        ['UFCG', 'PB'],
        ['UEPB', 'PE'],
        ['UFPB_PE', 'PE'],
      ]) {
        const institutionKey = acronym.replace('_PE', '');
        const campus = await tx.campus.create({
          data: {
            institutionId: institutions.get(institutionKey).id,
            name: `Campus sintético ${acronym}`,
            normalizedName: `campus sintetico ${acronym.toLowerCase()}`,
            city: 'Cidade de teste',
            normalizedCity: 'cidade de teste',
            state,
            timezone: 'America/Sao_Paulo',
            verifiedAt,
          },
        });
        campuses.set(acronym, campus);
      }
      async function createProcess(acronym, status, selectionType, requiresEnem) {
        const process = await tx.selectionProcess.create({
          data: {
            institutionId: institutions.get(acronym).id,
            publicationStatus: status,
            selectionType,
            requiresEnem,
            regularSisuFlow: false,
            tuitionFree: true,
            verifiedAt,
            referenceUrl: 'https://example.org/test-only',
          },
        });
        if (status === 'PUBLICADO') {
          await tx.reviewDecision.create({
            data: {
              processId: process.id,
              reviewerId: 'fixture-only',
              decision: 'APPROVE',
              reason: 'Transação sintética revertida após o teste',
            },
          });
        }
        return process;
      }
      async function offer(process, acronym, modality, index) {
        return tx.offering.create({
          data: {
            processId: process.id,
            institutionId: process.institutionId,
            campusId: campuses.get(acronym).id,
            courseName: `Curso sintético ${index}`,
            normalizedCourseName: `curso sintetico ${index}`,
            modality,
          },
        });
      }
      const first = await createProcess('UFPB', 'PUBLICADO', 'TRANSFER', false);
      await offer(first, 'UFPB', 'EAD', 1);
      await offer(first, 'UFPB', 'EAD', 2);
      await offer(first, 'UFPB', 'PRESENCIAL', 3);
      const second = await createProcess('UFCG', 'PUBLICADO', 'TRANSFER', true);
      await offer(second, 'UFCG', 'EAD', 4);
      const third = await createProcess('UEPB', 'PUBLICADO', 'GRADUATE_ENTRY', null);
      await offer(third, 'UEPB', 'EAD', 5);
      const crossOffer = await createProcess('UFPB', 'PUBLICADO', 'TRANSFER', true);
      await offer(crossOffer, 'UFPB', 'PRESENCIAL', 6);
      await offer(crossOffer, 'UFPB_PE', 'EAD', 7);
      const draft = await createProcess('UFPB', 'RASCUNHO', 'TRANSFER', false);
      await offer(draft, 'UFPB', 'EAD', 8);

      const filters = new FiltersService(tx);
      assert.equal((await filters.list({})).total, 4);
      const combined = await filters.list({ uf: 'PB', modality: 'EAD' });
      assert.equal(combined.total, 2);
      assert.deepEqual(combined.facets.uf, [{ value: 'PB', count: 2 }]);
      assert.deepEqual(combined.facets.modality, [{ value: 'EAD', count: 2 }]);
      assert.deepEqual(combined.facets.selectionType, [{ value: 'TRANSFER', count: 2 }]);
      assert.deepEqual(combined.facets.requiresEnem, [
        { value: 'true', count: 1 },
        { value: 'false', count: 1 },
      ]);
      const pb = await filters.list({ uf: 'PB' });
      assert.equal(pb.total, 3);
      assert.deepEqual(pb.facets.modality, [
        { value: 'EAD', count: 2 },
        { value: 'PRESENCIAL', count: 2 },
      ]);
      const unknown = await filters.list({ requiresEnem: null });
      assert.equal(unknown.total, 1);
      assert.deepEqual(unknown.facets.requiresEnem, [{ value: 'unknown', count: 1 }]);
      throw new Error('rollback synthetic facet fixtures');
    }),
    /rollback synthetic facet fixtures/iu,
  );
  assert.equal((await new FiltersService(database).list({})).total, 0);
});
