import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import test from 'node:test';
import { stopChild } from '../helpers/stop-child.mjs';

if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required');

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  server.close();
  await once(server, 'close');
  return port;
}

async function probe(databaseUrl, redisUrl) {
  const port = await freePort();
  const child = spawn(process.execPath, ['apps/api/dist/main.js'], {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      REDIS_URL: redisUrl,
      CORS_ORIGINS: 'http://127.0.0.1:4200',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (chunk) => {
    logs += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    logs += chunk.toString();
  });
  try {
    let started = false;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (child.exitCode !== null) throw new Error(`API exited before probe: ${logs}`);
      try {
        const health = await fetch(`http://127.0.0.1:${port}/health`);
        if (health.ok) {
          started = true;
          break;
        }
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    assert.ok(started, 'API did not start in 20 seconds');
    const response = await fetch(`http://127.0.0.1:${port}/ready`);
    const body = await response.json();
    return { status: response.status, body, logs: () => logs };
  } finally {
    await stopChild(child);
  }
}

test('readiness requires both PostgreSQL and Redis and reports safe errors', async () => {
  const goodDatabase = process.env.TEST_DATABASE_URL;
  const goodRedis = process.env.TEST_REDIS_URL || 'redis://127.0.0.1:6380';
  const ready = await probe(goodDatabase, goodRedis);
  assert.equal(ready.status, 200);
  assert.deepEqual(ready.body, { status: 'ready', dependencies: { database: 'up', redis: 'up' } });

  const redisDown = await probe(goodDatabase, 'redis://127.0.0.1:6399');
  assert.equal(redisDown.status, 503);
  assert.equal(redisDown.body.error.code, 'SERVICE_UNAVAILABLE');
  assert.match(redisDown.logs(), /readiness redis failed/iu);
  assert.doesNotMatch(redisDown.body.error.message, /6399/iu);

  const badDatabase = new URL(goodDatabase);
  badDatabase.pathname = '/alem_do_sisu_missing_readiness';
  const databaseDown = await probe(badDatabase.toString(), goodRedis);
  assert.equal(databaseDown.status, 503);
  assert.equal(databaseDown.body.error.code, 'SERVICE_UNAVAILABLE');
  assert.match(databaseDown.logs(), /readiness database failed/iu);
  assert.doesNotMatch(databaseDown.body.error.message, /alem_do_sisu_missing_readiness/iu);
});
