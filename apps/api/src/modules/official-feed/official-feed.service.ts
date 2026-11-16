import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseHtmlLinkCandidates } from '../discovery/parsers/html-link.parser.js';
import { GeminiAiProvider } from '../ai/provider/gemini-ai.provider.js';

const INTERVAL_MS = 12 * 60 * 60 * 1000;
const SOURCES = [
  { institution: 'UFPB', url: 'https://www.prg.ufpb.br/editais/' },
  { institution: 'UFCG', url: 'https://comprov.ufcg.edu.br/graduacao.html' },
  { institution: 'UEPB', url: 'https://uepb.edu.br/prograd/processos-seletivos/' },
  { institution: 'IFPB', url: 'https://estudante.ifpb.edu.br/editais/' },
] as const;
const CATEGORIES = [
  'Reopção',
  'Transferência',
  'Ingresso de graduados',
  'Processo Seletivo Especial',
] as const;
const UEPB_SEARCH_TERMS = [
  'ingresso de graduados',
  'transferência',
  'reopção',
  'vagas remanescentes',
  'nota do ensino médio',
] as const;

export interface OfficialFeedItem {
  institution: string;
  title: string;
  url: string;
  category: (typeof CATEGORIES)[number];
  checkedAt: string;
}

interface Candidate {
  id: number;
  title: string;
  url: string;
}

function validSelection(
  value: unknown,
): value is { id: number; category: OfficialFeedItem['category'] } {
  return (
    !!value &&
    typeof value === 'object' &&
    Number.isSafeInteger((value as { id?: unknown }).id) &&
    CATEGORIES.includes((value as { category: OfficialFeedItem['category'] }).category)
  );
}

function robotsAllows(content: string, path: string): boolean {
  let applies = false;
  for (const raw of content.split(/\r?\n/u)) {
    const line = raw.split('#', 1)[0]?.trim() ?? '';
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === 'user-agent') applies = value === '*';
    if (applies && field === 'disallow' && value && path.startsWith(value)) return false;
  }
  return true;
}

