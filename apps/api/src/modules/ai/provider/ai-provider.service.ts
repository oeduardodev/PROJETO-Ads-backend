import { AiProviderError } from './ai-provider.js';
import type { AiGenerationRequest, AiProvider, AiProviderResponse } from './ai-provider.js';
import type { AiTokenBudgetStore } from './ai-token-budget.store.js';

export interface AiTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AiGenerationResult {
  output: unknown;
  usage: AiTokenUsage;
  attempts: number;
}

export interface AiProviderServiceOptions {
  timeoutMs: number;
  maxAttempts: number;
  retryBaseMs: number;
  maxTokensPerDocument?: number;
  tokenBudget?: AiTokenBudgetStore;
  sleep?: (milliseconds: number) => Promise<void>;
}

interface ResolvedAiProviderServiceOptions extends AiProviderServiceOptions {
  maxTokensPerDocument: number;
}

export const DEFAULT_AI_PROVIDER_OPTIONS: ResolvedAiProviderServiceOptions = {
  timeoutMs: 30_000,
  maxAttempts: 2,
  retryBaseMs: 500,
  maxTokensPerDocument: 0,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DEFAULT_SLEEP = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function validateOptions(options: ResolvedAiProviderServiceOptions): void {
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1) {
    throw new Error('AI timeoutMs must be a positive safe integer');
  }
  if (
    !Number.isSafeInteger(options.maxAttempts) ||
    options.maxAttempts < 1 ||
    options.maxAttempts > 5
  ) {
    throw new Error('AI maxAttempts must be an integer from 1 to 5');
  }
  if (!Number.isSafeInteger(options.retryBaseMs) || options.retryBaseMs < 0) {
    throw new Error('AI retryBaseMs must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(options.maxTokensPerDocument) || options.maxTokensPerDocument < 0) {
    throw new Error('AI maxTokensPerDocument must be a non-negative safe integer');
  }
}

function validateRequest(request: AiGenerationRequest): void {
  if (!UUID.test(request.documentId)) throw new TypeError('documentId must be a UUID');
  if (!request.requestId.trim() || request.requestId.length > 200) {
    throw new TypeError('requestId must contain 1 to 200 characters');
  }
  if (!['classification-v1', 'extraction-v1'].includes(request.schemaId)) {
    throw new TypeError('schemaId is not supported');
  }
  if (!Number.isSafeInteger(request.maxInputTokens) || request.maxInputTokens < 1) {
    throw new TypeError('maxInputTokens must be a positive safe integer');
  }
  if (!Number.isSafeInteger(request.maxOutputTokens) || request.maxOutputTokens < 1) {
    throw new TypeError('maxOutputTokens must be a positive safe integer');
  }
  if (
    !request.jsonSchema ||
    typeof request.jsonSchema !== 'object' ||
    Array.isArray(request.jsonSchema)
  ) {
    throw new TypeError('jsonSchema must be an object');
  }
}

function validateResponse(
  response: AiProviderResponse,
  maxInputTokens: number,
  maxOutputTokens: number,
): AiGenerationResult['usage'] {
  const inputTokens = response?.usage?.inputTokens;
  const outputTokens = response?.usage?.outputTokens;
  if (
    !Number.isSafeInteger(inputTokens) ||
    inputTokens < 0 ||
    !Number.isSafeInteger(outputTokens) ||
    outputTokens < 0 ||
    inputTokens > maxInputTokens ||
    outputTokens > maxOutputTokens
  ) {
    throw new AiProviderError('INVALID_RESPONSE', false);
  }
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
}

export class AiProviderService {
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly options: ResolvedAiProviderServiceOptions;

  constructor(
    private readonly provider: AiProvider,
    options: Partial<AiProviderServiceOptions> = {},
  ) {
    this.options = { ...DEFAULT_AI_PROVIDER_OPTIONS, ...options };
    validateOptions(this.options);
    this.sleep = this.options.sleep ?? DEFAULT_SLEEP;
  }

  async generate(request: AiGenerationRequest): Promise<AiGenerationResult> {
    validateRequest(request);
    const identity = { documentId: request.documentId, requestId: request.requestId };
    const perAttemptReservation = request.maxInputTokens + request.maxOutputTokens;
    const totalReservation = perAttemptReservation * this.options.maxAttempts;
    if (!Number.isSafeInteger(perAttemptReservation) || !Number.isSafeInteger(totalReservation)) {
      throw new TypeError('AI token reservation must be a positive safe integer');
    }
    if (this.provider.kind === 'external') {
      if (this.options.maxTokensPerDocument === 0) {
        throw new AiProviderError('DISABLED', false);
      }
      if (!this.options.tokenBudget) {
        throw new AiProviderError('BUDGET_UNAVAILABLE', false);
      }
      let reservation;
      try {
        reservation = await this.options.tokenBudget.reserve(
          identity,
          this.options.maxTokensPerDocument,
          totalReservation,
        );
      } catch (error) {
        throw new AiProviderError('BUDGET_UNAVAILABLE', false, { cause: error });
      }
      if (reservation === 'EXHAUSTED') throw new AiProviderError('BUDGET_EXHAUSTED', false);
      if (reservation === 'DUPLICATE') throw new AiProviderError('DUPLICATE_REQUEST', false);
    }

    let lastError: AiProviderError | undefined;
    let completed: AiGenerationResult | undefined;
    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt += 1) {
      try {
        const response = await this.withTimeout(request);
        const usage = validateResponse(response, request.maxInputTokens, request.maxOutputTokens);
        completed = { output: response.output, usage, attempts: attempt };
        break;
      } catch (error) {
        lastError =
          error instanceof AiProviderError
            ? error
            : new AiProviderError('UNAVAILABLE', true, { cause: error });
        if (!lastError.retryable || attempt === this.options.maxAttempts) break;
        await this.sleep(this.options.retryBaseMs * 2 ** (attempt - 1));
      }
    }
    if (this.provider.kind === 'external' && this.options.tokenBudget) {
      const chargedTokens = completed
        ? (completed.attempts - 1) * perAttemptReservation + completed.usage.totalTokens
        : totalReservation;
      try {
        await this.options.tokenBudget.settle(identity, chargedTokens);
      } catch (error) {
        throw new AiProviderError('BUDGET_UNAVAILABLE', false, { cause: error });
      }
    }
    if (completed) return completed;
    throw lastError ?? new AiProviderError('UNAVAILABLE', true);
  }

  private async withTimeout(request: AiGenerationRequest): Promise<AiProviderResponse> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new AiProviderError('TIMEOUT', true));
      }, this.options.timeoutMs);
    });
    try {
      return await Promise.race([this.provider.generate(request, controller.signal), timeout]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}
