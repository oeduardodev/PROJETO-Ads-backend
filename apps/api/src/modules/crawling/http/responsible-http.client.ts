import { lookup } from 'node:dns/promises';
import { isIP, type LookupFunction } from 'node:net';
import { request as httpsRequest } from 'node:https';

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string | undefined>;
  body: Buffer;
}

export interface HttpTransport {
  resolve(host: string): Promise<ResolvedAddress[]>;
  request(
    url: URL,
    address: ResolvedAddress,
    options: {
      userAgent: string;
      timeoutMs: number;
      maxBytes: number;
    },
  ): Promise<HttpResponse>;
  sleep(milliseconds: number): Promise<void>;
  random(): number;
}

export interface ResponsibleHttpOptions {
  allowedHosts: readonly string[];
  collectionAllowed: boolean;
  userAgent: string;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  maxAttempts?: number;
  retryBaseMs?: number;
  maxRetryMs?: number;
  transport?: HttpTransport;
}

export class HttpFetchError extends Error {
  constructor(
    message: string,
    readonly code: 'POLICY' | 'SSRF' | 'ROBOTS' | 'HTTP' | 'TIMEOUT' | 'SIZE' | 'NETWORK',
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'HttpFetchError';
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_MS = 1_000;
const DEFAULT_MAX_RETRY_MS = 60_000;

function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const octets = address.split('.').map(Number);
    const [a, b, c] = octets;
    if (octets.length !== 4 || octets.some((part) => part < 0 || part > 255)) return false;
    if (a === undefined || b === undefined || c === undefined) return false;
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b! >= 64 && b! <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b! >= 16 && b! <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a! >= 224
    );
  }
  if (family !== 6) return false;

  const normalized = address.toLowerCase().split('%')[0]!;
  const halves = normalized.split('::');
  if (halves.length > 2) return false;
  const parseHalf = (half: string): number[] =>
    half ? half.split(':').map((part) => Number.parseInt(part, 16)) : [];
  const left = parseHalf(halves[0]!);
  let right = parseHalf(halves[1] ?? '');
  if (normalized.includes('.')) {
    const ipv4 = normalized.slice(normalized.lastIndexOf(':') + 1);
    if (isIP(ipv4) !== 4) return false;
    const octets = ipv4.split('.').map(Number);
    right = [...right.slice(0, -1), (octets[0]! << 8) | octets[1]!, (octets[2]! << 8) | octets[3]!];
  }
  const missing = 8 - left.length - right.length;
  const words = [...left, ...Array(Math.max(0, missing)).fill(0), ...right];
  if (
    words.length !== 8 ||
    words.some((word) => !Number.isInteger(word) || word < 0 || word > 0xffff)
  )
    return false;
  const isMapped = words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;
  if (isMapped) {
    const mappedIpv4 = `${words[6]! >> 8}.${words[6]! & 255}.${words[7]! >> 8}.${words[7]! & 255}`;
    return isPublicAddress(mappedIpv4);
  }
  const first = words[0]!;
  const second = words[1]!;
  const third = words[2]!;
  // Only global-unicast 2000::/3 is eligible; exclude documentation and transition ranges.
  return (
    (first & 0xe000) === 0x2000 &&
    !(
      first === 0x2001 &&
      (second === 0x0db8 || (second === 0x0000 && (third & 0xff00) === 0x0200))
    ) &&
    first !== 0x2002
  );
}

function validateUrl(value: URL, allowedHosts: ReadonlySet<string>): URL {
  if (isIP(value.hostname.replace(/^\[|\]$/gu, '')) !== 0) {
    throw new HttpFetchError('IP literal URLs are not permitted', 'SSRF');
  }
  if (
    value.protocol !== 'https:' ||
    value.username ||
    value.password ||
    value.port ||
    !allowedHosts.has(value.hostname.toLowerCase())
  ) {
    throw new HttpFetchError('URL is outside the authorized HTTPS host policy', 'POLICY');
  }
  value.hash = '';
  return value;
}

function retryAfterMilliseconds(value: string | undefined, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value.trim());
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : undefined;
}

