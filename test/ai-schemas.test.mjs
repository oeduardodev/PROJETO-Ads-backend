import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  ClassificationV1,
  ClassificationV1JsonSchema,
  ExtractionV1,
  ExtractionV1JsonSchema,
} from '../apps/api/dist/modules/ai/schemas/index.js';

const documentId = '80fc8a31-cf6f-4d81-9a4a-f86af0aad456';
const institutionId = '7d5ffcb6-e5cc-4808-9877-10c7a617760a';
const evidence = (field, excerpt = 'Fixture sintética de teste') => ({
  field,
  document_id: documentId,
  page_or_section: 'p. 1, seção sintética',
  excerpt,
});

function emptyExtraction() {
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

test('classification accepts only versioned taxonomy and keeps unknown values nullable', () => {
  const unknown = {
    schema_version: 1,
    scope_decision: 'UNKNOWN',
    selection_type: null,
    regular_sisu_flow: null,
    requires_enem: null,
    evidence: [],
  };
  assert.deepEqual(ClassificationV1.parse(unknown), unknown);

  const classified = {
    schema_version: 1,
    scope_decision: 'IN_SCOPE',
    selection_type: 'SCHOOL_RECORD',
    regular_sisu_flow: false,
    requires_enem: true,
    evidence: [
      evidence('scope_decision'),
      evidence('selection_type'),
      evidence('regular_sisu_flow'),
      evidence('requires_enem'),
    ],
  };
  assert.deepEqual(ClassificationV1.parse(classified), classified);
  assert.equal(
    ClassificationV1.safeParse({ ...classified, selection_type: 'HISTORICO_ESCOLAR' }).success,
    false,
  );
  assert.equal(
    ClassificationV1.safeParse({ ...classified, evidence: [evidence('selection_type')] }).success,
    false,
  );
});

test('extraction requires explicit nulls for unknown fields and rejects missing properties', () => {
  const input = emptyExtraction();
  assert.deepEqual(ExtractionV1.parse(input), input);
  const missingField = { ...input };
  delete missingField.application_windows;
  assert.equal(ExtractionV1.safeParse(missingField).success, false);
  assert.equal(ExtractionV1.safeParse({ ...input, inventado: true }).success, false);
});

test('extraction validates offers, reservations, requirements, dates, and field evidence', () => {
  const input = {
    ...emptyExtraction(),
    notice_number: 'PS-TESTE-01/2026',
    selection_type: 'GRADUATE_ENTRY',
    regular_sisu_flow: false,
    tuition_free: true,
    application_windows: [
      {
        label: 'Inscrições',
        start_date: '2026-07-30',
        start_time: null,
        end_date: '2026-08-03',
        end_time: null,
        timezone: null,
      },
    ],
    offerings: [
      {
        course: 'Curso sintético',
        degree_type: 'BACHARELADO',
        campus: null,
        modality: null,
        shift: null,
        seats: 25,
        reservations: [
          {
            category: 'Reserva sintética',
            seats: 5,
            requirements: [
              { criterion: 'Critério sintético', required: true, value: 'Comprovante citado' },
            ],
          },
        ],
        requirements: null,
      },
    ],
    requirements: [{ criterion: 'Requisito geral sintético', required: null, value: null }],
    evidence: [
      evidence('notice_number'),
      evidence('selection_type'),
      evidence('regular_sisu_flow'),
      evidence('tuition_free'),
      evidence('application_windows[0].label'),
      evidence('application_windows[0].start_date'),
      evidence('application_windows[0].end_date'),
      evidence('offerings[0].course'),
      evidence('offerings[0].degree_type'),
      evidence('offerings[0].seats'),
      evidence('offerings[0].reservations[0].category'),
      evidence('offerings[0].reservations[0].seats'),
      evidence('offerings[0].reservations[0].requirements[0].criterion'),
      evidence('offerings[0].reservations[0].requirements[0].required'),
      evidence('offerings[0].reservations[0].requirements[0].value'),
      evidence('requirements[0].criterion'),
    ],
  };
  assert.deepEqual(ExtractionV1.parse(input), input);

  const withoutEvidence = {
    ...input,
    evidence: input.evidence.filter((item) => item.field !== 'application_windows[0].end_date'),
  };
  assert.equal(ExtractionV1.safeParse(withoutEvidence).success, false);
  assert.equal(
    ExtractionV1.safeParse({ ...input, application_fee_brl: Number.NaN }).success,
    false,
  );
  assert.equal(
    ExtractionV1.safeParse({
      ...input,
      application_windows: [{ ...input.application_windows[0], start_time: '25:70' }],
    }).success,
    false,
  );
});

test('checked-in JSON Schemas match the versioned Zod contracts', async () => {
  const classification = JSON.parse(
    await readFile(new URL('../docs/contracts/classification-v1.json', import.meta.url), 'utf8'),
  );
  const extraction = JSON.parse(
    await readFile(new URL('../docs/contracts/extraction-v1.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(classification, ClassificationV1JsonSchema);
  assert.deepEqual(extraction, ExtractionV1JsonSchema);
});
