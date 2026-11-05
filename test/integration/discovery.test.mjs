import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PrismaService } from '../../apps/api/dist/database/prisma.service.js';
import { CrawlErrorCode, SourceKind } from '../../apps/api/dist/generated/prisma/enums.js';
import { CrawlRunsRepository } from '../../apps/api/dist/modules/crawling/crawl-runs.repository.js';
import { DiscoveredUrlsRepository } from '../../apps/api/dist/modules/discovery/discovered-urls.repository.js';
import { parseInstitutionIndexHtml } from '../../apps/api/dist/modules/discovery/connectors/institution-connectors.js';
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
    const sentinel = new Date('2025-01-02T03:04:05.000Z');
    await database.discoveredUrl.update({
      where: { canonicalUrl: candidateUrl },
      data: { lastSeenAt: sentinel },
    });
    await database.discoveryObservation.update({
      where: {
        discoveredUrlId_crawlRunId: {
          discoveredUrlId: first.id,
          crawlRunId: runA.id,
        },
      },
      data: { lastSeenAt: sentinel },
    });
    const second = await discoveries.record({
      sourceId: sourceA.id,
      crawlRunId: runA.id,
      url: candidateUrl,
    });
    const afterReplay = await discoveries.findByUrl(candidateUrl);
    assert.equal(afterReplay.seenCount, 1);
    assert.equal(afterReplay.lastSeenAt.toISOString(), sentinel.toISOString());
    assert.equal(afterReplay.observations[0].seenCount, 1);
    assert.equal(afterReplay.observations[0].lastSeenAt.toISOString(), sentinel.toISOString());
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
    assert.equal(candidate.seenCount, 2);
    assert.equal(candidate.observations.length, 2);
    assert.deepEqual(candidate.observations.map((item) => item.seenCount).sort(), [1, 1]);
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

test('replaying a versioned connector fixture is idempotent and remains unpublished', async () => {
  const institution = await database.institution.findUniqueOrThrow({ where: { acronym: 'UFPB' } });
  const domain = await domains.create({
    institutionId: institution.id,
    host: 'www.prg.ufpb.br',
    evidenceUrl: 'https://www.prg.ufpb.br/editais/ingressantes/',
  });
  let source;
  let crawlRun;
  let candidateUrls = [];
  try {
    source = await sources.create({
      institutionId: institution.id,
      url: 'https://www.prg.ufpb.br/editais/ingressantes/',
      kind: SourceKind.HTML_INDEX,
    });
    crawlRun = await runs.createRecord(source.id);
    const html = readFileSync(
      new URL('../fixtures/discovery/connector-layout-v2.html', import.meta.url),
      'utf8',
    );
    const firstReplay = parseInstitutionIndexHtml('UFPB', html);
    const secondReplay = parseInstitutionIndexHtml('UFPB', html);
    candidateUrls = firstReplay.map((candidate) => candidate.canonicalUrl);
    assert.deepEqual(secondReplay, firstReplay);
    assert.equal(new Set(candidateUrls).size, candidateUrls.length);

    const recordCandidate = (candidate) =>
      discoveries.record({
        sourceId: source.id,
        crawlRunId: crawlRun.id,
        url: candidate.canonicalUrl,
        relevanceScore: candidate.relevanceScore,
      });
    const firstRecords = await Promise.all(
      firstReplay.map(async (candidate) => {
        const [created, concurrentReplay] = await Promise.all([
          recordCandidate(candidate),
          recordCandidate(candidate),
        ]);
        assert.equal(concurrentReplay.id, created.id);
        return created;
      }),
    );
    const sentinel = new Date('2025-02-03T04:05:06.000Z');
    for (const canonicalUrl of candidateUrls) {
      const candidate = await database.discoveredUrl.findUniqueOrThrow({
        where: { canonicalUrl },
        select: { id: true },
      });
      await database.discoveredUrl.update({
        where: { id: candidate.id },
        data: { lastSeenAt: sentinel },
      });
      await database.discoveryObservation.update({
        where: {
          discoveredUrlId_crawlRunId: {
            discoveredUrlId: candidate.id,
            crawlRunId: crawlRun.id,
          },
        },
        data: { lastSeenAt: sentinel },
      });
    }

    const replayedRecords = await Promise.all(
      secondReplay.map(async (candidate) => {
        const [replay, concurrentReplay] = await Promise.all([
          recordCandidate(candidate),
          recordCandidate(candidate),
        ]);
        assert.equal(concurrentReplay.id, replay.id);
        return replay;
      }),
    );
    assert.deepEqual(
      replayedRecords.map((candidate) => candidate.id),
      firstRecords.map((candidate) => candidate.id),
    );
    for (const canonicalUrl of candidateUrls) {
      const candidate = await discoveries.findByUrl(canonicalUrl);
      assert.equal(candidate.status, 'CANDIDATE');
      assert.equal(candidate.seenCount, 1);
      assert.equal(candidate.observations.length, 1);
      assert.equal(candidate.observations[0].seenCount, 1);
      assert.equal(candidate.lastSeenAt.toISOString(), sentinel.toISOString());
      assert.equal(candidate.observations[0].lastSeenAt.toISOString(), sentinel.toISOString());
    }
    assert.equal(
      await database.discoveredUrl.count({ where: { canonicalUrl: { in: candidateUrls } } }),
      candidateUrls.length,
    );
  } finally {
    if (source) {
      await database.discoveryObservation.deleteMany({ where: { sourceId: source.id } });
      if (candidateUrls.length > 0) {
        await database.discoveredUrl.deleteMany({ where: { canonicalUrl: { in: candidateUrls } } });
      }
      await database.crawlRun.deleteMany({ where: { sourceId: source.id } });
      await database.source.delete({ where: { id: source.id } });
    }
    await database.allowedDomain.delete({ where: { id: domain.id } });
  }
});
