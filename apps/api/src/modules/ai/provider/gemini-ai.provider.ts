import { AiProviderError } from './ai-provider.js';
import type { AiGenerationRequest, AiProvider, AiProviderResponse } from './ai-provider.js';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-3.5-flash-lite';

export class GeminiAiProvider implements AiProvider {
  readonly kind = 'external' as const;

  constructor(
    private readonly apiKey: string,
    private readonly request: typeof fetch = fetch,
  ) {
    if (!apiKey.trim()) throw new Error('Gemini API key is required');
  }

  async generate(input: AiGenerationRequest, signal: AbortSignal): Promise<AiProviderResponse> {
    let response: Response;
    try {
      response = await this.request(`${ENDPOINT}/${MODEL}:generateContent`, {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: JSON.stringify({
                    instruction:
                      'Return only JSON matching the supplied schema. Use only the supplied official document excerpts. Use null for unsupported values and quote exact evidence.',
                    schema: input.jsonSchema,
                    document: input.input,
                  }),
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: input.maxOutputTokens,
            temperature: 0,
          },
        }),
      });
    } catch (error) {
      if (signal.aborted) throw new AiProviderError('TIMEOUT', true);
      throw new AiProviderError('UNAVAILABLE', true, { cause: error });
    }
    if (!response.ok) {
      // Never include the upstream response body: it can contain prompt or credential data.
      if (response.status === 429) throw new AiProviderError('RATE_LIMITED', true);
      if (response.status >= 500) throw new AiProviderError('UNAVAILABLE', true);
      throw new AiProviderError('INVALID_RESPONSE', false);
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AiProviderError('INVALID_RESPONSE', false);
    }
    if (!payload || typeof payload !== 'object')
      throw new AiProviderError('INVALID_RESPONSE', false);
    const data = payload as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('');
    const inputTokens = data.usageMetadata?.promptTokenCount;
    const outputTokens = data.usageMetadata?.candidatesTokenCount;
    if (!text || !Number.isSafeInteger(inputTokens) || !Number.isSafeInteger(outputTokens)) {
      throw new AiProviderError('INVALID_RESPONSE', false);
    }
    try {
      return {
        output: JSON.parse(text),
        usage: { inputTokens: inputTokens!, outputTokens: outputTokens! },
      };
    } catch {
      throw new AiProviderError('INVALID_RESPONSE', false);
    }
  }
}
