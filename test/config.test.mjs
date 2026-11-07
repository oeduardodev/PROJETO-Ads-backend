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
  assert.equal(loadWorkerConfig(valid).crawlConcurrency, 1);
  assert.equal(loadWorkerConfig(valid).searchDailyQuotaPerHost, 0);
  assert.equal(loadWorkerConfig(valid).maxPdfBytes, 10 * 1024 * 1024);
  assert.equal(loadWorkerConfig(valid).ocrDailyPageBudget, 0);
  assert.equal(loadWorkerConfig(valid).ocrMaxPagesPerDocument, 5);
  assert.equal(loadWorkerConfig(valid).aiMaxTokensPerDocument, 0);
  assert.equal(loadWorkerConfig({ ...valid, MAX_PDF_BYTES: '2048' }).maxPdfBytes, 2048);
  assert.equal(loadWorkerConfig({ ...valid, CRAWL_CONCURRENCY: '4' }).crawlConcurrency, 4);
  assert.equal(
    loadWorkerConfig({ ...valid, SEARCH_DAILY_QUOTA_PER_HOST: '7' }).searchDailyQuotaPerHost,
    7,
  );
  assert.equal(loadWorkerConfig({ ...valid, OCR_DAILY_PAGE_BUDGET: '7' }).ocrDailyPageBudget, 7);
  assert.equal(
    loadWorkerConfig({ ...valid, AI_MAX_TOKENS_PER_DOCUMENT: '5000' }).aiMaxTokensPerDocument,
    5000,
  );
  assert.equal(
    loadWorkerConfig({ ...valid, OCR_MAX_PAGES_PER_DOCUMENT: '3' }).ocrMaxPagesPerDocument,
    3,
  );
  assert.throws(
    () => loadWorkerConfig({ ...valid, CRAWL_CONCURRENCY: '0' }),
    /CRAWL_CONCURRENCY must be a positive safe integer/,
  );
  for (const size of ['0', '-1', '1.5', '1e2', '9007199254740992']) {
    assert.throws(
      () => loadWorkerConfig({ ...valid, MAX_PDF_BYTES: size }),
      /MAX_PDF_BYTES must be a positive safe integer/,
    );
  }
  for (const quota of ['-1', '1.5', '1e2', '9007199254740992']) {
    assert.throws(
      () => loadWorkerConfig({ ...valid, SEARCH_DAILY_QUOTA_PER_HOST: quota }),
      /SEARCH_DAILY_QUOTA_PER_HOST must be a non-negative safe integer/,
    );
  }
  for (const budget of ['-1', '1.5', '1e2', '9007199254740992']) {
    assert.throws(
      () => loadWorkerConfig({ ...valid, OCR_DAILY_PAGE_BUDGET: budget }),
      /OCR_DAILY_PAGE_BUDGET must be a non-negative safe integer/,
    );
  }
  for (const budget of ['-1', '1.5', '1e2', '9007199254740992']) {
    assert.throws(
      () => loadWorkerConfig({ ...valid, AI_MAX_TOKENS_PER_DOCUMENT: budget }),
      /AI_MAX_TOKENS_PER_DOCUMENT must be a non-negative safe integer/,
    );
  }
  for (const pageLimit of ['0', '-1', '1.5', '1e2', '9007199254740992']) {
    assert.throws(
      () => loadWorkerConfig({ ...valid, OCR_MAX_PAGES_PER_DOCUMENT: pageLimit }),
      /OCR_MAX_PAGES_PER_DOCUMENT must be a positive safe integer/,
    );
  }
});

test('API rejects wildcard CORS and accepts only configured origins', () => {
  assert.throws(() => loadApiConfig({ ...valid, CORS_ORIGINS: '*' }), /CORS_ORIGINS/);
  assert.deepEqual(loadApiConfig(valid).corsOrigins, ['http://127.0.0.1:4200']);
});
