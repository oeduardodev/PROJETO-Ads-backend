import assert from 'node:assert/strict';
import test from 'node:test';
import { DocumentProcessorKind } from '../apps/api/dist/generated/prisma/enums.js';
import { ProcessingResultsRepository } from '../apps/api/dist/modules/documents/processing-results.repository.js';
import { DocumentProcessingProcessor } from '../apps/api/dist/modules/jobs/document-processing.processor.js';

const documentId = 'c20e3c31-e995-4aec-8d83-7ec4cf59c3f8';
const sha256 = 'a'.repeat(64);

function databaseStub() {
  const rows = new Map();
  const database = {
    document: {
      async findUnique() {
        return { sha256 };
      },
    },
    documentProcessingResult: {
      async createMany({ data }) {
        for (const item of data) {
          const key = [item.documentId, item.sha256, item.processorKind, item.schemaVersion].join(
            ':',
          );
          if (!rows.has(key)) rows.set(key, { ...item, id: 'result-id' });
        }
        return { count: data.length };
      },
      async findUnique({ where }) {
        const key = [
          where.documentId_sha256_processorKind_schemaVersion.documentId,
          where.documentId_sha256_processorKind_schemaVersion.sha256,
          where.documentId_sha256_processorKind_schemaVersion.processorKind,
          where.documentId_sha256_processorKind_schemaVersion.schemaVersion,
        ].join(':');
        return rows.get(key) ?? null;
      },
    },
  };
  return { database, rows };
}

test('processing results are immutable and idempotent for document/hash/kind/schema', async () => {
  const { database, rows } = databaseStub();
  const repository = new ProcessingResultsRepository(database);
  const input = {
    documentId,
    sha256,
    processorKind: DocumentProcessorKind.CLASSIFICATION,
    schemaVersion: 1,
    status: 'PENDING_REVIEW',
    result: {
      processor_kind: 'CLASSIFICATION',
      schema_version: 1,
      status: 'PENDING_REVIEW',
      result: null,
      reason: 'connector disabled',
    },
  };
  const first = await repository.recordImmutable(input);
  const replay = await repository.recordImmutable({
    ...input,
    result: { ...input.result, reason: 'different replay output' },
  });

  assert.equal(rows.size, 1);
  assert.deepEqual(replay.resultJson, first.resultJson);
  assert.equal(replay.status, 'PENDING_REVIEW');
});

test('processing results reject a hash that does not match the document', async () => {
  const { database } = databaseStub();
  const repository = new ProcessingResultsRepository(database);
  await assert.rejects(
    repository.recordImmutable({
      documentId,
      sha256: 'b'.repeat(64),
      processorKind: DocumentProcessorKind.CLASSIFICATION,
      schemaVersion: 1,
      status: 'PENDING_REVIEW',
      result: {
        processor_kind: 'CLASSIFICATION',
        schema_version: 1,
        status: 'PENDING_REVIEW',
        result: null,
        reason: 'test',
      },
    }),
    /does not match document/u,
  );
});

test('document job consumers persist conservative review results without enabling external AI', async () => {
  const recorded = [];
  const processor = new DocumentProcessingProcessor({
    async documentHash(id) {
      assert.equal(id, documentId);
      return sha256;
    },
    async recordImmutable(input) {
      recorded.push(input);
      return input;
    },
  });
  await processor.classify({ data: { documentId, sha256 } });
  await processor.extract({ data: { documentId, schemaVersion: 1 } });

  assert.equal(recorded.length, 2);
  assert.deepEqual(
    recorded.map((item) => item.status),
    ['PENDING_REVIEW', 'PENDING_REVIEW'],
  );
  assert.deepEqual(
    recorded.map((item) => item.processorKind),
    [DocumentProcessorKind.CLASSIFICATION, DocumentProcessorKind.EXTRACTION],
  );
  assert.equal(recorded[0].result.reason, 'CLASSIFICATION_CONNECTOR_NOT_CONFIGURED');
  assert.equal(recorded[1].result.reason, 'EXTRACTION_CONNECTOR_NOT_CONFIGURED');
});
