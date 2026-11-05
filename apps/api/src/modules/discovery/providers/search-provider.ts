import { normalizeAuthorizedHost } from '../../sources/source-url.js';

export interface SearchProviderQuery {
  host: string;
  terms: readonly string[];
  query: string;
}

export interface SearchProviderResult {
  url: string;
  title?: string;
}

/** Provider adapter only. Implementations must use an authorized search API, never SERP scraping. */
export interface SearchProvider {
  search(query: SearchProviderQuery): Promise<readonly SearchProviderResult[]>;
}

export function buildSiteDomainQuery(host: string, terms: readonly string[]): SearchProviderQuery {
  if (typeof host !== 'string') throw new Error('Search host must be an authorized DNS host');
  const normalizedHost = normalizeAuthorizedHost(host.trim().toLowerCase().replace(/\.$/u, ''));
  if (!Array.isArray(terms) || terms.length === 0) {
    throw new Error('Search terms are required');
  }

  const normalizedTerms = terms.map((term) => {
    if (
      typeof term !== 'string' ||
      Array.from(term).some((character) => {
        const code = character.codePointAt(0) ?? 0;
        return code < 32 || code === 127;
      })
    ) {
      throw new Error('Search terms must be plain text');
    }
    const normalized = term.trim().replace(/\s+/gu, ' ');
    if (!normalized) throw new Error('Search terms cannot be empty');
    return normalized;
  });

  return {
    host: normalizedHost,
    terms: normalizedTerms,
    query: `site:${normalizedHost} ${normalizedTerms.join(' ')}`,
  };
}
