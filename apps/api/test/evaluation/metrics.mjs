const UNKNOWN = new Set(['UNKNOWN', 'NOT_MEASURED']);

function known(value) {
  return (
    value !== null && value !== undefined && !(typeof value === 'string' && UNKNOWN.has(value))
  );
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function score(records) {
  const fields = new Map();
  for (const record of records) {
    for (const [field, expected] of Object.entries(record.expected ?? {})) {
      if (!known(expected)) continue;
      const metric = fields.get(field) ?? { known: 0, correct: 0, incorrect: 0, abstained: 0 };
      metric.known += 1;
      const actual = record.actual?.[field];
      if (!known(actual)) metric.abstained += 1;
      else if (sameValue(expected, actual)) metric.correct += 1;
      else metric.incorrect += 1;
      fields.set(field, metric);
    }
  }
  return Object.fromEntries(
    [...fields.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([field, metric]) => {
        const emitted = metric.correct + metric.incorrect;
        return [
          field,
          {
            ...metric,
            precision: emitted === 0 ? null : metric.correct / emitted,
            recall: metric.known === 0 ? null : metric.correct / metric.known,
            coverage: metric.known === 0 ? null : emitted / metric.known,
          },
        ];
      }),
  );
}

function tokenUsage(records) {
  const providerCalls = records.filter((record) => record.usage?.source === 'PROVIDER');
  const tokenTotal = providerCalls.reduce(
    (sum, record) => sum + record.usage.inputTokens + record.usage.outputTokens,
    0,
  );
  const documents = new Set(providerCalls.map((record) => record.documentId));
  return {
    measuredCalls: providerCalls.length,
    documents: documents.size,
    inputTokens: providerCalls.reduce((sum, record) => sum + record.usage.inputTokens, 0),
    outputTokens: providerCalls.reduce((sum, record) => sum + record.usage.outputTokens, 0),
    totalTokens: tokenTotal,
    tokensPerDocument: documents.size === 0 ? null : tokenTotal / documents.size,
  };
}

function versionKey(record) {
  return `${record.promptVersion ?? 'unknown'}|${record.modelVersion ?? 'unknown'}`;
}

function compareVersions(records) {
  const versions = [...new Set(records.map(versionKey))].sort();
  return versions.map((version, index) => {
    if (index === 0) return { version, comparedWith: null, regressions: 0, improvements: 0 };
    const baseline = new Map(
      records
        .filter((record) => versionKey(record) === versions[index - 1])
        .map((record) => [record.caseId, record]),
    );
    let regressions = 0;
    let improvements = 0;
    for (const current of records.filter((record) => versionKey(record) === version)) {
      const prior = baseline.get(current.caseId);
      if (!prior) continue;
      for (const [field, expected] of Object.entries(current.expected ?? {})) {
        if (!known(expected) || !Object.hasOwn(prior.expected ?? {}, field)) continue;
        const priorCorrect =
          known(prior.actual?.[field]) && sameValue(prior.actual[field], expected);
        const currentCorrect =
          known(current.actual?.[field]) && sameValue(current.actual[field], expected);
        if (priorCorrect && !currentCorrect) regressions += 1;
        if (!priorCorrect && currentCorrect) improvements += 1;
      }
    }
    return { version, comparedWith: versions[index - 1], regressions, improvements };
  });
}

export function buildEvaluationReport({ datasetVersion, records }) {
  if (!datasetVersion?.trim()) throw new Error('Evaluation dataset version is required');
  for (const record of records) {
    if (!record.caseId || !record.promptVersion || !record.modelVersion) {
      throw new Error('Every evaluation record requires case, prompt, and model versions');
    }
    if (record.usage?.source === 'PROVIDER') {
      for (const tokenValue of [record.usage.inputTokens, record.usage.outputTokens]) {
        if (!Number.isSafeInteger(tokenValue) || tokenValue < 0) {
          throw new Error('Provider token usage must be a non-negative integer');
        }
      }
    }
  }
  return {
    datasetVersion,
    sampleCount: records.length,
    fields: score(records),
    tokenUsage: tokenUsage(records),
    versionComparison: compareVersions(records),
  };
}
