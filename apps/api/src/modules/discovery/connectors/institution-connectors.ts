import { SourceKind, SourceStatus } from '../../../generated/prisma/enums.js';
import type { DiscoveredLinkCandidate } from '../parsers/html-link.parser.js';
import { parseHtmlLinkCandidates } from '../parsers/html-link.parser.js';

export type PilotInstitutionCode = 'UFPB' | 'UFCG';

export interface HtmlInstitutionConnector {
  institutionCode: PilotInstitutionCode;
  sourceUrl: string;
  exactHost: string;
  sourceKind: typeof SourceKind.HTML_INDEX;
  selector: 'a[href]';
  frequencyMinutes: number;
  sourceStatus: typeof SourceStatus.DRAFT;
  collectionAllowed: false;
  permissionStatus: 'PENDING_REVIEW';
}

/**
 * Offline connector definitions only. Source policy and terms are pending review, so these
 * definitions must not activate a scheduler or perform network requests.
 */
export const PILOT_HTML_CONNECTORS = [
  {
    institutionCode: 'UFPB',
    sourceUrl: 'https://www.prg.ufpb.br/editais/ingressantes/',
    exactHost: 'www.prg.ufpb.br',
    sourceKind: SourceKind.HTML_INDEX,
    selector: 'a[href]',
    frequencyMinutes: 1_440,
    sourceStatus: SourceStatus.DRAFT,
    collectionAllowed: false,
    permissionStatus: 'PENDING_REVIEW',
  },
  {
    institutionCode: 'UFCG',
    sourceUrl: 'https://comprov.ufcg.edu.br/graduacao.html',
    exactHost: 'comprov.ufcg.edu.br',
    sourceKind: SourceKind.HTML_INDEX,
    selector: 'a[href]',
    frequencyMinutes: 1_440,
    sourceStatus: SourceStatus.DRAFT,
    collectionAllowed: false,
    permissionStatus: 'PENDING_REVIEW',
  },
] as const satisfies readonly HtmlInstitutionConnector[];

export function getPilotHtmlConnector(code: PilotInstitutionCode): HtmlInstitutionConnector {
  const connector = PILOT_HTML_CONNECTORS.find((candidate) => candidate.institutionCode === code);
  if (!connector) throw new Error(`No HTML connector configured for ${code}`);
  return connector;
}

/** Parses caller-supplied or fixture HTML; this function never fetches a source. */
export function parseInstitutionIndexHtml(
  code: PilotInstitutionCode,
  html: string,
): DiscoveredLinkCandidate[] {
  const connector = getPilotHtmlConnector(code);
  const sourceHost = new URL(connector.sourceUrl).hostname.toLowerCase();
  if (sourceHost !== connector.exactHost) {
    throw new Error(`Connector source must use its exact host: ${connector.exactHost}`);
  }
  if (connector.selector !== 'a[href]') {
    throw new Error(`Unsupported connector selector: ${connector.selector}`);
  }

  return parseHtmlLinkCandidates(html, connector.sourceUrl, [connector.exactHost]);
}