function parseRobots(content: string, productToken: string, pathname: string): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let group: (typeof groups)[number] | undefined;
  let hasRule = false;
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.split('#', 1)[0]!.trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === 'user-agent') {
      if (!group || hasRule) {
        group = { agents: [], rules: [] };
        groups.push(group);
        hasRule = false;
      }
      group.agents.push(value.toLowerCase());
    } else if ((key === 'allow' || key === 'disallow') && group && value) {
      group.rules.push({ allow: key === 'allow', path: value });
      hasRule = true;
    }
  }

  const matching = groups
    .map((candidate) => ({
      candidate,
      specificity: Math.max(
        0,
        ...candidate.agents
          .filter((agent) => agent !== '*' && productToken.includes(agent))
          .map((agent) => agent.length),
      ),
      wildcard: candidate.agents.includes('*'),
    }))
    .filter(({ specificity, wildcard }) => specificity > 0 || wildcard);
  const bestSpecificity = Math.max(0, ...matching.map(({ specificity }) => specificity));
  const selected =
    bestSpecificity > 0
      ? matching.filter(({ specificity }) => specificity === bestSpecificity)
      : matching.filter(({ wildcard }) => wildcard);
  const rules = selected.flatMap(({ candidate }) => candidate.rules);
  const matched = rules
    .map((rule) => ({ ...rule, pattern: rule.path.replace(/\*/gu, '').replace(/\$$/u, '') }))
    .filter((rule) => pathname.startsWith(rule.pattern))
    .sort(
      (left, right) =>
        right.pattern.length - left.pattern.length || Number(right.allow) - Number(left.allow),
    )[0];
  return !matched || matched.allow;
}

const defaultTransport: HttpTransport = {
  async resolve(host) {
    return lookup(host, { all: true, verbatim: true }) as Promise<ResolvedAddress[]>;
  },
  request(url, address, options) {
    return new Promise((resolve, reject) => {
      const pinnedLookup = ((
        _: string,
        __: unknown,
        callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void,
      ) => {
        callback(null, address.address, address.family);
      }) as unknown as LookupFunction;
      const request = httpsRequest(
        url,
        {
          method: 'GET',
          headers: {
            'user-agent': options.userAgent,
            accept: 'text/html,application/pdf,text/plain,*/*;q=0.1',
          },
          lookup: pinnedLookup,
        },
        (response) => {
          const chunks: Buffer[] = [];
          let size = 0;
          response.on('data', (chunk: Buffer | string) => {
            const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += bytes.length;
            if (size > options.maxBytes) {
              request.destroy(new HttpFetchError('Response exceeds configured byte limit', 'SIZE'));
              return;
            }
            chunks.push(bytes);
          });
          response.on('end', () => {
            const headers = Object.fromEntries(
              Object.entries(response.headers).map(([key, value]) => [
                key.toLowerCase(),
                Array.isArray(value) ? value.join(', ') : value,
              ]),
            );
            resolve({ status: response.statusCode ?? 0, headers, body: Buffer.concat(chunks) });
          });
          response.on('error', reject);
        },
      );
      request.setTimeout(options.timeoutMs, () =>
        request.destroy(new HttpFetchError('HTTP request timed out', 'TIMEOUT')),
      );
      request.on('error', reject);
      request.end();
    });
  },
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  random: Math.random,
};

export class ResponsibleHttpClient {
  private readonly allowedHosts: ReadonlySet<string>;
  private readonly transport: HttpTransport;
  private readonly timeoutMs: number;
  private readonly maxBytes: number;
  private readonly maxRedirects: number;
  private readonly maxAttempts: number;
  private readonly retryBaseMs: number;
  private readonly maxRetryMs: number;

  constructor(private readonly options: ResponsibleHttpOptions) {
    if (!options.collectionAllowed) {
      throw new HttpFetchError('Collection permission has not been reviewed', 'POLICY');
    }
    if (!options.userAgent.trim() || !options.userAgent.includes('/')) {
      throw new Error('A descriptive crawler User-Agent is required');
    }
    this.allowedHosts = new Set(options.allowedHosts.map((host) => host.toLowerCase()));
    this.transport = options.transport ?? defaultTransport;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.retryBaseMs = options.retryBaseMs ?? DEFAULT_RETRY_BASE_MS;
    this.maxRetryMs = options.maxRetryMs ?? DEFAULT_MAX_RETRY_MS;
    for (const [name, value] of Object.entries({
      timeoutMs: this.timeoutMs,
      maxBytes: this.maxBytes,
      maxRedirects: this.maxRedirects,
      maxAttempts: this.maxAttempts,
      retryBaseMs: this.retryBaseMs,
      maxRetryMs: this.maxRetryMs,
    })) {
      if (!Number.isSafeInteger(value) || value < 1)
        throw new Error(`${name} must be a positive safe integer`);
    }
  }

