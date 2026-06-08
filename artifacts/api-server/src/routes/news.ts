import { Router, type IRouter } from "express";
import { getCurrenciesFromPairs } from "@workspace/pair-catalog";
import OpenAI from "openai";
import { enrichAndFilterNews } from "../services/newsHub/intelligence.js";
import {
  applyNewsFreshness,
  createNewsCache,
  newsCacheTtlMs,
  newsFreshnessWindowHours,
} from "../services/newsHub/freshness.js";
import {
  DEFAULT_NEWS_PAGE_SIZE,
  normalizeNewsSources,
  paginateNews,
  rankNewsForDisplay,
  sortNewsChronologically,
} from "../services/newsHub/ranking.js";
import { cleanNewsText, createTranslationMemo } from "../services/newsHub/contentQuality.js";

const router: IRouter = Router();

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewsArticle {
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
  primaryAssets?: string[];
  impactDirection?: "bullish" | "bearish" | "mixed" | "neutral";
  relevanceReason?: string;
  matchConfidence?: number;
  freshnessTier?: "live" | "fresh" | "fallback" | "stale";
  ageMinutes?: number;
  isFallback?: boolean;
  qualityScore?: number;
  // AI agent fields
  affectedPairs?: string[];
  impactScore?: number;       // 1–10
  impactReason?: string;      // perché è rilevante per questi pair
}

interface NewsResponse {
  articles: NewsArticle[];
  fetchedAt: string;
  hasApiKey: boolean;
  source: "ai" | "rss";
  // AI agent fields
  agentSummary?: string;
  watchedPairs?: string[];
  nextRefreshAt?: string;
  freshArticlesCount?: number;
  fallbackArticlesCount?: number;
  oldestFreshArticleAt?: string;
  freshnessWindowHours?: number;
  nextCursor?: string | null;
  totalCount?: number;
}

// Maximum number of articles kept in the chronological feed corpus that the
// paginated endpoint and live websocket snapshot draw from.
const NEWS_FEED_CORPUS_LIMIT = 80;

// Drop articles older than this so the feed stays "as recent as possible".
// Undated and clearly-stale items are excluded (with a floor so the feed is
// never emptied on a quiet news day).
const NEWS_MAX_AGE_HOURS = 96;

// ─── Cache ────────────────────────────────────────────────────────────────────

const NEWS_CACHE = createNewsCache<NewsResponse>({ ttlMs: newsCacheTtlMs() });
const TRANSLATION_MEMO = createTranslationMemo<{ title: string; summary: string }>();

// ─── Groq client (free tier — llama-3.1-8b-instant) ──────────────────────────
// Signup gratuito senza carta di credito: https://console.groq.com
// Imposta GROQ_API_KEY come secret per attivare l'analisi AI avanzata.
// Senza chiave il sistema usa l'enrichment euristico gratuito (sempre attivo).
let _groqKeyInvalidUntil = 0;
let _groqClient: OpenAI | null = null;
function getGroqClient(): OpenAI | null {
  if (Date.now() < _groqKeyInvalidUntil) return null;
  if (_groqClient) return _groqClient;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  _groqClient = new OpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey });
  return _groqClient;
}

// ─── RSS helpers ──────────────────────────────────────────────────────────────

