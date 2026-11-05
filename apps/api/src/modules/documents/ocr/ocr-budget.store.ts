import type { Redis } from 'ioredis';

export const OCR_PIPELINE_VERSION = 1;

export interface OcrPageIdentity {
  documentId: string;
  sha256: string;
  pageNumber: number;
  pipelineVersion: number;
}

export type OcrReservation = 'NEW' | 'EXISTING' | 'EXHAUSTED';

export interface OcrBudgetStore {
  tryReserve(
    identity: OcrPageIdentity,
    dailyPageBudget: number,
    now: Date,
  ): Promise<OcrReservation>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/iu;

const RESERVE_SCRIPT = `
if redis.call('EXISTS', KEYS[2]) == 1 then return 2 end
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(ARGV[1])
if current >= limit then return 0 end
redis.call('SET', KEYS[2], '1')
redis.call('INCR', KEYS[1])
redis.call('EXPIREAT', KEYS[1], ARGV[2])
return 1
`;

function positiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive safe integer`);
  }
}

export function validateOcrPageIdentity(identity: OcrPageIdentity): OcrPageIdentity {
  if (!UUID.test(identity.documentId)) throw new Error('documentId must be a UUID');
  if (!SHA256.test(identity.sha256))
    throw new Error('sha256 must contain 64 hexadecimal characters');
  positiveInteger(identity.pageNumber, 'pageNumber');
  positiveInteger(identity.pipelineVersion, 'pipelineVersion');
  return {
    documentId: identity.documentId.toLowerCase(),
    sha256: identity.sha256.toLowerCase(),
    pageNumber: identity.pageNumber,
    pipelineVersion: identity.pipelineVersion,
  };
}

export function ocrBudgetKeys(identity: OcrPageIdentity, now: Date) {
  if (!Number.isFinite(now.getTime())) throw new Error('now must be a valid date');
  const normalized = validateOcrPageIdentity(identity);
  return {
    daily: `alem-do-sisu:ocr:pages:${now.toISOString().slice(0, 10)}`,
    reservation: `alem-do-sisu:ocr:reserved:${normalized.documentId}:${normalized.sha256}:p${normalized.pageNumber}:v${normalized.pipelineVersion}`,
    nextMidnightSeconds: Math.floor(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) / 1_000,
    ),
  };
}

export class RedisOcrBudgetStore implements OcrBudgetStore {
  constructor(private readonly redis: Pick<Redis, 'eval'>) {}

  async tryReserve(
    identity: OcrPageIdentity,
    dailyPageBudget: number,
    now: Date,
  ): Promise<OcrReservation> {
    if (!Number.isSafeInteger(dailyPageBudget) || dailyPageBudget < 0) {
      throw new Error('dailyPageBudget must be a non-negative safe integer');
    }
    if (dailyPageBudget === 0) return 'EXHAUSTED';
    const keys = ocrBudgetKeys(identity, now);
    const result = Number(
      await this.redis.eval(
        RESERVE_SCRIPT,
        2,
        keys.daily,
        keys.reservation,
        String(dailyPageBudget),
        String(keys.nextMidnightSeconds),
      ),
    );
    if (result === 1) return 'NEW';
    if (result === 2) return 'EXISTING';
    if (result === 0) return 'EXHAUSTED';
    throw new Error('Unexpected OCR budget store response');
  }
}
