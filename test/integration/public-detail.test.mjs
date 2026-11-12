import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import test from 'node:test';
import { stopChild } from '../helpers/stop-child.mjs';
import { PrismaService } from '../../apps/api/dist/database/prisma.service.js';
import { FiltersService } from '../../apps/api/dist/modules/processes/filters/filters.service.js';
import { PublicDetailService } from '../../apps/api/dist/modules/processes/public-detail/public-detail.service.js';
import { PublicSearchService } from '../../apps/api/dist/modules/processes/public-search/public-search.service.js';

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

test('GET /api/v1/processes/:id hides draft and historical records', async () => {
  const historical = await database.selectionProcess.findFirstOrThrow({
    where: { demoHistorical: true },
  });
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
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (child.exitCode !== null) throw new Error('API exited before detail probe');
      try {
        response = await fetch(`http://127.0.0.1:${port}/api/v1/processes/${historical.id}`);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    assert.ok(response, 'API did not start in 20 seconds');
    assert.equal(response.status, 404);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/v1/processes/not-a-uuid`)).status, 400);
    assert.equal(
      (
        await fetch(
          `http://127.0.0.1:${port}/api/v1/processes/00000000-0000-0000-0000-000000000000`,
        )
      ).status,
      404,
    );
  } finally {
    await stopChild(child);
  }
});

test('detail, list and facets expose only links on reviewed active exact hosts', async () => {
  await assert.rejects(
    database.$transaction(async (tx) => {
      const verifiedAt = new Date('2026-01-05T12:00:00.000Z');
      const institution = await tx.institution.update({
        where: { acronym: 'UFPB' },
        data: { verifiedAt },
      });
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
          selector: 'private-selector',
        },
      });
      const campus = await tx.campus.create({
        data: {
          institutionId: institution.id,
          name: 'Campus de teste',
          normalizedName: 'CAMPUS DE TESTE',
          city: 'João Pessoa',
          normalizedCity: 'JOAO PESSOA',
          state: 'PB',
          timezone: 'America/Sao_Paulo',
          verifiedAt,
        },
      });
      async function fixture(referenceUrl, status = 'PUBLICADO') {
        const process = await tx.selectionProcess.create({
          data: {
            institutionId: institution.id,
            noticeCode: referenceUrl.includes('outside') ? 'OUTSIDE' : undefined,
            selectionType: 'TRANSFER',
            regularSisuFlow: false,
            tuitionFree: true,
            requiresEnem: null,
            referenceUrl,
            verifiedAt,
            publicationStatus: status,
          },
        });
        if (status === 'PUBLICADO') {
          await tx.reviewDecision.create({
            data: {
              processId: process.id,
              reviewerId: 'private-reviewer',
              decision: 'APPROVE',
              reason: 'private-review-reason',
            },
          });
        }
        return process;
      }
      const process = await fixture('https://example.org/test-only/notice');
      const outside = await fixture('https://outside.example.org/notice');
      const draft = await fixture('https://example.org/test-only/draft', 'RASCUNHO');
      const offering = await tx.offering.create({
        data: {
          processId: process.id,
          institutionId: institution.id,
          campusId: campus.id,
          courseName: 'Engenharia Elétrica',
          normalizedCourseName: 'ENGENHARIA ELETRICA',
          degreeType: 'BACHARELADO',
          modality: 'PRESENCIAL',
          seats: 12,
        },
      });
      await tx.offeringReservation.create({
        data: {
          offeringId: offering.id,
          category: 'Ampla concorrência',
          normalizedCategory: 'AMPLA CONCORRENCIA',
          seats: 8,
        },
      });
      await tx.applicationWindow.create({
        data: {
          processId: process.id,
          offeringId: offering.id,
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          startTime: '08:00',
          endDate: new Date('2026-01-20T00:00:00.000Z'),
          timezone: 'America/Sao_Paulo',
          instructionsUrl: 'https://outside.example.org/register',
        },
      });
      await tx.requirement.create({
        data: {
          processId: process.id,
          offeringId: offering.id,
          criterion: 'Histórico escolar',
          required: true,
          valueJson: { minimumScore: null },
        },
      });
      const storageKey = 'fixture-local/' + 'f'.repeat(64);
      await tx.documentBlob.create({
        data: { sha256: 'f'.repeat(64), storageKey, byteLength: 1 },
      });
      const officialDocument = await tx.document.create({
        data: {
          url: 'https://example.org/test-only/notice.pdf',
          sha256: 'f'.repeat(64),
          storageKey,
          mediaType: 'application/pdf',
          version: 1,
        },
      });
      const outsideDocument = await tx.document.create({
        data: {
          url: 'https://outside.example.org/notice.pdf',
          sha256: 'f'.repeat(64),
          storageKey,
          mediaType: 'application/pdf',
          version: 1,
        },
      });
      for (const documentId of [officialDocument.id, outsideDocument.id]) {
        await tx.evidence.create({
          data: {
            processId: process.id,
            documentId,
            fieldPath: 'offerings[0].seats',
            quote: 'Trecho sintético de teste',
            checkedAt: verifiedAt,
          },
        });
      }

      const detail = new PublicDetailService(tx);
      const result = await detail.get(process.id);
      assert.equal(result.officialNoticeUrl, 'https://example.org/test-only/notice');
      assert.equal(result.applicationStatus, 'INDETERMINADA');
      assert.equal(result.offerings.length, 1);
      assert.equal(result.offerings[0].reservations[0].seats, 8);
      assert.equal(result.offerings[0].campus.city, 'João Pessoa');
      assert.equal(result.windows[0].endDate, '2026-01-20');
      assert.equal(result.windows[0].endTime, null);
      assert.equal(result.windows[0].applicationStatus, 'INDETERMINADA');
      assert.equal(result.windows[0].instructionsUrl, null);
      assert.deepEqual(result.requirements[0].value, { minimumScore: null });
      assert.equal(result.evidence.length, 1);
      assert.equal(result.evidence[0].documentUrl, officialDocument.url);
      assert.doesNotMatch(
        JSON.stringify(result),
        /private-reviewer|private-review-reason|private-selector|outside\.example\.org|storageKey/u,
      );
      await assert.rejects(detail.get(outside.id), { name: 'NotFoundException' });
      await assert.rejects(detail.get(draft.id), { name: 'NotFoundException' });
      const found = await new PublicSearchService(tx).search(
        { openOnly: false, sort: 'recent' },
        { page: 1, pageSize: 20, skip: 0 },
        verifiedAt,
      );
      assert.deepEqual(
        found.data.map((item) => item.id),
        [process.id],
      );
      assert.equal((await new FiltersService(tx).list({})).total, 1);
      await tx.source.updateMany({
        where: { allowedDomainId: domain.id },
        data: { status: 'PAUSED' },
      });
      await assert.rejects(detail.get(process.id), { name: 'NotFoundException' });
      assert.equal(
        (
          await new PublicSearchService(tx).search(
            { openOnly: false, sort: 'recent' },
            { page: 1, pageSize: 20, skip: 0 },
            verifiedAt,
          )
        ).meta.total,
        0,
      );
      assert.equal((await new FiltersService(tx).list({})).total, 0);
      throw new Error('rollback synthetic public detail fixtures');
    }),
    /rollback synthetic public detail fixtures/u,
  );
  assert.equal((await new FiltersService(database).list({})).total, 0);
});
