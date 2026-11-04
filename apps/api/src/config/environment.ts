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
}

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
  return { ...base, crawlConcurrency };
}
