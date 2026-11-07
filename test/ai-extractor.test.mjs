import assert from 'node:assert/strict';
import test from 'node:test';
import { StructuredExtractor } from '../apps/api/dist/modules/ai/extractor/structured-extractor.js';
import { AiProviderService } from '../apps/api/dist/modules/ai/provider/ai-provider.service.js';

const documentId = 'bbdd9299-3d13-41ef-9e73-e7d8ddf36753';
const institutionId = '1b250f17-5a3c-4850-9998-e9bb414df017';
const source = (pageOrSection, text) => ({ documentId, pageOrSection, text });
const opening = source(
  'p. 1',
  'Edital PS-01/2026. Processo de ingresso de graduados. Seleção própria para bacharelado. Curso gratuito, sem mensalidade. Não exige nota do ENEM.',
);
const schedule = source(
  'p. 2',
  'Inscrições de 30/07/2026 às 08:00 até 03/08/2026 às 23:59. Taxa de inscrição R$ 50,00.',
);
const offers = source(
  'p. 3',
  'Curso de Matemática, bacharelado, Campus Centro, 25 vagas. Requisito: diploma de ensino médio.',
);
const request = {
  documentId,
  institutionId,
  requestId: 'extract-synthetic-v1',
  sources: [opening, schedule, offers],
  maxInputTokens: 1_000,
  maxOutputTokens: 500,
};

function evidence(field, excerptSource, excerpt = excerptSource.text) {
  return {
    field,
    document_id: excerptSource.documentId,
    page_or_section: excerptSource.pageOrSection,
    excerpt,
  };
}

function emptyOutput() {
  return {
    schema_version: 1,
    institution_id: institutionId,
    notice_number: null,
    notice_year: null,
    selection_type: null,
    regular_sisu_flow: null,
    requires_enem: null,
    tuition_free: null,
    application_fee_brl: null,
    application_windows: null,
    offerings: null,
    requirements: null,
    evidence: [],
  };
}

function completeOutput() {
  return {
    ...emptyOutput(),
    notice_number: 'PS-01/2026',
    notice_year: 2026,
    selection_type: 'GRADUATE_ENTRY',
    regular_sisu_flow: false,
    requires_enem: false,
    tuition_free: true,
    application_fee_brl: 50,
    application_windows: [
      {
        label: 'Inscrições',
        start_date: '2026-07-30',
        start_time: '08:00',
        end_date: '2026-08-03',
        end_time: '23:59',
        timezone: null,
      },
    ],
    offerings: [
      {
        course: 'Matemática',
        degree_type: 'bacharelado',
        campus: 'Centro',
        modality: null,
        shift: null,
        seats: 25,
        reservations: null,
        requirements: [{ criterion: 'diploma de ensino médio', required: true, value: null }],
      },
    ],
    evidence: [
      evidence('notice_number', opening),
      evidence('notice_year', opening),
      evidence('selection_type', opening),
      evidence('regular_sisu_flow', opening),
      evidence('requires_enem', opening),
      evidence('tuition_free', opening),
      evidence('application_fee_brl', schedule),
      ...['label', 'start_date', 'start_time', 'end_date', 'end_time'].map((field) =>
        evidence(`application_windows[0].${field}`, schedule),
      ),
      ...['course', 'degree_type', 'campus', 'seats'].map((field) =>
        evidence(`offerings[0].${field}`, offers),
      ),
      evidence('offerings[0].requirements[0].criterion', offers),
      evidence('offerings[0].requirements[0].required', offers),
    ],
  };
}

function fixtureExtractor(outputs) {
  const calls = [];
  const provider = {
    kind: 'fixture',
    generate: async (input) => {
      calls.push(input);
      const output = outputs.get(input.requestId);
      assert.ok(output, `unexpected fixture request ${input.requestId}`);
      return { output, usage: { inputTokens: 120, outputTokens: 75 } };
    },
  };
  return {
    extractor: new StructuredExtractor(
      new AiProviderService(provider, { timeoutMs: 1_000, maxAttempts: 1, retryBaseMs: 0 }),
    ),
    calls,
  };
}

