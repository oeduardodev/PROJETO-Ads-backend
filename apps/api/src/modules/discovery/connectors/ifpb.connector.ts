import { SourceKind, SourceStatus } from '../../../generated/prisma/enums.js';
import type { DiscoveredLinkCandidate } from '../parsers/html-link.parser.js';
import { parseConfiguredHtml } from './connector-parser.js';
import type { HtmlInstitutionConnector } from './connector.types.js';

export const IFPB_CONNECTOR = {
  institutionCode: 'IFPB',
  sourceUrl: 'https://estudante.ifpb.edu.br/editais/',
  exactHost: 'estudante.ifpb.edu.br',
  sourceKind: SourceKind.HTML_INDEX,
  selector: 'a[href]',
  frequencyMinutes: 1_440,
  sourceStatus: SourceStatus.DRAFT,
  collectionAllowed: false,
  permissionStatus: 'PENDING_REVIEW',
  accessReview: 'TERMS_PENDING',
} as const satisfies HtmlInstitutionConnector;

/** Isolated because the portal mixes graduation, technical, postgraduate, and SiSU notices. */
export function parseIfpbEditaisHtml(html: string): DiscoveredLinkCandidate[] {
  return parseConfiguredHtml(IFPB_CONNECTOR, html);
}
