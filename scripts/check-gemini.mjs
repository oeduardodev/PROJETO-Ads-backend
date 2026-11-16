import { GeminiAiProvider } from '../apps/api/dist/modules/ai/provider/gemini-ai.provider.js';

const key = process.env.LLM_PROVIDER_KEY;
if (!key) throw new Error('LLM_PROVIDER_KEY is missing from the environment');

const provider = new GeminiAiProvider(key);
const result = await provider.generate(
  {
    documentId: '80fc8a31-cf6f-4d81-9a4a-f86af0aad456',
    requestId: 'gemini-connection-check',
    schemaId: 'classification-v1',
    input: { task: 'Return an object with ok equal to true.' },
    jsonSchema: { type: 'object', properties: { ok: { type: 'boolean' } } },
    maxInputTokens: 256,
    maxOutputTokens: 128,
  },
  AbortSignal.timeout(30_000),
);
if (result.output?.ok !== true) throw new Error('Gemini connection check returned invalid output');
console.log('Gemini connection: OK');