function extractCDATA(block: string, tag: string): string {
  const cdataRe = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`);
  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  return cdataRe.exec(block)?.[1] || plainRe.exec(block)?.[1] || "";
}

function decodeHtml(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#xA0;/g, " ")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function extractRSSImage(block: string, descRaw: string): string | null {
  const enclosure = block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image[^"']*["']/i)?.[1]
    || block.match(/<enclosure[^>]+type=["']image[^"']*["'][^>]+url=["']([^"']+)["']/i)?.[1];
  if (enclosure) return enclosure;

  const mediaContent = block.match(/<media:content[^>]+url=["']([^"']+)["'][^>]*(?:type=["']image[^"']*["']|medium=["']image["'])/i)?.[1]
    || block.match(/<media:content[^>]+(?:type=["']image[^"']*["']|medium=["']image["'])[^>]+url=["']([^"']+)["']/i)?.[1]
    || block.match(/<media:content[^>]+url=["']([^"']+\.(?:jpg|jpeg|png|webp|gif))["']/i)?.[1];
  if (mediaContent) return mediaContent;

  const mediaThumbnail = block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1];
  if (mediaThumbnail) return mediaThumbnail;

  const imgInDesc = descRaw.match(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp|gif)[^"']*)["']/i)?.[1];
  if (imgInDesc) return imgInDesc;

  return null;
}

function parseRSS(xml: string, sourceName: string): NewsArticle[] {
  const items: NewsArticle[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = decodeHtml(extractCDATA(block, "title"));
    const descRaw = extractCDATA(block, "description");
    const sourceMatch = block.match(/<source[^>]*url=["']([^"']+)["'][^>]*>([\s\S]*?)<\/source>/i);
    const itemSourceName = sourceMatch?.[2] ? decodeHtml(sourceMatch[2]) : sourceName;
    const sourceUrl = sourceMatch?.[1]?.startsWith("http") ? sourceMatch[1] : null;
    const summary = cleanNewsText(decodeHtml(descRaw).slice(0, 280) || title, itemSourceName);
    const pubDate = block.match(/<pubDate>([^<]*)<\/pubDate>/)?.[1] || null;
    const link =
      block.match(/<link>([^<]*)<\/link>/)?.[1] ||
      block.match(/<guid[^>]*>([^<]*)<\/guid>/)?.[1] || null;

    if (!title || title.length < 5) continue;

    let parsedDate: string | null = null;
    if (pubDate) {
      try { parsedDate = new Date(pubDate).toISOString(); } catch { /* ignore */ }
    }

    const imageUrl = extractRSSImage(block, descRaw);
    items.push({
      title, summary, source: itemSourceName,
      publishedAt: parsedDate,
      url: link?.startsWith("http") ? link : null,
      sourceUrl,
      sentiment: null, imageUrl,
    });
  }
  return items;
}

async function fetchFeed(url: string, sourceName: string): Promise<NewsArticle[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Accept": "application/rss+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  if (xml.trim().startsWith("<!DOCTYPE") || xml.trim().startsWith("<html")) {
    throw new Error("Received HTML instead of RSS");
  }
  return parseRSS(xml, sourceName);
}

// ─── Keyword filtering (RSS) ──────────────────────────────────────────────────

const PAIR_KEYWORDS: Record<string, string[]> = {
  EUR: ["euro", "eur", "ecb", "bce", "lagarde", "eurozone"],
  USD: ["dollar", "usd", "dxy", "fed", "fomc", "powell", "treasury", "nonfarm", "payroll"],
  GBP: ["pound", "gbp", "sterling", "boe", "bank of england", "bailey"],
  JPY: ["yen", "jpy", "boj", "bank of japan", "ueda"],
  CHF: ["swiss", "chf", "snb", "franc"],
  CAD: ["canadian", "cad", "boc", "bank of canada"],
  AUD: ["aussie", "aud", "rba", "reserve bank of australia"],
  NZD: ["kiwi", "nzd", "rbnz"],
  XAU: ["gold", "xau", "bullion", "world gold council"],
  XAG: ["silver", "xag"],
  BTC: ["bitcoin", "btc", "crypto"],
  ETH: ["ethereum", "eth"],
  MXN: ["peso", "mxn", "banxico"],
  ZAR: ["rand", "zar", "sarb"],
  TRY: ["lira", "try", "tcmb"],
  SGD: ["singapore", "sgd", "mas"],
  HKD: ["hong kong", "hkd", "hkma"],
  NOK: ["krone", "nok", "norges"],
  SEK: ["krona", "sek", "riksbank"],
};

function buildKeywordsRegex(pairCurrencies: string[]): RegExp {
  const baseKeywords = ["inflation", "gdp", "cpi", "rate\\s*(cut|hike|decision)", "central\\s*bank", "monetary\\s*policy", "yield"];
  const pairKw: string[] = [];
  // Always include USD (+ XAU) keywords so dollar/Fed macro passes the filter
  // regardless of the user's selected pairs.
  for (const c of [...new Set([...pairCurrencies.map((cur) => cur.toUpperCase()), "USD", "XAU"])]) {
    const kws = PAIR_KEYWORDS[c];
    if (kws) pairKw.push(...kws);
  }
  const allKw = [...new Set([...baseKeywords, ...pairKw])];
  return new RegExp(allKw.join("|"), "i");
}

function pairsToCurrencies(pairsStr: string): string[] {
  if (!pairsStr) return [];
  const symbols = pairsStr.split(",").map((s) => s.trim()).filter(Boolean);
  return getCurrenciesFromPairs(symbols);
}

// Formats pair symbols for Perplexity prompt (e.g. "XAUUSD" → "XAU/USD")
function formatPairsForPrompt(pairsStr: string): string {
  if (!pairsStr) return "gold (XAU/USD), US dollar (DXY) and major forex pairs";
  const pairs = pairsStr.split(",").map((p) => {
    const s = p.trim();
    if (s.length === 6) return `${s.slice(0, 3)}/${s.slice(3)}`;
    return s;
  }).filter(Boolean);
  return pairs.length > 0 ? pairs.join(", ") : "major forex pairs";
}

function googleNewsUrl(query: string): string {
  const params = new URLSearchParams({
    q: query,
    hl: "en-US",
    gl: "US",
    ceid: "US:en",
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

function buildGoogleNewsQueries(pairCurrencies: string[], pairsStr: string): string[] {
  const normalizedPairs = pairsStr.split(",").map((pair) => pair.trim().toUpperCase()).filter(Boolean);
  const queries = new Set<string>();

  // Baseline: always fetch fresh USD/Fed macro (relevant to every FX/gold trader),
  // so dollar news is present regardless of the user's selected pairs.
  queries.add("US dollar DXY Federal Reserve when:1d");
  queries.add("Federal Reserve interest rate decision when:2d");
  queries.add("US inflation CPI jobs payrolls when:2d");

  for (const pair of normalizedPairs) {
    if (pair === "XAUUSD" || pair === "XAU/USD") {
      queries.add("gold price when:2d");
      queries.add("XAUUSD OR gold dollar when:2d");
      queries.add("gold dollar yields Fed when:2d");
      queries.add("gold safe haven when:2d");
      continue;
    }
    if (pair.length >= 6) queries.add(`${pair} forex when:2d`);
  }

  if (pairCurrencies.includes("XAU")) {
    queries.add("gold price when:2d");
    queries.add("gold dollar yields when:2d");
  }
  if (pairCurrencies.includes("USD")) queries.add("Federal Reserve dollar yields when:2d");

  if (queries.size === 0) {
    queries.add("forex market Federal Reserve dollar gold when:2d");
    queries.add("global markets currencies commodities when:2d");
  }

  return Array.from(queries).slice(0, 10);
}

async function fetchRSSNews(pairCurrencies: string[], pairsStr: string): Promise<NewsArticle[]> {
  const googleFeeds = buildGoogleNewsQueries(pairCurrencies, pairsStr).map((query) => ({
    url: googleNewsUrl(query),
    source: "Google News",
  }));

  const feeds = [
    ...googleFeeds,
    { url: "https://seekingalpha.com/tag/gold.xml", source: "Seeking Alpha – Gold" },
    { url: "https://seekingalpha.com/tag/forex.xml", source: "Seeking Alpha – Forex" },
    { url: "https://www.cnbc.com/id/20409666/device/rss/rss.html", source: "CNBC Markets" },
    { url: "https://www.cnbc.com/id/15839135/device/rss/rss.html", source: "CNBC Finance" },
  ];

  const results = await Promise.allSettled(feeds.map((f) => fetchFeed(f.url, f.source)));
  const all: NewsArticle[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      all.push(...r.value);
    } else {
      console.warn(`[news] Feed ${feeds[i].source} failed:`, r.reason);
    }
  }

  const keywords = buildKeywordsRegex(pairCurrencies);
  const filtered = all.filter((a) => keywords.test(a.title) || keywords.test(a.summary));

  const seen = new Set<string>();
  const deduped = (filtered.length >= 5 ? filtered : all).filter((a) => {
    const key = a.title.toLowerCase().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => {
    if (!a.publishedAt && !b.publishedAt) return 0;
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  return deduped.slice(0, 160);
}

// ─── Image helper ─────────────────────────────────────────────────────────────

function buildNewsImageUrl(keywords: string[] | undefined, sentiment: string | null, index = 0): string {
  const lock = (index * 37 + 1) % 1000 || 1;
  const kws = (keywords ?? []).filter(Boolean).slice(0, 3);
  if (kws.length > 0) {
    return `https://loremflickr.com/800/400/${kws.join(",")}?lock=${lock}`;
  }
  const sentMap: Record<string, string> = {
    bullish: "growth,economy,finance", bearish: "recession,economy,finance", neutral: "economy,finance,market",
  };
  return `https://loremflickr.com/800/400/${sentMap[sentiment ?? ""] ?? "economy,finance,market"}?lock=${lock}`;
}

