import { SourceKind, SourceStatus } from '../../../generated/prisma/enums.js';
import type { DiscoveredLinkCandidate } from '../parsers/html-link.parser.js';
import { parseConfiguredHtml } from './connector-parser.js';
import type { HtmlInstitutionConnector } from './connector.types.js';

export const UEPB_CONNECTOR = {
  institutionCode: 'UEPB',
  sourceUrl: 'https://uepb.edu.br/prograd/processos-seletivos/',
  exactHost: 'uepb.edu.br',
  sourceKind: SourceKind.HTML_INDEX,
  selector: 'a[href]',
  frequencyMinutes: 1_440,
  sourceStatus: SourceStatus.DRAFT,
  collectionAllowed: false,
  permissionStatus: 'PENDING_REVIEW',
  accessReview: 'ROBOTS_403_MANUAL_ONLY',
} as const satisfies HtmlInstitutionConnector;

/** Isolated because the reviewed robots endpoint returned 403; no automated fetch is allowed. */
export function parseUepbIndexHtml(html: string): DiscoveredLinkCandidate[] {
  return parseConfiguredHtml(UEPB_CONNECTOR, html);
}
