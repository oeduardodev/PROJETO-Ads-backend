import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OfficialFeedService } from '../apps/api/dist/modules/official-feed/official-feed.service.js';

test('Gemini selections can only refer to observed candidate IDs', async () => {
  const service = new OfficialFeedService();
  const candidate = {
    id: 0,
    title: 'Transferência para graduação',
    url: 'https://www.prg.ufpb.br/edital/transferencia/',
  };
  const result = await service.select(
    {
      generate: async () => ({
        output: {
          selections: [
            { id: 0, category: 'Transferência' },
            { id: 9, category: 'Transferência' },
          ],
        },
      }),
    },
    'UFPB',
    [candidate],
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].url, candidate.url);
});

test('last valid official feed survives a restart without making a new Gemini call', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'alem-official-feed-'));
  const oldKey = process.env.LLM_PROVIDER_KEY;
  const oldCache = process.env.OFFICIAL_FEED_CACHE_PATH;
  process.env.LLM_PROVIDER_KEY = 'test-only';
  process.env.OFFICIAL_FEED_CACHE_PATH = join(folder, 'feed.json');
  try {
    const first = new OfficialFeedService();
    first.fetchUepbCandidates = async () => [];
    first.fetchPage = async (url) =>
      `<a href="https://${new URL(url).hostname}/edital/transferencia/">Transferência para graduação</a>`;
    first.select = async (_provider, institution, candidates) =>
      institution === 'UFPB'
        ? [
            {
              institution,
              title: candidates[0].title,
              url: candidates[0].url,
              category: 'Transferência',
              checkedAt: new Date().toISOString(),
            },
          ]
        : [];
    await first.refresh();
    assert.equal(first.snapshot().items.length, 1);

    const restarted = new OfficialFeedService();
    restarted.fetchPage = async () => {
      throw new Error('No network expected');
    };
    await restarted.onModuleInit();
    assert.equal(restarted.snapshot().items.length, 1);
    assert.equal(restarted.snapshot().items[0].institution, 'UFPB');
    restarted.onApplicationShutdown();
  } finally {
    if (oldKey === undefined) delete process.env.LLM_PROVIDER_KEY;
    else process.env.LLM_PROVIDER_KEY = oldKey;
    if (oldCache === undefined) delete process.env.OFFICIAL_FEED_CACHE_PATH;
    else process.env.OFFICIAL_FEED_CACHE_PATH = oldCache;
    await rm(folder, { recursive: true, force: true });
  }
});