test('versioned extraction preserves cited dates, fee, ENEM, offerings and requirements', async () => {
  const output = completeOutput();
  const { extractor, calls } = fixtureExtractor(new Map([[request.requestId, output]]));
  const result = await extractor.extract(request);
  assert.equal(result.status, 'EXTRACTED');
  assert.equal(result.promptVersion, 'extraction-v1');
  assert.deepEqual(result.data, output);
  assert.deepEqual(result.issues, []);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].schemaId, 'extraction-v1');
  assert.equal(calls[0].input.prompt_version, 'extraction-v1');
  assert.equal(calls[0].input.institution_id, institutionId);
  assert.ok(calls[0].input.prompt.includes('null'));
});

test('partial official-looking deadline stays partial without an invented closing time', async () => {
  const partialRequest = {
    ...request,
    requestId: 'partial-deadline',
    sources: [source('cronograma', 'Inscrições até 03/08/2026.')],
  };
  const output = {
    ...emptyOutput(),
    application_windows: [
      {
        label: 'Inscrições',
        start_date: null,
        start_time: null,
        end_date: '2026-08-03',
        end_time: null,
        timezone: null,
      },
    ],
    evidence: [
      evidence('application_windows[0].label', partialRequest.sources[0]),
      evidence('application_windows[0].end_date', partialRequest.sources[0]),
    ],
  };
  const { extractor } = fixtureExtractor(new Map([[partialRequest.requestId, output]]));
  const result = await extractor.extract(partialRequest);
  assert.equal(result.status, 'EXTRACTED');
  assert.equal(result.data.application_windows[0].end_time, null);
});

test('unverifiable or unsupported values and changed institution context require review', async () => {
  const base = completeOutput();
  const fabricatedRequest = { ...request, requestId: 'fabricated' };
  const guessedTimeRequest = {
    ...request,
    requestId: 'guessed-time',
    sources: [
      opening,
      source('p. 2', 'Inscrições até 03/08/2026; taxa de inscrição R$ 50,00.'),
      offers,
    ],
  };
  const wrongInstitutionRequest = { ...request, requestId: 'wrong-institution' };
  const missingEvidenceRequest = { ...request, requestId: 'missing-evidence' };
  const outputs = new Map([
    [
      fabricatedRequest.requestId,
      {
        ...base,
        evidence: base.evidence.map((item) =>
          item.field === 'offerings[0].course' ? { ...item, excerpt: 'Curso inventado' } : item,
        ),
      },
    ],
    [guessedTimeRequest.requestId, base],
    [wrongInstitutionRequest.requestId, { ...base, institution_id: documentId }],
    [
      missingEvidenceRequest.requestId,
      {
        ...base,
        evidence: base.evidence.filter((item) => item.field !== 'application_fee_brl'),
      },
    ],
  ]);
  const { extractor } = fixtureExtractor(outputs);
  for (const [input, issue] of [
    [fabricatedRequest, 'UNVERIFIABLE_EVIDENCE'],
    [guessedTimeRequest, 'UNVERIFIABLE_EVIDENCE'],
    [wrongInstitutionRequest, 'INSTITUTION_MISMATCH'],
    [missingEvidenceRequest, 'INVALID_SCHEMA'],
  ]) {
    const result = await extractor.extract(input);
    assert.equal(result.status, 'PENDING_REVIEW', input.requestId);
    assert.deepEqual(result.issues, [issue]);
    assert.equal(result.data, null);
  }
});

test('time, fee, or selection type absent from cited excerpts cannot be inferred', async () => {
  const timeRequest = { ...request, requestId: 'unsupported-time' };
  const feeRequest = { ...request, requestId: 'unsupported-fee' };
  const typeRequest = { ...request, requestId: 'unsupported-type' };
  const original = completeOutput();
  const unsupportedTime = {
    ...original,
    application_windows: [{ ...original.application_windows[0], end_time: '22:00' }],
  };
  const unsupportedFee = { ...original, application_fee_brl: 70 };
  const unsupportedType = { ...original, selection_type: 'SCHOOL_RECORD' };
  const { extractor } = fixtureExtractor(
    new Map([
      [timeRequest.requestId, unsupportedTime],
      [feeRequest.requestId, unsupportedFee],
      [typeRequest.requestId, unsupportedType],
    ]),
  );
  for (const input of [timeRequest, feeRequest, typeRequest]) {
    const result = await extractor.extract(input);
    assert.equal(result.status, 'PENDING_REVIEW');
    assert.deepEqual(result.issues, ['UNSUPPORTED_VALUE']);
  }
});