// ─── Translation (RSS fallback) ───────────────────────────────────────────────

const VALID_NEWS_LANGS = new Set(["it", "en", "es", "fr", "de"]);
function sanitizeNewsLang(raw: string | undefined): string {
  const l = (raw ?? "it").toLowerCase().slice(0, 2);
  return VALID_NEWS_LANGS.has(l) ? l : "it";
}

async function translateNewsArticle(title: string, summary: string, lang: string, source?: string | null): Promise<{ title: string; summary: string }> {
  if (lang === "en") return { title, summary };
  const cached = TRANSLATION_MEMO.get(lang, title, summary);
  if (cached) return cached;
  const finalize = (nextTitle: string, nextSummary: string) => ({
    title: cleanNewsText(nextTitle, source),
    summary: cleanNewsText(nextSummary, source),
  });
  const combined = `${cleanNewsText(title, source).slice(0, 200)} ||| ${cleanNewsText(summary, source).slice(0, 280)}`;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${encodeURIComponent(lang)}&dt=t&q=${encodeURIComponent(combined)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json() as unknown;
      const chunks = Array.isArray(data) && Array.isArray(data[0]) ? data[0] as unknown[] : [];
      const translated = chunks
        .map((chunk) => Array.isArray(chunk) && typeof chunk[0] === "string" ? chunk[0] : "")
        .join("")
        .trim();
      if (translated) {
        const sep = translated.indexOf(" ||| ");
        if (sep !== -1) {
          const value = finalize(translated.slice(0, sep), translated.slice(sep + 5));
          TRANSLATION_MEMO.set(lang, title, summary, value);
          return value;
        }
        const value = finalize(translated, summary);
        TRANSLATION_MEMO.set(lang, title, summary, value);
        return value;
      }
    }
  } catch {
    // Fall through to secondary provider.
  }
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(combined)}&langpair=en|${lang}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { title, summary };
    const data = await res.json() as { responseData?: { translatedText?: string } };
    const translated = data.responseData?.translatedText ?? "";
    if (!translated || translated.toLowerCase().includes("mymemory warning")) return { title, summary };
    const sep = translated.indexOf(" ||| ");
    if (sep === -1) {
      const value = finalize(translated, summary);
      TRANSLATION_MEMO.set(lang, title, summary, value);
      return value;
    }
    const value = finalize(translated.slice(0, sep), translated.slice(sep + 5));
    TRANSLATION_MEMO.set(lang, title, summary, value);
    return value;
  } catch {
    return { title, summary };
  }
}

