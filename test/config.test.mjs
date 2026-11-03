import assert from 'node:assert/strict';
import test from 'node:test';
import { loadApiConfig, loadWorkerConfig } from '../apps/api/dist/config/environment.js';

const valid = {
  DATABASE_URL: 'postgresql://test_user:test_password@127.0.0.1:5433/test_db',
  REDIS_URL: 'redis://127.0.0.1:6380',
  CORS_ORIGINS: 'http://127.0.0.1:4200',
};

test('API and worker reject missing database configuration before starting', () => {
  assert.throws(() => loadApiConfig({}), /DATABASE_URL is required/);
  assert.throws(() => loadWorkerConfig({}), /DATABASE_URL is required/);
});

test('database URL requires a password without revealing its value in errors', () => {
  assert.throws(
    () => loadApiConfig({ ...valid, DATABASE_URL: 'postgresql://test_user@localhost:5432/db' }),
    /DATABASE_URL requires a username, password and database/,
  );
  assert.throws(
    () => loadApiConfig({ ...valid, DATABASE_URL: 'not-a-url:private_value' }),
    (error) => error.message.includes('DATABASE_URL') && !error.message.includes('private_value'),
  );
});

test('worker requires Redis while search and AI keys remain deferred', () => {
  assert.throws(
    () => loadWorkerConfig({ DATABASE_URL: valid.DATABASE_URL }),
    /REDIS_URL is required/,
  );
  assert.equal(loadWorkerConfig(valid).redisUrl, valid.REDIS_URL);
});

test('API rejects wildcard CORS and accepts only configured origins', () => {
  assert.throws(() => loadApiConfig({ ...valid, CORS_ORIGINS: '*' }), /CORS_ORIGINS/);
  assert.deepEqual(loadApiConfig(valid).corsOrigins, ['http://127.0.0.1:4200']);
});
