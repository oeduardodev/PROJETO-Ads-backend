import { OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { ParsedPdfText } from '../parsers/pdf/pdf-text.parser.js';
import { openLocalPdf } from '../parsers/pdf/pdfjs-local.js';

export const MIN_USEFUL_CHARACTERS_FOR_TEXT = 40;

const IMAGE_OPERATORS = new Set([
  OPS.paintImageXObject,
  OPS.paintInlineImageXObject,
  OPS.paintImageXObjectRepeat,
  OPS.paintInlineImageXObjectGroup,
  OPS.paintImageMaskXObject,
  OPS.paintImageMaskXObjectGroup,
  OPS.paintImageMaskXObjectRepeat,
]);

export async function findOcrCandidatePages(
  bytes: Uint8Array,
  parsed: ParsedPdfText,
): Promise<number[]> {
  const task = openLocalPdf(bytes);
  try {
    const document = await task.promise;
    if (document.numPages !== parsed.pageCount || parsed.pages.length !== parsed.pageCount) {
      throw new Error('PDF page count changed between text extraction and OCR planning');
    }
    const candidates: number[] = [];
    for (const extractedPage of parsed.pages) {
      const pageNumber = extractedPage.pageNumber;
      if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > document.numPages) {
        throw new Error('Invalid PDF page reference in OCR planning');
      }
      if (extractedPage.quality.usefulCharacters >= MIN_USEFUL_CHARACTERS_FOR_TEXT) continue;
      const page = await document.getPage(pageNumber);
      const operators = await page.getOperatorList();
      if (operators.fnArray.some((operator) => IMAGE_OPERATORS.has(operator))) {
        candidates.push(pageNumber);
      }
      page.cleanup();
    }
    return candidates;
  } finally {
    await task.destroy();
  }
}
