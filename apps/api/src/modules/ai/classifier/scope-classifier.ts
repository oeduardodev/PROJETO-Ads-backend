import { assessDiscoveryRelevance } from '../../discovery/relevance/relevance.classifier.js';
import type { RelevanceAssessment } from '../../discovery/relevance/relevance.classifier.js';
import type { AiProviderService } from '../provider/ai-provider.service.js';
import { ClassificationV1, ClassificationV1JsonSchema } from '../schemas/index.js';
import type { z } from 'zod';

export interface ScopeExcerpt {
  documentId: string;
  pageOrSection: string | null;
  text: string;
}

export interface VerifiedScopeFact {
  value: boolean | null;
  evidence?: ScopeExcerpt;
}

export interface VerifiedScopeFacts {
  institutionPublic?: VerifiedScopeFact;
  undergraduate?: VerifiedScopeFact;
  tuitionFree?: VerifiedScopeFact;
}

export interface ScopeCandidate {
  documentId: string;
  requestId: string;
  title: string;
  excerpts: readonly ScopeExcerpt[];
  facts?: VerifiedScopeFacts;
  maxInputTokens: number;
  maxOutputTokens: number;
}

export type ScopeClassificationRoute = 'RULES_EXCLUDED' | 'NEEDS_REVIEW' | 'AI_CLASSIFIED';

