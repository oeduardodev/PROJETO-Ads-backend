import { createHash } from 'node:crypto';

export type StructuredLogLevel = 'info' | 'warn' | 'error';

const ALLOWED_FIELDS = new Set([
  'requestId',
  'sourceId',
  'crawlRunId',
  'discoveredUrlId',
  'urlHash',
  'documentId',
  'processId',
  'queue',
  'jobName',
  'status',
  'errorCode',
  'httpStatus',
  'durationMs',
  'attempt',
  'tokens',
  'candidatesFound',
  'reviewVersion',
  'action',
  'method',
  'route',
]);
const IDENTIFIER_FIELDS = new Set([
  'requestId',
  'sourceId',
  'crawlRunId',
  'discoveredUrlId',
  'documentId',
  'processId',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function hashObservedUrl(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function structuredLogEntry(
  level: StructuredLogLevel,
  event: string,
  fields: Record<string, unknown> = {},
  now = new Date(),
): Record<string, string | number> {
  const entry: Record<string, string | number> = {
    timestamp: now.toISOString(),
    level,
    event: event.slice(0, 80),
  };
  for (const [key, value] of Object.entries(fields)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    if (typeof value === 'string') {
      if (IDENTIFIER_FIELDS.has(key) && !UUID.test(value)) continue;
      if (key === 'urlHash' && !/^[0-9a-f]{64}$/iu.test(value)) continue;
      if (
        ['queue', 'jobName', 'status', 'errorCode', 'action', 'method', 'route'].includes(key) &&
        !/^[a-zA-Z0-9_:/{}.-]{1,160}$/u.test(value)
      )
        continue;
      entry[key] = value.slice(0, 200);
    } else if (typeof value === 'number' && Number.isFinite(value)) entry[key] = value;
  }
  return entry;
}

export function logStructured(
  level: StructuredLogLevel,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const line = JSON.stringify(structuredLogEntry(level, event, fields));
  if (level === 'error') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}
