import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { DocumentParserKind } from '../../../generated/prisma/enums.js';
import { PrismaService } from '../../../database/prisma.service.js';

export interface ParserCacheKey {
  sha256: string;
  parserKind: DocumentParserKind;
  parserVersion: number;
}

export interface ParserCacheResult<T> {
  cacheHit: boolean;
  result: T;
}

const HASH = /^[0-9a-f]{64}$/iu;
const PARSER_KINDS = new Set<string>(Object.values(DocumentParserKind));

function validateKey(key: ParserCacheKey): ParserCacheKey {
  if (!HASH.test(key.sha256)) throw new TypeError('sha256 must contain 64 hexadecimal characters');
  if (!PARSER_KINDS.has(key.parserKind)) throw new TypeError('parserKind is not supported');
  if (!Number.isSafeInteger(key.parserVersion) || key.parserVersion < 1) {
    throw new TypeError('parserVersion must be a positive safe integer');
  }
  return { ...key, sha256: key.sha256.toLowerCase() };
}

function jsonObject(value: unknown): Prisma.InputJsonObject {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new TypeError('Parser output must be JSON serializable');
  }
  if (serialized === undefined) throw new TypeError('Parser output must be JSON serializable');
  const normalized: unknown = JSON.parse(serialized);
  if (normalized === null || typeof normalized !== 'object' || Array.isArray(normalized)) {
    throw new TypeError('Parser output must be a JSON object');
  }
  return normalized as Prisma.InputJsonObject;
}

type BlobAvailability = { expiredAt: Date | null };

@Injectable()
export class ParserCacheRepository {
  constructor(private readonly database: PrismaService) {}

  async getOrCompute<T extends object>(
    input: ParserCacheKey,
    compute: () => Promise<T>,
  ): Promise<ParserCacheResult<T>> {
    const key = validateKey(input);
    const existing = await this.database.$transaction(async (transaction) => {
      const blobs = await transaction.$queryRaw<BlobAvailability[]>`
        SELECT "expired_at" AS "expiredAt"
        FROM "document_blobs"
        WHERE "sha256" = ${key.sha256}
        FOR SHARE
      `;
      const blob = blobs[0];
      if (!blob) throw new Error('Parser cache requires a recorded document blob');
      if (blob.expiredAt !== null)
        throw new Error('Expired document blobs cannot be parsed or cached');
      return transaction.documentParseCache.findUnique({
        where: {
          sha256_parserKind_parserVersion: {
            sha256: key.sha256,
            parserKind: key.parserKind,
            parserVersion: key.parserVersion,
          },
        },
      });
    });
    if (existing) return { cacheHit: true, result: existing.resultJson as T };

    const resultJson = jsonObject(await compute());
    const stored = await this.database.$transaction(async (transaction) => {
      const blobs = await transaction.$queryRaw<BlobAvailability[]>`
        SELECT "expired_at" AS "expiredAt"
        FROM "document_blobs"
        WHERE "sha256" = ${key.sha256}
        FOR UPDATE
      `;
      const blob = blobs[0];
      if (!blob) throw new Error('Parser cache requires a recorded document blob');
      if (blob.expiredAt !== null)
        throw new Error('Expired document blobs cannot be parsed or cached');
      return transaction.documentParseCache.upsert({
        where: {
          sha256_parserKind_parserVersion: {
            sha256: key.sha256,
            parserKind: key.parserKind,
            parserVersion: key.parserVersion,
          },
        },
        create: { ...key, resultJson },
        update: {},
      });
    });
    return { cacheHit: false, result: stored.resultJson as T };
  }
}
