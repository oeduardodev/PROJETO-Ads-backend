import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument, PasswordException, VerbosityLevel } from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface PdfTextSegment {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfTextLine {
  lineNumber: number;
  text: string;
  segments: PdfTextSegment[];
}

export interface PdfSectionCandidate {
  title: string;
  lineNumber: number;
}

export interface PdfTextQuality {
  usefulCharacters: number;
  replacementCharacters: number;
  textItems: number;
  hasTextLayer: boolean;
}

export interface PdfPageText {
  pageNumber: number;
  rotationDegrees: number;
  text: string;
  lines: PdfTextLine[];
  sectionCandidates: PdfSectionCandidate[];
  quality: PdfTextQuality;
}

export interface ParsedPdfText {
  pageCount: number;
  pages: PdfPageText[];
  quality: {
    usefulCharacters: number;
    replacementCharacters: number;
    pagesWithoutText: number;
  };
}

export interface PdfParseLimits {
  maxBytes: number;
  maxPages: number;
  maxTextItemsPerPage: number;
}

export type PdfParseFailureCode =
  | 'INVALID_INPUT'
  | 'BYTE_LIMIT'
  | 'PAGE_LIMIT'
  | 'TEXT_ITEM_LIMIT'
  | 'PASSWORD_PROTECTED'
  | 'INVALID_LAYOUT'
  | 'PARSE_FAILED';

export class PdfParseError extends Error {
  constructor(
    readonly failureCode: PdfParseFailureCode,
    message: string,
    readonly pageNumber?: number,
  ) {
    super(`PDF parse failed (${failureCode}): ${message}`);
    this.name = 'PdfParseError';
  }
}

const packageDirectory = dirname(fileURLToPath(import.meta.resolve('pdfjs-dist/package.json')));

function assetDirectory(name: string): string {
  return `${join(packageDirectory, name).replaceAll('\\', '/')}/`;
}

function validateLimits(limits: PdfParseLimits): void {
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new Error(`${name} must be a positive safe integer`);
    }
  }
}

function cleanText(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

function hasHeadingShape(text: string): boolean {
  const letters = [...text.matchAll(/\p{L}/gu)].map((match) => match[0]);
  return (
    text.length <= 120 &&
    letters.length >= 3 &&
    letters.every((letter) => letter === letter.toLocaleUpperCase('pt-BR'))
  );
}

function lineText(segments: PdfTextSegment[]): string {
  let result = '';
  let previous: PdfTextSegment | undefined;
  for (const segment of segments) {
    if (previous) {
      const gap = segment.x - previous.x - previous.width;
      if (gap > Math.max(3, previous.height * 0.3)) result += '  ';
      else if (gap > 0.5) result += ' ';
    }
    result += segment.text;
    previous = segment;
  }
  return result;
}

function groupLines(segments: PdfTextSegment[]): PdfTextLine[] {
  const ordered = [...segments].sort((left, right) => right.y - left.y || left.x - right.x);
  const groups: PdfTextSegment[][] = [];
  for (const segment of ordered) {
    const group = groups.at(-1);
    if (group && Math.abs(group[0]!.y - segment.y) <= 2) group.push(segment);
    else groups.push([segment]);
  }
  return groups.map((group, index) => {
    group.sort((left, right) => left.x - right.x);
    return { lineNumber: index + 1, text: lineText(group), segments: group };
  });
}

function textQuality(lines: PdfTextLine[]): PdfTextQuality {
  const text = lines.map((line) => line.text).join('\n');
  const usefulCharacters = [...text.matchAll(/[\p{L}\p{N}]/gu)].length;
  return {
    usefulCharacters,
    replacementCharacters: [...text.matchAll(/\uFFFD/gu)].length,
    textItems: lines.reduce((total, line) => total + line.segments.length, 0),
    hasTextLayer: usefulCharacters > 0,
  };
}

export async function parsePdfText(
  bytes: Uint8Array,
  limits: PdfParseLimits,
): Promise<ParsedPdfText> {
  validateLimits(limits);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    throw new PdfParseError('INVALID_INPUT', 'Expected nonempty PDF bytes');
  }
  if (bytes.byteLength > limits.maxBytes) {
    throw new PdfParseError('BYTE_LIMIT', 'The PDF exceeds the byte limit');
  }

  const task = getDocument({
    data: new Uint8Array(bytes),
    cMapUrl: assetDirectory('cmaps'),
    cMapPacked: true,
    standardFontDataUrl: assetDirectory('standard_fonts'),
    wasmUrl: assetDirectory('wasm'),
    useSystemFonts: false,
    useWorkerFetch: false,
    stopAtErrors: true,
    verbosity: VerbosityLevel.ERRORS,
  });
  try {
    const document = await task.promise;
    if (document.numPages > limits.maxPages) {
      throw new PdfParseError('PAGE_LIMIT', 'The PDF exceeds the page limit');
    }

    const pages: PdfPageText[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      if (content.items.length > limits.maxTextItemsPerPage) {
        throw new PdfParseError(
          'TEXT_ITEM_LIMIT',
          'The page exceeds the text item limit',
          pageNumber,
        );
      }

      const segments: PdfTextSegment[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const text = cleanText(item.str);
        if (!text) continue;
        const [x, y] = [item.transform[4], item.transform[5]];
        if (
          typeof x !== 'number' ||
          typeof y !== 'number' ||
          !Number.isFinite(x) ||
          !Number.isFinite(y) ||
          !Number.isFinite(item.width) ||
          !Number.isFinite(item.height)
        ) {
          throw new PdfParseError(
            'INVALID_LAYOUT',
            'A text item has invalid coordinates',
            pageNumber,
          );
        }
        segments.push({ text, x, y, width: item.width, height: item.height });
      }

      const lines = groupLines(segments);
      pages.push({
        pageNumber,
        rotationDegrees: page.rotate,
        text: lines.map((line) => line.text).join('\n'),
        lines,
        sectionCandidates: lines
          .filter((line) => hasHeadingShape(line.text))
          .map((line) => ({ title: line.text, lineNumber: line.lineNumber })),
        quality: textQuality(lines),
      });
      page.cleanup();
    }

    return {
      pageCount: document.numPages,
      pages,
      quality: {
        usefulCharacters: pages.reduce((total, page) => total + page.quality.usefulCharacters, 0),
        replacementCharacters: pages.reduce(
          (total, page) => total + page.quality.replacementCharacters,
          0,
        ),
        pagesWithoutText: pages.filter((page) => !page.quality.hasTextLayer).length,
      },
    };
  } catch (error) {
    if (error instanceof PdfParseError) throw error;
    if (error instanceof PasswordException) {
      throw new PdfParseError('PASSWORD_PROTECTED', 'The PDF requires a password');
    }
    throw new PdfParseError('PARSE_FAILED', 'The PDF could not be parsed');
  } finally {
    await task.destroy();
  }
}