// ─── Heuristic Enrichment (100% gratuito, nessuna API key) ───────────────────

const NEWS_LANG_NAMES: Record<string, string> = {
  it: "Italian", en: "English", es: "Spanish", fr: "French", de: "German",
};

interface ImpactPattern { re: RegExp; score: number; key: string }
const IMPACT_PATTERNS: ImpactPattern[] = [
  { re: /non.?farm\s*payroll|nfp\b/i,                                             score: 9, key: "nfp" },
  { re: /rate\s*(decision|cut|hike|change)|interest\s*rate\s*(decision|change)/i, score: 9, key: "rate" },
  { re: /\bfomc\b|federal\s*reserve\s*(decision|meeting|statement|minutes)/i,     score: 9, key: "fed" },
  { re: /\bcpi\b|inflation\s*data|consumer\s*price\s*index/i,                      score: 8, key: "cpi" },
  { re: /war|conflict|military\s*action|invasion|sanctions/i,                     score: 8, key: "geo" },
  { re: /recession|financial\s*crisis|market\s*crash/i,                           score: 8, key: "crisis" },
  { re: /currency\s*intervention|emergency\s*(measure|rate)/i,                    score: 8, key: "intv" },
  { re: /unemployment|jobs?\s*report|employment\s*data/i,                         score: 7, key: "jobs" },
  { re: /\bgdp\b|gross\s*domestic\s*product/i,                                    score: 7, key: "gdp" },
  { re: /trade\s*(war|tariff|deal|agreement)/i,                                   score: 7, key: "trade" },
  { re: /\bpmi\b|purchasing\s*managers/i,                                         score: 6, key: "pmi" },
  { re: /central\s*bank|monetary\s*policy|quantitative\s*(easing|tightening)/i,  score: 6, key: "cb" },
];

