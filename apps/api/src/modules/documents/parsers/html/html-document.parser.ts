import { parse } from 'parse5';
import { normalizeAuthorizedHost, normalizeSourceUrl } from '../../../sources/source-url.js';

export const HTML_DOCUMENT_PARSER_VERSION = 1;

interface HtmlNode {
  nodeName: string;
  tagName?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: HtmlNode[];
  value?: string;
}

export type HtmlDocumentKindHint = 'ANNEX' | 'TIMELINE' | 'REVISION' | 'NOTICE' | 'DOCUMENT';

export interface HtmlDocumentLink {
  url: string;
  label: string;
  sectionHeading: string | null;
  kindHint: HtmlDocumentKindHint;
}

export interface HtmlSection {
  heading: string | null;
  headingLevel: number | null;
  text: string;
}

export interface NormalizedHtmlDocument {
  sourceUrl: string;
  title: string | null;
  text: string;
  sections: HtmlSection[];
  documentLinks: HtmlDocumentLink[];
}

const OMIT_TAGS = new Set([
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'canvas',
  'iframe',
  'form',
  'nav',
  'aside',
  'button',
]);
const BLOCK_TEXT_TAGS = new Set(['p', 'li', 'blockquote', 'dt', 'dd', 'figcaption']);
const BOILERPLATE_TOKEN =
  /(?:^|[\s_-])(?:menu|navbar|breadcrumb|sidebar|cookie|social|share|pagination|site-header|site-footer|topbar)(?:$|[\s_-])/iu;
