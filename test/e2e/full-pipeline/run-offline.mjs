import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const frontendRoot = resolve(backendRoot, '../frontend');
const packageManager = process.env.npm_execpath;
if (!packageManager) throw new Error('Run this harness through the workspace package manager');

async function run(name, cwd, script = 'test:e2e') {
  console.log(`\n=== ${name} ===`);
  const child = spawn(packageManager, [script], {
    cwd,
    stdio: 'inherit',
  });
  const [code, signal] = await once(child, 'exit');
  if (code !== 0) {
    throw new Error(`${name} failed with ${signal ?? `exit code ${code}`}`);
  }
}

await run('Backend offline E2E fixtures', backendRoot);
if (process.env.TEST_DATABASE_URL) {
  const testDatabase = new URL(process.env.TEST_DATABASE_URL);
  const testRedis = process.env.TEST_REDIS_URL ? new URL(process.env.TEST_REDIS_URL) : null;
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(testDatabase.hostname) ||
    !/(?:_e2e|_test)$/u.test(testDatabase.pathname.slice(1))
  ) {
    throw new Error(
      'TEST_DATABASE_URL must target loopback and a database ending in _e2e or _test',
    );
  }
  if (
    !testRedis ||
    testRedis.protocol !== 'redis:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(testRedis.hostname)
  ) {
    throw new Error('TEST_REDIS_URL must target a local Redis service');
  }
  await run(
    'PostgreSQL and Redis integration (migrations and local seed required)',
    backendRoot,
    'test:integration',
  );
} else {
  console.log('\n=== Database/Redis integration skipped: TEST_DATABASE_URL is not set ===');
}
await run('Angular Playwright journeys with mocked API', frontendRoot);
console.log('\nOffline checks passed; independent suites do not prove one connected pipeline.');
