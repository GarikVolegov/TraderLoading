import type { NewsArticle, NewsDeepDive, NewsResponse } from "./types.js";
import { computeRiskRegime } from "./riskRegime.js";
import { isTradingDecisionRelevantNews } from "./tradingRelevance.js";

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
  deepDive?: NewsDeepDive;
}

export interface MacroNewsResultLike {
  articles: MacroNewsArticle[];
  sentiment: string;
  sentimentIntensity?: string;
  summary: string;
  fetchedAt: string;
  citationUrls?: string[];
}

const MAJOR_CURRENCIES = ["EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"];
const KNOWN_ASSETS = ["EUR", "USD", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "XAU", "XAG", "BTC", "ETH"];
const ASSET_PATTERNS: Record<string, RegExp[]> = {
  EUR: [/\beur\b/i, /\beuro\b/i, /\becb\b/i],
  USD: [/\busd\b/i, /\bdollar\b/i, /\bdxy\b/i, /\bfed\b/i, /\bfomc\b/i, /federal\s+reserve/i, /treasury\s+yields?/i],
  GBP: [/\bgbp\b/i, /\bpound\b/i, /\bsterling\b/i, /\bboe\b/i],
  JPY: [/\bjpy\b/i, /\byen\b/i, /\bboj\b/i],
  CHF: [/\bchf\b/i, /\bswiss\s+franc\b/i, /\bsnb\b/i],
  CAD: [/\bcad\b/i, /\bcanadian\s+dollar\b/i, /\bboc\b/i],
  AUD: [/\baud\b/i, /\baussie\b/i, /\brba\b/i],
  NZD: [/\bnzd\b/i, /\bkiwi\b/i, /\brbnz\b/i, /\bnew\s+zealand\s+dollar\b/i],
  XAU: [/\bxau\b/i, /\bgold\b/i, /\bbullion\b/i],
  XAG: [/\bxag\b/i, /\bsilver\b/i],
  BTC: [/\bbtc\b/i, /\bbitcoin\b/i, /\bcrypto\b/i],
  ETH: [/\beth\b/i, /\bethereum\b/i],
};

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

function categoryFromArticle(article: NewsArticle): string {
  const text = `${article.title} ${article.summary}`.toLowerCase();
  if (/gold|xau|bullion|commodit/.test(text)) return "commodities";
  if (/fed|fomc|ecb|boe|boj|rate|yield|treasury/.test(text)) return "banca-centrale";
  if (/cpi|inflation|jobs|payroll|gdp|pmi/.test(text)) return "macro-dati";
  if (/war|conflict|sanction|geopolit/.test(text)) return "conflitto";
  return "macro-dati";
}

const ASSET_IMAGE_KEYWORDS: Record<string, string[]> = {
  EUR: ["euro", "europe", "centralbank"],
  USD: ["dollar", "wallstreet", "federalreserve"],
  GBP: ["london", "pound", "bankofengland"],
  JPY: ["tokyo", "yen", "bankofjapan"],
  CHF: ["switzerland", "franc", "bank"],
  CAD: ["canada", "dollar", "economy"],
  AUD: ["australia", "dollar", "economy"],
  NZD: ["newzealand", "dollar", "economy"],
  XAU: ["gold", "bullion", "vault"],
  GLOBALE: ["global", "economy", "markets"],
};

function stableLock(text: string, index: number): number {
  let hash = index + 1;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return hash || 1;
}

function semanticImageKeywords(article: NewsArticle): string[] {
  const text = `${article.title} ${article.summary} ${article.originalTitle ?? ""} ${article.originalSummary ?? ""}`.toLowerCase();
  const currency = currencyFromArticle(article);
  const keywords: string[] = [];
  const add = (...items: string[]) => {
    for (const item of items) if (item && !keywords.includes(item)) keywords.push(item);
  };

  if (/trump|white house|donald/.test(text)) add("donaldtrump", "gold", "tradeagreement");
  if (/gold|xau|bullion/.test(text)) add("gold", "bullion", "vault");
  if (/silver|xag/.test(text)) add("silver", "preciousmetals");
  if (/fed|fomc|powell|federal reserve/.test(text)) add("federalreserve", "centralbank");
  if (/cpi|inflation|pce|price index/.test(text)) add("inflation", "economy");
  if (/jobs|payroll|employment|unemployment/.test(text)) add("jobsreport", "economy");
  if (/oil|crude|petrol|energy/.test(text)) add("oil", "energy");
  if (/china|beijing/.test(text)) add("china", "trade");
  if (/war|conflict|geopolit|sanction/.test(text)) add("geopolitics", "conflict");
  if (/election|vote|government/.test(text)) add("election", "politics");
  add(...(article.primaryAssets ?? []));
  add(...(ASSET_IMAGE_KEYWORDS[currency] ?? ASSET_IMAGE_KEYWORDS.GLOBALE));
  return keywords.slice(0, 3);
}

