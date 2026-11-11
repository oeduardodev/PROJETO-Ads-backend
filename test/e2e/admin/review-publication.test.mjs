import assert from 'node:assert/strict';
import {
  generateKeyPair,
  exportJWK,
  SignJWT,
} from '../../../apps/api/node_modules/jose/dist/webapi/index.js';
import test from 'node:test';
import { Reflector } from '../../../apps/api/node_modules/@nestjs/core/index.js';
import { AdminRole } from '../../../apps/api/dist/generated/prisma/enums.js';
import { AuthTokenVerifier } from '../../../apps/api/dist/modules/auth/auth-token.verifier.js';
import { AuthenticationGuard } from '../../../apps/api/dist/modules/auth/authentication.guard.js';
import { AdminAuthorizationGuard } from '../../../apps/api/dist/modules/authz/admin-authorization.guard.js';
import { AdminUserRepository } from '../../../apps/api/dist/modules/authz/admin-user.repository.js';
import { AdminReviewController } from '../../../apps/api/dist/modules/reviews/admin.controller.js';
import { AdminReviewCommandsService } from '../../../apps/api/dist/modules/reviews/commands/admin-review-commands.service.js';
import { ReviewCommandsRepository } from '../../../apps/api/dist/modules/reviews/commands/review-commands.repository.js';
import { PublicDetailService } from '../../../apps/api/dist/modules/processes/public-detail/public-detail.service.js';

const processId = '11111111-1111-4111-8111-111111111111';
const windowId = '22222222-2222-4222-8222-222222222222';
const evidenceId = '33333333-3333-4333-8333-333333333333';
const documentId = '44444444-4444-4444-8444-444444444444';
const issuer = 'https://identity.example.test';
const audience = 'alem-do-sisu-api';
const subject = 'curator-01';
const evidenceUrl = 'https://prg.example.edu/edital.pdf';

