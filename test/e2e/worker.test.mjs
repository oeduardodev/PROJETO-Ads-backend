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

function waitForReady(child, output) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Worker did not start: ' + output())),
      10_000,
    );
    const check = () => {
      if (output().includes('Worker initialized without an HTTP listener')) {
        clearTimeout(timeout);
        resolve();
      }
      if (child.exitCode !== null) {
        clearTimeout(timeout);
        reject(new Error('Worker exited during startup: ' + output()));
      }
    };
    child.stdout.on('data', check);
    child.stderr.on('data', check);
  });
}

test('worker stays available without HTTP and closes its Nest context gracefully', async () => {
  const port = await freePort();
  const child = spawn(process.execPath, ['apps/api/dist/worker.js'], {
    env: {
      ...process.env,
      DATABASE_URL: 'postgresql://test_user:test_password@127.0.0.1:5433/test_db',
      REDIS_URL: process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6380',
      LOG_LEVEL: 'error',
      CORS_ORIGINS: 'http://127.0.0.1:4200',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => (output += chunk));
  child.stderr.on('data', (chunk) => (output += chunk));

  try {
    await waitForReady(child, () => output);
    assert.equal(child.exitCode, null, 'worker should remain available before shutdown');
    await assert.rejects(fetch('http://127.0.0.1:' + port + '/health'));

    const exited = once(child, 'exit');
    if (process.platform === 'win32') child.send({ type: 'shutdown' });
    else child.kill('SIGTERM');
    const [code, signal] = await exited;
    assert.equal(signal, null);
    assert.equal(code, 0, output);
  } finally {
    if (child.exitCode === null) child.kill();
  }
});