function representativeMacroImageUrl(article: NewsArticle, index: number): string {
  const keywords = semanticImageKeywords(article).map((keyword) => encodeURIComponent(keyword));
  const query = keywords.length > 0 ? keywords.join(",") : "global,economy,markets";
  const lock = stableLock(`${article.title} ${article.summary}`, index);
  return `https://loremflickr.com/800/400/${query}?lock=${lock}`;
}

function uniqueMacroImageUrl(article: NewsArticle, index: number, seen: Set<string>): string {
  const sourceImage = article.imageUrl?.trim();
  if (sourceImage && !seen.has(sourceImage)) {
    seen.add(sourceImage);
    return sourceImage;
  }

  for (let offset = 0; offset < 20; offset++) {
    const fallback = representativeMacroImageUrl(article, index + offset * 97);
    if (!seen.has(fallback)) {
      seen.add(fallback);
      return fallback;
    }
  }

  const fallback = representativeMacroImageUrl(article, index + seen.size * 193);
  seen.add(fallback);
  return fallback;
}

function normalizePair(pair: string): string {
  const clean = pair.trim().toUpperCase();
  return clean.length === 6 ? `${clean.slice(0, 3)}/${clean.slice(3)}` : clean;
}

function explicitPairsInText(text: string): string[] {
  const pairs = new Set<string>();
  const slashRe = /\b([A-Z]{3})\s*\/\s*([A-Z]{3})\b/gi;
  let slashMatch: RegExpExecArray | null;
  while ((slashMatch = slashRe.exec(text)) !== null) {
    pairs.add(`${slashMatch[1]?.toUpperCase()}/${slashMatch[2]?.toUpperCase()}`);
  }
  for (const base of KNOWN_ASSETS) {
    for (const quote of KNOWN_ASSETS) {
      if (base === quote) continue;
      const compact = `${base}${quote}`;
      if (new RegExp(`\\b${compact}\\b`, "i").test(text)) pairs.add(`${base}/${quote}`);
    }
  }
  return Array.from(pairs);
}

function selectedAssetsFromPairs(pairs: string[]): string[] {
  const assets = new Set<string>();
  for (const pair of pairs) {
    for (const part of pair.split("/")) if (part) assets.add(part);
  }
  return Array.from(assets);
}

function hasAssetPattern(text: string, asset: string): boolean {
  return (ASSET_PATTERNS[asset] ?? []).some((pattern) => pattern.test(text));
}

function hasStrongUsdMention(text: string): boolean {
  return /\busd\b|\bdxy\b|\bfed\b|\bfomc\b|federal\s+reserve|treasury\s+yields?|powell/i.test(text);
}

function mentionsDominantNonFocusAsset(text: string, focusPairs: string[]): boolean {
  const focusAssets = selectedAssetsFromPairs(focusPairs);
  if (focusAssets.length === 0) return false;
  const focusSet = new Set(focusAssets);
  const outsideAssets = KNOWN_ASSETS.filter((asset) => !focusSet.has(asset) && hasAssetPattern(text, asset));
  if (outsideAssets.length === 0) return false;
  const hasFocusMention = focusAssets.some((asset) => asset === "USD" ? hasStrongUsdMention(text) : hasAssetPattern(text, asset));
  return !hasFocusMention;
}

