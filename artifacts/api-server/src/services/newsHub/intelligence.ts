import type { NewsArticle } from "./types.js";

export interface NewsIntelligenceContext {
  pairs?: string;
  lang?: string;
}

export interface ClassifiedNewsArticle {
  article: NewsArticle;
  relevant: boolean;
}

type Direction = NonNullable<NewsArticle["impactDirection"]>;

interface RuleMatch {
  assets: string[];
  score: number;
  confidence: number;
  direction: Direction;
  reasonKey: string;
}

const ASSET_KEYWORDS: Record<string, RegExp[]> = {
  XAU: [/\bgold\b/i, /\bxau\b/i, /\bbullion\b/i, /precious\s+metals?/i, /gold\s+etf/i, /gold\s+futures/i],
  USD: [/\busd\b/i, /\bdollar\b/i, /\bdxy\b/i, /\bfed\b/i, /\bfomc\b/i, /treasury\s+yields?/i, /powell/i],
  EUR: [/\beur\b/i, /\beuro\b/i, /\becb\b/i, /\blagarde\b/i],
  GBP: [/\bgbp\b/i, /\bpound\b/i, /\bsterling\b/i, /\bboe\b/i],
  JPY: [/\bjpy\b/i, /\byen\b/i, /\bboj\b/i],
  BTC: [/\bbtc\b/i, /\bbitcoin\b/i, /\bcrypto\b/i],
};

const XAU_INDIRECT_RULES: Array<{ re: RegExp; score: number; confidence: number; direction: Direction; reasonKey: string }> = [
  { re: /\bcpi\b|inflation|pce|price\s+index/i, score: 8, confidence: 0.78, direction: "bearish", reasonKey: "inflation" },
  { re: /\bfed\b|\bfomc\b|powell|rate\s+(hike|decision|cut)|interest\s+rates?/i, score: 8, confidence: 0.76, direction: "bearish", reasonKey: "fed" },
  { re: /treasury\s+yields?|real\s+yields?|bond\s+yields?/i, score: 8, confidence: 0.8, direction: "bearish", reasonKey: "yields" },
  { re: /non.?farm|nfp|payrolls?|jobs?\s+report|unemployment/i, score: 7, confidence: 0.72, direction: "mixed", reasonKey: "jobs" },
  { re: /geopolitical|war|conflict|tensions?|safe.?haven|risk.?off|sanctions/i, score: 8, confidence: 0.82, direction: "bullish", reasonKey: "risk" },
  { re: /dollar\s+(rises?|jumps?|surges?|stronger|firmer)|dxy\s+(rises?|jumps?|surges?)/i, score: 7, confidence: 0.74, direction: "bearish", reasonKey: "usd_up" },
  { re: /dollar\s+(falls?|drops?|weakens?|slides)|dxy\s+(falls?|drops?|slides?)/i, score: 7, confidence: 0.74, direction: "bullish", reasonKey: "usd_down" },
];

const CORPORATE_EQUITY_RE = /\b(inc\.?|corp\.?|ltd\.?|plc|earnings|transcript|revenue|guidance|shares?|stock|nasdaq|nyse)\b/i;
const COMMODITY_GOLD_RE = /\b(spot\s+gold|gold\s+price|bullion|xau|gold\s+futures?|gold\s+etf|treasury\s+yields?|real\s+yields?|fed|fomc|inflation|cpi|pce|safe.?haven|geopolitical|war|conflict)\b/i;

const REASONS: Record<string, Record<string, string>> = {
  it: {
    direct_xau: "La notizia parla direttamente di oro/XAU, quindi e' rilevante per il prezzo spot e per XAU/USD.",
    inflation: "Inflazione e CPI influenzano aspettative sui tassi, dollaro e rendimenti reali: sono driver diretti dell'oro/XAU.",
    fed: "Fed, FOMC e tassi muovono USD e rendimenti; questo impatta XAU/USD anche se la notizia non cita l'oro.",
    yields: "I rendimenti Treasury e i rendimenti reali sono uno dei principali driver inversi dell'oro.",
    jobs: "I dati sul lavoro USA cambiano le aspettative Fed e quindi possono muovere USD e oro.",
    risk: "Il rischio geopolitico aumenta la domanda di beni rifugio, incluso l'oro.",
    usd_up: "Un dollaro piu' forte tende a pesare su XAU/USD.",
    usd_down: "Un dollaro piu' debole tende a sostenere XAU/USD.",
    generic: "La notizia e' collegata agli asset selezionati e puo' influenzarne volatilita' e direzione.",
  },
  en: {
    direct_xau: "The article directly mentions gold/XAU, so it is relevant for spot gold and XAU/USD.",
    inflation: "Inflation and CPI affect rate expectations, the dollar and real yields, all direct drivers of gold/XAU.",
    fed: "Fed, FOMC and rates move USD and yields, impacting XAU/USD even when gold is not named.",
    yields: "Treasury and real yields are one of gold's main inverse drivers.",
    jobs: "US labor data shifts Fed expectations and can move both USD and gold.",
    risk: "Geopolitical risk raises safe-haven demand, including gold.",
    usd_up: "A stronger dollar tends to weigh on XAU/USD.",
    usd_down: "A weaker dollar tends to support XAU/USD.",
    generic: "The article is connected to the selected assets and can affect volatility or direction.",
  },
};