@Injectable()
export class OfficialFeedService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OfficialFeedService.name);
  private items: OfficialFeedItem[] = [];
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private checkedAt: string | null = null;

  async onModuleInit(): Promise<void> {
    if (!process.env.LLM_PROVIDER_KEY) return;
    await this.loadCached();
    if (!this.checkedAt || Date.now() - Date.parse(this.checkedAt) >= INTERVAL_MS) {
      void this.refresh();
    }
    this.timer = setInterval(
      () => {
        if (!this.checkedAt || Date.now() - Date.parse(this.checkedAt) >= INTERVAL_MS) {
          void this.refresh();
        }
      },
      60 * 60 * 1000,
    );
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  snapshot(): { items: OfficialFeedItem[]; checkedAt: string | null; sourceCount: number } {
    return { items: [...this.items], checkedAt: this.checkedAt, sourceCount: SOURCES.length };
  }

  async refresh(): Promise<void> {
    const key = process.env.LLM_PROVIDER_KEY;
    if (!key || this.running) return;
    this.running = true;
    try {
      const provider = new GeminiAiProvider(key);
      const next: OfficialFeedItem[] = [];
      let successfulSources = 0;
      for (const source of SOURCES) {
        try {
          const candidates =
            source.institution === 'UEPB'
              ? await this.fetchUepbCandidates()
              : await this.fetchIndexCandidates(source.url);
          successfulSources += 1;
          if (!candidates.length) {
            next.push(...this.items.filter((item) => item.institution === source.institution));
            continue;
          }
          const selected = await this.select(provider, source.institution, candidates);
          next.push(...selected);
        } catch (error) {
          this.logger.warn(
            `Official feed refresh failed for ${source.institution}: ${error instanceof Error ? error.name : 'UNKNOWN'}`,
          );
          next.push(...this.items.filter((item) => item.institution === source.institution));
        }
      }
      this.items = [...new Map(next.map((item) => [item.url, item])).values()];
      if (successfulSources) {
        this.checkedAt = new Date().toISOString();
        await this.saveCached();
      }
    } finally {
      this.running = false;
    }
  }

  private async fetchIndexCandidates(url: string): Promise<Candidate[]> {
    const html = await this.fetchPage(url);
    const host = new URL(url).hostname;
    return parseHtmlLinkCandidates(html, url, [host])
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .filter((item) =>
        /edital|sele[cç][aã]o|processo|transfer|graduad|reop[cç]|remanescent|espec[ií]fic|vagas|vestibular|licenciatura/iu.test(
          `${item.anchorText} ${item.canonicalUrl}`,
        ),
      )
      .filter((item) => item.anchorText.length >= 8)
      .slice(0, 40)
      .map((item, id) => ({ id, title: item.anchorText.slice(0, 220), url: item.canonicalUrl }));
  }

  private async fetchUepbCandidates(): Promise<Candidate[]> {
    const links = new Map<string, string>();
    for (const term of UEPB_SEARCH_TERMS) {
      const endpoint = new URL('https://uepb.edu.br/wp-json/wp/v2/search');
      endpoint.searchParams.set('search', term);
      endpoint.searchParams.set('per_page', '10');
      const response = await fetch(endpoint, {
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        headers: { accept: 'application/json' },
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Official UEPB search API unavailable');
      }
      if (Number(response.headers.get('content-length')) > 200_000) {
        throw new Error('Official UEPB search response exceeded size limit');
      }
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 200_000)
        throw new Error('Official UEPB search response exceeded size limit');
      const results: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (!Array.isArray(results)) throw new Error('Official UEPB search response is invalid');
      for (const item of results) {
        if (!item || typeof item !== 'object') continue;
        const entry = item as { title?: unknown; url?: unknown };
        if (typeof entry.title !== 'string' || typeof entry.url !== 'string') continue;
        const title = entry.title
          .replace(/<[^>]+>/gu, ' ')
          .replace(/\s+/gu, ' ')
          .trim();
        let url: URL;
        try {
          url = new URL(entry.url);
        } catch {
          continue;
        }
        if (
          url.protocol !== 'https:' ||
          url.hostname !== 'uepb.edu.br' ||
          url.username ||
          url.password ||
          url.port ||
          title.length < 8
        )
          continue;
        links.set(url.toString(), title.slice(0, 220));
      }
    }
    return [...links]
      .filter(([, title]) => {
        const normalized = title
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .toLowerCase();
        if (/resultado|classificacao|convocacao|chamada|recurso|homologacao/iu.test(normalized)) {
          return false;
        }
        if (!/edital|abre|aberto|inscricao|processo seletivo|retificacao/iu.test(normalized)) {
          return false;
        }
        const years = [...normalized.matchAll(/20\d{2}/gu)].map((match) => Number(match[0]));
        return !years.length || Math.max(...years) >= new Date().getFullYear() - 1;
      })
      .slice(0, 40)
      .map(([url, title], id) => ({ id, title, url }));
  }

  private cachePath(): string {
    return (
      process.env.OFFICIAL_FEED_CACHE_PATH || join(process.cwd(), '.cache', 'official-feed.json')
    );
  }

  private async loadCached(): Promise<void> {
    try {
      const cached: unknown = JSON.parse(await readFile(this.cachePath(), 'utf8'));
      if (!cached || typeof cached !== 'object') return;
      const value = cached as { checkedAt?: unknown; items?: unknown };
      if (typeof value.checkedAt !== 'string' || !Array.isArray(value.items)) return;
      const trusted = value.items.filter((item): item is OfficialFeedItem => {
        if (!item || typeof item !== 'object') return false;
        const record = item as Partial<OfficialFeedItem>;
        const source = SOURCES.find((candidate) => candidate.institution === record.institution);
        if (!source || typeof record.url !== 'string' || typeof record.title !== 'string')
          return false;
        try {
          const url = new URL(record.url);
          return (
            url.protocol === 'https:' &&
            url.hostname === new URL(source.url).hostname &&
            !url.username &&
            !url.password &&
            CATEGORIES.includes(record.category!) &&
            record.title.length >= 8 &&
            typeof record.checkedAt === 'string'
          );
        } catch {
          return false;
        }
      });
      this.items = trusted;
      this.checkedAt = Number.isFinite(Date.parse(value.checkedAt)) ? value.checkedAt : null;
    } catch {
      // A missing or damaged cache triggers a fresh crawl.
    }
  }

  private async saveCached(): Promise<void> {
    const path = this.cachePath();
    try {
      await mkdir(dirname(path), { recursive: true });
      const temp = `${path}.${process.pid}.tmp`;
      await writeFile(temp, JSON.stringify(this.snapshot()), 'utf8');
      await rename(temp, path);
    } catch (error) {
      this.logger.warn(
        `Official feed cache write failed: ${error instanceof Error ? error.name : 'UNKNOWN'}`,
      );
    }
  }

  private async fetchPage(url: string): Promise<string> {
    const source = new URL(url);
    const options = {
      redirect: 'error' as const,
      signal: AbortSignal.timeout(15_000),
      headers: { 'user-agent': 'AlemDoSiSU-Bot/1.0' },
    };
    const robots = await fetch(`https://${source.hostname}/robots.txt`, options);
    if (robots.status !== 404 && !robots.ok) throw new Error('Robots policy unavailable');
    if (robots.ok && !robotsAllows(await robots.text(), source.pathname)) {
      throw new Error('Robots policy disallows collection');
    }
    const response = await fetch(url, options);
    if (response.status !== 200 || !response.headers.get('content-type')?.includes('text/html')) {
      throw new Error('Official page did not return HTML');
    }
    if (Number(response.headers.get('content-length')) > 1_000_000) {
      throw new Error('Official page exceeded size limit');
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 1_000_000) throw new Error('Official page exceeded size limit');
    return new TextDecoder('utf-8').decode(bytes);
  }

  private async select(
    provider: GeminiAiProvider,
    institution: string,
    candidates: Candidate[],
  ): Promise<OfficialFeedItem[]> {
    const result = await provider.generate(
      {
        documentId: randomUUID(),
        requestId: `official-feed:${institution}:${Date.now()}`,
        schemaId: 'classification-v1',
        input: {
          task: 'Select links about alternative undergraduate entry processes at this public institution. General pages dedicated to an alternative selection type are eligible even without a specific edital. Exclude regular SiSU, generic navigation, postgraduate programs, and pages that only announce results or rankings. Editais and rectifications are eligible. Return candidate IDs only; never invent URLs or titles.',
          institution,
          candidates,
        },
        jsonSchema: {
          type: 'object',
          properties: {
            selections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  category: { type: 'string', enum: CATEGORIES },
                },
                required: ['id', 'category'],
              },
            },
          },
          required: ['selections'],
        },
        maxInputTokens: 8_192,
        maxOutputTokens: 1_024,
      },
      AbortSignal.timeout(30_000),
    );
    const selections = (result.output as { selections?: unknown })?.selections;
    if (!Array.isArray(selections)) throw new Error('Invalid Gemini selection output');
    const checkedAt = new Date().toISOString();
    return selections.filter(validSelection).flatMap((item) => {
      const candidate = candidates[item.id];
      return candidate && candidate.id === item.id
        ? [
            {
              institution,
              title: candidate.title,
              url: candidate.url,
              category: item.category,
              checkedAt,
            },
          ]
        : [];
    });
  }
}