function isExplicitlyOutsideRequestedPairs(article: NewsArticle, requestedPairs = ""): boolean {
  const focusPairs = requestedPairs.split(",").map(normalizePair).filter(Boolean);
  if (focusPairs.length === 0) return false;
  const text = [
    article.title,
    article.summary,
    article.originalTitle,
    article.originalSummary,
  ].filter(Boolean).join(" ");
  const explicitPairs = explicitPairsInText(text);
  const focusSet = new Set(focusPairs);
  if (explicitPairs.length > 0 && explicitPairs.every((pair) => !focusSet.has(pair))) return true;
  return mentionsDominantNonFocusAsset(text, focusPairs);
}

function primaryMacroPair(articles: NewsArticle[], requestedPairs = ""): string {
  const requested = requestedPairs.split(",").map(normalizePair).filter(Boolean)[0];
  if (requested) return requested;
  return articles.find((article) => article.affectedPairs?.[0])?.affectedPairs?.[0] ?? "asset monitorati";
}

function regimeSummaryLabel(regime: ReturnType<typeof computeRiskRegime>): string {
  const base = regime.regime === "neutrale" ? "NEUTRALE" : regime.regime.toUpperCase();
  return regime.intensity ? `${base} ${regime.intensity}` : base;
}

function topMacroDriver(articles: NewsArticle[]): string {
  const text = articles
    .slice(0, 3)
    .map((article) => `${article.title} ${article.summary} ${article.originalTitle ?? ""} ${article.originalSummary ?? ""}`)
    .join(" ")
    .toLowerCase();
  if (/cpi|inflation|inflazione|consumer price index/.test(text)) return "CPI/inflazione";
  if (/fed|fomc|powell|treasury|yield|rendiment|tassi|rate/.test(text)) return "Fed, dollaro e rendimenti";
  if (/payroll|nfp|jobs|occupazione|unemployment/.test(text)) return "lavoro USA";
  if (/war|conflict|geopolit|sanction|crisi|sanzion/.test(text)) return "rischio geopolitico";
  return categoryFromArticle(articles[0] ?? ({} as NewsArticle)).replace("-", " ");
}

function macroActionHint(articles: NewsArticle[], pair: string): string {
  const text = articles
    .slice(0, 3)
    .map((article) => `${article.title} ${article.summary} ${article.originalTitle ?? ""} ${article.originalSummary ?? ""}`)
    .join(" ")
    .toLowerCase();
  if (/cpi|inflation|inflazione|consumer price index/.test(text) && /XAU\/USD/i.test(pair)) {
    return "Sopra attese: dollaro/rendimenti piu' forti e pressione su oro; sotto attese: possibile supporto a XAU/USD.";
  }
  if (/fed|fomc|treasury|yield|rendiment|tassi|rate/.test(text)) {
    return "Il punto operativo e' la reazione di dollaro e rendimenti: attendi conferma prima di aumentare size.";
  }
  return "Usalo come contesto: attendi conferma su prezzo e volatilita' prima di aumentare size.";
}

function buildMacroTickerSummary(
  articles: NewsArticle[],
  regime: ReturnType<typeof computeRiskRegime>,
  options: { pairs?: string } = {},
): string {
  if (articles.length === 0) return "Nessuna notizia macro ad alto impatto realmente utile per il trading in questo momento.";
  const pair = primaryMacroPair(articles, options.pairs);
  const driver = topMacroDriver(articles);
  return `${regimeSummaryLabel(regime)} su ${pair}: driver principale ${driver}. ${macroActionHint(articles, pair)}`;
}

export function macroNewsFromNewsHub(news: NewsResponse, options: { pairs?: string } = {}): MacroNewsResultLike {
  const kept = news.articles.filter(
    (article) => !isExplicitlyOutsideRequestedPairs(article, options.pairs) && isTradingDecisionRelevantNews(article),
  );
  const regime = computeRiskRegime(kept);
  const seenImageUrls = new Set<string>();
  const articles = kept
    .map((article, index): MacroNewsArticle => ({
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
    imageUrl: uniqueMacroImageUrl(article, index, seenImageUrls),
    imageKeywords: article.primaryAssets,
    deepDive: article.deepDive,
  }));

  return {
    articles,
    sentiment: regime.regime,
    sentimentIntensity: regime.intensity ?? undefined,
    summary: buildMacroTickerSummary(kept, regime, options),
    fetchedAt: news.fetchedAt,
    citationUrls: articles.flatMap((article) => article.citationUrls ?? []),
  };
}
