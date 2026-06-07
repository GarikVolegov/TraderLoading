import type { NewsArticle, NewsResponse } from "./types.js";

export interface MacroNewsArticle {
  title: string;
  summary: string;
  originalTitle?: string;
  originalSummary?: string;
  impact: string;
  currency: string;
  direction: string;
  source: string;
  url?: string | null;
  resolvedUrl?: string | null;
  sourceUrl?: string | null;
  sources?: string[];
  citationUrls?: string[];
  verified?: boolean;
  category?: string;
  timestamp?: string | null;
  imageUrl?: string | null;
  imageKeywords?: string[];
}

export interface MacroNewsResultLike {
  articles: MacroNewsArticle[];
  sentiment: string;
  summary: string;
  fetchedAt: string;
  citationUrls?: string[];
}

const MAJOR_CURRENCIES = ["EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"];

export function pairsFromMacroCurrencies(currenciesRaw: string): string {
  const currencies = currenciesRaw.split(",").map((currency) => currency.trim().toUpperCase()).filter(Boolean);
  const set = new Set(currencies);
  if (set.has("XAU") && set.has("USD")) return "XAUUSD";
  for (const currency of MAJOR_CURRENCIES) {
    if (set.has(currency) && set.has("USD")) return `${currency}USD`;
  }
  return "";
}

function impactFromScore(score: number | undefined): "alto" | "medio" | "basso" {
  if ((score ?? 0) >= 8) return "alto";
  if ((score ?? 0) >= 5) return "medio";
  return "basso";
}

function directionFromArticle(article: NewsArticle): "bullish" | "bearish" | "neutrale" {
  if (article.impactDirection === "bullish" || article.sentiment === "bullish") return "bullish";
  if (article.impactDirection === "bearish" || article.sentiment === "bearish") return "bearish";
  return "neutrale";
}

function currencyFromArticle(article: NewsArticle): string {
  const primary = article.primaryAssets?.find((asset) => asset && asset !== "USD");
  if (primary) return primary;
  const pair = article.affectedPairs?.[0];
  if (pair?.includes("/")) return pair.split("/")[0] ?? "GLOBALE";
  return article.primaryAssets?.[0] ?? "GLOBALE";
}

function sentimentFromArticles(articles: MacroNewsArticle[]): string {
  const bull = articles.filter((article) => article.direction === "bullish").length;
  const bear = articles.filter((article) => article.direction === "bearish").length;
  return bull > bear ? "risk-on" : bear > bull ? "risk-off" : "neutrale";
}

function categoryFromArticle(article: NewsArticle): string {
  const text = `${article.title} ${article.summary}`.toLowerCase();
  if (/gold|xau|bullion|commodit/.test(text)) return "commodities";
  if (/fed|fomc|ecb|boe|boj|rate|yield|treasury/.test(text)) return "banca-centrale";
  if (/cpi|inflation|jobs|payroll|gdp|pmi/.test(text)) return "macro-dati";
  if (/war|conflict|sanction|geopolit/.test(text)) return "conflitto";
  return "macro-dati";
}

export function macroNewsFromNewsHub(news: NewsResponse): MacroNewsResultLike {
  const articles = news.articles.map((article): MacroNewsArticle => ({
    title: article.title,
    summary: article.summary,
    originalTitle: article.originalTitle,
    originalSummary: article.originalSummary,
    impact: impactFromScore(article.impactScore),
    currency: currencyFromArticle(article),
    direction: directionFromArticle(article),
    source: article.source,
    url: article.url,
    resolvedUrl: article.resolvedUrl,
    sourceUrl: article.sourceUrl,
    sources: article.sources?.length ? article.sources : [article.source],
    citationUrls: article.citationUrls ?? (article.url ? [article.url] : []),
    verified: article.verified ?? Boolean(article.url),
    category: categoryFromArticle(article),
    timestamp: article.publishedAt,
    imageUrl: article.imageUrl,
    imageKeywords: article.primaryAssets,
  }));

  return {
    articles,
    sentiment: sentimentFromArticles(articles),
    summary: news.agentSummary ?? "Notizie aggiornate dal News Hub con filtro per asset e impatto.",
    fetchedAt: news.fetchedAt,
    citationUrls: articles.flatMap((article) => article.citationUrls ?? []),
  };
}
