import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEvaluationReport } from '../apps/api/test/evaluation/metrics.mjs';

test('field scores exclude UNKNOWN labels and report incorrect values and abstentions separately', () => {
  const report = buildEvaluationReport({
    datasetVersion: 'synthetic-v1',
    records: [
      {
        caseId: 'a',
        promptVersion: 'p1',
        modelVersion: 'm1',
        expected: { date: '2026-07-20' },
        actual: { date: '2026-07-20' },
      },
      {
        caseId: 'b',
        promptVersion: 'p1',
        modelVersion: 'm1',
        expected: { date: '2026-07-21' },
        actual: { date: null },
      },
      {
        caseId: 'c',
        promptVersion: 'p1',
        modelVersion: 'm1',
        expected: { date: 'UNKNOWN' },
        actual: { date: '2026-07-22' },
      },
      {
        caseId: 'd',
        promptVersion: 'p1',
        modelVersion: 'm1',
        expected: { date: '2026-07-23' },
        actual: { date: '2026-07-24' },
      },
    ],
  });
  assert.deepEqual(report.fields.date, {
    known: 3,
    correct: 1,
    incorrect: 1,
    abstained: 1,
    precision: 0.5,
    recall: 1 / 3,
    coverage: 2 / 3,
  });
});

test('token cost excludes fixture usage and reports provider usage per document', () => {
  const report = buildEvaluationReport({
    datasetVersion: 'synthetic-v1',
    records: [
      {
        caseId: 'a',
        documentId: 'doc-a',
        promptVersion: 'p1',
        modelVersion: 'm1',
        expected: {},
        actual: {},
        usage: { source: 'PROVIDER', inputTokens: 20, outputTokens: 5 },
      },
      {
        caseId: 'b',
        documentId: 'doc-b',
        promptVersion: 'p1',
        modelVersion: 'm1',
        expected: {},
        actual: {},
        usage: { source: 'PROVIDER', inputTokens: 40, outputTokens: 10 },
      },
      {
        caseId: 'mock',
        documentId: 'doc-c',
        promptVersion: 'p1',
        modelVersion: 'fixture',
        expected: {},
        actual: {},
        usage: { source: 'FIXTURE', inputTokens: 1000, outputTokens: 1000 },
      },
    ],
  });
  assert.deepEqual(report.tokenUsage, {
    measuredCalls: 2,
    documents: 2,
    inputTokens: 60,
    outputTokens: 15,
    totalTokens: 75,
    tokensPerDocument: 37.5,
  });
});

test('version comparisons identify regressions and improvements on the same case', () => {
  const report = buildEvaluationReport({
    datasetVersion: 'curated-v2',
    records: [
      {
        caseId: 'same-1',
        promptVersion: 'p1',
        modelVersion: 'm1',
        expected: { enem: true },
        actual: { enem: true },
      },
      {
        caseId: 'same-2',
        promptVersion: 'p1',
        modelVersion: 'm1',
        expected: { date: '2026-07-20' },
        actual: { date: null },
      },
      {
        caseId: 'same-1',
        promptVersion: 'p2',
        modelVersion: 'm1',
        expected: { enem: true },
        actual: { enem: false },
      },
      {
        caseId: 'same-2',
        promptVersion: 'p2',
        modelVersion: 'm1',
        expected: { date: '2026-07-20' },
        actual: { date: '2026-07-20' },
      },
    ],
  });
  assert.deepEqual(report.versionComparison, [
    { version: 'p1|m1', comparedWith: null, regressions: 0, improvements: 0 },
    { version: 'p2|m1', comparedWith: 'p1|m1', regressions: 1, improvements: 1 },
  ]);
});

test('rejects missing versions and invalid provider usage rather than reporting false metrics', () => {
  assert.throws(() => buildEvaluationReport({ datasetVersion: '', records: [] }));
  assert.throws(() =>
    buildEvaluationReport({ datasetVersion: 'v1', records: [{ caseId: 'a', expected: {} }] }),
  );
  assert.throws(() =>
    buildEvaluationReport({
      datasetVersion: 'v1',
      records: [
        {
          caseId: 'a',
          promptVersion: 'p1',
          modelVersion: 'm1',
          usage: { source: 'PROVIDER', inputTokens: -1, outputTokens: 0 },
        },
      ],
    }),
  );
});
