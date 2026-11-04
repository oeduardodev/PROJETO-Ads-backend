import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseRssIncrementally } from '../apps/api/dist/modules/discovery/strategies/rss.strategy.js';
import { parseSitemapIncrementally } from '../apps/api/dist/modules/discovery/strategies/sitemap.strategy.js';

const feedUrl = 'https://feed.example.edu.br/feeds/notices.xml';
const allowedHosts = ['feed.example.edu.br'];
const rss = readFileSync(new URL('./fixtures/discovery/feed.xml', import.meta.url), 'utf8');
const sitemap = readFileSync(new URL('./fixtures/discovery/sitemap.xml', import.meta.url), 'utf8');

test('RSS strategy returns only item keys missing from the saved cursor', () => {
  const initial = parseRssIncrementally(rss, feedUrl, allowedHosts);
  assert.deepEqual(initial.urls, [
    'https://feed.example.edu.br/notices/old',
    'https://feed.example.edu.br/notices/new?id=2',
  ]);
  assert.equal(initial.cursor.strategy, 'RSS');
  assert.equal(initial.cursor.version, 1);

  const incremental = parseRssIncrementally(rss, feedUrl, allowedHosts, initial.cursor);
  assert.deepEqual(incremental.urls, []);
  assert.deepEqual(incremental.cursor, initial.cursor);
});

test('RSS strategy canonicalizes links and emits a newly appended item exactly once', () => {
  const baseline = parseRssIncrementally(rss, feedUrl, allowedHosts);
  const updated = rss.replace(
    '</channel>',
    '<item><guid>item-latest</guid><link>/notices/latest?fbclid=x</link></item></channel>',
  );
  const result = parseRssIncrementally(updated, feedUrl, allowedHosts, baseline.cursor);
  assert.deepEqual(result.urls, ['https://feed.example.edu.br/notices/latest']);
  assert.equal(result.cursor.seenItemKeys.length, 4);
});

test('sitemap strategy emits only canonical URLs absent from the prior cursor', () => {
  const previous = {
    version: 1,
    strategy: 'SITEMAP',
    seenUrls: ['https://feed.example.edu.br/notices/old'],
  };
  const result = parseSitemapIncrementally(sitemap, feedUrl, allowedHosts, previous);
  assert.deepEqual(result.urls, ['https://feed.example.edu.br/notices/new?id=3']);
  assert.deepEqual(result.cursor.seenUrls, [
    'https://feed.example.edu.br/notices/old',
    'https://feed.example.edu.br/notices/new?id=3',
  ]);
  assert.deepEqual(
    parseSitemapIncrementally(sitemap, feedUrl, allowedHosts, result.cursor).urls,
    [],
  );
});

test('feed strategies reject malformed XML, external entities, mismatched cursors and unauthorized sources', () => {
  assert.throws(
    () => parseRssIncrementally('<rss><channel>', feedUrl, allowedHosts),
    /Invalid XML/u,
  );
  assert.throws(
    () =>
      parseRssIncrementally(
        '<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>',
        feedUrl,
        allowedHosts,
      ),
    /prohibited declaration/u,
  );
  assert.throws(
    () =>
      parseRssIncrementally(rss, feedUrl, allowedHosts, {
        version: 2,
        strategy: 'RSS',
        seenItemKeys: [],
      }),
    /Invalid RSS discovery cursor/u,
  );
  assert.throws(
    () => parseSitemapIncrementally(sitemap, feedUrl, ['other.example.edu.br']),
    /exact-host allowlist/u,
  );
});
