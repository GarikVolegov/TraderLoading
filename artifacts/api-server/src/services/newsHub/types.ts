export interface NewsArticle {
  title: string;
  summary: string;
  originalTitle?: string;
  originalSummary?: string;
  source: string;
  sources?: string[];
  citationUrls?: string[];
  verified?: boolean;
  publishedAt: string | null;
  url: string | null;
  resolvedUrl?: string | null;
  sourceUrl?: string | null;
  sentiment: string | null;
  imageUrl: string | null;
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
}

export interface NewsProviderStatus {
  provider: "rss" | "groq" | "benzinga" | "finnhub" | "polygon";
  status: "connected" | "connecting" | "polling" | "disabled" | "error";
  transport: "websocket" | "polling" | "rest" | "none";
  message?: string;
  lastUpdated: string;
}

export interface NewsResponse {
  articles: NewsArticle[];
  fetchedAt: string;
  hasApiKey: boolean;
  source: "ai" | "rss";
  agentSummary?: string;
  watchedPairs?: string[];
  nextRefreshAt?: string;
  providerStatuses?: NewsProviderStatus[];
  freshArticlesCount?: number;
  fallbackArticlesCount?: number;
  oldestFreshArticleAt?: string;
  freshnessWindowHours?: number;
}

export type NewsEvent =
  | { type: "news_snapshot"; snapshot: NewsResponse }
  | { type: "news_article"; article: NewsArticle }
  | { type: "news_provider_status"; status: NewsProviderStatus }
  | { type: "news_error"; message: string; provider?: string };

export interface NewsRefreshRequest {
  pairs?: string;
  lang?: string;
  force?: boolean;
}
