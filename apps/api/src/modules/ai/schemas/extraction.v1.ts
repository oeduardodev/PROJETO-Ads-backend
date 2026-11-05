import { z } from 'zod';
import { EvidenceV1, requireEvidence, SchemaVersionV1, SelectionTypeV1 } from './taxonomy.v1.js';

const DateV1 = z.iso.date().nullable();
const TimeV1 = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u)
  .nullable();
const NullableTextV1 = z.string().nullable();
const NullableNonnegativeIntegerV1 = z.number().int().nonnegative().nullable();

export const RequirementV1 = z.strictObject({
  criterion: z.string().min(1),
  required: z.boolean().nullable(),
  value: z.json().nullable(),
});

export const ReservationV1 = z.strictObject({
  category: NullableTextV1,
  seats: NullableNonnegativeIntegerV1,
  requirements: z.array(RequirementV1).nullable(),
});

export const OfferingV1 = z.strictObject({
  course: NullableTextV1,
  degree_type: NullableTextV1,
  campus: NullableTextV1,
  modality: NullableTextV1,
  shift: NullableTextV1,
  seats: NullableNonnegativeIntegerV1,
  reservations: z.array(ReservationV1).nullable(),
  requirements: z.array(RequirementV1).nullable(),
});

export const ApplicationWindowV1 = z.strictObject({
  label: NullableTextV1,
  start_date: DateV1,
  start_time: TimeV1,
  end_date: DateV1,
  end_time: TimeV1,
  timezone: NullableTextV1,
});

export const ExtractionV1Object = z.strictObject({
  schema_version: SchemaVersionV1,
  institution_id: z.uuid().nullable(),
  notice_number: NullableTextV1,
  notice_year: z.number().int().positive().nullable(),
  selection_type: SelectionTypeV1.nullable(),
  regular_sisu_flow: z.boolean().nullable(),
  requires_enem: z.boolean().nullable(),
  tuition_free: z.boolean().nullable(),
  application_fee_brl: z.number().nonnegative().nullable(),
  application_windows: z.array(ApplicationWindowV1).nullable(),
  offerings: z.array(OfferingV1).nullable(),
  requirements: z.array(RequirementV1).nullable(),
  evidence: z.array(EvidenceV1),
});

export const ExtractionV1 = ExtractionV1Object.superRefine((value, context) => {
  const addEvidenceIssue = (field: string) => {
    context.addIssue({
      code: 'custom',
      path: ['evidence'],
      message: `Non-null critical field requires evidence: ${field}`,
    });
  };
  for (const field of [
    'notice_number',
    'notice_year',
    'selection_type',
    'regular_sisu_flow',
    'requires_enem',
    'tuition_free',
    'application_fee_brl',
  ] as const) {
    requireEvidence(value[field], field, value.evidence, addEvidenceIssue);
  }

  value.application_windows?.forEach((window, index) => {
    for (const field of [
      'label',
      'start_date',
      'start_time',
      'end_date',
      'end_time',
      'timezone',
    ] as const) {
      requireEvidence(
        window[field],
        `application_windows[${index}].${field}`,
        value.evidence,
        addEvidenceIssue,
      );
    }
  });

  value.offerings?.forEach((offering, index) => {
    for (const field of [
      'course',
      'degree_type',
      'campus',
      'modality',
      'shift',
      'seats',
    ] as const) {
      requireEvidence(
        offering[field],
        `offerings[${index}].${field}`,
        value.evidence,
        addEvidenceIssue,
      );
    }
    offering.requirements?.forEach((requirement, requirementIndex) => {
      requireEvidence(
        requirement.criterion,
        `offerings[${index}].requirements[${requirementIndex}].criterion`,
        value.evidence,
        addEvidenceIssue,
      );
      requireEvidence(
        requirement.required,
        `offerings[${index}].requirements[${requirementIndex}].required`,
        value.evidence,
        addEvidenceIssue,
      );
      requireEvidence(
        requirement.value,
        `offerings[${index}].requirements[${requirementIndex}].value`,
        value.evidence,
        addEvidenceIssue,
      );
    });
    offering.reservations?.forEach((reservation, reservationIndex) => {
      requireEvidence(
        reservation.category,
        `offerings[${index}].reservations[${reservationIndex}].category`,
        value.evidence,
        addEvidenceIssue,
      );
      requireEvidence(
        reservation.seats,
        `offerings[${index}].reservations[${reservationIndex}].seats`,
        value.evidence,
        addEvidenceIssue,
      );
      reservation.requirements?.forEach((requirement, requirementIndex) => {
        const prefix = `offerings[${index}].reservations[${reservationIndex}].requirements[${requirementIndex}]`;
        requireEvidence(
          requirement.criterion,
          `${prefix}.criterion`,
          value.evidence,
          addEvidenceIssue,
        );
        requireEvidence(
          requirement.required,
          `${prefix}.required`,
          value.evidence,
          addEvidenceIssue,
        );
        requireEvidence(requirement.value, `${prefix}.value`, value.evidence, addEvidenceIssue);
      });
    });
  });

  value.requirements?.forEach((requirement, index) => {
    requireEvidence(
      requirement.criterion,
      `requirements[${index}].criterion`,
      value.evidence,
      addEvidenceIssue,
    );
    requireEvidence(
      requirement.required,
      `requirements[${index}].required`,
      value.evidence,
      addEvidenceIssue,
    );
    requireEvidence(
      requirement.value,
      `requirements[${index}].value`,
      value.evidence,
      addEvidenceIssue,
    );
  });
});

export type RequirementV1 = z.infer<typeof RequirementV1>;
export type ReservationV1 = z.infer<typeof ReservationV1>;
export type OfferingV1 = z.infer<typeof OfferingV1>;
export type ApplicationWindowV1 = z.infer<typeof ApplicationWindowV1>;
export type ExtractionV1 = z.infer<typeof ExtractionV1>;