const IMPACT_REASONS: Record<string, Record<string, string>> = {
  it: {
    nfp:   "Il dato NFP è il principale indicatore del mercato del lavoro USA e muove USD su tutti i pair collegati.",
    rate:  "Le decisioni sui tassi spostano direttamente i differenziali di rendimento tra valute.",
    fed:   "Le comunicazioni Fed influenzano il dollaro e per riflesso tutti i pair legati all'USD.",
    cpi:   "L'inflazione condiziona le aspettative sui tassi e quindi i movimenti valutari.",
    geo:   "L'instabilità geopolitica aumenta la volatilità e favorisce i beni rifugio (XAU, CHF, JPY).",
    crisis:"Le crisi finanziarie aumentano l'avversione al rischio e muovono verso asset sicuri.",
    intv:  "Gli interventi valutari causano movimenti immediati e bruschi sul mercato.",
    jobs:  "I dati occupazionali influenzano le decisioni di politica monetaria della banca centrale.",
    gdp:   "Il PIL misura la salute economica del paese e orienta le aspettative di politica monetaria.",
    trade: "Le tensioni commerciali impattano le valute dei paesi esportatori coinvolti.",
    pmi:   "Il PMI anticipa l'attività economica e può modificare le aspettative sui tassi futuri.",
    cb:    "La politica monetaria è il principale motore dei tassi di cambio nel medio termine.",
  },
  en: {
    nfp:   "NFP is the key US labor market indicator and directly moves USD across all linked pairs.",
    rate:  "Interest rate decisions shift yield differentials between currencies.",
    fed:   "Fed communications influence the dollar and by extension all USD-linked pairs.",
    cpi:   "Inflation shapes rate expectations and thus drives currency movements.",
    geo:   "Geopolitical instability increases volatility and drives demand for safe havens (XAU, CHF, JPY).",
    crisis:"Financial crises increase risk aversion and shift flows to safe-haven assets.",
    intv:  "Direct currency interventions cause immediate and sharp market moves.",
    jobs:  "Employment data influences central bank monetary policy decisions.",
    gdp:   "GDP measures economic health and shapes monetary policy expectations.",
    trade: "Trade tensions impact currencies of the exporting countries involved.",
    pmi:   "PMI leads economic activity and can shift future rate expectations.",
    cb:    "Monetary policy is the primary driver of exchange rates in the medium term.",
  },
};

function computeImpact(text: string): { score: number; key: string } {
  let best = { score: 3, key: "" };
  for (const { re, score, key } of IMPACT_PATTERNS) {
    if (re.test(text) && score > best.score) best = { score, key };
  }
  return best;
}

function detectSentiment(text: string): "bullish" | "bearish" | "neutral" {
  const b = (text.match(/surges?|rally|rallies|gains?|rises?|risen|higher|strong|beats?|above.forecast|hawkish|boost/ig) ?? []).length;
  const e = (text.match(/falls?|dropped?|drops?|declines?|lower|weak|misses?|below.forecast|dovish|recession|crisis|concern/ig) ?? []).length;
  return b > e ? "bullish" : e > b ? "bearish" : "neutral";
}

