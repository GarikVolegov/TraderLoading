import type { NewsArticle } from "./types.js";

export interface NewsRankingOptions {
  limit?: number;
  maxPerSource?: number;
}

const DEFAULT_LIMIT = 20;
const DEFAULT_MAX_PER_SOURCE = 3;

const TIER_SCORE: Record<NonNullable<NewsArticle["freshnessTier"]>, number> = {
  live: 1,
  fresh: 0.86,
  fallback: 0.35,
  stale: 0.1,
};

const TRUSTED_SOURCE_BONUS: Record<string, number> = {
  reuters: 0.08,
  "associated press": 0.07,
  bloomberg: 0.07,
  cnbc: 0.05,
  "marketwatch": 0.04,
  "financial times": 0.06,
};

const NOISE_RE = /\b(earnings call transcript|gaap eps|price target|stock rating|shares of|class action|lawsuit)\b/i;
const FINANCE_RE = /\b(gold|xau|bullion|dollar|usd|dxy|treasury|yield|fed|fomc|inflation|cpi|rate|safe haven|forex|currency|commodit)/i;
const GOOGLE_PUBLISHER_RE = /^(.*?)\s+-\s+([^-]{2,60})$/;

function parseDate(value: string | null | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+-\s+[^-]{2,40}$/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(update|breaking|latest|exclusive|analysis)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceRoot(source: string): string {
  return source.toLowerCase().replace(/\s+-\s+.*/g, "").trim();
}

function sourceBonus(source: string): number {
  const normalized = sourceRoot(source);
  for (const [key, bonus] of Object.entries(TRUSTED_SOURCE_BONUS)) {
    if (normalized.includes(key)) return bonus;
  }
  return 0;
}

export function computeNewsQualityScore(article: NewsArticle): number {
  const text = `${article.title} ${article.summary}`;
  const freshness = TIER_SCORE[article.freshnessTier ?? "stale"] ?? 0;
  const confidence = article.matchConfidence ?? 0;
  const impact = (article.impactScore ?? 0) / 10;
  const financeBonus = FINANCE_RE.test(text) ? 0.08 : -0.08;
  const noisePenalty = NOISE_RE.test(text) ? -0.24 : 0;
  const score = freshness * 0.42 + confidence * 0.32 + impact * 0.18 + sourceBonus(article.source) + financeBonus + noisePenalty;
  return Math.max(0, Math.min(1, Number(score.toFixed(4))));
}

export function normalizeNewsSources(articles: NewsArticle[]): NewsArticle[] {
  return articles.map((article) => {
    if (article.source.toLowerCase() !== "google news") return article;
    const match = GOOGLE_PUBLISHER_RE.exec(article.title.trim());
    if (!match) return article;
    const title = match[1]?.trim();
    const source = match[2]?.trim();
    if (!title || !source) return article;
    return { ...article, title, source };
  });
}

export function sortNewsChronologically(articles: NewsArticle[]): NewsArticle[] {
  // Newest first; articles without a parseable date sink to the bottom.
  return [...articles].sort((a, b) => parseDate(b.publishedAt) - parseDate(a.publishedAt));
}

export interface NewsPage {
  articles: NewsArticle[];
  nextCursor: string | null;
  totalCount: number;
}

export interface NewsPaginationOptions {
  cursor?: string | null;
  limit?: number;
}

export const DEFAULT_NEWS_PAGE_SIZE = 15;
const MAX_NEWS_PAGE_SIZE = 50;

export function parseNewsCursor(cursor: string | null | undefined): number {
  const parsed = Number.parseInt(cursor ?? "0", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function paginateNews(articles: NewsArticle[], options: NewsPaginationOptions = {}): NewsPage {
  const total = articles.length;
  const offset = parseNewsCursor(options.cursor);
  const rawLimit = Math.floor(options.limit ?? DEFAULT_NEWS_PAGE_SIZE);
  const limit = Math.max(1, Math.min(MAX_NEWS_PAGE_SIZE, Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : DEFAULT_NEWS_PAGE_SIZE));
  const slice = articles.slice(offset, offset + limit);
  const nextOffset = offset + limit;
  return {
    articles: slice,
    nextCursor: nextOffset < total ? String(nextOffset) : null,
    totalCount: total,
  };
}

export function rankNewsForDisplay(articles: NewsArticle[], options: NewsRankingOptions = {}): NewsArticle[] {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const maxPerSource = options.maxPerSource ?? DEFAULT_MAX_PER_SOURCE;
  const seenTitles = new Set<string>();
  const sourceCounts = new Map<string, number>();

  const scored = articles
    .map((article) => ({ ...article, qualityScore: computeNewsQualityScore(article) }))
    .sort((a, b) =>
      (b.qualityScore ?? 0) - (a.qualityScore ?? 0)
      || parseDate(b.publishedAt) - parseDate(a.publishedAt)
      || (b.matchConfidence ?? 0) - (a.matchConfidence ?? 0),
    );

  const selected: NewsArticle[] = [];
  for (const article of scored) {
    const titleKey = normalizeTitle(article.title);
    if (!titleKey || seenTitles.has(titleKey)) continue;

    const sourceKey = sourceRoot(article.source);
    const sourceCount = sourceCounts.get(sourceKey) ?? 0;
    if (sourceCount >= maxPerSource) continue;

    seenTitles.add(titleKey);
    sourceCounts.set(sourceKey, sourceCount + 1);
    selected.push(article);
    if (selected.length >= limit) break;
  }

  return selected;
}