export interface ScopeClassificationResult {
  classification: z.infer<typeof ClassificationV1>;
  route: ScopeClassificationRoute;
  heuristic: RelevanceAssessment;
  reason: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PRIVATE_INSTITUTION = /\b(?:instituicao|universidade|faculdade)\s+(?:privada|particular)\b/u;
const PUBLIC_INSTITUTION =
  /\b(?:instituicao|universidade|faculdade)\s+(?:publica|federal|estadual)\b/u;
const PAID_COURSE =
  /\b(?:curso|graduacao)\s+(?:pago|paga)\b|\b(?:curso|graduacao)\s+(?:com|possui|tem|cobra)\s+mensalidades?\b|\bmensalidades?\s+(?:de|no valor|obrigatoria|mensal)|\bcobra(?:m)?\s+mensalidades?\b/u;
const FREE_COURSE = /\bgratuit[ao]s?\b|\bsem mensalidades?\b/u;
const SI_SU = /\bsisu\b|\bsistema de selecao unificada\b/u;
const SI_SU_REMAINDER = /\bvagas?\s+(?:remanescentes?|nao preenchidas)\b/u;
const INDEPENDENT_SELECTION =
  /\b(?:vestibular|selecao|processo seletivo|edital)\s+(?:propri[ao]|independente|autonom[ao])\b|\bfora do sistema unificado\b/u;
const UNDERGRADUATE_TEXT =
  /\bgraduacao\b|\bbacharelado\b|\blicenciatura\b|\bcurso superior(?: de tecnologia)?\b|\btecnologo\b/u;
const ENEM_REQUIRED =
  /\b(?:exige|exigida|obrigatoria|utiliza|utilizada|considera)\b.{0,50}\b(?:nota do enem|enem)\b|\b(?:nota do enem|enem)\b.{0,50}\b(?:para classificacao|como criterio|obrigatoria)\b/u;
const ENEM_NOT_REQUIRED =
  /\b(?:nao exige|nao utiliza|dispensa|sem)\b.{0,40}\b(?:nota do enem|enem)\b/u;

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

function validateCandidate(candidate: ScopeCandidate): void {
  if (!UUID.test(candidate.documentId)) throw new TypeError('documentId must be a UUID');
  if (!candidate.requestId.trim() || candidate.requestId.length > 200) {
    throw new TypeError('requestId must contain 1 to 200 characters');
  }
  if (!candidate.title.trim() || candidate.title.length > 500) {
    throw new TypeError('title must contain 1 to 500 characters');
  }
  if (candidate.excerpts.length > 20) throw new TypeError('excerpts cannot exceed 20 items');
  for (const source of sourcesFor(candidate)) {
    if (!UUID.test(source.documentId)) throw new TypeError('evidence documentId must be a UUID');
    if (!source.text.trim() || source.text.length > 4_000) {
      throw new TypeError('evidence text must contain 1 to 4000 characters');
    }
    if (source.pageOrSection !== null && source.pageOrSection.length > 160) {
      throw new TypeError('pageOrSection cannot exceed 160 characters');
    }
  }
}

function sourcesFor(candidate: ScopeCandidate): ScopeExcerpt[] {
  const sources: ScopeExcerpt[] = [
    { documentId: candidate.documentId, pageOrSection: 'title', text: candidate.title },
    ...candidate.excerpts,
  ];
  for (const fact of Object.values(candidate.facts ?? {})) {
    if (fact?.evidence) sources.push(fact.evidence);
  }
  return sources;
}

function sameSource(
  evidence: { documentId: string; pageOrSection: string | null; excerpt: string },
  source: ScopeExcerpt,
): boolean {
  return (
    evidence.documentId.toLowerCase() === source.documentId.toLowerCase() &&
    evidence.pageOrSection === source.pageOrSection &&
    evidence.excerpt.length > 0 &&
    source.text.includes(evidence.excerpt)
  );
}

function evidenceFor(field: string, source: ScopeExcerpt) {
  const relevant = source.text.search(
    /sisu|mensalidade|privad|particular|técnic|tecnic|mestrado|doutorado|graduação|graduacao/iu,
  );
  const start = relevant < 0 ? 0 : Math.max(0, relevant - 100);
  return {
    field,
    document_id: source.documentId,
    page_or_section: source.pageOrSection,
    excerpt: source.text.slice(start, start + 320).trim(),
  };
}

function createResult(
  heuristic: RelevanceAssessment,
  route: ScopeClassificationRoute,
  reason: string,
  source: ScopeExcerpt,
  decision: 'OUT_OF_SCOPE' | 'PENDING_REVIEW',
  options: { regularSisu?: boolean; selectionType?: 'SISU' | 'SISU_PLUS' | 'REMAINING_SEATS' } = {},
): ScopeClassificationResult {
  const evidence = [evidenceFor('scope_decision', source)];
  if (options.selectionType) evidence.push(evidenceFor('selection_type', source));
  if (options.regularSisu !== undefined) evidence.push(evidenceFor('regular_sisu_flow', source));
  return {
    classification: ClassificationV1.parse({
      schema_version: 1,
      scope_decision: decision,
      selection_type: options.selectionType ?? null,
      regular_sisu_flow: options.regularSisu ?? null,
      requires_enem: null,
      evidence,
    }),
    route,
    heuristic,
    reason,
  };
}

function firstSource(
  sources: readonly ScopeExcerpt[],
  predicate: (text: string) => boolean,
): ScopeExcerpt | undefined {
  return sources.find((source) => predicate(normalizeText(source.text)));
}

function factHasEvidence(
  fact: VerifiedScopeFact | undefined,
  sources: readonly ScopeExcerpt[],
): boolean {
  if (!fact?.evidence) return false;
  return sources.some((source) =>
    sameSource(
      {
        documentId: fact.evidence!.documentId,
        pageOrSection: fact.evidence!.pageOrSection,
        excerpt: fact.evidence!.text,
      },
      source,
    ),
  );
}

function outputCitesFact(
  classification: z.infer<typeof ClassificationV1>,
  field: string,
  fact: VerifiedScopeFact | undefined,
): boolean {
  if (!fact?.evidence) return false;
  return classification.evidence.some(
    (item) =>
      item.field === field &&
      sameSource(
        {
          documentId: item.document_id,
          pageOrSection: item.page_or_section,
          excerpt: item.excerpt,
        },
        fact.evidence!,
      ),
  );
}

function factsPermitInScope(candidate: ScopeCandidate, sources: readonly ScopeExcerpt[]): boolean {
  const facts = candidate.facts;
  return Boolean(
    facts?.institutionPublic?.value === true &&
    facts.undergraduate?.value === true &&
    facts.tuitionFree?.value === true &&
    factHasEvidence(facts.institutionPublic, sources) &&
    factHasEvidence(facts.undergraduate, sources) &&
    factHasEvidence(facts.tuitionFree, sources),
  );
}

function review(
  candidate: ScopeCandidate,
  heuristic: RelevanceAssessment,
  reason: string,
  source = sourcesFor(candidate)[0],
  selectionType?: 'REMAINING_SEATS',
): ScopeClassificationResult {
  const selectedSource = source ?? sourcesFor(candidate)[0];
  if (!selectedSource) throw new Error('Candidate has no evidence source');
  return createResult(heuristic, 'NEEDS_REVIEW', reason, selectedSource, 'PENDING_REVIEW', {
    ...(selectionType ? { selectionType } : {}),
  });
}

function preflight(candidate: ScopeCandidate, heuristic: RelevanceAssessment) {
  const sources = sourcesFor(candidate);
  const normalized = sources.map((source) => normalizeText(source.text));
  const combinedText = normalized.join(' ');

  const remainderMention = SI_SU.test(combinedText) && SI_SU_REMAINDER.test(combinedText);
  if (remainderMention) {
    const source = firstSource(sources, (text) => SI_SU.test(text) || SI_SU_REMAINDER.test(text));
    return review(
      candidate,
      heuristic,
      'Seleção de vagas remanescentes com origem SiSU exige revisão humana.',
      source,
      'REMAINING_SEATS',
    );
  }

  const privateSource = firstSource(sources, (text) => PRIVATE_INSTITUTION.test(text));
  const paidSource = firstSource(sources, (text) => PAID_COURSE.test(text));
  const freeSource = firstSource(sources, (text) => FREE_COURSE.test(text));
  const publicSource = firstSource(sources, (text) => PUBLIC_INSTITUTION.test(text));
  const privateFact = candidate.facts?.institutionPublic;
  const tuitionFact = candidate.facts?.tuitionFree;
  const educationFact = candidate.facts?.undergraduate;

  if (
    (privateSource || privateFact?.value === false) &&
    (publicSource || privateFact?.value === true)
  ) {
    return review(
      candidate,
      heuristic,
      'Há sinais conflitantes sobre a natureza pública da instituição.',
    );
  }
  if ((paidSource || tuitionFact?.value === false) && (freeSource || tuitionFact?.value === true)) {
    return review(
      candidate,
      heuristic,
      'Há sinais conflitantes sobre a gratuidade do curso.',
      paidSource ?? freeSource,
    );
  }
  if (educationFact?.value === true && !UNDERGRADUATE_TEXT.test(combinedText)) {
    return review(
      candidate,
      heuristic,
      'O nível de graduação informado não tem trecho de confirmação.',
    );
  }
  if (educationFact?.value === false && UNDERGRADUATE_TEXT.test(combinedText)) {
    return review(candidate, heuristic, 'Há sinais conflitantes sobre o nível do curso.');
  }

  const hasSupportedPrivateFact =
    privateFact?.value === false && factHasEvidence(privateFact, sources);
  const hasSupportedPaidFact =
    tuitionFact?.value === false && factHasEvidence(tuitionFact, sources);
  if (privateSource && privateSource !== sources[0] && !hasSupportedPrivateFact) {
    return review(
      candidate,
      heuristic,
      'Menção a instituição privada fora do título exige revisão.',
      privateSource,
    );
  }
  if (paidSource && paidSource !== sources[0] && !hasSupportedPaidFact) {
    return review(
      candidate,
      heuristic,
      'Menção a mensalidade fora do título exige revisão.',
      paidSource,
    );
  }
  if (privateSource || hasSupportedPrivateFact) {
    return createResult(
      heuristic,
      'RULES_EXCLUDED',
      'Instituição privada identificada em evidência explícita.',
      privateSource ?? privateFact?.evidence ?? sources[0]!,
      'OUT_OF_SCOPE',
    );
  }
  if (paidSource || hasSupportedPaidFact) {
    return createResult(
      heuristic,
      'RULES_EXCLUDED',
      'Curso pago identificado; taxa de inscrição não é usada como sinal de mensalidade.',
      paidSource ?? tuitionFact?.evidence ?? sources[0]!,
      'OUT_OF_SCOPE',
    );
  }
  if (educationFact?.value === false && factHasEvidence(educationFact, sources)) {
    return createResult(
      heuristic,
      'RULES_EXCLUDED',
      'Nível fora da graduação confirmado por evidência.',
      educationFact.evidence!,
      'OUT_OF_SCOPE',
    );
  }

  if (heuristic.decision === 'DISCARD') {
    const source = sources.find(
      (item) => assessDiscoveryRelevance(item.text, '').decision === 'DISCARD',
    );
    if (source) {
      const isSiSuPlus = normalizeText(source.text).includes('sisu plus');
      const isSiSu = SI_SU.test(normalizeText(source.text));
      return createResult(
        heuristic,
        'RULES_EXCLUDED',
        heuristic.exclusionReasons[0] ?? 'Exclusão confirmada por regra contextual.',
        source,
        'OUT_OF_SCOPE',
        {
          ...(isSiSu ? { regularSisu: true } : {}),
          ...(isSiSuPlus
            ? { selectionType: 'SISU_PLUS' as const }
            : isSiSu
              ? { selectionType: 'SISU' as const }
              : {}),
        },
      );
    }
    return review(
      candidate,
      heuristic,
      'Exclusão heurística sem trecho isolado suficiente para confirmar.',
    );
  }

  if (heuristic.decision === 'REVIEW') {
    return review(
      candidate,
      heuristic,
      'Sinais de escopo ausentes, conflitantes ou insuficientes.',
    );
  }
  return { sources, combinedText };
}

function outputEvidenceMatches(
  classification: z.infer<typeof ClassificationV1>,
  sources: readonly ScopeExcerpt[],
): boolean {
  return classification.evidence.every(
    (item) =>
      item.excerpt.length <= 500 &&
      sources.some((source) =>
        sameSource(
          {
            documentId: item.document_id,
            pageOrSection: item.page_or_section,
            excerpt: item.excerpt,
          },
          source,
        ),
      ),
  );
}

function fieldHasEvidence(
  classification: z.infer<typeof ClassificationV1>,
  field: string,
  sources: readonly ScopeExcerpt[],
  pattern: RegExp,
): boolean {
  return classification.evidence.some((item) => {
    if (item.field !== field || !pattern.test(normalizeText(item.excerpt))) return false;
    return sources.some((source) =>
      sameSource(
        {
          documentId: item.document_id,
          pageOrSection: item.page_or_section,
          excerpt: item.excerpt,
        },
        source,
      ),
    );
  });
}

export class ScopeClassifier {
  constructor(private readonly provider: AiProviderService) {}

