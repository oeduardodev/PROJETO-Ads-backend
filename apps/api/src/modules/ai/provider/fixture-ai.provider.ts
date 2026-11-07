import { AiProviderError } from './ai-provider.js';
import type { AiGenerationRequest, AiProvider, AiProviderResponse } from './ai-provider.js';

export class FixtureAiProvider implements AiProvider {
  readonly kind = 'fixture' as const;
  readonly requests: AiGenerationRequest[] = [];

  constructor(private readonly fixtures: ReadonlyMap<string, AiProviderResponse>) {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Fixture AI provider is available only in tests');
    }
  }

  async generate(request: AiGenerationRequest, signal: AbortSignal): Promise<AiProviderResponse> {
    if (signal.aborted) throw new AiProviderError('UNAVAILABLE', true);
    this.requests.push(request);
    const fixture = this.fixtures.get(request.requestId);
    if (!fixture) throw new AiProviderError('FIXTURE_NOT_FOUND', false);
    return structuredClone(fixture);
  }
}