function detectAffectedPairs(text: string, pairCurrencies: string[], pairsStr: string): string[] {
  const lc = text.toLowerCase();
  const userPairs = pairsStr.split(",").map((p) => {
    const s = p.trim();
    return s.length === 6 ? `${s.slice(0, 3)}/${s.slice(3)}` : s;
  }).filter(Boolean);
  const matched = new Set<string>();
  for (const cur of pairCurrencies) {
    const kws = PAIR_KEYWORDS[cur.toUpperCase()];
    if (kws?.some((kw) => lc.includes(kw))) matched.add(cur.toUpperCase());
  }
  return userPairs.filter((pair) => {
    const [base, quote] = pair.split("/");
    return matched.has(base) || matched.has(quote);
  });
}

function enrichHeuristically(
  articles: NewsArticle[],
  pairCurrencies: string[],
  pairsStr: string,
  lang: string,
): NewsArticle[] {
  const reasons = IMPACT_REASONS[lang] ?? IMPACT_REASONS.en;
  return articles.map((a) => {
    const text = `${a.title} ${a.summary}`;
    const { score, key } = computeImpact(text);
    const affectedPairs = detectAffectedPairs(text, pairCurrencies, pairsStr);
    const sentiment = a.sentiment ?? detectSentiment(text);
    const baseReason = key ? (reasons[key] ?? "") : "";
    const impactReason = baseReason && affectedPairs.length > 0
      ? `${baseReason}${lang === "it" ? " Pair coinvolti" : " Affected pairs"}: ${affectedPairs.join(", ")}.`
      : baseReason || undefined;
    return { ...a, impactScore: score, affectedPairs, sentiment, impactReason };
  });
}

function heuristicAgentSummary(articles: NewsArticle[], formattedPairs: string, lang: string): string {
  const top = articles.filter((a) => (a.impactScore ?? 0) >= 7).slice(0, 3);
  if (top.length === 0) {
    return lang === "it"
      ? `Nessun evento macro ad alto impatto rilevato oggi per ${formattedPairs}. I mercati potrebbero muoversi su dati tecnici o flussi di fine sessione.`
      : `No high-impact macro events detected today for ${formattedPairs}. Markets may trade on technicals or end-of-session flows.`;
  }
  const titles = top.map((a) => a.title.slice(0, 60)).join("; ");
  return lang === "it"
    ? `Attenzione ai seguenti eventi ad alto impatto per ${formattedPairs}: ${titles}. Gestire il rischio con stop adeguati.`
    : `Watch these high-impact events for ${formattedPairs}: ${titles}. Manage risk with appropriate stops.`;
}

// ─── Groq AI Enrichment (opzionale — free tier, nessuna carta di credito) ─────
// 1. Vai su https://console.groq.com  → crea account gratuito
// 2. Genera un'API key
// 3. Aggiungila come secret GROQ_API_KEY in questo progetto

interface GroqEnrichItem {
  impactScore: number;
  impactReason: string;
  affectedPairs: string[];
  sentiment: string;
}
interface GroqEnrichResult { agentSummary: string; articles: GroqEnrichItem[] }

