import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import { PrismaService } from '../../apps/api/dist/database/prisma.service.js';
import { ProcessingReviewService } from '../../apps/api/dist/modules/reviews/processing-review.service.js';

if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const database = new PrismaService();
test.after(async () => database.$disconnect());

test('curator explicitly creates a private draft from an artifact with exact reviewed source provenance', async () => {
  const suffix = randomUUID();
  const hash = createHash('sha256').update(suffix).digest('hex');
  const host = 'review-' + suffix.slice(0, 8) + '.edu.br';
  const url = `https://${host}/editais/2026`;
  const storageKey = `fixture-local/${hash}`;
  const institution = await database.institution.create({
    data: {
      name: `Integration University ${suffix}`,
      normalizedName: `integration university ${suffix}`,
      acronym: `T${suffix.slice(0, 5).toUpperCase()}`,
      jurisdiction: 'FEDERAL',
      verifiedAt: new Date(),
      referenceUrl: url,
    },
  });
  const domain = await database.allowedDomain.create({
    data: {
      institutionId: institution.id,
      host,
      evidenceUrl: url,
      reviewedAt: new Date(),
      collectionAllowed: true,
    },
  });
  const source = await database.source.create({
    data: {
      institutionId: institution.id,
      allowedDomainId: domain.id,
      url,
      kind: 'HTML_INDEX',
      status: 'ACTIVE',
    },
  });
  const run = await database.crawlRun.create({
    data: {
      sourceId: source.id,
      status: 'SUCCEEDED',
      success: true,
      startedAt: new Date('2026-01-01T00:00:00Z'),
      finishedAt: new Date('2026-01-01T00:00:01Z'),
    },
  });
  const candidate = await database.discoveredUrl.create({ data: { canonicalUrl: url } });
  await database.discoveryObservation.create({
    data: { discoveredUrlId: candidate.id, sourceId: source.id, crawlRunId: run.id },
  });
  await database.documentBlob.create({ data: { sha256: hash, storageKey, byteLength: 12 } });
  const document = await database.document.create({
    data: {
      discoveredUrlId: candidate.id,
      url,
      sha256: hash,
      storageKey,
      mediaType: 'application/pdf',
      version: 1,
    },
  });
  await database.documentProcessingResult.create({
    data: {
      documentId: document.id,
      sha256: hash,
      processorKind: 'CLASSIFICATION',
      schemaVersion: 1,
      status: 'PENDING_REVIEW',
      resultJson: {
        processor_kind: 'CLASSIFICATION',
        schema_version: 1,
        status: 'PENDING_REVIEW',
        result: null,
        reason: 'fixture',
      },
    },
  });
  const reviewItem = await database.documentProcessingReviewItem.create({
    data: { documentId: document.id, sha256: hash, discoveredUrlId: candidate.id },
  });
  const admin = await database.adminUser.create({
    data: {
      issuer: `https://issuer-${suffix}.example`,
      subject: `curator-${suffix}`,
      role: 'CURATOR',
    },
  });
  let processId;
  try {
    const service = new ProcessingReviewService(database);
    const options = await service.processOptions(reviewItem.id, institution.id);
    assert.deepEqual(options, []);
    const result = await service.resolve(
      reviewItem.id,
      {
        expectedReviewVersion: 0,
        institutionId: institution.id,
        reason: 'Revisar o resultado extraído com evidência oficial.',
      },
      { id: admin.id, issuer: admin.issuer, subject: admin.subject, requestId: suffix },
    );
    processId = result.processId;
    assert.equal(result.status, 'RESOLVED');
    const process = await database.selectionProcess.findUniqueOrThrow({ where: { id: processId } });
    assert.equal(process.referenceUrl, url);
    assert.equal(process.publicationStatus, 'RASCUNHO');
    assert.equal(process.ingestionState, 'NEEDS_REVIEW');
    assert.equal(process.noticeCode, null);
    const persisted = await database.documentProcessingReviewItem.findUniqueOrThrow({
      where: { id: reviewItem.id },
    });
    assert.equal(persisted.reviewVersion, 1);
    assert.equal(persisted.resolvedByAdminUserId, admin.id);
    assert.equal(
      await database.auditEvent.count({
        where: { resourceType: 'DocumentProcessingReviewItem', resourceId: reviewItem.id },
      }),
      1,
    );
    await assert.rejects(
      service.resolve(
        reviewItem.id,
        {
          expectedReviewVersion: 0,
          institutionId: institution.id,
          reason: 'Replay deve falhar.',
        },
        { id: admin.id, issuer: admin.issuer, subject: admin.subject, requestId: suffix },
      ),
    );
  } finally {
    await database.auditEvent.deleteMany({
      where: { resourceType: 'DocumentProcessingReviewItem', resourceId: reviewItem.id },
    });
    await database.documentProcessingReviewItem.delete({ where: { id: reviewItem.id } });
    if (processId) await database.selectionProcess.delete({ where: { id: processId } });
    await database.adminUser.delete({ where: { id: admin.id } });
    await database.documentProcessingResult.deleteMany({ where: { documentId: document.id } });
    await database.document.delete({ where: { id: document.id } });
    await database.documentBlob.delete({ where: { sha256: hash } });
    await database.discoveryObservation.deleteMany({ where: { discoveredUrlId: candidate.id } });
    await database.discoveredUrl.delete({ where: { id: candidate.id } });
    await database.crawlRun.delete({ where: { id: run.id } });
    await database.source.delete({ where: { id: source.id } });
    await database.allowedDomain.delete({ where: { id: domain.id } });
    await database.institution.delete({ where: { id: institution.id } });
  }
});
