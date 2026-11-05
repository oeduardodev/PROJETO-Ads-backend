import { createHash } from 'node:crypto';
import { HttpFetchError } from '../../crawling/http/responsible-http.client.js';
import type {
  HttpResponse,
  ResponsibleHttpClient,
} from '../../crawling/http/responsible-http.client.js';
import { normalizeSourceUrl } from '../../sources/source-url.js';

export type DocumentMediaType = 'text/html' | 'application/pdf';
export type DocumentFetchFailureCode =
  | 'INVALID_SOURCE_URL'
  | 'SOURCE_BLOCKED'
  | 'SOURCE_POLICY'
  | 'SOURCE_UNAVAILABLE'
  | 'SOURCE_FETCH_FAILED'
  | 'HTTP_STATUS'
  | 'SIZE_LIMIT'
  | 'EMPTY_BODY'
  | 'UNSUPPORTED_MEDIA'
  | 'MIME_MISMATCH';

export interface FetchedArtifact {
  sourceUrl: string;
  mediaType: DocumentMediaType;
  sha256: string;
  byteLength: number;
  capturedAt: Date;
  etag?: string;
  lastModified?: string;
  bytes: Buffer;
}

export interface FetchArtifactOptions {
  maxBytes: number;
  capturedAt?: Date;
}

export class DocumentFetchError extends Error {
  constructor(
    readonly sourceUrl: string,
    readonly failureCode: DocumentFetchFailureCode,
    message: string,
    readonly httpStatus?: number,
    options?: ErrorOptions,
  ) {
    super(`Document fetch failed (${failureCode}): ${message}`, options);
    this.name = 'DocumentFetchError';
  }
}

type FetchClient = Pick<ResponsibleHttpClient, 'fetch'>;

function mapFetchFailure(error: unknown): DocumentFetchFailureCode {
  if (!(error instanceof HttpFetchError)) return 'SOURCE_FETCH_FAILED';
  if (error.code === 'SIZE') return 'SIZE_LIMIT';
  if (error.code === 'ROBOTS' || error.status === 401 || error.status === 403) {
    return 'SOURCE_BLOCKED';
  }
  if (error.code === 'SSRF' || error.code === 'POLICY') return 'SOURCE_POLICY';
  if (
    error.code === 'NETWORK' ||
    error.code === 'TIMEOUT' ||
    error.status === 429 ||
    (error.status !== undefined && error.status >= 500)
  ) {
    return 'SOURCE_UNAVAILABLE';
  }
  return 'SOURCE_FETCH_FAILED';
}

function sniffMediaType(bytes: Buffer): DocumentMediaType | undefined {
  const header = bytes.subarray(0, 1_024).toString('latin1');
  if (header.includes('%PDF-')) return 'application/pdf';

  let prefix = bytes
    .subarray(0, 4_096)
    .toString('utf8')
    .replace(/^\uFEFF/u, '')
    .trimStart();
  while (prefix.startsWith('<!--')) {
    const end = prefix.indexOf('-->');
    if (end < 0) return undefined;
    prefix = prefix.slice(end + 3).trimStart();
  }
  prefix = prefix.toLowerCase();
  if (/^(?:<!doctype\s+html\b|<html(?:\s|>)|<head(?:\s|>)|<body(?:\s|>))/u.test(prefix)) {
    return 'text/html';
  }
  return undefined;
}

function declaredMediaType(
  response: HttpResponse,
  sourceUrl: string,
): DocumentMediaType | undefined {
  const declared = response.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase();
  if (!declared || declared === 'application/octet-stream' || declared === 'binary/octet-stream') {
    return undefined;
  }
  if (declared === 'text/html' || declared === 'application/xhtml+xml') return 'text/html';
  if (declared === 'application/pdf') return 'application/pdf';
  throw new DocumentFetchError(
    sourceUrl,
    'UNSUPPORTED_MEDIA',
    `Unsupported declared MIME type: ${declared}`,
    response.status,
  );
}

function extensionMediaType(sourceUrl: string): DocumentMediaType | undefined {
  const pathname = new URL(sourceUrl).pathname.toLowerCase();
  if (/\.pdf$/u.test(pathname)) return 'application/pdf';
  if (/\.(?:html?|xhtml)$/u.test(pathname)) return 'text/html';
  return undefined;
}

export async function fetchTypedArtifact(
  client: FetchClient,
  sourceUrl: string,
  options: FetchArtifactOptions,
): Promise<FetchedArtifact> {
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes < 1) {
    throw new Error('maxBytes must be a positive safe integer');
  }
  const capturedAt = options.capturedAt ?? new Date();
  if (!Number.isFinite(capturedAt.getTime())) throw new Error('capturedAt must be a valid date');

  let canonicalUrl: string;
  try {
    canonicalUrl = normalizeSourceUrl(sourceUrl).url;
  } catch (error) {
    throw new DocumentFetchError(
      '[invalid-source-url]',
      'INVALID_SOURCE_URL',
      'The source URL must be a public HTTPS URL',
      undefined,
      { cause: error },
    );
  }

  let response: HttpResponse;
  try {
    response = await client.fetch(canonicalUrl);
  } catch (error) {
    const failureCode = mapFetchFailure(error);
    const httpStatus = error instanceof HttpFetchError ? error.status : undefined;
    throw new DocumentFetchError(
      canonicalUrl,
      failureCode,
      'The responsible HTTP client did not return an artifact',
      httpStatus,
      { cause: error },
    );
  }

  if (response.status !== 200) {
    throw new DocumentFetchError(
      canonicalUrl,
      'HTTP_STATUS',
      'Only a complete HTTP 200 response can be stored',
      response.status,
    );
  }
  if (response.body.byteLength < 1) {
    throw new DocumentFetchError(canonicalUrl, 'EMPTY_BODY', 'The response body is empty', 200);
  }
  if (response.body.byteLength > options.maxBytes) {
    throw new DocumentFetchError(
      canonicalUrl,
      'SIZE_LIMIT',
      'The response exceeds the byte limit',
      200,
    );
  }

  const bytes = Buffer.from(response.body);
  const mediaType = sniffMediaType(bytes);
  if (!mediaType) {
    throw new DocumentFetchError(
      canonicalUrl,
      'UNSUPPORTED_MEDIA',
      'The response bytes are neither recognizable HTML nor PDF',
      200,
    );
  }

  const declared = declaredMediaType(response, canonicalUrl);
  const extensionType = extensionMediaType(canonicalUrl);
  if ((declared && declared !== mediaType) || (extensionType && extensionType !== mediaType)) {
    throw new DocumentFetchError(
      canonicalUrl,
      'MIME_MISMATCH',
      'Declared MIME type, URL extension, and detected content do not agree',
      200,
    );
  }

  return {
    sourceUrl: canonicalUrl,
    mediaType,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    byteLength: bytes.byteLength,
    capturedAt,
    etag: response.headers.etag,
    lastModified: response.headers['last-modified'],
    bytes,
  };
}
