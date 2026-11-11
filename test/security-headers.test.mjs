import assert from 'node:assert/strict';
import test from 'node:test';
import { setApiSecurityHeaders } from '../apps/api/dist/common/security/api-security-headers.js';

test('sets baseline API headers that disable sniffing, framing and active content', () => {
  const headers = new Map();
  setApiSecurityHeaders({ setHeader: (name, value) => headers.set(name, value) });

  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-frame-options'), 'DENY');
  assert.equal(headers.get('referrer-policy'), 'no-referrer');
  assert.equal(headers.get('x-permitted-cross-domain-policies'), 'none');
  assert.equal(
    headers.get('content-security-policy'),
    "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  );
  assert.equal(headers.get('permissions-policy'), 'camera=(), geolocation=(), microphone=()');
  assert.equal(headers.has('strict-transport-security'), false);
});
