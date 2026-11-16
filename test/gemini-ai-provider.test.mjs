import assert from 'node:assert/strict';
import test from 'node:test';
import { GeminiAiProvider } from '../apps/api/dist/modules/ai/provider/gemini-ai.provider.js';
import { AiProviderError } from '../apps/api/dist/modules/ai/provider/ai-provider.js';

const input = {
  documentId: '80fc8a31-cf6f-4d81-9a4a-f86af0aad456',
  requestId: 'classification-v1:example',
  schemaId: 'classification-v1',
  input: { excerpts: [{ text: 'Official text' }] },
  jsonSchema: { type: 'object' },
  maxInputTokens: 500,
  maxOutputTokens: 100,
};

test('Gemini adapter sends JSON requests and returns output with measured token usage', async () => {
  let url;
  let options;
  const provider = new GeminiAiProvider('test-secret', async (target, request) => {
    url = target;
    options = request;
    return new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{"scope_decision":"UNKNOWN"}' }] } }],
        usageMetadata: { promptTokenCount: 42, candidatesTokenCount: 8 },
      }),
      { status: 200 },
    );
  });
  const result = await provider.generate(input, new AbortController().signal);
  assert.match(url, /gemini-3\.5-flash-lite:generateContent$/u);
  assert.equal(options.headers['x-goog-api-key'], 'test-secret');
  const body = JSON.parse(options.body);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.equal(body.generationConfig.maxOutputTokens, 100);
  assert.deepEqual(result, {
    output: { scope_decision: 'UNKNOWN' },
    usage: { inputTokens: 42, outputTokens: 8 },
  });
});

test('Gemini adapter fails closed on quota and invalid output', async () => {
  const limited = new GeminiAiProvider(
    'test-secret',
    async () => new Response('', { status: 429 }),
  );
  await assert.rejects(limited.generate(input, new AbortController().signal), (error) => {
    assert.ok(error instanceof AiProviderError);
    assert.equal(error.failureCode, 'RATE_LIMITED');
    return true;
  });
  const invalid = new GeminiAiProvider(
    'test-secret',
    async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 }),
  );
  await assert.rejects(invalid.generate(input, new AbortController().signal), (error) => {
    assert.ok(error instanceof AiProviderError);
    assert.equal(error.failureCode, 'INVALID_RESPONSE');
    return true;
  });
});
