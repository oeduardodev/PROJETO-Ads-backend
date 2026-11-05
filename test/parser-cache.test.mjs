import assert from 'node:assert/strict';
import test from 'node:test';
import { DocumentParserKind } from '../apps/api/dist/generated/prisma/enums.js';
import { ParserCacheRepository } from '../apps/api/dist/modules/documents/cache/parser-cache.repository.js';

const sha256 = 'a'.repeat(64);

function createDatabase({ expiredAt = null, hasBlob = true } = {}) {
  const blobs = new Map(hasBlob ? [[sha256, { expiredAt }]] : []);
  const cache = new Map();
  const database = {
    $transaction: async (operation) => operation(database),
    $queryRaw: async (_strings, key) => (blobs.has(key) ? [blobs.get(key)] : []),
    documentParseCache: {
      findUnique: async ({ where }) => {
        const key = where.sha256_parserKind_parserVersion;
        return cache.get(`${key.sha256}|${key.parserKind}|${key.parserVersion}`) ?? null;
      },
      upsert: async ({ where, create }) => {
        const identity = where.sha256_parserKind_parserVersion;
        const key = `${identity.sha256}|${identity.parserKind}|${identity.parserVersion}`;
        if (!cache.has(key)) cache.set(key, { ...create });
        return cache.get(key);
      },
    },
  };
  return { database, cache };
}

test('reuses parser output for the same immutable hash, kind, and version', async () => {
  const { database, cache } = createDatabase();
  const repository = new ParserCacheRepository(database);
  let computations = 0;
  const key = { sha256, parserKind: DocumentParserKind.PDF_TEXT, parserVersion: 1 };
  const compute = async () => ({ pages: [{ number: 1, text: 'fixture text' }] });

  const first = await repository.getOrCompute(key, async () => {
    computations += 1;
    return compute();
  });
  const replay = await repository.getOrCompute(key, async () => {
    computations += 1;
    return compute();
  });

  assert.equal(first.cacheHit, false);
  assert.deepEqual(first.result, { pages: [{ number: 1, text: 'fixture text' }] });
  assert.equal(replay.cacheHit, true);
  assert.deepEqual(replay.result, first.result);
  assert.equal(computations, 1);
  assert.equal(cache.size, 1);
});

test('uses a distinct cache entry when parser kind or version changes', async () => {
  const { database, cache } = createDatabase();
  const repository = new ParserCacheRepository(database);
  let computations = 0;
  for (const key of [
    { sha256, parserKind: DocumentParserKind.PDF_TEXT, parserVersion: 1 },
    { sha256, parserKind: DocumentParserKind.PDF_TEXT, parserVersion: 2 },
    { sha256, parserKind: DocumentParserKind.OCR, parserVersion: 1 },
  ]) {
    const result = await repository.getOrCompute(key, async () => ({ run: ++computations }));
    assert.equal(result.cacheHit, false);
  }
  assert.equal(cache.size, 3);
  assert.equal(computations, 3);
});

test('refuses to parse a missing or expired blob', async () => {
  for (const database of [
    createDatabase({ hasBlob: false }).database,
    createDatabase({ expiredAt: new Date() }).database,
  ]) {
    const repository = new ParserCacheRepository(database);
    let called = false;
    await assert.rejects(
      repository.getOrCompute(
        { sha256, parserKind: DocumentParserKind.HTML_DOCUMENT, parserVersion: 1 },
        async () => {
          called = true;
          return { text: 'should not run' };
        },
      ),
      /document blob/u,
    );
    assert.equal(called, false);
  }
});

test('validates cache keys and persists only JSON objects', async () => {
  const { database } = createDatabase();
  const repository = new ParserCacheRepository(database);
  await assert.rejects(
    repository.getOrCompute(
      { sha256: 'not-a-hash', parserKind: DocumentParserKind.PDF_TEXT, parserVersion: 1 },
      async () => ({}),
    ),
    /64 hexadecimal/u,
  );
  await assert.rejects(
    repository.getOrCompute(
      { sha256, parserKind: DocumentParserKind.PDF_TEXT, parserVersion: 0 },
      async () => ({}),
    ),
    /positive safe integer/u,
  );
  await assert.rejects(
    repository.getOrCompute(
      { sha256, parserKind: DocumentParserKind.PDF_TEXT, parserVersion: 1 },
      async () => ['not', 'an object'],
    ),
    /JSON object/u,
  );
});
