import type { AiProviderService } from '../provider/ai-provider.service.js';
import { ExtractionV1, ExtractionV1JsonSchema } from '../schemas/index.js';
import type { z } from 'zod';
import { EXTRACTION_PROMPT_V1, EXTRACTION_PROMPT_VERSION } from './extraction-prompt.v1.js';

export interface ExtractionSource {
  documentId: string;
  pageOrSection: string;
  text: string;
}

export interface ExtractionRequest {
  documentId: string;
  institutionId: string;
  requestId: string;
  sources: readonly ExtractionSource[];
  maxInputTokens: number;
  maxOutputTokens: number;
}

export type ExtractionIssue =
  'INVALID_SCHEMA' | 'INSTITUTION_MISMATCH' | 'UNVERIFIABLE_EVIDENCE' | 'UNSUPPORTED_VALUE';

export type ExtractionOutcome =
  | {
      status: 'EXTRACTED';
      promptVersion: typeof EXTRACTION_PROMPT_VERSION;
      data: z.infer<typeof ExtractionV1>;
      issues: [];
    }
  | {
      status: 'PENDING_REVIEW';
      promptVersion: typeof EXTRACTION_PROMPT_VERSION;
      data: null;
      issues: ExtractionIssue[];
    };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SELECTION_TYPE_MARKERS: Record<string, RegExp> = {
  GRADUATE_ENTRY: /\bingresso de graduados\b|\bportador de diploma\b/u,
  TRANSFER: /\btransferencia\b/u,
  COURSE_CHANGE: /\breopcao\b|\bmudanca de curso\b/u,
  SPECIFIC_KNOWLEDGE: /\bconhecimento especifico\b/u,
  REMAINING_SEATS: /\bvagas remanescentes\b|\bvagas nao preenchidas\b/u,
  FIELD_EDUCATION: /\beducacao do campo\b/u,
  ENEM_OWN_SELECTION: /\bselecao propria\b.{0,100}\benem\b|\benem\b.{0,100}\bselecao propria\b/u,
  SCHOOL_RECORD: /\bhistorico escolar\b|\bnota do ensino medio\b/u,
  OLYMPIAD_ENTRY: /\bolimpiad/u,
  PRONERA_GRADUATION: /\bpronera\b/u,
  SISU: /\bsisu regular\b|\bsistema de selecao unificada\b/u,
  SISU_PLUS: /\bsisu plus\b|\betapa complementar do sisu\b/u,
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\bsisu\s*\+/gu, 'sisu plus')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function validateRequest(request: ExtractionRequest): void {
  if (!UUID.test(request.documentId) || !UUID.test(request.institutionId)) {
    throw new TypeError('documentId and institutionId must be UUIDs');
  }
  if (!request.requestId.trim() || request.requestId.length > 200) {
    throw new TypeError('requestId must contain 1 to 200 characters');
  }
  if (!request.sources.length || request.sources.length > 40) {
    throw new TypeError('sources must contain 1 to 40 excerpts');
  }
  for (const source of request.sources) {
    if (!UUID.test(source.documentId) || !source.pageOrSection.trim()) {
      throw new TypeError('source must identify its document and page or section');
    }
    if (!source.text.trim() || source.text.length > 4_000) {
      throw new TypeError('source text must contain 1 to 4000 characters');
    }
  }
}

function isSupportedQuote(
  item: z.infer<typeof ExtractionV1>['evidence'][number],
  sources: readonly ExtractionSource[],
): boolean {
  if (!item.page_or_section || item.excerpt.length > 500) return false;
  return sources.some(
    (source) =>
      source.documentId.toLowerCase() === item.document_id.toLowerCase() &&
      source.pageOrSection === item.page_or_section &&
      source.text.includes(item.excerpt),
  );
}

function leaves(value: unknown, prefix = ''): Array<{ field: string; value: unknown }> {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => leaves(entry, `${prefix}[${index}]`));
  }
  if (typeof value === 'object' && !prefix.endsWith('.value')) {
    return Object.entries(value).flatMap(([key, entry]) => {
      if (key === 'evidence' || key === 'schema_version' || key === 'institution_id') return [];
      return leaves(entry, prefix ? `${prefix}.${key}` : key);
    });
  }
  return [{ field: prefix, value }];
}

function numberInQuote(value: number, quote: string): boolean {
  return new RegExp(`(^|\\D)${String(value).replace('.', '[.,]')}(?:[.,]00)?(?!\\d)`, 'u').test(
    quote,
  );
}

function dateInQuote(value: string, quote: string): boolean {
  const [year, month, day] = value.split('-');
  return (
    quote.includes(value) ||
    quote.includes(`${day}/${month}/${year}`) ||
    quote.includes(`${day}.${month}.${year}`)
  );
}

