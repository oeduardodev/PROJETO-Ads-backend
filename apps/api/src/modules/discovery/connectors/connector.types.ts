import type { SourceKind, SourceStatus } from '../../../generated/prisma/enums.js';

export type PilotInstitutionCode = 'UFPB' | 'UFCG' | 'UEPB' | 'IFPB';
export type ConnectorAccessReview =
  'TERMS_PENDING' | 'LICENSE_RETENTION_PENDING' | 'ROBOTS_403_MANUAL_ONLY';

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
  accessReview: ConnectorAccessReview;
}
