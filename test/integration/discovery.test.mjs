import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaService } from '../../apps/api/dist/database/prisma.service.js';
import { CrawlErrorCode, SourceKind } from '../../apps/api/dist/generated/prisma/enums.js';
import { CrawlRunsRepository } from '../../apps/api/dist/modules/crawling/crawl-runs.repository.js';
import { DiscoveredUrlsRepository } from '../../apps/api/dist/modules/discovery/discovered-urls.repository.js';
import {
  AllowedDomainsRepository,
  SourcesRepository,
} from '../../apps/api/dist/modules/sources/sources.repository.js';

if (!process.env.TEST_DATABASE_URL)
  throw new Error('TEST_DATABASE_URL is required for local integration tests');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const database = new PrismaService();
const domains = new AllowedDomainsRepository(database);
const sources = new SourcesRepository(database);
const runs = new CrawlRunsRepository(database);
const discoveries = new DiscoveredUrlsRepository(database);

test.after(async () => database.$disconnect());

test('repeated canonical URL creates one candidate with per-run provenance', async () => {
  const institution = await database.institution.findUniqueOrThrow({ where: { acronym: 'UFPB' } });
  const candidateUrl = 'https://drive.ufpb.br/s/cFAAZgcncGti8mD/download/Edital_PSIG_2026_2_.pdf';
  const domain = await domains.create({
    institutionId: institution.id,
    host: 'www.prg.ufpb.br',
    evidenceUrl: 'https://www.prg.ufpb.br/editais/ingressantes/',
  });
  try {
    const sourceA = await sources.create({
      institutionId: institution.id,
      url: 'https://www.prg.ufpb.br/editais/ingressantes/',
      kind: SourceKind.HTML_INDEX,
    });
    const sourceB = await sources.create({
      institutionId: institution.id,
      url: 'https://www.prg.ufpb.br/edital/processo-seletivo-para-ingresso-de-graduados-nos-cursos-de-graduacao-presenciais-psig-2026-2/',
      kind: SourceKind.HTML_INDEX,
    });
    assert.throws(() => runs.createRecord(sourceA.id, 0), /positive integer/);
    const runA = await runs.createRecord(sourceA.id);
    const runB = await runs.createRecord(sourceB.id, 2);
    const first = await discoveries.record({
      sourceId: sourceA.id,
      crawlRunId: runA.id,
      url: `${candidateUrl}#page=1`,
    });
    const second = await discoveries.record({
      sourceId: sourceA.id,
      crawlRunId: runA.id,
      url: candidateUrl,
    });
    const third = await discoveries.record({
      sourceId: sourceB.id,
      crawlRunId: runB.id,
      url: candidateUrl,
    });
    assert.equal(first.id, second.id);
    assert.equal(first.id, third.id);
    const candidate = await discoveries.findByUrl(candidateUrl);
    assert.equal(candidate.canonicalUrl, candidateUrl);
    assert.equal(candidate.status, 'CANDIDATE');
    assert.equal(candidate.seenCount, 3);
    assert.equal(candidate.observations.length, 2);
    assert.deepEqual(candidate.observations.map((item) => item.seenCount).sort(), [1, 2]);
    assert.deepEqual(
      new Set(candidate.observations.map((item) => item.sourceId)),
      new Set([sourceA.id, sourceB.id]),
    );
    assert.equal(await database.discoveredUrl.count(), 1);

    await assert.rejects(
      discoveries.record({
        sourceId: sourceA.id,
        crawlRunId: runB.id,
        url: 'https://www.prg.ufpb.br/editais/ingressantes/',
      }),
    );
    assert.equal(await database.discoveredUrl.count(), 1);

    const completed = await runs.finishSuccess(runA.id, 200);
    const failed = await runs.finishFailure(runB.id, CrawlErrorCode.RATE_LIMITED, 429);
    assert.equal(completed.success, true);
    assert.equal(completed.status, 'SUCCEEDED');
    assert.equal(failed.success, false);
    assert.equal(failed.errorCode, 'RATE_LIMITED');

    const sourceAfterSuccess = await database.source.findUniqueOrThrow({
      where: { id: sourceA.id },
      select: { lastCheckedAt: true, lastSuccessAt: true },
    });
    assert.equal(
      sourceAfterSuccess.lastCheckedAt.toISOString(),
      completed.finishedAt.toISOString(),
    );
    assert.equal(
      sourceAfterSuccess.lastSuccessAt.toISOString(),
      completed.finishedAt.toISOString(),
    );
    const sourceAfterFailure = await database.source.findUniqueOrThrow({
      where: { id: sourceB.id },
      select: { lastCheckedAt: true, lastSuccessAt: true },
    });
    assert.equal(sourceAfterFailure.lastCheckedAt.toISOString(), failed.finishedAt.toISOString());
    assert.equal(sourceAfterFailure.lastSuccessAt, null);

    const retry = await runs.createRecord(sourceA.id, 2);
    const failedAfterSuccess = await runs.finishFailure(retry.id, CrawlErrorCode.NETWORK);
    const sourceAfterRetryFailure = await database.source.findUniqueOrThrow({
      where: { id: sourceA.id },
      select: { lastCheckedAt: true, lastSuccessAt: true },
    });
    assert.equal(
      sourceAfterRetryFailure.lastCheckedAt.toISOString(),
      failedAfterSuccess.finishedAt.toISOString(),
    );
    assert.equal(
      sourceAfterRetryFailure.lastSuccessAt.toISOString(),
      completed.finishedAt.toISOString(),
    );
    await assert.rejects(runs.finishSuccess(runA.id, 200), /not running/);
  } finally {
    await database.discoveryObservation.deleteMany({
      where: { source: { allowedDomainId: domain.id } },
    });
    await database.discoveredUrl.deleteMany({ where: { canonicalUrl: candidateUrl } });
    await database.crawlRun.deleteMany({ where: { source: { allowedDomainId: domain.id } } });
    await database.source.deleteMany({ where: { allowedDomainId: domain.id } });
    await database.allowedDomain.delete({ where: { id: domain.id } });
  }
});
