const API_SECURITY_HEADERS = Object.freeze({
  'content-security-policy':
    "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'permissions-policy': 'camera=(), geolocation=(), microphone=()',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'x-permitted-cross-domain-policies': 'none',
});

export interface SecurityHeaderResponse {
  setHeader(name: string, value: string): unknown;
}

export function setApiSecurityHeaders(response: SecurityHeaderResponse): void {
  for (const [name, value] of Object.entries(API_SECURITY_HEADERS)) {
    response.setHeader(name, value);
  }
}

export function apiSecurityHeadersMiddleware(
  _request: unknown,
  response: SecurityHeaderResponse,
  next: () => void,
): void {
  setApiSecurityHeaders(response);
  next();
}