async function enrichWithGroq(
  articles: NewsArticle[],
  pairCurrencies: string[],
  pairsStr: string,
  lang: string,
): Promise<{ articles: NewsArticle[]; agentSummary: string } | null> {
  const client = getGroqClient();
  if (!client) return null;

  const langName = NEWS_LANG_NAMES[lang] ?? "Italian";
  const formattedPairs = formatPairsForPrompt(pairsStr);
  const currencyFocus = pairCurrencies.length > 0 ? pairCurrencies.join(", ") : "USD, EUR, XAU";
  const batch = articles.slice(0, 8).map((a, i) => ({
    id: i, title: a.title, summary: a.summary.slice(0, 200),
  }));

  try {
    const completion = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      max_tokens: 2000,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `You are a professional forex and commodities market analyst. Analyze news articles and return structured market impact data. Respond ONLY with valid JSON. All text fields MUST be in ${langName}.`,
        },
        {
          role: "user",
          content: `Trading pairs: ${formattedPairs}. Key currencies: ${currencyFocus}.

Articles to analyze:
${JSON.stringify(batch, null, 2)}

Return ONLY this JSON (no markdown, no extra text):
{
  "agentSummary": "2-3 sentence macro overview in ${langName} for ${formattedPairs}",
  "articles": [
    {
      "impactScore": 7,
      "impactReason": "1 sentence in ${langName} why this matters for these specific pairs",
      "affectedPairs": ["EUR/USD"],
      "sentiment": "bullish|bearish|neutral"
    }
  ]
}

Return exactly ${batch.length} objects in articles[], same order as input.`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const jsonMatch = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim().match(/\{[\s\S]*\}/);
    if (!jsonMatch) { console.warn("[news/groq] Risposta non-JSON"); return null; }
    const parsed = JSON.parse(jsonMatch[0]) as GroqEnrichResult;
    if (!Array.isArray(parsed.articles)) return null;

    const enriched = articles.map((a, i) => {
      const ai = parsed.articles[i];
      if (!ai) return a;
      return {
        ...a,
        impactScore: typeof ai.impactScore === "number" ? Math.min(10, Math.max(1, Math.round(ai.impactScore))) : a.impactScore,
        impactReason: typeof ai.impactReason === "string" ? ai.impactReason : a.impactReason,
        affectedPairs: Array.isArray(ai.affectedPairs) && ai.affectedPairs.length > 0 ? ai.affectedPairs : a.affectedPairs,
        sentiment: typeof ai.sentiment === "string" ? ai.sentiment : a.sentiment,
      };
    });

    console.info(`[news/groq] OK — ${enriched.length} articoli arricchiti con Llama`);
    return { articles: enriched, agentSummary: parsed.agentSummary ?? "" };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("401") || msg.includes("403")) {
      _groqKeyInvalidUntil = Date.now() + 60 * 60 * 1000;
      _groqClient = null;
      console.warn("[news/groq] Chiave non valida — solo enrichment euristico");
    } else {
      console.warn("[news/groq] Errore:", msg);
    }
    return null;
  }
}

// ─── USD / dollar macro detection (always surfaced in the feed) ───────────────
// Matches English + Italian stems so it works on both original and translated
// text. "dollar" also matches the Italian "dollaro".
const USD_MACRO_RE =
  /\bfed\b|\bfomc\b|powell|federal\s+reserve|non[-\s]?farm|\bnfp\b|payroll|\bcpi\b|\bppi\b|inflation|inflazione|treasur|\byields?\b|rendiment|\bdxy\b|dollar|greenback|rate\s+(cut|hike|decision)|interest\s+rate|tassi/i;

