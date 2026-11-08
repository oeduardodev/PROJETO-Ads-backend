import assert from 'node:assert/strict';
import test from 'node:test';
import { AdminAuthorizationGuard } from '../apps/api/dist/modules/authz/admin-authorization.guard.js';
import { AuditRepository } from '../apps/api/dist/modules/audit/audit.repository.js';

function context(request) {
  return {
    getHandler: () => 'handler',
    getClass: () => 'controller',
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

function guard(roles, authorizedUser) {
  return new AdminAuthorizationGuard(
    { getAllAndOverride: () => roles },
    { findAuthorized: async () => authorizedUser },
  );
}

const principal = { issuer: 'https://identity.example', subject: 'user-123' };

test('server role mapping permits a curator review and exposes the trusted actor', async () => {
  const request = { auth: principal };
  const adminUser = { id: 'admin-id', ...principal, role: 'CURATOR' };
  const authorization = guard(['CURATOR', 'ADMIN'], adminUser);

  assert.equal(await authorization.canActivate(context(request)), true);
  assert.deepEqual(request.adminUser, adminUser);
});

test('a curator cannot perform admin source changes and unmapped users are denied', async () => {
  const curator = guard(['ADMIN'], null);
  const request = { auth: principal };
  await assert.rejects(curator.canActivate(context(request)), (error) => error.getStatus() === 403);

  const unmapped = guard(['CURATOR', 'ADMIN'], null);
  await assert.rejects(
    unmapped.canActivate(context(request)),
    (error) => error.getStatus() === 403,
  );
});

test('authorization guard requires a verified identity and declared roles', async () => {
  await assert.rejects(
    guard(['CURATOR'], null).canActivate(context({})),
    (error) => error.getStatus() === 401,
  );
  await assert.rejects(
    guard([], null).canActivate(context({ auth: principal })),
    (error) => error.getStatus() === 403,
  );
});

test('audit repository persists actor, reason, and bounded before/after snapshots', async () => {
  let persisted;
  const repository = new AuditRepository({
    auditEvent: { create: async ({ data }) => ((persisted = data), { id: 'event-1', ...data }) },
  });
  const input = {
    actorAdminUserId: 'admin-id',
    actorIssuer: principal.issuer,
    actorSubject: principal.subject,
    action: 'process.approve',
    resourceType: 'selection_process',
    resourceId: 'process-1',
    reason: 'Official notice and evidence reviewed',
    before: { publicationStatus: 'EM_REVISAO' },
    after: { publicationStatus: 'PUBLICADO' },
    requestId: 'request-1',
  };

  await repository.record(input);
  assert.equal(persisted.actor.connect.id, input.actorAdminUserId);
  assert.equal(persisted.actorIssuer, principal.issuer);
  assert.equal(persisted.reason, input.reason);
  assert.deepEqual(persisted.beforeJson, input.before);
  assert.deepEqual(persisted.afterJson, input.after);
});

test('audit repository rejects missing reasons, oversized snapshots, and secret-bearing snapshots', async () => {
  const repository = new AuditRepository({ auditEvent: { create: async () => ({}) } });
  const input = {
    actorAdminUserId: 'admin-id',
    actorIssuer: principal.issuer,
    actorSubject: principal.subject,
    action: 'source.update',
    resourceType: 'source',
    resourceId: 'source-1',
    reason: 'Reviewed official source change',
  };

  assert.throws(() => repository.record({ ...input, reason: '  ' }));
  assert.throws(() => repository.record({ ...input, after: { token: 'do-not-log' } }));
  assert.throws(() => repository.record({ ...input, after: { description: 'x'.repeat(33_000) } }));
});
