import { SourceKind, SourceStatus } from '../../../generated/prisma/enums.js';
import type { DiscoveredLinkCandidate } from '../parsers/html-link.parser.js';
import { parseHtmlLinkCandidates } from '../parsers/html-link.parser.js';
import { IFPB_CONNECTOR, parseIfpbEditaisHtml } from './ifpb.connector.js';
import { parseUepbIndexHtml, UEPB_CONNECTOR } from './uepb.connector.js';
import type { HtmlInstitutionConnector, PilotInstitutionCode } from './connector.types.js';

export type { HtmlInstitutionConnector, PilotInstitutionCode } from './connector.types.js';

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
    accessReview: 'TERMS_PENDING',
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
    accessReview: 'LICENSE_RETENTION_PENDING',
  },
  UEPB_CONNECTOR,
  IFPB_CONNECTOR,
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
  if (code === 'UEPB') return parseUepbIndexHtml(html);
  if (code === 'IFPB') return parseIfpbEditaisHtml(html);
  const sourceHost = new URL(connector.sourceUrl).hostname.toLowerCase();
  if (sourceHost !== connector.exactHost || connector.selector !== 'a[href]') {
    throw new Error(`Invalid HTML connector configuration for ${code}`);
  }

  return parseHtmlLinkCandidates(html, connector.sourceUrl, [connector.exactHost]);
}

export type ConnectorRunStatus = 'SUCCEEDED' | 'FAILED';

export interface ConnectorRunResult {
  institutionCode: PilotInstitutionCode;
  sourceUrl: string;
  status: ConnectorRunStatus;
  lastCheckedAt: Date;
  lastSuccessAt?: Date;
  metrics: { candidatesDiscovered: number };
  candidates: DiscoveredLinkCandidate[];
  failureCode?: 'CONNECTOR_PARSE_FAILED';
}

/** Offline run summary for metrics and source traceability; does not persist or fetch. */
export function executeInstitutionConnector(
  code: PilotInstitutionCode,
  html: string,
  checkedAt = new Date(),
): ConnectorRunResult {
  if (!Number.isFinite(checkedAt.getTime())) throw new Error('Connector check date must be valid');
  const connector = getPilotHtmlConnector(code);
  try {
    const candidates = parseInstitutionIndexHtml(code, html);
    return {
      institutionCode: code,
      sourceUrl: connector.sourceUrl,
      status: 'SUCCEEDED',
      lastCheckedAt: checkedAt,
      lastSuccessAt: checkedAt,
      metrics: { candidatesDiscovered: candidates.length },
      candidates,
    };
  } catch {
    return {
      institutionCode: code,
      sourceUrl: connector.sourceUrl,
      status: 'FAILED',
      lastCheckedAt: checkedAt,
      metrics: { candidatesDiscovered: 0 },
      candidates: [],
      failureCode: 'CONNECTOR_PARSE_FAILED',
    };
  }
}