function timeInQuote(value: string, quote: string): boolean {
  const [hour, minute] = value.split(':');
  const plainHour = String(Number(hour));
  return (
    quote.includes(value) ||
    quote.includes(`${plainHour}h${minute}`) ||
    (minute === '00' && new RegExp(`(^|\\D)${plainHour}h(?!\\d)`, 'u').test(quote))
  );
}

function valueIsSupported(field: string, value: unknown, quote: string): boolean {
  const normalized = normalizeText(quote);
  if (field === 'selection_type') {
    return typeof value === 'string' && Boolean(SELECTION_TYPE_MARKERS[value]?.test(normalized));
  }
  if (field === 'regular_sisu_flow') {
    return value === true
      ? /\bsisu regular\b|\bsisu plus\b|\bsistema de selecao unificada\b/u.test(normalized)
      : /\bselecao propria\b|\bvestibular proprio\b|\bfora do sisu\b/u.test(normalized);
  }
  if (field === 'requires_enem') {
    return value === true
      ? /\benem\b/u.test(normalized) && !/\bnao exige\b|\bsem nota\b/u.test(normalized)
      : /\b(?:nao exige|nao utiliza|sem nota|dispensa)\b.{0,50}\benem\b/u.test(normalized);
  }
  if (field === 'tuition_free') {
    return value === true
      ? /\bsem mensalidade\b|\bcurso gratuito\b|\bgraduacao gratuita\b/u.test(normalized)
      : /\bmensalidade\b|\bcurso pago\b|\bgraduacao paga\b/u.test(normalized);
  }
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') {
    if (field === 'application_fee_brl' && !/\btaxa de inscricao\b/u.test(normalized)) {
      return false;
    }
    return numberInQuote(value, quote);
  }
  if (typeof value === 'string') {
    if (/\.(?:start_date|end_date)$/u.test(field)) return dateInQuote(value, quote);
    if (/\.(?:start_time|end_time)$/u.test(field)) return timeInQuote(value, quote);
    return normalized.includes(normalizeText(value));
  }
  return true;
}

function unsupportedValues(extraction: z.infer<typeof ExtractionV1>): boolean {
  for (const leaf of leaves(extraction)) {
    const quotes = extraction.evidence.filter((item) => item.field === leaf.field);
    if (
      !quotes.length ||
      !quotes.some((item) => valueIsSupported(leaf.field, leaf.value, item.excerpt))
    ) {
      return true;
    }
  }
  return false;
}

export class StructuredExtractor {
  constructor(private readonly provider: AiProviderService) {}

  async extract(request: ExtractionRequest): Promise<ExtractionOutcome> {
    validateRequest(request);
    const generated = await this.provider.generate({
      documentId: request.documentId,
      requestId: request.requestId,
      schemaId: 'extraction-v1',
      input: {
        prompt_version: EXTRACTION_PROMPT_VERSION,
        prompt: EXTRACTION_PROMPT_V1,
        institution_id: request.institutionId,
        sources: request.sources.map((source) => ({
          document_id: source.documentId,
          page_or_section: source.pageOrSection,
          text: source.text,
        })),
      },
      jsonSchema: ExtractionV1JsonSchema,
      maxInputTokens: request.maxInputTokens,
      maxOutputTokens: request.maxOutputTokens,
    });
    const parsed = ExtractionV1.safeParse(generated.output);
    if (!parsed.success) {
      return {
        status: 'PENDING_REVIEW',
        promptVersion: EXTRACTION_PROMPT_VERSION,
        data: null,
        issues: ['INVALID_SCHEMA'],
      };
    }
    if (parsed.data.institution_id !== request.institutionId) {
      return {
        status: 'PENDING_REVIEW',
        promptVersion: EXTRACTION_PROMPT_VERSION,
        data: null,
        issues: ['INSTITUTION_MISMATCH'],
      };
    }
    if (!parsed.data.evidence.every((item) => isSupportedQuote(item, request.sources))) {
      return {
        status: 'PENDING_REVIEW',
        promptVersion: EXTRACTION_PROMPT_VERSION,
        data: null,
        issues: ['UNVERIFIABLE_EVIDENCE'],
      };
    }
    if (unsupportedValues(parsed.data)) {
      return {
        status: 'PENDING_REVIEW',
        promptVersion: EXTRACTION_PROMPT_VERSION,
        data: null,
        issues: ['UNSUPPORTED_VALUE'],
      };
    }
    return {
      status: 'EXTRACTED',
      promptVersion: EXTRACTION_PROMPT_VERSION,
      data: parsed.data,
      issues: [],
    };
  }
}
