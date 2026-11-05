import { parse } from 'parse5';
import { normalizeAuthorizedHost, normalizeSourceUrl } from '../../sources/source-url.js';
import { assessDiscoveryRelevance } from '../relevance/relevance.classifier.js';

export interface DiscoveredLinkCandidate {
  canonicalUrl: string;
  sourceUrl: string;
  anchorText: string;
  relevanceScore: number;
}

interface HtmlNode {
  nodeName: string;
  tagName?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: HtmlNode[];
  value?: string;
}

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

function anchorText(node: HtmlNode): string {
  const pieces: string[] = [];
  const visit = (current: HtmlNode): void => {
    if (current.nodeName === '#text' && current.value) pieces.push(current.value);
    for (const child of current.childNodes ?? []) visit(child);
  };
  visit(node);
  return pieces.join(' ').replace(/\s+/gu, ' ').trim();
}

function canonicalizeLink(
  rawHref: string,
  baseUrl: URL,
  allowedHosts: ReadonlySet<string>,
): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(rawHref.trim(), baseUrl);
  } catch {
    return undefined;
  }
  const host = parsed.hostname.toLowerCase();
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    !allowedHosts.has(host)
  ) {
    return undefined;
  }

  for (const key of [...parsed.searchParams.keys()]) {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey.startsWith('utm_') || TRACKING_PARAMETERS.has(normalizedKey)) {
      parsed.searchParams.delete(key);
    }
  }
  parsed.searchParams.sort();
  parsed.hash = '';

  try {
    return normalizeSourceUrl(parsed.toString()).url;
  } catch {
    return undefined;
  }
}

export function parseHtmlLinkCandidates(
  html: string,
  sourceUrl: string,
  allowedHostValues: readonly string[],
): DiscoveredLinkCandidate[] {
  const normalizedSource = normalizeSourceUrl(sourceUrl).url;
  const baseUrl = new URL(normalizedSource);
  const allowedHosts = new Set(allowedHostValues.map((host) => normalizeAuthorizedHost(host)));
  if (!allowedHosts.has(baseUrl.hostname.toLowerCase())) {
    throw new Error('Source host is not in the exact-host allowlist');
  }

  const document = parse(html) as unknown as HtmlNode;
  const candidates = new Map<string, DiscoveredLinkCandidate>();
  const visit = (node: HtmlNode): void => {
    if (node.tagName === 'a') {
      const href = node.attrs?.find((attribute) => attribute.name === 'href')?.value;
      if (href) {
        const canonicalUrl = canonicalizeLink(href, baseUrl, allowedHosts);
        if (canonicalUrl) {
          const text = anchorText(node);
          const relevance = assessDiscoveryRelevance(text, canonicalUrl);
          if (relevance.decision !== 'DISCARD') {
            const previous = candidates.get(canonicalUrl);
            if (!previous) {
              candidates.set(canonicalUrl, {
                canonicalUrl,
                sourceUrl: normalizedSource,
                anchorText: text,
                relevanceScore: relevance.score,
              });
            } else if (relevance.score > previous.relevanceScore) {
              candidates.set(canonicalUrl, {
                ...previous,
                anchorText: text,
                relevanceScore: relevance.score,
              });
            }
          }
        }
      }
    }
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(document);
  return [...candidates.values()];
}
