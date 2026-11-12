import { isIP } from 'node:net';

const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const RESERVED_TLDS = new Set([
  'localhost',
  'local',
  'internal',
  'test',
  'invalid',
  'example',
  'onion',
  'lan',
]);

export function normalizeAuthorizedHost(value: string): string {
  const host = value.trim().toLowerCase();
  const labels = host.split('.');
  const tld = labels.at(-1);
  const fixtureDomain =
    process.env.NODE_ENV === 'test' && (host.endsWith('.test') || host.endsWith('.example'));
  if (
    host.length > 253 ||
    labels.length < 2 ||
    !labels.every((label) => HOST_LABEL.test(label)) ||
    !tld ||
    !/^[a-z]{2,63}$/u.test(tld) ||
    (RESERVED_TLDS.has(tld) && !fixtureDomain) ||
    isIP(host)
  ) {
    throw new Error('Host must be a public DNS name');
  }
  return host;
}

export function normalizeSourceUrl(value: string): { url: string; host: string } {
  if (
    Array.from(value).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  ) {
    throw new Error('Source URL contains control characters');
  }
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error('Source URL must be an absolute HTTPS URL');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) {
    throw new Error('Source URL must use HTTPS without credentials or a custom port');
  }
  const host = normalizeAuthorizedHost(parsed.hostname);
  parsed.hash = '';
  return { url: parsed.toString(), host };
}
