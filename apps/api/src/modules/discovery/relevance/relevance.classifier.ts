export type RelevanceDecision = 'PRIORITIZE' | 'REVIEW' | 'DISCARD';

export interface RelevanceAssessment {
  decision: RelevanceDecision;
  score: number;
  positiveSignals: string[];
  negativeSignals: string[];
  exclusionReasons: string[];
}

const POSITIVE_TERMS = [
  'vestibular proprio',
  'processo seletivo especifico',
  'processo seletivo de conhecimento especifico',
  'ingresso por historico',
  'ingresso de graduados',
  'vagas remanescentes',
  'selecao independente pelo enem',
  'transferencia externa',
  'reingresso',
  'portador de diploma',
  'licenciatura',
  'bacharelado',
  'tecnologo',
];

const NEGATIVE_TERMS = [
  'ensino medio',
  'tecnico integrado',
  'especializacao',
  'mestrado',
  'doutorado',
  'sisu',
  'prouni',
  'fies',
];

const POSTGRAD_PROGRAMS = ['pos graduacao', 'especializacao', 'mestrado', 'doutorado'];
const SELECTION_CONTEXT = ['processo seletivo', 'selecao', 'ingresso', 'edital', 'inscricao'];

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

function includesTerm(text: string, term: string): boolean {
  return ` ${text} `.includes(` ${term} `);
}

function hasPostgraduateSelection(anchor: string): boolean {
  return POSTGRAD_PROGRAMS.some((program) =>
    SELECTION_CONTEXT.some(
      (context) =>
        new RegExp(`\\b${context}\\b.{0,60}\\b${program}\\b`, 'u').test(anchor) ||
        new RegExp(`\\b${program}\\b.{0,60}\\b${context}\\b`, 'u').test(anchor),
    ),
  );
}

function explicitAnchorExclusions(anchor: string): string[] {
  const reasons: string[] = [];
  if (
    includesTerm(anchor, 'sisu regular') ||
    includesTerm(anchor, 'fluxo regular do sisu') ||
    includesTerm(anchor, 'sisu plus') ||
    /\b(?:selecao|processo seletivo|fluxo) regular (?:do|via|pelo) sisu\b/u.test(anchor)
  ) {
    reasons.push('SiSU regular ou SiSU+ identificado no texto âncora');
  }
  if (hasPostgraduateSelection(anchor)) {
    reasons.push('processo de pós-graduação identificado no texto âncora');
  }
  if (
    includesTerm(anchor, 'tecnico integrado') ||
    includesTerm(anchor, 'tecnico de nivel medio') ||
    includesTerm(anchor, 'tecnico em nivel medio')
  ) {
    reasons.push('curso técnico integrado/de nível médio identificado no texto âncora');
  }
  return reasons;
}

export function assessDiscoveryRelevance(anchorText: string, url: string): RelevanceAssessment {
  const anchor = normalizeText(anchorText);
  const combined = normalizeText(`${anchorText} ${url}`);
  const positiveSignals = POSITIVE_TERMS.filter((term) => includesTerm(combined, term));
  const negativeSignals = NEGATIVE_TERMS.filter((term) => includesTerm(combined, term));
  const score =
    Math.round(
      Math.max(0, Math.min(1, positiveSignals.length * 0.25 - negativeSignals.length * 0.1)) * 100,
    ) / 100;
  const exclusionReasons = explicitAnchorExclusions(anchor);
  const hasConflictingPositive = POSITIVE_TERMS.some((term) => includesTerm(anchor, term));

  if (exclusionReasons.length > 0 && !hasConflictingPositive) {
    return { decision: 'DISCARD', score, positiveSignals, negativeSignals, exclusionReasons };
  }
  if (exclusionReasons.length > 0 || score === 0) {
    return { decision: 'REVIEW', score, positiveSignals, negativeSignals, exclusionReasons };
  }
  return { decision: 'PRIORITIZE', score, positiveSignals, negativeSignals, exclusionReasons };
}