function isUsdMacroArticle(article: NewsArticle): boolean {
  return USD_MACRO_RE.test(
    `${article.title} ${article.summary} ${article.originalTitle ?? ""} ${article.originalSummary ?? ""}`,
  );
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function getNewsData(input: { noCache?: boolean; pairs?: string; lang?: string } = {}): Promise<NewsResponse> {
  const noCache    = input.noCache === true;
  const pairsStr   = input.pairs || "";
  const lang       = sanitizeNewsLang(input.lang);
  const pairCurrencies = pairsToCurrencies(pairsStr);
  const baseCacheKey   = pairCurrencies.length > 0 ? pairCurrencies.sort().join(",") : "all";
  const cacheKey       = `${baseCacheKey}:${lang}`;

  // Check request-scoped cache.
  if (!noCache) {
    const cached = NEWS_CACHE.get(cacheKey);
    if (cached) return cached;
  }

  let articles: NewsArticle[] = [];
  let source: "ai" | "rss" = "rss";
  let agentSummary: string | undefined;
  let nextRefreshAt: string | undefined;
  const formattedPairs = formatPairsForPrompt(pairsStr);
  const cacheTtl = newsCacheTtlMs();
  const freshnessWindowHours = newsFreshnessWindowHours();

  // 1. Fetch RSS (sempre attivo, gratuito)
  try {
    const rssArticles = await fetchRSSNews(pairCurrencies.length > 0 ? pairCurrencies : ["USD", "XAU"], pairsStr);
    const withImages = normalizeNewsSources(rssArticles).map((a, i) => ({
      ...a,
      originalTitle: a.originalTitle ?? a.title,
      originalSummary: a.originalSummary ?? a.summary,
      imageUrl: a.imageUrl ?? buildNewsImageUrl(undefined, a.sentiment, i),
    }));
    const translated = lang !== "en"
      ? await Promise.all(
          withImages.map(async (a) => {
            const { title, summary } = await translateNewsArticle(a.title, a.summary, lang, a.source);
            return { ...a, title, summary };
          })
        )
      : withImages;

    // 2. Enrichment euristico (sempre gratuito — impact score, pair detection, sentiment)
    const enriched = enrichHeuristically(translated, pairCurrencies, pairsStr, lang);

    // 3. Groq AI enhancement (opzionale — free tier con GROQ_API_KEY)
    const groqResult = await enrichWithGroq(enriched, pairCurrencies, pairsStr, lang);
    if (groqResult && groqResult.articles.length > 0) {
      articles = groqResult.articles;
      agentSummary = groqResult.agentSummary;
    } else {
      articles = enriched;
      agentSummary = heuristicAgentSummary(enriched, formattedPairs, lang);
    }

    // Relevant set for the user's selected pairs (or a generic fallback when
    // no pairs are selected).
    const relevant = enrichAndFilterNews(articles, { pairs: pairsStr, lang });
    // USD/dollar macro (Fed, FOMC, CPI, NFP, Treasury yields, DXY…) is relevant
    // to virtually every FX/gold trader, so always surface it even when the
    // selected pairs don't include USD. rankNewsForDisplay dedupes the overlap.
    const usdMacro = articles.filter(isUsdMacroArticle);
    // Dedupe + quality-score the combined set (keeps a large corpus for the
    // paginated feed), then order strictly newest-first for chronological scroll.
    const deduped = rankNewsForDisplay(
      applyNewsFreshness([...relevant, ...usdMacro], { freshnessWindowHours }),
      { limit: NEWS_FEED_CORPUS_LIMIT, maxPerSource: 6 },
    );
    const sorted = sortNewsChronologically(deduped);
    // Keep the feed fresh: drop stale/undated items, but never empty the feed.
    const maxAgeMs = NEWS_MAX_AGE_HOURS * 60 * 60 * 1000;
    const nowMs = Date.now();
    const recent = sorted.filter((a) => a.publishedAt && nowMs - new Date(a.publishedAt).getTime() <= maxAgeMs);
    articles = recent.length > 0 ? recent : sorted.slice(0, 12);
    source = "ai";  // enrichment (euristico o Groq) conta come AI
    nextRefreshAt = new Date(Date.now() + cacheTtl).toISOString();
  } catch {
    articles = [];
    nextRefreshAt = new Date(Date.now() + cacheTtl).toISOString();
  }

  const watchedPairs = pairsStr
    ? pairsStr.split(",").map((p) => {
        const s = p.trim();
        return s.length === 6 ? `${s.slice(0, 3)}/${s.slice(3)}` : s;
      }).filter(Boolean)
    : [];

  const freshArticles = articles.filter((article) => !article.isFallback);
  const fallbackArticles = articles.filter((article) => article.isFallback);
  const oldestFreshArticleAt = freshArticles
    .map((article) => article.publishedAt)
    .filter((date): date is string => typeof date === "string")
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];

  const result: NewsResponse = {
    articles,
    fetchedAt: new Date().toISOString(),
    hasApiKey: true,  // sempre attivo: enrichment euristico gratuito (+ Groq se GROQ_API_KEY è impostata)
    source,
    agentSummary,
    watchedPairs,
    nextRefreshAt,
    freshArticlesCount: freshArticles.length,
    fallbackArticlesCount: fallbackArticles.length,
    oldestFreshArticleAt,
    freshnessWindowHours,
  };

  NEWS_CACHE.set(cacheKey, result);
  return result;
}

router.get("/news", async (req, res) => {
  const result = await getNewsData({
    noCache: req.query.nocache === "1",
    pairs: (req.query.pairs as string) || "",
    lang: req.query.lang as string | undefined,
  });

  const limitParam = Number.parseInt((req.query.limit as string) ?? "", 10);
  const page = paginateNews(result.articles, {
    cursor: (req.query.cursor as string) ?? null,
    limit: Number.isFinite(limitParam) ? limitParam : DEFAULT_NEWS_PAGE_SIZE,
  });

  res.json({
    ...result,
    articles: page.articles,
    nextCursor: page.nextCursor,
    totalCount: page.totalCount,
  });
});

export default router;
