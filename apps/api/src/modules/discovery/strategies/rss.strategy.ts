import {
  asXmlArray,
  asXmlRecord,
  canonicalFeedUrl,
  exactAllowlist,
  parseXmlDocument,
  xmlText,
} from './xml-feed.utils.js';
import {
  assertRssCursor,
  type IncrementalStrategyResult,
  type RssDiscoveryCursor,
} from './strategy-cursor.js';

function entryLink(entry: Record<string, unknown>): string | undefined {
  const links = asXmlArray(entry.link).map(asXmlRecord).filter(Boolean);
  const atomLink = links.find((link) => {
    const rel = link?.['@_rel'];
    return rel === undefined || rel === 'alternate';
  });
  return xmlText(entry.link) ?? xmlText(atomLink?.['@_href']);
}

export function parseRssIncrementally(
  xml: string,
  sourceUrl: string,
  allowedHosts: readonly string[],
  cursorValue?: unknown,
): IncrementalStrategyResult<RssDiscoveryCursor> {
  const cursor = assertRssCursor(cursorValue);
  const { source, hosts } = exactAllowlist(sourceUrl, allowedHosts);
  const document = parseXmlDocument(xml);
  const rss = asXmlRecord(document.rss);
  const channel = asXmlRecord(rss?.channel);
  const atom = asXmlRecord(document.feed);
  const feedContainer = channel ?? atom;
  if (!feedContainer) throw new Error('XML is not an RSS or Atom feed');
  const entries = asXmlArray(feedContainer.item ?? feedContainer.entry)
    .map(asXmlRecord)
    .filter((entry): entry is Record<string, unknown> => entry !== undefined);

  const previousKeys = new Set(cursor?.seenItemKeys ?? []);
  const nextKeys = new Set<string>();
  const newUrls = new Set<string>();
  for (const entry of entries) {
    const rawLink = entryLink(entry);
    const canonicalUrl = rawLink ? canonicalFeedUrl(rawLink, source, hosts) : undefined;
    const id = xmlText(entry.guid) ?? xmlText(entry.id);
    const itemKey = id ? `${id}\n${canonicalUrl ?? rawLink ?? ''}` : canonicalUrl;
    if (!itemKey) continue;
    nextKeys.add(itemKey);
    if (!previousKeys.has(itemKey) && canonicalUrl) newUrls.add(canonicalUrl);
  }

  return {
    urls: [...newUrls],
    cursor: { version: 1, strategy: 'RSS', seenItemKeys: [...nextKeys] },
  };
}
