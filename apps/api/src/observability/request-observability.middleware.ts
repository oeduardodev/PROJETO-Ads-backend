import { randomUUID } from 'node:crypto';
import { logStructured } from './structured-log.js';
import { observabilityMetrics } from './metrics.registry.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

interface RequestLike {
  method: string;
  baseUrl?: string;
  route?: { path?: string | string[] };
  requestId?: string;
  header(name: string): string | undefined;
}

interface ResponseLike {
  statusCode: number;
  setHeader(name: string, value: string): void;
  once(event: 'finish', callback: () => void): void;
}

type NextFunction = () => void;

function safeRoute(request: RequestLike): string {
  const route = request.route?.path;
  const base = request.baseUrl ?? '';
  if (typeof route === 'string') return `${base}${route}`.slice(0, 160);
  return 'unmatched';
}

export function requestObservabilityMiddleware(
  request: RequestLike,
  response: ResponseLike,
  next: NextFunction,
): void {
  const supplied = request.header('x-request-id');
  const requestId = supplied && UUID.test(supplied) ? supplied.toLowerCase() : randomUUID();
  const startedAt = process.hrtime.bigint();
  request.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);
  response.once('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const method = request.method.toUpperCase();
    const route = safeRoute(request);
    const status = String(response.statusCode);
    observabilityMetrics.increment(
      'http_requests_total',
      'HTTP requests by method, route and status',
      {
        method,
        route,
        status,
      },
    );
    observabilityMetrics.increment(
      'http_request_duration_milliseconds_total',
      'Total HTTP request duration in milliseconds by method and route',
      { method, route },
      durationMs,
    );
    logStructured('info', 'http.request.completed', {
      requestId,
      method,
      route,
      status,
      durationMs: Math.round(durationMs * 100) / 100,
    });
  });
  next();
}
