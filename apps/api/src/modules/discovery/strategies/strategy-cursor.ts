export interface RssDiscoveryCursor {
  version: 1;
  strategy: 'RSS';
  seenItemKeys: string[];
}

export interface SitemapDiscoveryCursor {
  version: 1;
  strategy: 'SITEMAP';
  seenUrls: string[];
}

export type DiscoveryStrategyCursor = RssDiscoveryCursor | SitemapDiscoveryCursor;

export interface IncrementalStrategyResult<Cursor extends DiscoveryStrategyCursor> {
  urls: string[];
  cursor: Cursor;
}

export function assertRssCursor(value: unknown): RssDiscoveryCursor | undefined {
  if (value === undefined || value === null) return undefined;
  if (
    typeof value !== 'object' ||
    !('version' in value) ||
    value.version !== 1 ||
    !('strategy' in value) ||
    value.strategy !== 'RSS' ||
    !('seenItemKeys' in value) ||
    !Array.isArray(value.seenItemKeys) ||
    !value.seenItemKeys.every((key) => typeof key === 'string')
  ) {
    throw new Error('Invalid RSS discovery cursor');
  }
  return value as RssDiscoveryCursor;
}

export function assertSitemapCursor(value: unknown): SitemapDiscoveryCursor | undefined {
  if (value === undefined || value === null) return undefined;
  if (
    typeof value !== 'object' ||
    !('version' in value) ||
    value.version !== 1 ||
    !('strategy' in value) ||
    value.strategy !== 'SITEMAP' ||
    !('seenUrls' in value) ||
    !Array.isArray(value.seenUrls) ||
    !value.seenUrls.every((url) => typeof url === 'string')
  ) {
    throw new Error('Invalid sitemap discovery cursor');
  }
  return value as SitemapDiscoveryCursor;
}
