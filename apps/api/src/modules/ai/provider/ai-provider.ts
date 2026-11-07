export type AiSchemaId = 'classification-v1' | 'extraction-v1';

export interface AiGenerationRequest {
  documentId: string;
  requestId: string;
  schemaId: AiSchemaId;
  input: unknown;
  jsonSchema: Record<string, unknown>;
  maxInputTokens: number;
  maxOutputTokens: number;
}

export interface AiProviderResponse {
  output: unknown;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AiProvider {
  readonly kind: 'external' | 'fixture';
  generate(request: AiGenerationRequest, signal: AbortSignal): Promise<AiProviderResponse>;
}

export type AiProviderFailureCode =
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'INVALID_RESPONSE'
  | 'FIXTURE_NOT_FOUND'
  | 'DISABLED'
  | 'BUDGET_EXHAUSTED'
  | 'DUPLICATE_REQUEST'
  | 'BUDGET_UNAVAILABLE';

export class AiProviderError extends Error {
  constructor(
    readonly failureCode: AiProviderFailureCode,
    readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(`AI provider failed (${failureCode})`, options);
    this.name = 'AiProviderError';
  }
}