function textOf(article: NewsArticle): string {
  return `${article.title} ${article.summary}`.toLowerCase();
}

function selectedPairs(pairs = ""): string[] {
  return pairs
    .split(",")
    .map((pair) => pair.trim().toUpperCase())
    .filter(Boolean)
    .map((pair) => (pair.length === 6 ? `${pair.slice(0, 3)}/${pair.slice(3)}` : pair));
}

function selectedAssets(pairs = ""): string[] {
  const assets = new Set<string>();
  for (const pair of selectedPairs(pairs)) {
    for (const part of pair.split("/")) if (part) assets.add(part);
  }
  return Array.from(assets);
}

function hasAssetKeyword(text: string, asset: string): boolean {
  return (ASSET_KEYWORDS[asset] ?? []).some((re) => re.test(text));
}

function directMatches(text: string, focusAssets: string[]): RuleMatch[] {
  return focusAssets
    .filter((asset) => hasAssetKeyword(text, asset))
    .map((asset): RuleMatch => ({
      assets: [asset],
      score: asset === "XAU" ? 8 : 6,
      confidence: asset === "XAU" && CORPORATE_EQUITY_RE.test(text) && !COMMODITY_GOLD_RE.test(text) ? 0.32 : asset === "XAU" ? 0.9 : 0.68,
      direction: /rises?|rally|gains?|inflows?|record|surges?|safe.?haven/i.test(text)
        ? "bullish"
        : /falls?|drops?|outflows?|slumps?|sell.?off/i.test(text)
          ? "bearish"
          : "neutral",
      reasonKey: asset === "XAU" ? "direct_xau" : "generic",
    }));
}

function xauIndirectMatches(text: string, focusAssets: string[]): RuleMatch[] {
  if (!focusAssets.includes("XAU")) return [];
  return XAU_INDIRECT_RULES.filter((rule) => rule.re.test(text)).map((rule) => ({
    assets: ["XAU", "USD"],
    score: rule.score,
    confidence: rule.confidence,
    direction: rule.direction,
    reasonKey: rule.reasonKey,
  }));
}

function bestMatch(matches: RuleMatch[]): RuleMatch | null {
  return matches.sort((a, b) => b.confidence + b.score / 20 - (a.confidence + a.score / 20))[0] ?? null;
}

function reasonFor(key: string, lang = "it"): string {
  const language = lang.toLowerCase().slice(0, 2);
  return REASONS[language]?.[key] ?? REASONS.en[key] ?? REASONS.en.generic;
}

export function classifyNewsArticle(article: NewsArticle, context: NewsIntelligenceContext = {}): ClassifiedNewsArticle {
  const focusPairs = selectedPairs(context.pairs);
  const focusAssets = selectedAssets(context.pairs);
  const text = textOf(article);
  const matches = [...directMatches(text, focusAssets), ...xauIndirectMatches(text, focusAssets)];
  const match = bestMatch(matches);
  const confidence = match?.confidence ?? 0.15;
  const affectedPairs = match
    ? focusPairs.filter((pair) => {
        const parts = pair.split("/");
        return parts.some((part) => match.assets.includes(part));
      })
    : [];
  const relevant = Boolean(match && confidence >= 0.45 && affectedPairs.length > 0);
  const articleAssets = match ? Array.from(new Set(match.assets)) : [];
  const relevanceReason = match ? reasonFor(match.reasonKey, context.lang) : undefined;

  return {
    relevant,
    article: {
      ...article,
      primaryAssets: articleAssets,
      affectedPairs,
      impactScore: match?.score ?? article.impactScore ?? 2,
      impactDirection: match?.direction ?? "neutral",
      sentiment: article.sentiment ?? match?.direction ?? null,
      relevanceReason,
      impactReason: article.impactReason ?? relevanceReason,
      matchConfidence: Number(confidence.toFixed(2)),
    },
  };
}

export function enrichAndFilterNews(articles: NewsArticle[], context: NewsIntelligenceContext = {}): NewsArticle[] {
  const classified = articles.map((article) => classifyNewsArticle(article, context));
  const relevant = classified.filter((item) => item.relevant).map((item) => item.article);
  const fallback = classified
    .map((item) => item.article)
    .sort((a, b) => (b.matchConfidence ?? 0) - (a.matchConfidence ?? 0))
    .slice(0, 10);
  return (relevant.length > 0 ? relevant : fallback).sort(
    (a, b) => (b.matchConfidence ?? 0) - (a.matchConfidence ?? 0) || (b.impactScore ?? 0) - (a.impactScore ?? 0),
  );
}
