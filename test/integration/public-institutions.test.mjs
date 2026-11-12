import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import test from 'node:test';
import { stopChild } from '../helpers/stop-child.mjs';
import { PrismaService } from '../../apps/api/dist/database/prisma.service.js';

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

test('public directory includes only reviewed institutions and campuses without source internals', async () => {
  const institution = await database.institution.findUniqueOrThrow({ where: { acronym: 'UFPB' } });
  const verifiedAt = new Date('2026-11-02T12:00:00.000Z');
  const checkedAt = new Date('2026-11-02T13:00:00.000Z');
  const officialUrl = 'https://www.prg.ufpb.br/editais/ingressantes/';
  let domain;
  let source;
  let verifiedCampus;
  let draftCampus;
  let child;
  try {
    await database.institution.update({ where: { id: institution.id }, data: { verifiedAt } });
    verifiedCampus = await database.campus.create({
      data: {
        institutionId: institution.id,
        name: 'Campus de teste revisado',
        normalizedName: 'campus de teste revisado',
        city: 'João Pessoa',
        normalizedCity: 'JOAO PESSOA',
        state: 'PB',
        timezone: 'America/Sao_Paulo',
        verifiedAt,
      },
    });
    draftCampus = await database.campus.create({
      data: {
        institutionId: institution.id,
        name: 'Campus de teste sem revisão',
        normalizedName: 'campus de teste sem revisao',
        city: 'João Pessoa',
        normalizedCity: 'JOAO PESSOA',
        state: 'PB',
        timezone: 'America/Sao_Paulo',
      },
    });
    domain = await database.allowedDomain.create({
      data: {
        institutionId: institution.id,
        host: 'www.prg.ufpb.br',
        evidenceUrl: officialUrl,
        reviewedAt: verifiedAt,
      },
    });
    source = await database.source.create({
      data: {
        institutionId: institution.id,
        allowedDomainId: domain.id,
        url: officialUrl,
        kind: 'HTML_INDEX',
        status: 'ACTIVE',
        selector: 'private-test-selector',
        lastCheckedAt: checkedAt,
        lastSuccessAt: checkedAt,
      },
    });
    const port = await freePort();
    child = spawn(process.execPath, ['apps/api/dist/main.js'], {
      env: {
        ...process.env,
        PORT: String(port),
        CORS_ORIGINS: 'http://127.0.0.1:4200',
        REDIS_URL: process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6380',
      },
      stdio: 'ignore',
    });
    let response;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (child.exitCode !== null) throw new Error('API exited before directory test');
      try {
        response = await fetch(`http://127.0.0.1:${port}/api/v1/institutions?page=1&page_size=1`);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    assert.ok(response, 'API did not start in 20 seconds');
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(result.meta, { page: 1, pageSize: 1, total: 1 });
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].acronym, 'UFPB');
    assert.equal(result.data[0].campuses.length, 1);
    assert.equal(result.data[0].campuses[0].id, verifiedCampus.id);
    assert.equal(result.data[0].monitoring.activeSourceCount, 1);
    assert.equal(result.data[0].monitoring.lastSuccessAt, checkedAt.toISOString());
    assert.doesNotMatch(
      JSON.stringify(result),
      /private-test-selector|sources|allowedDomains|ingressantes/iu,
    );
    const next = await fetch(`http://127.0.0.1:${port}/api/v1/institutions?page=2&page_size=1`);
    assert.deepEqual((await next.json()).meta, { page: 2, pageSize: 1, total: 1 });
    for (const query of [
      'q=para%C3%ADba',
      'q=ufpb',
      'uf=PB&city=Jo%C3%A3o%20Pessoa&jurisdiction=FEDERAL',
    ]) {
      const filtered = await fetch(`http://127.0.0.1:${port}/api/v1/institutions?${query}`);
      assert.equal(filtered.status, 200, query);
      const body = await filtered.json();
      assert.equal(body.meta.total, 1, query);
      assert.equal(body.data[0].acronym, 'UFPB', query);
      assert.deepEqual(
        body.data[0].campuses.map((campus) => campus.id),
        [verifiedCampus.id],
      );
    }
    const excluded = await fetch(
      `http://127.0.0.1:${port}/api/v1/institutions?jurisdiction=ESTADUAL`,
    );
    assert.deepEqual((await excluded.json()).meta.total, 0);
    const invalid = await fetch(`http://127.0.0.1:${port}/api/v1/institutions?page_size=0`);
    assert.equal(invalid.status, 400);
    const invalidFilter = await fetch(
      `http://127.0.0.1:${port}/api/v1/institutions?jurisdiction=MUNICIPAL`,
    );
    assert.equal(invalidFilter.status, 400);
  } finally {
    await stopChild(child);
    if (source) await database.source.delete({ where: { id: source.id } });
    if (domain) await database.allowedDomain.delete({ where: { id: domain.id } });
    if (verifiedCampus) await database.campus.delete({ where: { id: verifiedCampus.id } });
    if (draftCampus) await database.campus.delete({ where: { id: draftCampus.id } });
    await database.institution.update({
      where: { id: institution.id },
      data: { verifiedAt: null },
    });
  }
});
