import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DocumentParserKind, SourceStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../database/prisma.service.js';
import { FixtureLocalStorage } from '../documents/fixture-local-storage.js';
import { ParserCacheRepository } from '../documents/cache/parser-cache.repository.js';
import {
  normalizeHtmlDocument,
  HTML_DOCUMENT_PARSER_VERSION,
} from '../documents/parsers/html/html-document.parser.js';
import { parsePdfText, PDF_TEXT_PARSER_VERSION } from '../documents/parsers/pdf/pdf-text.parser.js';
import { normalizeSourceUrl } from '../sources/source-url.js';

const MAX_HTML_CHARACTERS = 1_000_000;
const MAX_PDF_PAGES = 200;
const MAX_PDF_TEXT_ITEMS_PER_PAGE = 20_000;
const MAX_EXCERPTS = 20;
const MAX_EXCERPT_CHARACTERS = 4_000;

export interface DocumentExcerpt {
  pageOrSection: string;
  text: string;
}

export interface ParsedDocumentContent {
  title: string;
  excerpts: DocumentExcerpt[];
}

function isExactAuthorizedHost(
  source: {
    status: SourceStatus;
    allowedDomain: { host: string; reviewedAt: Date | null; collectionAllowed: boolean };
  },
  host: string,
): boolean {
  return (
    source.status === SourceStatus.ACTIVE &&
    source.allowedDomain.collectionAllowed &&
    source.allowedDomain.reviewedAt !== null &&
    source.allowedDomain.host === host
  );
}

function clip(text: string): string {
  return text.trim().slice(0, MAX_EXCERPT_CHARACTERS);
}

@Injectable()
export class DocumentProcessingContentService {
  constructor(
    private readonly database: PrismaService,
    private readonly parserCache: ParserCacheRepository,
  ) {}

  async parseFixture(documentId: string, expectedSha256: string): Promise<ParsedDocumentContent> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Official snapshots require a reviewed retention policy and storage adapter');
    }
    const document = await this.database.document.findUnique({
      where: { id: documentId },
      include: {
        discoveredUrl: {
          include: {
            observations: {
              include: { source: { include: { allowedDomain: true } } },
            },
          },
        },
      },
    });
    if (!document) throw new Error('Document does not exist');
    if (document.sha256 !== expectedSha256.toLowerCase()) {
      throw new Error('Document hash does not match the job payload');
    }
    if (!document.url.startsWith('fixture://local/')) {
      throw new Error('Only local test fixtures can be parsed');
    }
    if (!document.discoveredUrl) throw new Error('Fixture is missing discovery provenance');

    const canonical = normalizeSourceUrl(document.discoveredUrl.canonicalUrl);
    const allowedHosts = [
      ...new Set(
        document.discoveredUrl.observations
          .filter((observation) => isExactAuthorizedHost(observation.source, canonical.host))
          .map((observation) => observation.source.allowedDomain.host),
      ),
    ];
    if (!allowedHosts.includes(canonical.host)) {
      throw new Error('Fixture host has no active, reviewed exact-host authorization');
    }

    const storage = new FixtureLocalStorage(
      join(tmpdir(), 'alem-do-sisu-worker-fixtures', String(process.pid)),
    );
    const bytes = await storage.read(document.storageKey);
    const actualSha256 = createHash('sha256').update(bytes).digest('hex');
    if (actualSha256 !== document.sha256)
      throw new Error('Fixture bytes do not match document hash');

    if (document.mediaType === 'text/html') {
      const parsed = await this.parserCache.getOrCompute(
        {
          sha256: document.sha256,
          parserKind: DocumentParserKind.HTML_DOCUMENT,
          parserVersion: HTML_DOCUMENT_PARSER_VERSION,
        },
        async () =>
          normalizeHtmlDocument(
            new TextDecoder('utf-8', { fatal: true }).decode(bytes),
            canonical.url,
            allowedHosts,
            MAX_HTML_CHARACTERS,
          ),
      );
      const excerpts = parsed.result.sections
        .map((section, index) => ({
          pageOrSection: section.heading ?? `seção ${index + 1}`,
          text: clip([section.heading, section.text].filter(Boolean).join('\n')),
        }))
        .filter((item) => item.text)
        .slice(0, MAX_EXCERPTS);
      return {
        title: parsed.result.title?.trim() || 'Documento HTML sem título identificado',
        excerpts,
      };
    }

    if (document.mediaType === 'application/pdf') {
      const parsed = await this.parserCache.getOrCompute(
        {
          sha256: document.sha256,
          parserKind: DocumentParserKind.PDF_TEXT,
          parserVersion: PDF_TEXT_PARSER_VERSION,
        },
        () =>
          parsePdfText(bytes, {
            maxBytes: 1024 * 1024,
            maxPages: MAX_PDF_PAGES,
            maxTextItemsPerPage: MAX_PDF_TEXT_ITEMS_PER_PAGE,
          }),
      );
      const excerpts = parsed.result.pages
        .map((page) => ({ pageOrSection: `página ${page.pageNumber}`, text: clip(page.text) }))
        .filter((item) => item.text)
        .slice(0, MAX_EXCERPTS);
      return { title: 'Documento PDF', excerpts };
    }

    throw new Error('Unsupported fixture media type');
  }
}
