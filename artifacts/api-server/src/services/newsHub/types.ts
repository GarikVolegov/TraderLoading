export interface NewsDeepDive {
  whatHappened: string;
  whyItMatters: string;
  possibleImpact: string;
}

export interface NewsArticle {
  articleId?: string;
  eventId?: string;
  sourceDocumentId?: string;
  articleIds?: string[];
  sourceDocumentIds?: string[];
  firstSeenAt?: string;
  archiveStatus?: "persisted" | "unavailable";
  release?: import("./eventEvidence.js").MacroRelease;
  effects?: import("./eventEvidence.js").NewsPairEffect[];
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
  curationScore?: number;
  sourceType?: "official" | "publisher";
  analysisMethod?: "llm" | "heuristic" | "none";
  contentBasis?: "full_text" | "snippet" | "headline";
  deepDive?: NewsDeepDive;
}

export interface NewsProviderStatus {
  provider: "rss" | "groq" | "benzinga" | "finnhub" | "polygon";
  status: "connected" | "connecting" | "polling" | "disabled" | "error";
  transport: "websocket" | "polling" | "rest" | "none";
  message?: string;
  lastUpdated: string;
}

export interface NewsResponse {
  modelStatus?:import("../directional/status.js").DirectionalModelState[];
  lang?: string;
  sourceCoverage?: NewsSourceCoverage[];
  articles: NewsArticle[];
  sourceStatus?: "available" | "partial" | "unavailable";
  analysisStatus?: "available" | "unavailable" | "disabled";
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
  nextCursor?: string | null;
  totalCount?: number;
}

export interface NewsSourceCoverage {
  source: string;
  url: string;
  status: "available" | "unavailable";
  fetchedAt: string;
  articleCount: number;
}

export type NewsEvent =
  | { type: "news_snapshot"; snapshot: NewsResponse }
  | { type: "news_article"; article: NewsArticle }
  | { type: "news_provider_status"; status: NewsProviderStatus }
  | { type: "news_error"; message: string; provider?: string; subscriptionKey?: string };

export interface NewsRefreshRequest {
  pairs?: string;
  lang?: string;
  force?: boolean;
}