const ARTIFACT_EXTENSION = /\.(?:pdf|docx?|odt|rtf|xlsx?|ods)(?:$|[?#])/iu;

function attribute(node: HtmlNode, name: string): string | undefined {
  return node.attrs?.find((entry) => entry.name === name)?.value;
}

function cleanText(value: string): string {
  return value
    .replace(/\s+/gu, ' ')
    .replace(/\s+([,.;:!?])/gu, '$1')
    .trim();
}

function isOmitted(node: HtmlNode, insideArticle: boolean): boolean {
  const tag = node.tagName;
  if (!tag) return false;
  if (OMIT_TAGS.has(tag)) return true;
  if (tag === 'footer' && !insideArticle) return true;
  if (attribute(node, 'hidden') !== undefined || attribute(node, 'aria-hidden') === 'true') {
    return true;
  }
  const style = attribute(node, 'style')?.toLowerCase() ?? '';
  if (/\bdisplay\s*:\s*none\b|\bvisibility\s*:\s*hidden\b/u.test(style)) return true;
  const role = attribute(node, 'role')?.toLowerCase();
  if (role && ['navigation', 'complementary', 'contentinfo', 'banner', 'search'].includes(role)) {
    return true;
  }
  const identity = `${attribute(node, 'id') ?? ''} ${attribute(node, 'class') ?? ''}`;
  return BOILERPLATE_TOKEN.test(identity);
}

function nodeText(node: HtmlNode, insideArticle: boolean): string {
  const parts: string[] = [];
  const visit = (current: HtmlNode, inArticle: boolean): void => {
    if (isOmitted(current, inArticle)) return;
    if (current.nodeName === '#text' && current.value) {
      parts.push(current.value);
      return;
    }
    const nextArticle = inArticle || current.tagName === 'article';
    for (const child of current.childNodes ?? []) visit(child, nextArticle);
  };
  visit(node, insideArticle);
  return cleanText(parts.join(' '));
}

function visitNodes(node: HtmlNode, visit: (node: HtmlNode) => void): void {
  visit(node);
  for (const child of node.childNodes ?? []) visitNodes(child, visit);
}

function largestReadable(nodes: HtmlNode[]): HtmlNode | undefined {
  const scored = nodes.map((node) => ({ node, length: nodeText(node, false).length }));
  scored.sort((left, right) => right.length - left.length);
  const best = scored[0];
  return best && best.length >= 20 ? best.node : undefined;
}

function contentRoot(document: HtmlNode): HtmlNode {
  const main: HtmlNode[] = [];
  const articles: HtmlNode[] = [];
  const contentRegions: HtmlNode[] = [];
  let body: HtmlNode | undefined;
  visitNodes(document, (node) => {
    if (node.tagName === 'body') body = node;
    if (node.tagName === 'main' || attribute(node, 'role')?.toLowerCase() === 'main') {
      main.push(node);
    } else if (node.tagName === 'article') {
      articles.push(node);
    } else if (
      /(?:^|[\s_-])(?:content|entry-content|article-body)(?:$|[\s_-])/iu.test(
        `${attribute(node, 'id') ?? ''} ${attribute(node, 'class') ?? ''}`,
      )
    ) {
      contentRegions.push(node);
    }
  });
  return (
    largestReadable(main) ??
    largestReadable(articles) ??
    largestReadable(contentRegions) ??
    body ??
    document
  );
}

function kindHint(label: string, url: string): HtmlDocumentKindHint | undefined {
  const plain = label.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (/\banexos?\b/u.test(plain)) return 'ANNEX';
  if (/\bcronograma\b/u.test(plain)) return 'TIMELINE';
  if (/\bretificac(?:ao|oes)\b/u.test(plain)) return 'REVISION';
  if (/\bedital\b/u.test(plain)) return 'NOTICE';
  if (ARTIFACT_EXTENSION.test(url)) return 'DOCUMENT';
  return undefined;
}

function officialCandidateUrl(
  rawHref: string,
  sourceUrl: string,
  allowedHosts: ReadonlySet<string>,
): string | undefined {
  try {
    const resolved = new URL(rawHref, sourceUrl);
    const normalized = normalizeSourceUrl(resolved.toString());
    return allowedHosts.has(normalized.host) ? normalized.url : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeHtmlDocument(
  html: string,
  sourceUrl: string,
  allowedHostValues: readonly string[],
  maxInputCharacters: number,
): NormalizedHtmlDocument {
  if (!Number.isSafeInteger(maxInputCharacters) || maxInputCharacters < 1) {
    throw new Error('maxInputCharacters must be a positive safe integer');
  }
  if (html.length > maxInputCharacters) throw new Error('HTML exceeds the input character limit');

  const normalizedSource = normalizeSourceUrl(sourceUrl);
  const allowedHosts = new Set(allowedHostValues.map(normalizeAuthorizedHost));
  if (!allowedHosts.has(normalizedSource.host)) {
    throw new Error('Source host is not in the exact-host allowlist');
  }

  const document = parse(html) as unknown as HtmlNode;
  const root = contentRoot(document);
  let documentTitle: string | null = null;
  visitNodes(document, (node) => {
    if (node.tagName === 'title' && documentTitle === null) {
      documentTitle = nodeText(node, false) || null;
    }
  });

  const links = new Map<string, HtmlDocumentLink>();
  const sections: HtmlSection[] = [];
  let heading: string | null = null;
  let headingLevel: number | null = null;
  let title: string | null = null;
  let lines: string[] = [];

  const saveSection = (): void => {
    if (heading || lines.length) {
      sections.push({ heading, headingLevel, text: lines.join('\n') });
    }
    lines = [];
  };
  const captureLinks = (node: HtmlNode, insideArticle: boolean): void => {
    const visit = (current: HtmlNode, inArticle: boolean): void => {
      if (isOmitted(current, inArticle)) return;
      if (current.tagName === 'a') {
        const rawHref = attribute(current, 'href');
        const label =
          nodeText(current, inArticle) ||
          cleanText(attribute(current, 'title') ?? attribute(current, 'aria-label') ?? '');
        if (rawHref && label) {
          const url = officialCandidateUrl(rawHref, normalizedSource.url, allowedHosts);
          const hint = url ? kindHint(label, url) : undefined;
          if (url && hint && (!links.has(url) || links.get(url)!.label.length < label.length)) {
            links.set(url, { url, label, sectionHeading: heading, kindHint: hint });
          }
        }
      }
      const nextArticle = inArticle || current.tagName === 'article';
      for (const child of current.childNodes ?? []) visit(child, nextArticle);
    };
    visit(node, insideArticle);
  };

  const walk = (node: HtmlNode, insideArticle: boolean): void => {
    if (isOmitted(node, insideArticle)) return;
    const tag = node.tagName;
    const nextArticle = insideArticle || tag === 'article';
    if (tag && /^h[1-6]$/u.test(tag)) {
      const text = nodeText(node, nextArticle);
      if (text) {
        saveSection();
        heading = text;
        headingLevel = Number(tag[1]);
        if (tag === 'h1' && !title) title = text;
      }
      captureLinks(node, nextArticle);
      return;
    }
    if (tag === 'tr') {
      const cells = (node.childNodes ?? [])
        .filter((child) => child.tagName === 'th' || child.tagName === 'td')
        .map((cell) => nodeText(cell, nextArticle))
        .filter(Boolean);
      if (cells.length) lines.push(cells.join(' | '));
      captureLinks(node, nextArticle);
      return;
    }
    if (tag && (BLOCK_TEXT_TAGS.has(tag) || tag === 'a')) {
      const text = nodeText(node, nextArticle);
      if (text) lines.push(text);
      captureLinks(node, nextArticle);
      return;
    }
    if (node.nodeName === '#text' && node.value) {
      const text = cleanText(node.value);
      if (text) lines.push(text);
      return;
    }
    for (const child of node.childNodes ?? []) walk(child, nextArticle);
  };

  walk(root, root.tagName === 'article');
  saveSection();
  return {
    sourceUrl: normalizedSource.url,
    title: title ?? documentTitle,
    text: sections.flatMap((section) => [section.heading, section.text].filter(Boolean)).join('\n'),
    sections,
    documentLinks: [...links.values()],
  };
}
