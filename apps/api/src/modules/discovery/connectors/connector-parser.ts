import type { DiscoveredLinkCandidate } from '../parsers/html-link.parser.js';
import { parseHtmlLinkCandidates } from '../parsers/html-link.parser.js';
import type { HtmlInstitutionConnector } from './connector.types.js';

export function parseConfiguredHtml(
  connector: HtmlInstitutionConnector,
  html: string,
): DiscoveredLinkCandidate[] {
  const sourceHost = new URL(connector.sourceUrl).hostname.toLowerCase();
  if (sourceHost !== connector.exactHost) {
    throw new Error(`Connector source must use its exact host: ${connector.exactHost}`);
  }
  if (connector.selector !== 'a[href]') {
    throw new Error(`Unsupported connector selector: ${connector.selector}`);
  }

  return parseHtmlLinkCandidates(html, connector.sourceUrl, [connector.exactHost]);
}