  async fetch(value: string): Promise<HttpResponse> {
    const target = validateUrl(new URL(value), this.allowedHosts);
    await this.assertRobotsAllows(target);
    const response = await this.fetchWithRedirects(target);
    const contentType = response.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase();
    if (
      contentType &&
      ![
        'text/html',
        'application/xhtml+xml',
        'application/pdf',
        'text/plain',
        'application/xml',
        'text/xml',
      ].includes(contentType)
    ) {
      throw new HttpFetchError(
        `Unexpected content type: ${contentType}`,
        'POLICY',
        response.status,
      );
    }
    return response;
  }

  private async assertRobotsAllows(target: URL): Promise<void> {
    const robotsUrl = new URL('/robots.txt', target.origin);
    const response = await this.fetchWithRedirects(robotsUrl);
    if (
      response.status === 404 ||
      (response.status >= 400 &&
        response.status < 500 &&
        response.status !== 403 &&
        response.status !== 429)
    )
      return;
    if (response.status < 200 || response.status >= 300) {
      throw new HttpFetchError(
        `robots.txt is unavailable (HTTP ${response.status})`,
        'ROBOTS',
        response.status,
      );
    }
    const productToken = this.options.userAgent.split(/[\s/]/u)[0]!.toLowerCase();
    if (!parseRobots(response.body.toString('utf8'), productToken, target.pathname)) {
      throw new HttpFetchError('robots.txt disallows this path', 'ROBOTS');
    }
  }

  private async fetchWithRedirects(start: URL): Promise<HttpResponse> {
    let current = start;
    const originalHost = start.hostname.toLowerCase();
    for (let redirects = 0; redirects <= this.maxRedirects; redirects += 1) {
      validateUrl(current, this.allowedHosts);
      const response = await this.requestWithRetries(current);
      if (![301, 302, 303, 307, 308].includes(response.status)) return response;
      const location = response.headers.location;
      if (!location)
        throw new HttpFetchError(
          'Redirect response has no Location header',
          'HTTP',
          response.status,
        );
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        throw new HttpFetchError('Redirect Location is invalid', 'POLICY', response.status);
      }
      validateUrl(next, this.allowedHosts);
      if (next.hostname.toLowerCase() !== originalHost) {
        throw new HttpFetchError(
          'Cross-host redirects are not permitted',
          'POLICY',
          response.status,
        );
      }
      current = next;
    }
    throw new HttpFetchError('HTTP redirect limit exceeded', 'POLICY');
  }

  private async requestWithRetries(url: URL): Promise<HttpResponse> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const addresses = await this.transport.resolve(url.hostname);
        if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
          throw new HttpFetchError('DNS resolved to a non-public address', 'SSRF');
        }
        const response = await this.transport.request(url, addresses[0]!, {
          userAgent: this.options.userAgent,
          timeoutMs: this.timeoutMs,
          maxBytes: this.maxBytes,
        });
        if (response.body.length > this.maxBytes)
          throw new HttpFetchError('Response exceeds configured byte limit', 'SIZE');
        if (response.status === 401 || response.status === 403) {
          throw new HttpFetchError(
            `HTTP ${response.status} requires source review`,
            'HTTP',
            response.status,
          );
        }
        if (response.status !== 429 && response.status < 500) return response;
        lastError = new HttpFetchError(
          `Temporary HTTP failure (HTTP ${response.status})`,
          'HTTP',
          response.status,
          retryAfterMilliseconds(response.headers['retry-after']),
        );
      } catch (error) {
        if (error instanceof HttpFetchError && !['NETWORK', 'TIMEOUT'].includes(error.code))
          throw error;
        lastError = error;
      }
      if (attempt < this.maxAttempts) {
        const retryAfter = lastError instanceof HttpFetchError ? lastError.retryAfterMs : undefined;
        const exponential = this.retryBaseMs * 2 ** (attempt - 1);
        const jitter = 0.5 + this.transport.random() * 0.5;
        const delay = retryAfter ?? Math.min(this.maxRetryMs, Math.ceil(exponential * jitter));
        await this.transport.sleep(delay);
      }
    }
    if (lastError instanceof HttpFetchError) throw lastError;
    throw new HttpFetchError('HTTP request failed after retries', 'NETWORK');
  }
}
