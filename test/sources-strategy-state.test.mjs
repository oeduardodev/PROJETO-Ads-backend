import assert from 'node:assert/strict';
import test from 'node:test';
import { SourceKind } from '../apps/api/dist/generated/prisma/enums.js';
import { SourcesRepository } from '../apps/api/dist/modules/sources/sources.repository.js';

const sourceId = 'c7e0ca61-3f26-4b2a-8d0f-6dafc8f40d33';

function repositoryWithMock(updateCount = 1) {
  const calls = [];
  const database = {
    source: {
      updateMany: async (input) => {
        calls.push(input);
        return { count: updateCount };
      },
      findUniqueOrThrow: async ({ where }) => ({
        id: where.id,
        kind: SourceKind.RSS,
        discoveryCursor: calls[0]?.data.discoveryCursor,
        strategyLastExecutedAt: calls[0]?.data.strategyLastExecutedAt,
      }),
    },
  };
  return { sources: new SourcesRepository(database), calls };
}

test('persists a versioned RSS cursor and execution timestamp atomically on the matching source kind', async () => {
  const { sources, calls } = repositoryWithMock();
  const cursor = { version: 1, strategy: 'RSS', seenItemKeys: ['id-1'] };
  const executedAt = new Date('2026-11-04T12:00:00.000Z');
  const saved = await sources.saveStrategyState(sourceId, cursor, executedAt);

  assert.deepEqual(calls[0].where, { id: sourceId, kind: SourceKind.RSS });
  assert.deepEqual(calls[0].data, {
    discoveryCursor: cursor,
    strategyLastExecutedAt: executedAt,
  });
  assert.deepEqual(saved.discoveryCursor, cursor);
  assert.equal(saved.strategyLastExecutedAt.toISOString(), executedAt.toISOString());
});

test('rejects a cursor whose source is missing or has a different strategy kind', async () => {
  const { sources } = repositoryWithMock(0);
  await assert.rejects(
    sources.saveStrategyState(sourceId, { version: 1, strategy: 'SITEMAP', seenUrls: [] }),
    /does not match source kind/u,
  );
});

test('does not persist an invalid execution date', async () => {
  const { sources, calls } = repositoryWithMock();
  await assert.rejects(
    sources.saveStrategyState(
      sourceId,
      { version: 1, strategy: 'RSS', seenItemKeys: [] },
      new Date('bad'),
    ),
    /date must be valid/u,
  );
  assert.equal(calls.length, 0);
});
