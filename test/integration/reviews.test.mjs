import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaService } from '../../apps/api/dist/database/prisma.service.js';
import { ReviewsRepository } from '../../apps/api/dist/modules/reviews/reviews.repository.js';

if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const database = new PrismaService();
test.after(async () => database.$disconnect());

test('synthetic revision preserves its predecessor and review history rejects mutation', async () => {
  const institution = await database.institution.findUniqueOrThrow({ where: { acronym: 'UFPB' } });
  await assert.rejects(
    database.$transaction(async (tx) => {
      const review = new ReviewsRepository(tx);
      const process = await tx.selectionProcess.create({ data: { institutionId: institution.id } });
      assert.equal(process.publicationStatus, 'RASCUNHO');
      const url = 'fixture://local/revision';
      const documents = [];
      for (const [index, hash] of ['a'.repeat(64), 'b'.repeat(64)].entries()) {
        const storageKey = `fixture-local/${hash}`;
        await tx.documentBlob.create({ data: { sha256: hash, storageKey, byteLength: 8 } });
        documents.push(
          await tx.document.create({
            data: { url, sha256: hash, storageKey, mediaType: 'text/html', version: index + 1 },
          }),
        );
      }
      const original = await review.addRevision({
        processId: process.id,
        documentId: documents[0].id,
        changedFields: { endDate: '2026-08-20' },
      });
      const corrected = await review.addRevision({
        processId: process.id,
        documentId: documents[1].id,
        changedFields: { endDate: '2026-08-25' },
        supersedesId: original.id,
      });
      await review.addEvidence({
        processId: process.id,
        documentId: documents[1].id,
        fieldPath: 'windows[0].endDate',
        quote: 'Trecho sintético de teste',
      });
      const decision = await review.recordDecision({
        processId: process.id,
        reviewerId: 'fixture-reviewer',
        decision: 'REVISAR',
        reason: 'Dados sintéticos, sem publicação',
      });
      const [evidence, revisions, decisions] = await review.listHistory(process.id);
      assert.equal(evidence.length, 1);
      assert.equal(revisions.length, 2);
      assert.equal(decisions.length, 1);
      assert.equal(corrected.supersedesId, original.id);
      assert.equal(revisions[0].changedFieldsJson.endDate, '2026-08-20');
      assert.equal(decision.reviewerId, 'fixture-reviewer');
      const unchanged = await tx.selectionProcess.findUniqueOrThrow({ where: { id: process.id } });
      assert.equal(unchanged.publicationStatus, 'RASCUNHO');
      await tx.reviewDecision.update({ where: { id: decision.id }, data: { reason: 'alterado' } });
    }),
    /Review history is append-only/iu,
  );
  assert.equal(
    await database.reviewDecision.count({ where: { reviewerId: 'fixture-reviewer' } }),
    0,
  );
});
