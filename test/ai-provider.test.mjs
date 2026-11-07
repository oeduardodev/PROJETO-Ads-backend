import assert from 'node:assert/strict';
import test from 'node:test';
import { ClassificationV1 } from '../apps/api/dist/modules/ai/schemas/index.js';
import { AiProviderError } from '../apps/api/dist/modules/ai/provider/ai-provider.js';
import { FixtureAiProvider } from '../apps/api/dist/modules/ai/provider/fixture-ai.provider.js';
import { AiProviderService } from '../apps/api/dist/modules/ai/provider/ai-provider.service.js';
import {
  aiTokenBudgetKeys,
  RedisAiTokenBudgetStore,
} from '../apps/api/dist/modules/ai/provider/redis-ai-token-budget.store.js';
import { createWorkerAiProviderService } from '../apps/api/dist/modules/ai/provider/worker-ai-provider.factory.js';
import { loadWorkerConfig } from '../apps/api/dist/config/environment.js';

const documentId = '80fc8a31-cf6f-4d81-9a4a-f86af0aad456';
const request = {
  documentId,
  requestId: 'classify-document-v1',
  schemaId: 'classification-v1',
  input: { text: 'Trecho sintético de fixture.' },
  jsonSchema: { type: 'object', properties: {} },
  maxInputTokens: 500,
  maxOutputTokens: 200,
};
const output = {
  schema_version: 1,
  scope_decision: 'UNKNOWN',
  selection_type: null,
  regular_sisu_flow: null,
  requires_enem: null,
  evidence: [],
};
const response = { output, usage: { inputTokens: 31, outputTokens: 9 } };

test('uses a fixture provider without an LLM key and reports structured output token usage', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalLlmKey = process.env.LLM_PROVIDER_KEY;
  process.env.NODE_ENV = 'test';
  delete process.env.LLM_PROVIDER_KEY;
  try {
    const provider = new FixtureAiProvider(new Map([[request.requestId, response]]));
    const service = new AiProviderService(provider, {
      timeoutMs: 100,
      maxAttempts: 1,
      retryBaseMs: 0,
      sleep: async () => undefined,
    });
    const result = await service.generate(request);

    assert.deepEqual(ClassificationV1.parse(result.output), output);
    assert.deepEqual(result.usage, { inputTokens: 31, outputTokens: 9, totalTokens: 40 });
    assert.equal(result.attempts, 1);
    assert.equal(provider.requests.length, 1);
    assert.equal(provider.requests[0].requestId, request.requestId);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalLlmKey === undefined) delete process.env.LLM_PROVIDER_KEY;
    else process.env.LLM_PROVIDER_KEY = originalLlmKey;
  }
});

test('retries transient failures with bounded exponential backoff and stable request identity', async () => {
  const delays = [];
  const requests = [];
  const budgetCalls = [];
  const tokenBudget = {
    reserve: async (...args) => {
      budgetCalls.push(['reserve', ...args]);
      return 'RESERVED';
    },
    settle: async (...args) => budgetCalls.push(['settle', ...args]),
  };
  let calls = 0;
  const provider = {
    kind: 'external',
    generate: async (currentRequest) => {
      requests.push(currentRequest.requestId);
      calls += 1;
      if (calls === 1) throw new AiProviderError('RATE_LIMITED', true);
      return response;
    },
  };
  const service = new AiProviderService(provider, {
    timeoutMs: 100,
    maxAttempts: 3,
    retryBaseMs: 25,
    maxTokensPerDocument: 5_000,
    tokenBudget,
    sleep: async (milliseconds) => delays.push(milliseconds),
  });
  const result = await service.generate(request);
  assert.equal(result.attempts, 2);
  assert.deepEqual(requests, [request.requestId, request.requestId]);
  assert.deepEqual(delays, [25]);
  assert.deepEqual(budgetCalls[0], [
    'reserve',
    { documentId, requestId: request.requestId },
    5_000,
    2_100,
  ]);
  assert.deepEqual(budgetCalls[1], ['settle', { documentId, requestId: request.requestId }, 740]);
});

test('times out provider work, aborts its signal, and retries within configured attempts', async () => {
  let calls = 0;
  let aborted = 0;
  const budgetCalls = [];
  const provider = {
    kind: 'external',
    generate: async (_currentRequest, signal) => {
      calls += 1;
      return new Promise((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            aborted += 1;
            reject(new Error('cancelled by timeout'));
          },
          { once: true },
        );
      });
    },
  };
  const service = new AiProviderService(provider, {
    timeoutMs: 5,
    maxAttempts: 2,
    retryBaseMs: 0,
    maxTokensPerDocument: 2_000,
    tokenBudget: {
      reserve: async () => 'RESERVED',
      settle: async (...args) => budgetCalls.push(args),
    },
    sleep: async () => undefined,
  });

  await assert.rejects(service.generate(request), (error) => {
    assert.ok(error instanceof AiProviderError);
    assert.equal(error.failureCode, 'TIMEOUT');
    return true;
  });
  assert.equal(calls, 2);
  assert.equal(aborted, 2);
  assert.deepEqual(budgetCalls, [[{ documentId, requestId: request.requestId }, 1_400]]);
});

test('does not retry malformed token usage or fixtures that exceed the requested output cap', async () => {
  let calls = 0;
  const service = new AiProviderService(
    {
      kind: 'fixture',
      generate: async () => {
        calls += 1;
        return { ...response, usage: { inputTokens: 31, outputTokens: 201 } };
      },
    },
    {
      timeoutMs: 100,
      maxAttempts: 3,
      retryBaseMs: 0,
      sleep: async () => undefined,
    },
  );
  await assert.rejects(service.generate(request), (error) => {
    assert.ok(error instanceof AiProviderError);
    assert.equal(error.failureCode, 'INVALID_RESPONSE');
    assert.equal(error.retryable, false);
    return true;
  });
  assert.equal(calls, 1);
});

