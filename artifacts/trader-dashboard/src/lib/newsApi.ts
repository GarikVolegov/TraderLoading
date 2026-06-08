import { createApiUrl, type RelativeApiOptions } from "./apiFetch";

export interface ArticleDeepDive {
  whatHappened: string;
  whyItMatters: string;
  possibleImpact: string;
}

export interface Article {
  title: string;
  summary: string;
  originalTitle?: string;
  originalSummary?: string;
  source: string;
  sources?: string[];
  citationUrls?: string[];
  verified?: boolean;
  publishedAt?: string | null;
  url?: string | null;
  resolvedUrl?: string | null;
  sourceUrl?: string | null;
  sentiment?: string | null;
  imageUrl?: string | null;
  affectedPairs?: string[];
  impactScore?: number;
  impactReason?: string;
  primaryAssets?: string[];
  impactDirection?: "bullish" | "bearish" | "mixed" | "neutral";
  relevanceReason?: string;
  matchConfidence?: number;
  freshnessTier?: "live" | "fresh" | "fallback" | "stale";
  ageMinutes?: number;
  isFallback?: boolean;
  qualityScore?: number;
  deepDive?: ArticleDeepDive;
}

export interface NewsData {
  articles: Article[];
  fetchedAt: string;
  hasApiKey: boolean;
  source?: string;
  agentSummary?: string;
  watchedPairs?: string[];
  nextRefreshAt?: string;
  providerStatuses?: NewsProviderStatus[];
  freshArticlesCount?: number;
  fallbackArticlesCount?: number;
  oldestFreshArticleAt?: string;
  freshnessWindowHours?: number;
  nextCursor?: string | null;
  totalCount?: number;
}

export interface NewsProviderStatus {
  provider: string;
  status: "connected" | "connecting" | "polling" | "disabled" | "error";
  transport: "websocket" | "polling" | "rest" | "none";
  message?: string;
  lastUpdated: string;
}

export type NewsSocketMessage =
  | { type: "news_snapshot"; snapshot: NewsData }
  | { type: "news_article"; article: Article }
  | { type: "news_provider_status"; status: NewsProviderStatus }
  | { type: "news_error"; message: string };

export type NewsQueryKey = readonly ["macro-news", string, string];

export type FetchNewsInput = RelativeApiOptions & {
  selectedPairsKey: string;
  language: string;
  noCache?: boolean;
  cursor?: string | null;
  limit?: number;
};

export function createNewsQueryKey(selectedPairsKey: string, language: string): NewsQueryKey {
  return ["macro-news", selectedPairsKey, language] as const;
}

export function createNewsSubscribeMessage(selectedPairsKey: string, language: string) {
  return { type: "subscribe", pairs: selectedPairsKey, lang: language } as const;
}

export function createNewsRefreshMessage(selectedPairsKey: string, language: string) {
  return { type: "refresh", pairs: selectedPairsKey, lang: language, force: true } as const;
}

function createNewsUrl(input: FetchNewsInput): string {
  const params = new URLSearchParams();
  params.set(input.noCache ? "nocache" : "_", "1");
  if (input.selectedPairsKey) params.set("pairs", input.selectedPairsKey);
  params.set("lang", input.language);
  if (input.cursor) params.set("cursor", input.cursor);
  if (typeof input.limit === "number") params.set("limit", String(input.limit));
  return `${createApiUrl("news", input.basePath)}?${params.toString()}`;
}

export async function fetchNews(input: FetchNewsInput): Promise<NewsData> {
  const res = await fetch(createNewsUrl(input), { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch news");
  return res.json() as Promise<NewsData>;
}
