import type { NewsArticle } from "./types.js";

export interface Clock {
  now(): number;
}

export interface FreshnessOptions {
  clock?: Clock;
  freshnessWindowHours?: number;
}

export interface NewsCacheOptions {
  ttlMs: number;
  clock?: Clock;
}

type CacheEntry<T> = {
  data: T;
  ts: number;
};

const DEFAULT_CLOCK: Clock = {
  now: () => Date.now(),
};

const TIER_RANK: Record<NonNullable<NewsArticle["freshnessTier"]>, number> = {
  live: 0,
  fresh: 1,
  fallback: 2,
  stale: 3,
};

function parseDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

export function applyNewsFreshness(articles: NewsArticle[], options: FreshnessOptions = {}): NewsArticle[] {
  const clock = options.clock ?? DEFAULT_CLOCK;
  const freshnessWindowHours = options.freshnessWindowHours ?? 48;
  const freshnessWindowMs = freshnessWindowHours * 60 * 60 * 1000;
  const now = clock.now();

  return articles.map((article) => {
    const published = parseDate(article.publishedAt);
    const ageMinutes = published === null ? undefined : Math.max(0, Math.round((now - published) / 60_000));
    const freshnessTier: NonNullable<NewsArticle["freshnessTier"]> =
      published === null
        ? "stale"
        : now - published <= freshnessWindowMs
          ? "fresh"
          : "fallback";

    return {
      ...article,
      freshnessTier,
      ageMinutes,
      isFallback: freshnessTier === "fallback" || freshnessTier === "stale",
    };
  });
}

export function sortNewsByFreshness(articles: NewsArticle[]): NewsArticle[] {
  return [...articles].sort((a, b) => {
    const tierA = TIER_RANK[a.freshnessTier ?? "stale"];
    const tierB = TIER_RANK[b.freshnessTier ?? "stale"];
    if (tierA !== tierB) return tierA - tierB;

    const dateA = parseDate(a.publishedAt) ?? 0;
    const dateB = parseDate(b.publishedAt) ?? 0;
    if (dateA !== dateB) return dateB - dateA;

    return (b.matchConfidence ?? 0) - (a.matchConfidence ?? 0) || (b.impactScore ?? 0) - (a.impactScore ?? 0);
  });
}

export function createNewsCache<T>(options: NewsCacheOptions) {
  const entries = new Map<string, CacheEntry<T>>();
  let clock = options.clock ?? DEFAULT_CLOCK;

  return {
    get(key: string): T | null {
      const entry = entries.get(key);
      if (!entry) return null;
      if (clock.now() - entry.ts > options.ttlMs) {
        entries.delete(key);
        return null;
      }
      return entry.data;
    },
    set(key: string, data: T): void {
      entries.set(key, { data, ts: clock.now() });
    },
    setClock(nextClock: Clock): void {
      clock = nextClock;
    },
    clear(): void {
      entries.clear();
    },
  };
}

export function newsCacheTtlMs(): number {
  const raw = Number(process.env.NEWS_CACHE_TTL_MS ?? 120_000);
  return Number.isFinite(raw) && raw > 0 ? raw : 120_000;
}

export function newsFreshnessWindowHours(): number {
  const raw = Number(process.env.NEWS_FRESH_WINDOW_HOURS ?? 48);
  return Number.isFinite(raw) && raw > 0 ? raw : 48;
}