test('zero token budget disables external calls while fixtures remain available', async () => {
  let calls = 0;
  const service = new AiProviderService(
    {
      kind: 'external',
      generate: async () => {
        calls += 1;
        return response;
      },
    },
    { timeoutMs: 100, maxAttempts: 1, retryBaseMs: 0, maxTokensPerDocument: 0 },
  );
  await assert.rejects(service.generate(request), (error) => {
    assert.ok(error instanceof AiProviderError);
    assert.equal(error.failureCode, 'DISABLED');
    return true;
  });
  assert.equal(calls, 0);
});

test('worker factory passes the configured document token limit to the provider service', async () => {
  const workerConfig = loadWorkerConfig({
    DATABASE_URL: 'postgresql://test_user:test_password@127.0.0.1:5433/test_db',
    REDIS_URL: 'redis://127.0.0.1:6380',
    AI_MAX_TOKENS_PER_DOCUMENT: '0',
  });
  let calls = 0;
  const service = createWorkerAiProviderService(
    {
      kind: 'external',
      generate: async () => {
        calls += 1;
        return response;
      },
    },
    workerConfig,
    { reserve: async () => 'RESERVED', settle: async () => undefined },
  );
  await assert.rejects(service.generate(request), (error) => {
    assert.ok(error instanceof AiProviderError);
    assert.equal(error.failureCode, 'DISABLED');
    return true;
  });
  assert.equal(calls, 0);
});

test('external providers fail closed without Redis budget or with an exhausted budget', async () => {
  let calls = 0;
  const provider = {
    kind: 'external',
    generate: async () => {
      calls += 1;
      return response;
    },
  };
  const options = { timeoutMs: 100, maxAttempts: 1, retryBaseMs: 0, maxTokensPerDocument: 1_000 };
  for (const [tokenBudget, expected] of [
    [undefined, 'BUDGET_UNAVAILABLE'],
    [{ reserve: async () => 'EXHAUSTED', settle: async () => undefined }, 'BUDGET_EXHAUSTED'],
    [{ reserve: async () => 'DUPLICATE', settle: async () => undefined }, 'DUPLICATE_REQUEST'],
    [
      {
        reserve: async () => {
          throw new Error('redis unavailable');
        },
        settle: async () => undefined,
      },
      'BUDGET_UNAVAILABLE',
    ],
  ]) {
    const service = new AiProviderService(provider, { ...options, tokenBudget });
    await assert.rejects(service.generate(request), (error) => {
      assert.ok(error instanceof AiProviderError);
      assert.equal(error.failureCode, expected);
      return true;
    });
  }
  assert.equal(calls, 0);
});

test('Redis token budget is atomic, cumulative, idempotent, and uses hashed request keys', async () => {
  const values = new Map();
  const redis = {
    eval: async (script, keyCount, counter, requestKey, ...args) => {
      assert.equal(keyCount, 2);
      if (script.includes("if redis.call('EXISTS', KEYS[2]) == 1")) {
        if (values.has(requestKey)) return 2;
        const reservation = Number(args[0]);
        const limit = Number(args[1]);
        const current = Number(values.get(counter) ?? 0);
        if (current + reservation > limit) return 0;
        values.set(counter, current + reservation);
        values.set(requestKey, `P:${reservation}`);
        return 1;
      }
      if (script.includes('local state = redis.call')) {
        const state = values.get(requestKey);
        if (state === undefined) return -1;
        if (!state.startsWith('P:')) return 2;
        const reservation = Number(state.slice(2));
        const charged = Number(args[0]);
        if (charged > reservation) return -2;
        const current = Number(values.get(counter) ?? 0);
        if (current < reservation) return -3;
        values.set(counter, current - reservation + charged);
        values.set(requestKey, `C:${charged}`);
        return 1;
      }
      throw new Error('Unexpected script');
    },
  };
  const store = new RedisAiTokenBudgetStore(redis);
  const first = { documentId, requestId: 'request/private-value' };
  const second = { documentId, requestId: 'another-request' };
  const keys = aiTokenBudgetKeys(first);
  assert.equal(keys.counter, `alem-do-sisu:ai:{${documentId}}:tokens`);
  assert.ok(!keys.request.includes(first.requestId));
  assert.equal(await store.reserve(first, 100, 70), 'RESERVED');
  assert.equal(await store.reserve(first, 100, 70), 'DUPLICATE');
  await store.settle(first, 40);
  await store.settle(first, 40);
  assert.equal(values.get(keys.counter), 40);
  assert.equal(await store.reserve(second, 100, 60), 'RESERVED');
  assert.equal(await store.reserve({ documentId, requestId: 'over-budget' }, 100, 1), 'EXHAUSTED');
  await assert.rejects(store.settle({ documentId, requestId: 'missing' }, 0), /does not exist/u);
  await assert.rejects(store.settle(second, 61), /exceeds its reservation/u);
});

test('rejects missing fixture output and invalid runtime limits', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  try {
    const service = new AiProviderService(new FixtureAiProvider(new Map()), {
      timeoutMs: 100,
      maxAttempts: 1,
      retryBaseMs: 0,
      sleep: async () => undefined,
    });
    await assert.rejects(service.generate(request), (error) => {
      assert.ok(error instanceof AiProviderError);
      assert.equal(error.failureCode, 'FIXTURE_NOT_FOUND');
      return true;
    });
    assert.throws(
      () =>
        new AiProviderService(new FixtureAiProvider(new Map()), {
          timeoutMs: 0,
          maxAttempts: 1,
          retryBaseMs: 0,
        }),
      /timeoutMs/u,
    );
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});
