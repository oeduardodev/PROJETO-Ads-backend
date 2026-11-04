import type { SchemaObject } from '@nestjs/swagger';

export const schemaRef = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const uuid = { type: 'string', format: 'uuid' };
const timestamp = { type: 'string', format: 'date-time' };
const nullableTimestamp = { ...timestamp, nullable: true };
const nullableString = { type: 'string', nullable: true };
const nullableInteger = { type: 'integer', nullable: true };
const nullableBoolean = { type: 'boolean', nullable: true };
const uri = { type: 'string', format: 'uri' };
const publicStatus = {
  type: 'string',
  enum: ['PREVISTA', 'ABERTA', 'ENCERRADA', 'INDETERMINADA'],
};

export const publicSchemas: Record<string, SchemaObject> = {
  ApiError: {
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'object',
        required: ['code', 'message', 'status', 'requestId'],
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          status: { type: 'integer' },
          requestId: uuid,
        },
      },
    },
  },
  PageMeta: {
    type: 'object',
    required: ['page', 'pageSize', 'total'],
    properties: {
      page: { type: 'integer', minimum: 1 },
      pageSize: { type: 'integer', minimum: 1, maximum: 100 },
      total: { type: 'integer', minimum: 0 },
    },
  },
  Institution: {
    type: 'object',
    required: [
      'id',
      'name',
      'acronym',
      'jurisdiction',
      'verifiedAt',
      'referenceUrl',
      'campuses',
      'monitoring',
    ],
    properties: {
      id: uuid,
      name: { type: 'string' },
      acronym: { type: 'string' },
      jurisdiction: { type: 'string', enum: ['FEDERAL', 'ESTADUAL'] },
      verifiedAt: timestamp,
      referenceUrl: { ...uri, nullable: true },
      campuses: { type: 'array', items: schemaRef('Campus') },
      monitoring: schemaRef('InstitutionMonitoring'),
    },
  },
  Campus: {
    type: 'object',
    required: ['id', 'name', 'city', 'state', 'timezone', 'verifiedAt'],
    properties: {
      id: uuid,
      name: { type: 'string' },
      city: { type: 'string' },
      state: { type: 'string', minLength: 2, maxLength: 2 },
      timezone: { type: 'string' },
      verifiedAt: timestamp,
    },
  },
  InstitutionMonitoring: {
    type: 'object',
    required: ['activeSourceCount', 'lastCheckedAt', 'lastSuccessAt'],
    properties: {
      activeSourceCount: { type: 'integer', minimum: 1 },
      lastCheckedAt: nullableTimestamp,
      lastSuccessAt: nullableTimestamp,
    },
  },
  InstitutionList: {
    type: 'object',
    required: ['data', 'meta'],
    properties: {
      data: { type: 'array', items: schemaRef('Institution') },
      meta: schemaRef('PageMeta'),
    },
  },
  FacetValue: {
    type: 'object',
    required: ['value', 'count'],
    properties: {
      value: { type: 'string' },
      count: { type: 'integer', minimum: 1 },
    },
  },
  Filters: {
    type: 'object',
    required: ['total', 'facets'],
    properties: {
      total: { type: 'integer', minimum: 0 },
      facets: {
        type: 'object',
        required: ['uf', 'modality', 'selectionType', 'requiresEnem'],
        properties: {
          uf: { type: 'array', items: schemaRef('FacetValue') },
          modality: { type: 'array', items: schemaRef('FacetValue') },
          selectionType: { type: 'array', items: schemaRef('FacetValue') },
          requiresEnem: { type: 'array', items: schemaRef('FacetValue') },
        },
      },
    },
  },
  ProcessInstitution: {
    type: 'object',
    required: ['id', 'name', 'acronym'],
    properties: {
      id: uuid,
      name: { type: 'string' },
      acronym: { type: 'string' },
    },
  },
  ProcessCard: {
    type: 'object',
    required: [
      'id',
      'noticeCode',
      'selectionType',
      'requiresEnem',
      'verifiedAt',
      'officialNoticeUrl',
      'institution',
      'offeringCount',
      'coursePreview',
      'nextDeadlineAt',
      'applicationStatus',
    ],
    properties: {
      id: uuid,
      noticeCode: nullableString,
      selectionType: { type: 'string' },
      requiresEnem: nullableBoolean,
      verifiedAt: timestamp,
      officialNoticeUrl: uri,
      institution: schemaRef('ProcessInstitution'),
      offeringCount: { type: 'integer', minimum: 0 },
      coursePreview: { type: 'array', items: { type: 'string' }, maxItems: 3 },
      nextDeadlineAt: nullableTimestamp,
      applicationStatus: publicStatus,
    },
  },
  ProcessList: {
    type: 'object',
    required: ['data', 'meta'],
    properties: {
      data: { type: 'array', items: schemaRef('ProcessCard') },
      meta: schemaRef('PageMeta'),
    },
  },
  OfferingReservation: {
    type: 'object',
    required: ['id', 'category', 'seats'],
    properties: { id: uuid, category: { type: 'string' }, seats: nullableInteger },
  },
  DetailCampus: {
    type: 'object',
    required: ['id', 'name', 'city', 'state', 'timezone', 'verifiedAt'],
    properties: {
      id: uuid,
      name: { type: 'string' },
      city: { type: 'string' },
      state: { type: 'string' },
      timezone: { type: 'string' },
      verifiedAt: timestamp,
    },
  },
  Offering: {
    type: 'object',
    required: [
      'id',
      'courseName',
      'degreeType',
      'modality',
      'shift',
      'seats',
      'campus',
      'reservations',
    ],
    properties: {
      id: uuid,
      courseName: { type: 'string' },
      degreeType: nullableString,
      modality: nullableString,
      shift: nullableString,
      seats: nullableInteger,
      campus: { allOf: [schemaRef('DetailCampus')], nullable: true },
      reservations: { type: 'array', items: schemaRef('OfferingReservation') },
    },
  },
  ApplicationWindow: {
    type: 'object',
    required: [
      'id',
      'offeringId',
      'label',
      'applicationStatus',
      'startDate',
      'startTime',
      'endDate',
      'endTime',
      'timezone',
      'instructionsUrl',
    ],
    properties: {
      id: uuid,
      offeringId: { ...uuid, nullable: true },
      label: nullableString,
      applicationStatus: publicStatus,
      startDate: { type: 'string', format: 'date', nullable: true },
      startTime: nullableString,
      endDate: { type: 'string', format: 'date', nullable: true },
      endTime: nullableString,
      timezone: nullableString,
      instructionsUrl: { ...uri, nullable: true },
    },
  },
  Requirement: {
    type: 'object',
    required: ['id', 'offeringId', 'reservationId', 'criterion', 'required', 'value'],
    properties: {
      id: uuid,
      offeringId: { ...uuid, nullable: true },
      reservationId: { ...uuid, nullable: true },
      criterion: { type: 'string' },
      required: nullableBoolean,
      value: { description: 'Valor estruturado revisado, ou null quando ausente', nullable: true },
    },
  },
  Evidence: {
    type: 'object',
    required: [
      'fieldPath',
      'pageOrSection',
      'quote',
      'checkedAt',
      'documentUrl',
      'documentIssuedAt',
    ],
    properties: {
      fieldPath: { type: 'string' },
      pageOrSection: nullableString,
      quote: { type: 'string' },
      checkedAt: nullableTimestamp,
      documentUrl: uri,
      documentIssuedAt: nullableTimestamp,
    },
  },
  ProcessDetail: {
    type: 'object',
    required: [
      'id',
      'noticeCode',
      'noticeYear',
      'selectionType',
      'requiresEnem',
      'tuitionFree',
      'verifiedAt',
      'applicationStatus',
      'officialNoticeUrl',
      'institution',
      'offerings',
      'windows',
      'requirements',
      'evidence',
    ],
    properties: {
      id: uuid,
      noticeCode: nullableString,
      noticeYear: nullableInteger,
      selectionType: { type: 'string' },
      requiresEnem: nullableBoolean,
      tuitionFree: { type: 'boolean', enum: [true] },
      verifiedAt: timestamp,
      applicationStatus: publicStatus,
      officialNoticeUrl: uri,
      institution: {
        allOf: [schemaRef('ProcessInstitution')],
        properties: { jurisdiction: { type: 'string', enum: ['FEDERAL', 'ESTADUAL'] } },
        required: ['jurisdiction'],
      },
      offerings: { type: 'array', items: schemaRef('Offering') },
      windows: { type: 'array', items: schemaRef('ApplicationWindow') },
      requirements: { type: 'array', items: schemaRef('Requirement') },
      evidence: { type: 'array', items: schemaRef('Evidence') },
    },
  },
};
