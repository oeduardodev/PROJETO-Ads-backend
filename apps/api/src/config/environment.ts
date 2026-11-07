export interface BaseConfig {
  databaseUrl: string;
  redisUrl: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface ApiConfig extends BaseConfig {
  host: string;
  port: number;
  corsOrigins: string[];
}

export interface WorkerConfig extends BaseConfig {
  crawlConcurrency: number;
  searchDailyQuotaPerHost: number;
  maxPdfBytes: number;
  ocrDailyPageBudget: number;
  ocrMaxPagesPerDocument: number;
  aiMaxTokensPerDocument: number;
}

export const DEFAULT_MAX_PDF_BYTES = 10 * 1024 * 1024;
export const DEFAULT_OCR_DAILY_PAGE_BUDGET = 0;
export const DEFAULT_OCR_MAX_PAGES_PER_DOCUMENT = 5;
export const DEFAULT_AI_MAX_TOKENS_PER_DOCUMENT = 0;

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(`Configuration error: ${message}`);
    this.name = 'ConfigurationError';
  }
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new ConfigurationError(`${name} is required`);
  return value;
}

function parseUrl(env: NodeJS.ProcessEnv, name: string, protocols: string[]): URL {
  let url: URL;
  try {
    url = new URL(required(env, name));
  } catch (error) {
    if (error instanceof ConfigurationError) throw error;
    throw new ConfigurationError(`${name} must be a valid URL`);
  }
  if (!protocols.includes(url.protocol) || !url.hostname) {
    throw new ConfigurationError(`${name} has an invalid protocol or host`);
  }
  return url;
}

export function loadDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const databaseUrl = parseUrl(env, 'DATABASE_URL', ['postgres:', 'postgresql:']);
  if (!databaseUrl.username || !databaseUrl.password || databaseUrl.pathname === '/') {
    throw new ConfigurationError('DATABASE_URL requires a username, password and database');
  }
  return databaseUrl.toString();
}

function baseConfig(env: NodeJS.ProcessEnv): BaseConfig {
  const databaseUrl = loadDatabaseUrl(env);
  const redisUrl = parseUrl(env, 'REDIS_URL', ['redis:', 'rediss:']);
  const logLevel = env.LOG_LEVEL?.trim() || 'info';
  if (!['debug', 'info', 'warn', 'error'].includes(logLevel)) {
    throw new ConfigurationError('LOG_LEVEL must be debug, info, warn or error');
  }
  return {
    databaseUrl,
    redisUrl: redisUrl.toString(),
    logLevel: logLevel as BaseConfig['logLevel'],
  };
}

export function loadApiConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const base = baseConfig(env);
  const host = env.HOST?.trim() || '127.0.0.1';
  const rawPort = env.PORT?.trim() || '3000';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigurationError('PORT must be an integer from 1 to 65535');
  }
  const corsOrigins = required(env, 'CORS_ORIGINS')
    .split(',')
    .map((value) => value.trim());
  for (const origin of corsOrigins) {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new ConfigurationError('CORS_ORIGINS must contain absolute HTTP(S) origins');
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.origin !== origin ||
      url.username ||
      url.password
    ) {
      throw new ConfigurationError('CORS_ORIGINS must contain only HTTP(S) origins');
    }
  }
  return { ...base, host, port, corsOrigins };
}

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const base = baseConfig(env);
  const rawConcurrency = env.CRAWL_CONCURRENCY?.trim() || '1';
  const crawlConcurrency = Number(rawConcurrency);
  if (!Number.isSafeInteger(crawlConcurrency) || crawlConcurrency < 1) {
    throw new ConfigurationError('CRAWL_CONCURRENCY must be a positive safe integer');
  }
  const rawSearchDailyQuota = env.SEARCH_DAILY_QUOTA_PER_HOST?.trim() || '0';
  if (!/^(0|[1-9]\d*)$/u.test(rawSearchDailyQuota)) {
    throw new ConfigurationError('SEARCH_DAILY_QUOTA_PER_HOST must be a non-negative safe integer');
  }
  const searchDailyQuotaPerHost = Number(rawSearchDailyQuota);
  if (!Number.isSafeInteger(searchDailyQuotaPerHost) || searchDailyQuotaPerHost < 0) {
    throw new ConfigurationError('SEARCH_DAILY_QUOTA_PER_HOST must be a non-negative safe integer');
  }
  const rawMaxPdfBytes = env.MAX_PDF_BYTES?.trim() || String(DEFAULT_MAX_PDF_BYTES);
  const maxPdfBytes = Number(rawMaxPdfBytes);
  if (
    !/^(0|[1-9]\d*)$/u.test(rawMaxPdfBytes) ||
    !Number.isSafeInteger(maxPdfBytes) ||
    maxPdfBytes < 1
  ) {
    throw new ConfigurationError('MAX_PDF_BYTES must be a positive safe integer');
  }
  const rawOcrDailyPageBudget =
    env.OCR_DAILY_PAGE_BUDGET?.trim() || String(DEFAULT_OCR_DAILY_PAGE_BUDGET);
  if (!/^(0|[1-9]\d*)$/u.test(rawOcrDailyPageBudget)) {
    throw new ConfigurationError('OCR_DAILY_PAGE_BUDGET must be a non-negative safe integer');
  }
  const ocrDailyPageBudget = Number(rawOcrDailyPageBudget);
  if (!Number.isSafeInteger(ocrDailyPageBudget) || ocrDailyPageBudget < 0) {
    throw new ConfigurationError('OCR_DAILY_PAGE_BUDGET must be a non-negative safe integer');
  }
  const rawOcrMaxPages =
    env.OCR_MAX_PAGES_PER_DOCUMENT?.trim() || String(DEFAULT_OCR_MAX_PAGES_PER_DOCUMENT);
  if (!/^[1-9]\d*$/u.test(rawOcrMaxPages)) {
    throw new ConfigurationError('OCR_MAX_PAGES_PER_DOCUMENT must be a positive safe integer');
  }
  const ocrMaxPagesPerDocument = Number(rawOcrMaxPages);
  if (!Number.isSafeInteger(ocrMaxPagesPerDocument) || ocrMaxPagesPerDocument < 1) {
    throw new ConfigurationError('OCR_MAX_PAGES_PER_DOCUMENT must be a positive safe integer');
  }
  const rawAiMaxTokens =
    env.AI_MAX_TOKENS_PER_DOCUMENT?.trim() || String(DEFAULT_AI_MAX_TOKENS_PER_DOCUMENT);
  if (!/^(0|[1-9]\d*)$/u.test(rawAiMaxTokens)) {
    throw new ConfigurationError('AI_MAX_TOKENS_PER_DOCUMENT must be a non-negative safe integer');
  }
  const aiMaxTokensPerDocument = Number(rawAiMaxTokens);
  if (!Number.isSafeInteger(aiMaxTokensPerDocument) || aiMaxTokensPerDocument < 0) {
    throw new ConfigurationError('AI_MAX_TOKENS_PER_DOCUMENT must be a non-negative safe integer');
  }
  return {
    ...base,
    crawlConcurrency,
    searchDailyQuotaPerHost,
    maxPdfBytes,
    ocrDailyPageBudget,
    ocrMaxPagesPerDocument,
    aiMaxTokensPerDocument,
  };
}