async function signedAdminToken(sub = subject) {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const publicJwk = await exportJWK(publicKey);
  Object.assign(publicJwk, { kid: 'admin-e2e-key', alg: 'RS256', use: 'sig' });
  const token = await new SignJWT({ role: 'ADMIN' })
    .setProtectedHeader({ alg: 'RS256', kid: 'admin-e2e-key' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
  const env = {
    ADMIN_AUTH_ISSUER: issuer,
    ADMIN_AUTH_AUDIENCE: audience,
    ADMIN_AUTH_JWKS_URL: `${issuer}/.well-known/jwks.json`,
  };
  const fetcher = async () =>
    new Response(JSON.stringify({ keys: [publicJwk] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  return { authorization: `Bearer ${token}`, env, fetcher };
}

function fixtureDatabase() {
  const state = {
    process: {
      id: processId,
      noticeCode: 'REM-2026-01',
      noticeYear: 2026,
      selectionType: 'VESTIBULAR',
      requiresEnem: false,
      tuitionFree: true,
      regularSisuFlow: false,
      ingestionState: 'NEEDS_REVIEW',
      publicationStatus: 'EM_REVISAO',
      ingestionStateReason: 'Prazo de encerramento incompleto',
      reviewVersion: 0,
      verifiedAt: null,
      referenceUrl: 'https://prg.example.edu/edital',
    },
    window: {
      id: windowId,
      processId,
      offeringId: null,
      label: 'Inscrições',
      startDate: new Date('2026-11-10T00:00:00.000Z'),
      startTime: '08:00',
      endDate: new Date('2026-11-12T00:00:00.000Z'),
      endTime: null,
      timezone: 'America/Sao_Paulo',
      instructionsUrl: null,
    },
    evidence: {
      id: evidenceId,
      processId,
      fieldPath: 'windows[0].endTime',
      pageOrSection: 'Cronograma, página 2',
      quote: 'Encerramento das inscrições às 18h.',
      checkedAt: new Date('2026-11-10T12:00:00.000Z'),
      document: {
        id: documentId,
        url: evidenceUrl,
        sha256: 'a'.repeat(64),
        issuedAt: new Date('2026-11-09T00:00:00.000Z'),
      },
    },
    decisions: [],
    audits: [],
  };
  const source = {
    status: 'ACTIVE',
    allowedDomain: { host: 'prg.example.edu', reviewedAt: new Date() },
  };
  const publicProcess = () => ({
    ...state.process,
    institution: {
      id: '55555555-5555-4555-8555-555555555555',
      name: 'Universidade Pública de Exemplo',
      acronym: 'UPE',
      jurisdiction: 'FEDERAL',
      sources: [{ allowedDomain: { host: source.allowedDomain.host } }],
    },
    offerings: [],
    windows: [state.window],
    requirements: [],
    evidence: [state.evidence],
  });
  const database = {
    adminUser: {
      findFirst: async ({ where }) =>
        where.issuer === issuer &&
        where.subject === subject &&
        where.active === true &&
        where.role.in.includes(AdminRole.CURATOR)
          ? { id: 'admin-user-01', issuer, subject, role: AdminRole.CURATOR }
          : null,
    },
    selectionProcess: {
      findUnique: async () => ({
        ...state.process,
        institution: { sources: [source] },
      }),
      findFirst: async () =>
        state.process.publicationStatus === 'PUBLICADO' ? publicProcess() : null,
      updateMany: async ({ where, data }) => {
        if (where.id !== processId || where.reviewVersion !== state.process.reviewVersion) {
          return { count: 0 };
        }
        for (const [key, value] of Object.entries(data)) {
          state.process[key] = value?.increment ? state.process[key] + value.increment : value;
        }
        return { count: 1 };
      },
    },
    applicationWindow: {
      findFirst: async ({ where }) =>
        where.id === windowId && where.processId === processId ? state.window : null,
      update: async ({ data }) => Object.assign(state.window, data),
    },
    evidence: {
      findMany: async ({ where }) =>
        where.processId === processId && where.id.in.includes(evidenceId)
          ? [
              {
                id: evidenceId,
                fieldPath: state.evidence.fieldPath,
                pageOrSection: state.evidence.pageOrSection,
                document: { url: evidenceUrl, sha256: 'a'.repeat(64) },
              },
            ]
          : [],
    },
    reviewDecision: { create: async ({ data }) => (state.decisions.push(data), data) },
    auditEvent: { create: async ({ data }) => (state.audits.push(data), data) },
  };
  database.$transaction = async (callback) => callback(database);
  return { database, state, source };
}

function requestContext(handler, request) {
  return {
    getHandler: () => handler,
    getClass: () => AdminReviewController,
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

async function authenticateRequest(token, handler, request) {
  const verifier = new AuthTokenVerifier();
  const guard = new AuthenticationGuard({
    verifyAuthorizationHeader: (authorization) =>
      verifier.verifyAuthorizationHeader(authorization, token.env, token.fetcher),
  });
  await guard.canActivate(requestContext(handler, request));
}

test('curator JWT cannot publish ambiguous deadline before evidence correction; audit and public detail follow review', async () => {
  const memory = fixtureDatabase();
  const token = await signedAdminToken();
  const controller = new AdminReviewController(
    {},
    new AdminReviewCommandsService(memory.database, new ReviewCommandsRepository(memory.database)),
  );
  const handler = AdminReviewController.prototype.approve;
  const request = { headers: { authorization: token.authorization } };
  await authenticateRequest(token, handler, request);
  await new AdminAuthorizationGuard(
    new Reflector(),
    new AdminUserRepository(memory.database),
  ).canActivate(requestContext(handler, request));

  assert.equal(request.adminUser.role, AdminRole.CURATOR);
  assert.equal(request.auth.claims.role, 'ADMIN');
  const publicDetail = new PublicDetailService(memory.database);
  await assert.rejects(publicDetail.get(processId, Date.parse('2026-11-11T16:00:00.000Z')));

  await assert.rejects(
    controller.approve(
      processId,
      {
        expectedReviewVersion: 0,
        reason: 'A data final ainda não está confirmada.',
        evidenceIds: [evidenceId],
        scopeEligible: true,
        unresolvedCriticalFacts: true,
      },
      request,
    ),
  );
  assert.equal(memory.state.process.publicationStatus, 'EM_REVISAO');

  const correctionRequest = { ...request };
  await new AdminAuthorizationGuard(
    new Reflector(),
    new AdminUserRepository(memory.database),
  ).canActivate(requestContext(AdminReviewController.prototype.correct, correctionRequest));
  await controller.correct(
    processId,
    {
      expectedReviewVersion: 0,
      reason: 'Horário confirmado no cronograma oficial.',
      patches: [
        {
          target: 'window',
          targetId: windowId,
          field: 'endTime',
          value: '18:00',
          evidenceId,
        },
      ],
    },
    correctionRequest,
  );
  assert.equal(memory.state.process.reviewVersion, 1);
  assert.equal(memory.state.process.publicationStatus, 'EM_REVISAO');
  assert.equal(memory.state.window.endTime, '18:00');

  await assert.rejects(
    controller.approve(
      processId,
      {
        expectedReviewVersion: 0,
        reason: 'Versão anterior.',
        evidenceIds: [evidenceId],
        scopeEligible: true,
        unresolvedCriticalFacts: false,
      },
      request,
    ),
    (error) => error.getStatus() === 409,
  );

  await controller.approve(
    processId,
    {
      expectedReviewVersion: 1,
      reason: 'Prazo completo confirmado no edital oficial.',
      evidenceIds: [evidenceId],
      scopeEligible: true,
      unresolvedCriticalFacts: false,
    },
    request,
  );
  const published = await publicDetail.get(processId, new Date('2026-11-11T16:00:00.000Z'));
  assert.equal(published.applicationStatus, 'ABERTA');
  assert.equal(published.windows[0].endTime, '18:00');
  assert.equal(memory.state.decisions.length, 2);
  assert.deepEqual(
    memory.state.decisions.map((decision) => decision.decision),
    ['CORRECTED', 'APPROVED_AND_PUBLISHED'],
  );
  assert.equal(memory.state.audits.length, 2);
  assert.equal(memory.state.audits[0].action, 'process.correct');
  assert.equal(memory.state.audits[0].actorAdminUserId, 'admin-user-01');
  assert.equal(memory.state.audits[0].afterJson.fields[0].evidence.sha256, 'a'.repeat(64));
});

test('valid signed token without a server-side admin mapping is forbidden', async () => {
  const memory = fixtureDatabase();
  const token = await signedAdminToken('unmapped-user');
  const request = { headers: { authorization: token.authorization } };
  await authenticateRequest(token, AdminReviewController.prototype.approve, request);
  const guard = new AdminAuthorizationGuard(
    new Reflector(),
    new AdminUserRepository(memory.database),
  );
  await assert.rejects(
    guard.canActivate(requestContext(AdminReviewController.prototype.approve, request)),
    (error) => error.getStatus() === 403,
  );
});
