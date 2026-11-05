import { Inject, Injectable, Optional } from '@nestjs/common';
import { normalizeSourceUrl } from '../../sources/source-url.js';
import {
  buildSiteDomainQuery,
  type SearchProvider,
  type SearchProviderResult,
} from './search-provider.js';
import type { SearchQuotaStore } from './search-quota.store.js';

export const SEARCH_PROVIDER = Symbol('SEARCH_PROVIDER');
export const SEARCH_QUOTA_STORE = Symbol('SEARCH_QUOTA_STORE');
export const SEARCH_DAILY_QUOTA = Symbol('SEARCH_DAILY_QUOTA');

export type SearchDiscoverySource = 'external' | 'fallback';

export interface SearchDiscoveryResult {
  source: SearchDiscoverySource;
  results: SearchProviderResult[];
}

export type SearchFallback = () => Promise<readonly SearchProviderResult[]>;

@Injectable()
export class SearchProviderService {
  constructor(
    @Optional() @Inject(SEARCH_PROVIDER) private readonly provider: SearchProvider | undefined,
    @Inject(SEARCH_QUOTA_STORE) private readonly quota: SearchQuotaStore,
    @Inject(SEARCH_DAILY_QUOTA) private readonly dailyQuotaPerHost: number,
  ) {
    if (!Number.isSafeInteger(dailyQuotaPerHost) || dailyQuotaPerHost < 0) {
      throw new Error('Search quota must be a non-negative safe integer');
    }
  }

  async discover(
    host: string,
    terms: readonly string[],
    fallback: SearchFallback,
    now = new Date(),
  ): Promise<SearchDiscoveryResult> {
    const request = buildSiteDomainQuery(host, terms);
    if (!this.provider || this.dailyQuotaPerHost === 0) {
      return this.fromFallback(request.host, fallback);
    }

    try {
      const admitted = await this.quota.tryConsume(request.host, this.dailyQuotaPerHost, now);
      if (!admitted) return this.fromFallback(request.host, fallback);
    } catch {
      return this.fromFallback(request.host, fallback);
    }

    try {
      const results = await this.provider.search(request);
      return { source: 'external', results: exactHostResults(results, request.host) };
    } catch {
      return this.fromFallback(request.host, fallback);
    }
  }

  private async fromFallback(
    allowedHost: string,
    fallback: SearchFallback,
  ): Promise<SearchDiscoveryResult> {
    return { source: 'fallback', results: exactHostResults(await fallback(), allowedHost) };
  }
}

function exactHostResults(results: readonly SearchProviderResult[], allowedHost: string) {
  const unique = new Map<string, SearchProviderResult>();
  for (const result of results) {
    if (!result || typeof result.url !== 'string') continue;
    try {
      const normalized = normalizeSourceUrl(result.url);
      if (normalized.host !== allowedHost) continue;
      if (!unique.has(normalized.url)) {
        unique.set(normalized.url, {
          url: normalized.url,
          ...(typeof result.title === 'string' ? { title: result.title } : {}),
        });
      }
    } catch {
      // Provider output is untrusted; ignore non-HTTPS, private, or non-canonical URLs.
    }
  }
  return [...unique.values()];
}
