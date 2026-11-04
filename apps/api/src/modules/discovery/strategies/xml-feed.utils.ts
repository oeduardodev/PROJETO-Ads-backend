import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { normalizeAuthorizedHost, normalizeSourceUrl } from '../../sources/source-url.js';

const XML_PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false,
});

const TRACKING_PARAMETERS = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'yclid',
  'igshid',
  'mkt_tok',
  'mc_cid',
  'mc_eid',
  'vero_id',
  '_ga',
]);

export type XmlRecord = Record<string, unknown>;

export function parseXmlDocument(xml: string): XmlRecord {
  if (!xml.trim() || /<!DOCTYPE|<!ENTITY/iu.test(xml)) {
    throw new Error('XML document is empty or contains a prohibited declaration');
  }
  const validation = XMLValidator.validate(xml);
  if (validation !== true) throw new Error('Invalid XML feed or sitemap');
  return XML_PARSER.parse(xml) as XmlRecord;
}

export function asXmlRecord(value: unknown): XmlRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as XmlRecord)
    : undefined;
}

export function asXmlArray(value: unknown): unknown[] {
  return value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
}

export function xmlText(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  const record = asXmlRecord(value);
  if (!record) return undefined;
  const text = record['#text'] ?? record['#cdata'];
  return typeof text === 'string' ? text.trim() || undefined : undefined;
}

export function exactAllowlist(sourceUrl: string, values: readonly string[]) {
  const normalizedSource = normalizeSourceUrl(sourceUrl).url;
  const source = new URL(normalizedSource);
  const hosts = new Set(values.map((host) => normalizeAuthorizedHost(host)));
  if (!hosts.has(source.hostname.toLowerCase())) {
    throw new Error('Source host is not in the exact-host allowlist');
  }
  return { normalizedSource, source, hosts };
}

export function canonicalFeedUrl(
  raw: string,
  base: URL,
  allowedHosts: ReadonlySet<string>,
): string | undefined {
  let url: URL;
  try {
    url = new URL(raw.trim(), base);
  } catch {
    return undefined;
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !allowedHosts.has(url.hostname.toLowerCase())
  ) {
    return undefined;
  }
  for (const key of [...url.searchParams.keys()]) {
    const normalized = key.toLowerCase();
    if (normalized.startsWith('utm_') || TRACKING_PARAMETERS.has(normalized)) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  url.hash = '';
  try {
    return normalizeSourceUrl(url.toString()).url;
  } catch {
    return undefined;
  }
}