  async classify(candidate: ScopeCandidate): Promise<ScopeClassificationResult> {
    validateCandidate(candidate);
    const sources = sourcesFor(candidate);
    const text = [candidate.title, ...candidate.excerpts.map((source) => source.text)].join('\n');
    const heuristic = assessDiscoveryRelevance(text, '');
    const initial = preflight(candidate, heuristic);
    if ('route' in initial) return initial;

    const generated = await this.provider.generate({
      documentId: candidate.documentId,
      requestId: candidate.requestId,
      schemaId: 'classification-v1',
      input: {
        task: 'Classify scope only; an in-scope result is a candidate for human review, never publication.',
        policy: [
          'Consider title and quoted excerpts together.',
          'Do not infer public status, undergraduate level, tuition, ENEM, or SiSU flow when absent.',
          'A mention of SiSU alone is not proof of regular SiSU; own selections for SiSU-origin seats require human review.',
          'Do not treat an application fee as course tuition.',
          'Cite every non-null critical field with an exact excerpt from supplied sources.',
          'Return PENDING_REVIEW when evidence is ambiguous or conflicting.',
        ],
        title: candidate.title,
        excerpts: candidate.excerpts.map((source) => ({
          document_id: source.documentId,
          page_or_section: source.pageOrSection,
          text: source.text,
        })),
        verified_scope_facts: candidate.facts ?? null,
        heuristic: {
          decision: heuristic.decision,
          score: heuristic.score,
          positive_signals: heuristic.positiveSignals,
          negative_signals: heuristic.negativeSignals,
        },
      },
      jsonSchema: ClassificationV1JsonSchema,
      maxInputTokens: candidate.maxInputTokens,
      maxOutputTokens: candidate.maxOutputTokens,
    });

    const parsed = ClassificationV1.safeParse(generated.output);
    if (!parsed.success || !outputEvidenceMatches(parsed.data, sources)) {
      return review(
        candidate,
        heuristic,
        'Saída do classificador inválida ou sem citação verificável.',
      );
    }
    const classification = parsed.data;
    if (
      classification.scope_decision === 'UNKNOWN' ||
      classification.scope_decision === 'OUT_OF_SCOPE'
    ) {
      return review(
        candidate,
        heuristic,
        classification.scope_decision === 'OUT_OF_SCOPE'
          ? 'Modelo sugeriu exclusão sem regra determinística suficiente.'
          : 'Modelo não confirmou o escopo.',
        sources.find((source) =>
          classification.evidence.some(
            (item) =>
              item.field === 'scope_decision' &&
              sameSource(
                {
                  documentId: item.document_id,
                  pageOrSection: item.page_or_section,
                  excerpt: item.excerpt,
                },
                source,
              ),
          ),
        ),
      );
    }
    if (classification.scope_decision === 'PENDING_REVIEW') {
      return {
        classification,
        route: 'NEEDS_REVIEW',
        heuristic,
        reason: 'Modelo encaminhou o caso para revisão humana.',
      };
    }

    const independenceSupported = fieldHasEvidence(
      classification,
      'regular_sisu_flow',
      sources,
      INDEPENDENT_SELECTION,
    );
    const educationConfirmed =
      candidate.facts?.institutionPublic?.value === true &&
      candidate.facts?.undergraduate?.value === true &&
      candidate.facts?.tuitionFree?.value === true &&
      factsPermitInScope(candidate, sources) &&
      outputCitesFact(classification, 'institution_public', candidate.facts?.institutionPublic) &&
      outputCitesFact(classification, 'undergraduate', candidate.facts?.undergraduate) &&
      outputCitesFact(classification, 'tuition_free', candidate.facts?.tuitionFree);
    const sisuFlowConfirmed = classification.regular_sisu_flow === false && independenceSupported;
    const enemConfirmed =
      classification.requires_enem === null ||
      (classification.requires_enem &&
        fieldHasEvidence(classification, 'requires_enem', sources, ENEM_REQUIRED)) ||
      (!classification.requires_enem &&
        fieldHasEvidence(classification, 'requires_enem', sources, ENEM_NOT_REQUIRED));
    if (
      classification.selection_type === 'SISU' ||
      classification.selection_type === 'SISU_PLUS' ||
      !sisuFlowConfirmed ||
      !educationConfirmed ||
      !enemConfirmed
    ) {
      return review(
        candidate,
        heuristic,
        'Saída positiva sem confirmação determinística de graduação pública gratuita e seleção própria.',
      );
    }
    return { classification, route: 'AI_CLASSIFIED', heuristic, reason: null };
  }
}
