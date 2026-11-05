import type { JobsService } from '../../jobs/jobs.service.js';
import type { ParsedPdfText } from '../parsers/pdf/pdf-text.parser.js';
import {
  OCR_PIPELINE_VERSION,
  validateOcrPageIdentity,
  type OcrBudgetStore,
} from './ocr-budget.store.js';
import { findOcrCandidatePages } from './ocr-eligibility.js';

export interface OcrAdmissionOptions {
  dailyPageBudget: number;
  maxPagesPerDocument: number;
  now?: Date;
}

export interface OcrAdmissionResult {
  candidatePages: number[];
  queuedPages: number[];
  budgetDeferredPages: number[];
  pageLimitSkipped: number[];
}

type OcrJobEnqueuer = Pick<JobsService, 'enqueueDocumentOcr'>;

export async function enqueueOcrFallback(
  bytes: Uint8Array,
  parsed: ParsedPdfText,
  documentId: string,
  sha256: string,
  budget: OcrBudgetStore,
  jobs: OcrJobEnqueuer,
  options: OcrAdmissionOptions,
): Promise<OcrAdmissionResult> {
  if (!Number.isSafeInteger(options.dailyPageBudget) || options.dailyPageBudget < 0) {
    throw new Error('dailyPageBudget must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(options.maxPagesPerDocument) || options.maxPagesPerDocument < 1) {
    throw new Error('maxPagesPerDocument must be a positive safe integer');
  }
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error('now must be a valid date');

  const candidatePages = await findOcrCandidatePages(bytes, parsed);
  const admittedCandidates = candidatePages.slice(0, options.maxPagesPerDocument);
  const result: OcrAdmissionResult = {
    candidatePages,
    queuedPages: [],
    budgetDeferredPages: [],
    pageLimitSkipped: candidatePages.slice(options.maxPagesPerDocument),
  };
  if (options.dailyPageBudget === 0) {
    result.budgetDeferredPages = admittedCandidates;
    return result;
  }

  for (const pageNumber of admittedCandidates) {
    const identity = validateOcrPageIdentity({
      documentId,
      sha256,
      pageNumber,
      pipelineVersion: OCR_PIPELINE_VERSION,
    });
    const reservation = await budget.tryReserve(identity, options.dailyPageBudget, now);
    if (reservation === 'EXHAUSTED') {
      result.budgetDeferredPages.push(pageNumber);
      continue;
    }
    await jobs.enqueueDocumentOcr(identity);
    result.queuedPages.push(pageNumber);
  }
  return result;
}
