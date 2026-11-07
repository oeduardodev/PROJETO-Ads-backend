import { createHash } from 'node:crypto';
import type { Redis } from 'ioredis';
import type {
  AiTokenBudgetIdentity,
  AiTokenBudgetStore,
  AiTokenReservation,
} from './ai-token-budget.store.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const RESERVE_SCRIPT = `
if redis.call('EXISTS', KEYS[2]) == 1 then return 2 end
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local reservation = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
if current + reservation > limit then return 0 end
redis.call('INCRBY', KEYS[1], ARGV[1])
redis.call('SET', KEYS[2], 'P:' .. ARGV[1])
return 1
`;

const SETTLE_SCRIPT = `
local state = redis.call('GET', KEYS[2])
if not state then return -1 end
if string.sub(state, 1, 2) ~= 'P:' then return 2 end
local reservation = tonumber(string.sub(state, 3))
local charged = tonumber(ARGV[1])
if charged > reservation then return -2 end
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current < reservation then return -3 end
redis.call('SET', KEYS[1], current - reservation + charged)
redis.call('SET', KEYS[2], 'C:' .. ARGV[1])
return 1
`;

function positiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive safe integer`);
  }
}

function normalizeIdentity(identity: AiTokenBudgetIdentity): AiTokenBudgetIdentity {
  if (!UUID.test(identity.documentId)) throw new Error('documentId must be a UUID');
  if (!identity.requestId.trim() || identity.requestId.length > 200) {
    throw new Error('requestId must contain 1 to 200 characters');
  }
  return { documentId: identity.documentId.toLowerCase(), requestId: identity.requestId };
}

export function aiTokenBudgetKeys(identity: AiTokenBudgetIdentity) {
  const normalized = normalizeIdentity(identity);
  const requestHash = createHash('sha256').update(normalized.requestId, 'utf8').digest('hex');
  return {
    counter: `alem-do-sisu:ai:{${normalized.documentId}}:tokens`,
    request: `alem-do-sisu:ai:{${normalized.documentId}}:request:${requestHash}`,
  };
}

export class RedisAiTokenBudgetStore implements AiTokenBudgetStore {
  constructor(private readonly redis: Pick<Redis, 'eval'>) {}

  async reserve(
    identity: AiTokenBudgetIdentity,
    limit: number,
    reservationTokens: number,
  ): Promise<AiTokenReservation> {
    if (!Number.isSafeInteger(limit) || limit < 0) {
      throw new Error('limit must be a non-negative safe integer');
    }
    positiveInteger(reservationTokens, 'reservationTokens');
    if (limit === 0) return 'EXHAUSTED';
    const keys = aiTokenBudgetKeys(identity);
    const result = Number(
      await this.redis.eval(
        RESERVE_SCRIPT,
        2,
        keys.counter,
        keys.request,
        String(reservationTokens),
        String(limit),
      ),
    );
    if (result === 1) return 'RESERVED';
    if (result === 2) return 'DUPLICATE';
    if (result === 0) return 'EXHAUSTED';
    throw new Error('Unexpected AI token budget reservation response');
  }

  async settle(identity: AiTokenBudgetIdentity, chargedTokens: number): Promise<void> {
    if (!Number.isSafeInteger(chargedTokens) || chargedTokens < 0) {
      throw new Error('chargedTokens must be a non-negative safe integer');
    }
    const keys = aiTokenBudgetKeys(identity);
    const result = Number(
      await this.redis.eval(SETTLE_SCRIPT, 2, keys.counter, keys.request, String(chargedTokens)),
    );
    if (result === 1 || result === 2) return;
    if (result === -1) throw new Error('AI token reservation does not exist');
    if (result === -2) throw new Error('AI token charge exceeds its reservation');
    if (result === -3) throw new Error('AI token counter is below its reservation');
    throw new Error('Unexpected AI token budget settlement response');
  }
}
