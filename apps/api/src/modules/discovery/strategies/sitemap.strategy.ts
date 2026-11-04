import {
  asXmlArray,
  asXmlRecord,
  canonicalFeedUrl,
  exactAllowlist,
  parseXmlDocument,
  xmlText,
} from './xml-feed.utils.js';
import {
  assertSitemapCursor,
  type IncrementalStrategyResult,
  type SitemapDiscoveryCursor,
} from './strategy-cursor.js';

export function parseSitemapIncrementally(
  xml: string,
  sourceUrl: string,
  allowedHosts: readonly string[],
  cursorValue?: unknown,
): IncrementalStrategyResult<SitemapDiscoveryCursor> {
  const cursor = assertSitemapCursor(cursorValue);
  const { source, hosts } = exactAllowlist(sourceUrl, allowedHosts);
  const document = parseXmlDocument(xml);
  const urlset = asXmlRecord(document.urlset);
  const sitemapIndex = asXmlRecord(document.sitemapindex);
  const container = urlset ?? sitemapIndex;
  if (!container) throw new Error('XML is not a sitemap or sitemap index');
  const entries = asXmlArray(container.url ?? container.sitemap)
    .map(asXmlRecord)
    .filter((entry): entry is Record<string, unknown> => entry !== undefined);

  const previousUrls = new Set(cursor?.seenUrls ?? []);
  const nextUrls = new Set<string>();
  const newUrls = new Set<string>();
  for (const entry of entries) {
    const rawUrl = xmlText(entry.loc);
    if (!rawUrl) continue;
    const canonicalUrl = canonicalFeedUrl(rawUrl, source, hosts);
    if (!canonicalUrl) continue;
    nextUrls.add(canonicalUrl);
    if (!previousUrls.has(canonicalUrl)) newUrls.add(canonicalUrl);
  }

  return {
    urls: [...newUrls],
    cursor: { version: 1, strategy: 'SITEMAP', seenUrls: [...nextUrls] },
  };
}
