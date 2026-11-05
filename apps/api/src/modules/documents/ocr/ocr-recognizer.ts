import { createCanvas } from '@napi-rs/canvas';
import { createRequire } from 'node:module';
import { createWorker } from 'tesseract.js';
import { openLocalPdf } from '../parsers/pdf/pdfjs-local.js';
import { OCR_PIPELINE_VERSION } from './ocr-budget.store.js';

export const DEFAULT_OCR_MAX_PIXELS_PER_PAGE = 18_000_000;
export const DEFAULT_OCR_TIMEOUT_MS = 60_000;
export const OCR_RENDER_SCALE = 2;

interface PortugueseModelPackage {
  code: string;
  gzip: boolean;
  langPath: string;
}

const portugueseModel = createRequire(import.meta.url)('@tesseract.js-data/por') as
  PortugueseModelPackage | undefined;

export interface OcrRecognitionLimits {
  maxBytes: number;
  maxPages: number;
  maxPixelsPerPage?: number;
  timeoutMs?: number;
}

export interface OcrPageText {
  pageNumber: number;
  text: string;
  confidence: number;
  language: 'por';
  engine: 'tesseract.js';
  engineVersion: string;
  pipelineVersion: number;
}

export type OcrRecognitionFailureCode =
  | 'INVALID_INPUT'
  | 'BYTE_LIMIT'
  | 'PAGE_LIMIT'
  | 'PAGE_NOT_FOUND'
  | 'PIXEL_LIMIT'
  | 'TIMEOUT'
  | 'MODEL_UNAVAILABLE'
  | 'RECOGNITION_FAILED';

export class OcrRecognitionError extends Error {
  constructor(
    readonly failureCode: OcrRecognitionFailureCode,
    message: string,
  ) {
    super(`OCR failed (${failureCode}): ${message}`);
    this.name = 'OcrRecognitionError';
  }
}

function validatePositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new OcrRecognitionError('INVALID_INPUT', `${name} must be a positive safe integer`);
  }
}

function validateLimits(limits: OcrRecognitionLimits): Required<OcrRecognitionLimits> {
  const resolved = {
    maxBytes: limits.maxBytes,
    maxPages: limits.maxPages,
    maxPixelsPerPage: limits.maxPixelsPerPage ?? DEFAULT_OCR_MAX_PIXELS_PER_PAGE,
    timeoutMs: limits.timeoutMs ?? DEFAULT_OCR_TIMEOUT_MS,
  };
  for (const [name, value] of Object.entries(resolved)) validatePositiveInteger(value, name);
  return resolved;
}

export async function recognizePdfPage(
  bytes: Uint8Array,
  pageNumber: number,
  limits: OcrRecognitionLimits,
): Promise<OcrPageText> {
  const resolvedLimits = validateLimits(limits);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    throw new OcrRecognitionError('INVALID_INPUT', 'Expected nonempty PDF bytes');
  }
  if (bytes.byteLength > resolvedLimits.maxBytes) {
    throw new OcrRecognitionError('BYTE_LIMIT', 'The PDF exceeds the byte limit');
  }
  validatePositiveInteger(pageNumber, 'pageNumber');
  if (!portugueseModel || portugueseModel.code !== 'por' || !portugueseModel.langPath) {
    throw new OcrRecognitionError(
      'MODEL_UNAVAILABLE',
      'The packaged Portuguese model is unavailable',
    );
  }

  const task = openLocalPdf(bytes);
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  let workerCreation: Promise<Awaited<ReturnType<typeof createWorker>>> | undefined;
  let termination: Promise<void> | undefined;
  let destruction: Promise<void> | undefined;
  const stopWorker = (): Promise<void> => {
    if (!worker) return Promise.resolve();
    termination ??= worker.terminate().then(() => undefined);
    return termination;
  };
  const destroyTask = (): Promise<void> => {
    destruction ??= task.destroy().then(() => undefined);
    return destruction;
  };

  const abortController = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  let rejectTimeout: ((error: OcrRecognitionError) => void) | undefined;
  const timeout = new Promise<never>((_, reject) => {
    rejectTimeout = reject;
    timer = setTimeout(() => {
      abortController.abort();
      rejectTimeout?.(new OcrRecognitionError('TIMEOUT', 'The OCR job exceeded its time limit'));
    }, resolvedLimits.timeoutMs);
  });
  const stopOnAbort = () => {
    void destroyTask().catch(() => undefined);
    void stopWorker().catch(() => undefined);
  };
  abortController.signal.addEventListener('abort', stopOnAbort, { once: true });

  const operation = async (): Promise<OcrPageText> => {
    try {
      const document = await task.promise;
      if (document.numPages > resolvedLimits.maxPages) {
        throw new OcrRecognitionError('PAGE_LIMIT', 'The PDF exceeds the page limit');
      }
      if (pageNumber > document.numPages) {
        throw new OcrRecognitionError('PAGE_NOT_FOUND', 'The requested page is not in the PDF');
      }

      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });
      const width = Math.ceil(viewport.width);
      const height = Math.ceil(viewport.height);
      const pixelCount = width * height;
      if (
        !Number.isSafeInteger(pixelCount) ||
        width < 1 ||
        height < 1 ||
        pixelCount > resolvedLimits.maxPixelsPerPage
      ) {
        page.cleanup();
        throw new OcrRecognitionError('PIXEL_LIMIT', 'The rendered page exceeds the pixel limit');
      }

      const canvas = createCanvas(width, height);
      const context = canvas.getContext('2d');
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;
      page.cleanup();

      workerCreation = createWorker('por', 1, {
        langPath: portugueseModel.langPath,
        gzip: portugueseModel.gzip,
        cacheMethod: 'none',
        logger: () => undefined,
      });
      void workerCreation
        .then((created) => {
          worker = created;
          if (abortController.signal.aborted) return stopWorker();
          return undefined;
        })
        .catch(() => undefined);
      worker = await workerCreation;
      if (abortController.signal.aborted) {
        throw new OcrRecognitionError('TIMEOUT', 'The OCR job exceeded its time limit');
      }
      const { data } = await worker.recognize(canvas.toBuffer('image/png'));
      if (abortController.signal.aborted) {
        throw new OcrRecognitionError('TIMEOUT', 'The OCR job exceeded its time limit');
      }
      return {
        pageNumber,
        text: data.text,
        confidence: data.confidence,
        language: 'por',
        engine: 'tesseract.js',
        engineVersion: data.version,
        pipelineVersion: OCR_PIPELINE_VERSION,
      };
    } catch (error) {
      if (error instanceof OcrRecognitionError) throw error;
      throw new OcrRecognitionError('RECOGNITION_FAILED', 'The PDF page could not be recognized');
    }
  };

  try {
    return await Promise.race([operation(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    abortController.signal.removeEventListener('abort', stopOnAbort);
    await Promise.allSettled([destroyTask(), stopWorker()]);
  }
}
