import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaService } from '../../apps/api/dist/database/prisma.service.js';
import { SourceKind } from '../../apps/api/dist/generated/prisma/enums.js';
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

test.after(async () => database.$disconnect());

test('one institution can have multiple draft sources on an exact allowlisted host', async () => {
  const ufpb = await database.institution.findUniqueOrThrow({ where: { acronym: 'UFPB' } });
  const ufcg = await database.institution.findUniqueOrThrow({ where: { acronym: 'UFCG' } });
  const domain = await domains.create({
    institutionId: ufpb.id,
    host: 'www.prg.ufpb.br',
    evidenceUrl: 'https://www.prg.ufpb.br/editais/ingressantes/',
  });
  try {
    const first = await sources.create({
      institutionId: ufpb.id,
      url: 'https://www.prg.ufpb.br/editais/ingressantes/',
      kind: SourceKind.HTML_INDEX,
    });
    const second = await sources.create({
      institutionId: ufpb.id,
      url: 'https://www.prg.ufpb.br/edital/processo-seletivo-para-ingresso-de-graduados-nos-cursos-de-graduacao-presenciais-psig-2026-2/',
      kind: SourceKind.HTML_INDEX,
      frequencyMinutes: 720,
      priority: 20,
    });
    const rssSource = await sources.create({
      institutionId: ufpb.id,
      url: 'https://www.prg.ufpb.br/editais/ingressantes/?integration_test=rss',
      kind: SourceKind.RSS,
    });
    assert.notEqual(first.id, second.id);
    assert.equal((await sources.listByInstitution(ufpb.id)).length, 3);
    assert.equal(first.status, 'DRAFT');
    assert.equal(first.health, 'UNKNOWN');
    assert.equal(domain.collectionAllowed, false);
    assert.equal(domain.reviewedAt, null);

    const executedAt = new Date('2026-11-04T12:00:00.000Z');
    const cursor = { version: 1, strategy: 'RSS', seenItemKeys: ['integration-test-item'] };
    const strategyState = await sources.saveStrategyState(rssSource.id, cursor, executedAt);
    assert.deepEqual(strategyState.discoveryCursor, cursor);
    assert.equal(strategyState.strategyLastExecutedAt.toISOString(), executedAt.toISOString());
    await assert.rejects(
      sources.saveStrategyState(rssSource.id, { version: 1, strategy: 'SITEMAP', seenUrls: [] }),
      /does not match source kind/u,
    );

    await assert.rejects(
      sources.create({
        institutionId: ufpb.id,
        url: 'https://drive.ufpb.br/s/cFAAZgcncGti8mD/download/Edital_PSIG_2026_2_.pdf',
        kind: SourceKind.HTML_INDEX,
      }),
      /not allowlisted/iu,
    );
    await assert.rejects(
      sources.create({ institutionId: ufcg.id, url: first.url, kind: SourceKind.HTML_INDEX }),
      /not allowlisted/iu,
    );
    await assert.rejects(
      database.allowedDomain.update({
        where: { id: domain.id },
        data: { collectionAllowed: true },
      }),
      /check constraint|allowed_domains_review_before_collection_check/iu,
    );
  } finally {
    await database.source.deleteMany({ where: { allowedDomainId: domain.id } });
    await database.allowedDomain.delete({ where: { id: domain.id } });
  }
});
