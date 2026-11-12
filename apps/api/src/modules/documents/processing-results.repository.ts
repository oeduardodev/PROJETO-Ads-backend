import { Injectable } from '@nestjs/common';
import { DocumentProcessorKind } from '../../generated/prisma/enums.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import { z } from 'zod';
import { ClassificationV1, ExtractionV1 } from '../ai/schemas/index.js';

export interface DocumentProcessingResultInput {
  documentId: string;
  sha256: string;
  processorKind: DocumentProcessorKind;
  schemaVersion: number;
  status: 'COMPLETED' | 'PENDING_REVIEW' | 'EXCLUDED';
  result: unknown;
}

const SHA256 = /^[0-9a-f]{64}$/iu;
const ResultStatus = z.enum(['COMPLETED', 'PENDING_REVIEW', 'EXCLUDED']);
const ClassificationResultV1 = z.strictObject({
  processor_kind: z.literal('CLASSIFICATION'),
  schema_version: z.literal(1),
  status: ResultStatus,
  result: ClassificationV1.nullable(),
  reason: z.string().nullable(),
});
const ExtractionResultV1 = z.strictObject({
  processor_kind: z.literal('EXTRACTION'),
  schema_version: z.number().int().positive(),
  status: ResultStatus,
  result: ExtractionV1.nullable(),
  reason: z.string().nullable(),
});

function jsonObject(value: unknown): Prisma.InputJsonObject {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new TypeError('Processing result must be JSON serializable');
  }
  if (serialized === undefined) throw new TypeError('Processing result must be JSON serializable');
  const normalized: unknown = JSON.parse(serialized);
  if (normalized === null || typeof normalized !== 'object' || Array.isArray(normalized)) {
    throw new TypeError('Processing result must be a JSON object');
  }
  return normalized as Prisma.InputJsonObject;
}

@Injectable()
export class ProcessingResultsRepository {
  constructor(private readonly database: PrismaService) {}

  async documentHash(documentId: string): Promise<string | null> {
    const document = await this.database.document.findUnique({
      where: { id: documentId },
      select: { sha256: true },
    });
    return document?.sha256 ?? null;
  }

  async recordImmutable(input: DocumentProcessingResultInput) {
    if (!SHA256.test(input.sha256))
      throw new TypeError('sha256 must contain 64 hexadecimal characters');
    if (!Number.isSafeInteger(input.schemaVersion) || input.schemaVersion < 1) {
      throw new TypeError('schemaVersion must be a positive safe integer');
    }
    const parsedResult =
      input.processorKind === DocumentProcessorKind.CLASSIFICATION
        ? ClassificationResultV1.safeParse(input.result)
        : ExtractionResultV1.safeParse(input.result);
    if (!parsedResult.success)
      throw new TypeError('Processing result does not match its typed schema');
    if (
      parsedResult.data.status !== input.status ||
      parsedResult.data.schema_version !== input.schemaVersion
    ) {
      throw new TypeError('Processing result identity does not match its typed schema');
    }
    const resultJson = jsonObject(parsedResult.data);
    const sha256 = input.sha256.toLowerCase();
    const document = await this.database.document.findUnique({
      where: { id: input.documentId },
      select: { sha256: true },
    });
    if (!document) throw new Error('Processing result requires an existing document');
    if (document.sha256 !== sha256)
      throw new Error('Processing result hash does not match document');

    await this.database.documentProcessingResult.createMany({
      data: [
        {
          documentId: input.documentId,
          sha256,
          processorKind: input.processorKind,
          schemaVersion: input.schemaVersion,
          status: input.status,
          resultJson,
        },
      ],
      skipDuplicates: true,
    });
    const stored = await this.database.documentProcessingResult.findUnique({
      where: {
        documentId_sha256_processorKind_schemaVersion: {
          documentId: input.documentId,
          sha256,
          processorKind: input.processorKind,
          schemaVersion: input.schemaVersion,
        },
      },
    });
    if (!stored) throw new Error('Processing result was not persisted');
    return stored;
  }
}
