import { logStructured } from './structured-log.js';
import { observabilityMetrics } from './metrics.registry.js';

export interface SourceFailureAlertInput {
  active: boolean;
  exactHostReviewed: boolean;
  consecutiveFailures: number;
  lastSuccessAt: Date | null;
  frequencyMinutes: number;
  now: Date;
}

export function sourceFailureAlert(input: SourceFailureAlertInput): 'none' | 'warning' | 'alert' {
  if (!input.active || !input.exactHostReviewed) return 'none';
  if (!Number.isSafeInteger(input.frequencyMinutes) || input.frequencyMinutes < 1) return 'none';
  if (input.consecutiveFailures >= 3) return 'alert';
  if (
    input.lastSuccessAt &&
    input.now.getTime() - input.lastSuccessAt.getTime() >= input.frequencyMinutes * 2 * 60_000
  ) {
    return 'alert';
  }
  return input.consecutiveFailures === 1 ? 'warning' : 'none';
}

export function noCandidateWarning(candidatesFound: number): boolean {
  return Number.isSafeInteger(candidatesFound) && candidatesFound === 0;
}

export function recordSourceCandidateCount(
  sourceId: string,
  crawlRunId: string,
  candidatesFound: number,
): void {
  if (!Number.isSafeInteger(candidatesFound) || candidatesFound < 0) {
    throw new Error('Candidate count must be a non-negative safe integer');
  }
  observabilityMetrics.increment(
    'source_candidates_discovered_total',
    'Candidate URLs discovered by source',
    { source_id: sourceId },
    candidatesFound,
  );
  const empty = noCandidateWarning(candidatesFound);
  logStructured(
    empty ? 'warn' : 'info',
    empty ? 'source.crawl.zero_candidates' : 'source.crawl.candidates_discovered',
    {
      sourceId,
      crawlRunId,
      candidatesFound,
    },
  );
}
