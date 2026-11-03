import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import test from 'node:test';

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  server.close();
  await once(server, 'close');
  return port;
}

test('API serves health with configured CORS origin', async () => {
  const port = await freePort();
  const child = spawn(process.execPath, ['apps/api/dist/main.js'], {
    env: {
      ...process.env,
      DATABASE_URL: 'postgresql://test_user:test_password@127.0.0.1:5433/test_db',
      REDIS_URL: 'redis://127.0.0.1:6380',
      CORS_ORIGINS: 'http://127.0.0.1:4200',
      PORT: String(port),
    },
    stdio: 'ignore',
  });
  try {
    let response;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (child.exitCode !== null) throw new Error('API exited before health probe');
      try {
        response = await fetch(`http://127.0.0.1:${port}/health`, {
          headers: { Origin: 'http://127.0.0.1:4200' },
        });
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    assert.ok(response, 'API did not start in 10 seconds');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://127.0.0.1:4200');
    assert.deepEqual(await response.json(), { status: 'ok' });
    const ready = await fetch(`http://127.0.0.1:${port}/ready`);
    assert.equal(ready.status, 503);
    const readyBody = await ready.json();
    assert.equal(readyBody.error.code, 'SERVICE_UNAVAILABLE');
    assert.equal(readyBody.error.message, 'Service unavailable');
    assert.match(readyBody.error.requestId, /^[0-9a-f-]{36}$/u);
    assert.doesNotMatch(JSON.stringify(readyBody), /test_password|test_db/iu);
    const missing = await fetch(`http://127.0.0.1:${port}/missing`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, 'NOT_FOUND');
  } finally {
    child.kill();
  }
});
