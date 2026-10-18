import { getCotOutlook } from "../services/cot.js";
import { Router } from "express";
import cron from "node-cron";
import { getCurrenciesFromPairs, getPairEntry } from "@workspace/pair-catalog";
import { getCalendarEvents } from "./calendar.js";
import { createMarketContextService } from "../services/marketContextService.js";
import { getNewsData } from "./news.js";
import { cleanNewsText } from "../services/newsHub/contentQuality.js";
import { buildMacroTickerSummary, ensureMacroDeepDive, macroArticleToNewsLike, macroNewsFromNewsHub, pairsFromMacroCurrencies } from "../services/newsHub/macroNewsAdapter.js";
import type { NewsDeepDive } from "../services/newsHub/types.js";
import { computeRiskRegime } from "../services/newsHub/riskRegime.js";
import { createSentimentOutlookService } from "../services/sentimentOutlook.js";
import { attachIntelligence } from "../services/marketIntelligence.js";
import { newsSubscriptionKey } from "../services/newsHub/providerCorpus.js";
import { buildVolatilitySnapshot, volatilityResponse, type VolatilitySnapshot } from "../services/volatilitySnapshot.js";
import { parseMonteCarloParams } from "../services/monteCarloParams.js";
import {
  YAHOO_VOLATILITY_PAIRS,
} from "../services/volatility.js";
import { getCandles, isSupportedSymbol } from "../services/candles.js";
import {
  buildWatchlistItem,
  parseWatchlistPairsParam,
  type WatchlistItem,
} from "../services/watchlistQuotes.js";
import { getJsonCache, setJsonCache } from "../lib/cache.js";
import { captureError } from "../lib/observability.js";

const router = Router();

// COT fetch runs from a cron and at boot, detached from any request. A failure
// here was previously swallowed to console and never reached Sentry; report it so
// a silently-stale COT feed is visible in production.
function onCotFetchError(err: unknown): void {
  console.error("[tools/cot] fetch failed", err);
  captureError(err, { surface: "cron", job: "cot-fetch" });
}

// ─── 1. MONTE CARLO ───────────────────────────────────────────────────────────
// Scenario-based Monte Carlo: ogni simulazione ha la propria sequenza di regimi
// di mercato (bull / neutral / bear) che cambiano stocasticamente. Questo rende
// ogni curva genuinamente unica, con drawdown, recuperi e fasi di trend diversi.
router.post("/tools/montecarlo", (req, res) => {
  // Validate + clamp every input (numTrades/simCount bound the work) so a crafted
  // body can't spin the CPU or allocate unbounded curves. winrate is normalized to 0..1.
  const { winrate, avgR, lossR, numTrades, riskPercent, initialBalance, simCount } =
    parseMonteCarloParams(req.body);

  // Regime definitions: multipliers applied to base parameters
  type Regime = "bull" | "neutral" | "bear";
  const regimeParams: Record<Regime, { wr: number; rr: number; lr: number }> = {
    bull:    { wr: 1.20, rr: 1.15, lr: 0.85 },
    neutral: { wr: 1.00, rr: 1.00, lr: 1.00 },
    bear:    { wr: 0.72, rr: 0.80, lr: 1.25 },
  };

  // Markov transition matrix: P[from][to]
  // Regimes tend to persist; transitions are gradual
  const transition: Record<Regime, Record<Regime, number>> = {
    bull:    { bull: 0.75, neutral: 0.20, bear: 0.05 },
    neutral: { bull: 0.20, neutral: 0.55, bear: 0.25 },
    bear:    { bull: 0.05, neutral: 0.30, bear: 0.65 },
  };

  function nextRegime(current: Regime): Regime {
    const r = Math.random();
    const t = transition[current];
    if (r < t.bull) return "bull";
    if (r < t.bull + t.neutral) return "neutral";
    return "bear";
  }

  // Each regime lasts between 5-20 trades before potentially switching
  function initialRegime(): Regime {
    const r = Math.random();
    if (r < 0.33) return "bull";
    if (r < 0.66) return "neutral";
    return "bear";
  }

  const simulations: number[][] = [];
  const finalValues: number[] = [];
  const N = simCount; // already clamped to [1, 200] by parseMonteCarloParams

  for (let s = 0; s < N; s++) {
    const curve: number[] = [initialBalance];
    let balance = initialBalance;
    let regime: Regime = initialRegime();
    let regimeDuration = Math.floor(Math.random() * 12) + 5;   // trades left in current regime
    let consecutiveLosses = 0;

    for (let t = 0; t < numTrades; t++) {
      // Possibly switch regime
      if (regimeDuration <= 0) {
        regime = nextRegime(regime);
        regimeDuration = Math.floor(Math.random() * 15) + 5;
      }
      regimeDuration--;

      const rp = regimeParams[regime];

      // Effective parameters for this trade
      let effWr = Math.min(0.95, Math.max(0.05, winrate * rp.wr));
      // Tilt effect: 3+ consecutive losses slightly reduce next-trade win probability
      if (consecutiveLosses >= 3) effWr *= (1 - 0.04 * Math.min(consecutiveLosses - 2, 4));

      const win = Math.random() < effWr;

      // Black swan event: rare large unexpected loss (~3% in bear, ~1% otherwise)
      const blackSwanChance = regime === "bear" ? 0.035 : 0.010;
      const isBlackSwan = !win && Math.random() < blackSwanChance;

      const riskAmount = balance * (riskPercent / 100);
      let tradeResult: number;
      if (win) {
        // Slight randomness on the actual R achieved (±20%)
        const achievedR = avgR * rp.rr * (0.80 + Math.random() * 0.40);
        tradeResult = riskAmount * achievedR;
        consecutiveLosses = 0;
      } else if (isBlackSwan) {
        // Black swan: 2.5-4x normal loss
        const bsMult = 2.5 + Math.random() * 1.5;
        tradeResult = -riskAmount * lossR * rp.lr * bsMult;
        consecutiveLosses++;
      } else {
        // Slight randomness on loss R (±15%)
        const achievedLR = lossR * rp.lr * (0.85 + Math.random() * 0.30);
        tradeResult = -riskAmount * achievedLR;
        consecutiveLosses++;
      }

      balance += tradeResult;
      if (!Number.isFinite(balance)) {
        res.status(422).json({ error: "I parametri producono saldi oltre il limite numerico; riduci rischio, R o numero di operazioni" });
        return;
      }
      curve.push(Math.max(0, balance));

      if (balance <= 0) {
        while (curve.length <= numTrades) curve.push(0);
        break;
      }
    }

    simulations.push(curve);
    finalValues.push(curve[curve.length - 1]);
  }

  finalValues.sort((a, b) => a - b);
  const ruinCount = finalValues.filter((v) => v <= 0).length;
  const median = finalValues[Math.floor(finalValues.length / 2)];
  const p10 = finalValues[Math.floor(finalValues.length * 0.1)];
  const p90 = finalValues[Math.floor(finalValues.length * 0.9)];
  const avgReturn =
    ((finalValues.reduce((a, b) => a + b, 0) / finalValues.length - initialBalance) / initialBalance) * 100;
  if (!Number.isFinite(avgReturn)) {
    res.status(422).json({ error: "I parametri producono rendimenti oltre il limite numerico; riduci rischio, R o numero di operazioni" });
    return;
  }

  res.json({
    simulations,
    stats: {
      median: Math.round(median),
      percentile10: Math.round(p10),
      percentile90: Math.round(p90),
      ruinProbability: ((ruinCount / N) * 100).toFixed(1),
      avgReturnPercent: avgReturn.toFixed(1),
      initialBalance,
    },
  });
});

// ─── 2. MYFXBOOK SENTIMENT ────────────────────────────────────────────────────

const getSentimentOutlook = createSentimentOutlookService();
const getMarketContext = createMarketContextService({
  candles: pair => getCandles(pair, "D1", { maxAgeMs: 5 * 60_000 }),
  news: pair => getNewsData({ pairs: pair, lang: "en", awaitRefresh: true }),
  sentiment: () => getSentimentOutlook(),
  calendar: () => getCalendarEvents(false, true),
  cot: () => getCotOutlook(),
});
router.get("/tools/market-context", async (req, res) => {
  const pair = typeof req.query.pair === "string" ? req.query.pair.trim().toUpperCase() : "";
  if (!getPairEntry(pair) || !isSupportedSymbol(pair)) {
    res.status(400).json({ error: "Dati non disponibili per questo strumento" });
    return;
  }
  if(req.query.horizon && req.query.horizon!=="4h") {res.status(400).json({error:"Unsupported horizon"});return;}
  res.json(await attachIntelligence(getMarketContext(pair)));
});
router.get("/tools/sentiment", async (_req, res) => {
  res.json(await getSentimentOutlook());
});

// ─── 3. VOLATILITY (Mataf-methodology daily ranges) ──────────────────────────
// Sources D1 candles via the shared candle service (Binance/TwelveData/Dukascopy
// ahead of Yahoo) so it keeps working on Railway, where Yahoo blocks the
// datacenter IP. Stale-while-revalidate: a request only ever reads cache and
// triggers a deduped, concurrency-capped background refresh, so the slow no-key
// source (Dukascopy pulls per-day files) never blocks the HTTP request.

const VOLATILITY_FRESH_TTL_SECONDS = 30 * 60;
const VOLATILITY_STALE_TTL_SECONDS = 7 * 24 * 60 * 60;
const VOLATILITY_WARM_MAX = 3;

const volatilityLastGood = new Map<string, VolatilitySnapshot>();
const volatilityInFlight = new Map<string, Promise<void>>();
let volatilityWarmActive = 0;
const volatilityWarmWaiters: Array<() => void> = [];

const volatilityFreshKey = (pair: string) => `volatility:v4:${pair}`;
const volatilityStaleKey = (pair: string) => `volatility:stale:v4:${pair}`;

function acquireVolatilityWarmSlot(): Promise<void> {
  if (volatilityWarmActive < VOLATILITY_WARM_MAX) {
    volatilityWarmActive++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    volatilityWarmWaiters.push(() => {
      volatilityWarmActive++;
      resolve();
    });
  });
}

function releaseVolatilityWarmSlot(): void {
  volatilityWarmActive--;
  volatilityWarmWaiters.shift()?.();
}

async function refreshVolatility(pair: string): Promise<void> {
  // Pair keys are canonical symbols (EURUSD, USDJPY, XAUUSD, XAGUSD, …).
  const { candles, source, fetchedAt, stale } = await getCandles(pair, "D1", { maxAgeMs: 30 * 60_000 });
  if (stale || !fetchedAt || !Number.isFinite(Date.parse(fetchedAt))) throw new Error("Candle provider refresh unavailable");
  const metrics = buildVolatilitySnapshot(pair, candles, source, new Date(fetchedAt));
  volatilityLastGood.set(pair, metrics);
  await setJsonCache(volatilityFreshKey(pair), metrics, VOLATILITY_FRESH_TTL_SECONDS);
  await setJsonCache(volatilityStaleKey(pair), metrics, VOLATILITY_STALE_TTL_SECONDS);
}

/** Refresh a pair's volatility in the background — deduped per pair and globally
 * concurrency-capped so a cold cache can't fan out into N slow Dukascopy pulls. */
function ensureVolatilityWarm(pair: string): Promise<void> {
  const existing = volatilityInFlight.get(pair);
  if (existing) return existing;
  const job = (async () => {
    await acquireVolatilityWarmSlot();
    try {
      await refreshVolatility(pair);
    } catch (err) {
      console.warn(`[tools/volatility] warm ${pair}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      releaseVolatilityWarmSlot();
      volatilityInFlight.delete(pair);
    }
  })();
  volatilityInFlight.set(pair, job);
  return job;
}

router.get("/tools/volatility", async (req, res) => {
  const pair = ((req.query["pair"] as string) ?? "EURUSD").toUpperCase();
  if (!YAHOO_VOLATILITY_PAIRS[pair]) {
    res.status(400).json({ error: `Pair ${pair} non supportato` });
    return;
  }

  const fresh = await getJsonCache<VolatilitySnapshot>(volatilityFreshKey(pair));
  if (fresh) {
    res.json(volatilityResponse(fresh, false));
    return;
  }

  // Cache miss: kick off a background refresh and serve the best we have now.
  void ensureVolatilityWarm(pair);
  const stale =
    volatilityLastGood.get(pair) ?? (await getJsonCache<VolatilitySnapshot>(volatilityStaleKey(pair)));
  if (stale) {
    res.json(volatilityResponse(stale, true));
    return;
  }
  res.status(503).json({ error: "Dati di volatilita in aggiornamento", status: "unavailable", source: null, fetchedAt: null, observedAt: null, observationStart: null, timeframe: "D1" });
});

// ─── 3b. WATCHLIST (dashboard sparkline rows over the D1 candle chain) ───────
// Same stale-while-revalidate discipline as volatility: a request only ever
// reads cache and triggers a deduped, concurrency-capped background refresh, so
// the slow no-key source (Dukascopy) never blocks the HTTP request. Pure payload
// shaping lives in services/watchlistQuotes.ts.

const WATCHLIST_FRESH_TTL_SECONDS = 2 * 60;
const WATCHLIST_STALE_TTL_SECONDS = 7 * 24 * 60 * 60;
const WATCHLIST_WARM_MAX = 3;

const watchlistLastGood = new Map<string, WatchlistItem>();
const watchlistInFlight = new Map<string, Promise<void>>();
let watchlistWarmActive = 0;
const watchlistWarmWaiters: Array<() => void> = [];

const watchlistFreshKey = (pair: string) => `watchlist:v1:${pair}`;
const watchlistStaleKey = (pair: string) => `watchlist:stale:v1:${pair}`;

function acquireWatchlistWarmSlot(): Promise<void> {
  if (watchlistWarmActive < WATCHLIST_WARM_MAX) {
    watchlistWarmActive++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    watchlistWarmWaiters.push(() => {
      watchlistWarmActive++;
      resolve();
    });
  });
}

function releaseWatchlistWarmSlot(): void {
  watchlistWarmActive--;
  watchlistWarmWaiters.shift()?.();
}

async function refreshWatchlistPair(pair: string): Promise<void> {
  const { candles } = await getCandles(pair, "D1");
  const item = buildWatchlistItem(pair, candles, true);
  watchlistLastGood.set(pair, item);
  await setJsonCache(watchlistFreshKey(pair), item, WATCHLIST_FRESH_TTL_SECONDS);
  await setJsonCache(watchlistStaleKey(pair), item, WATCHLIST_STALE_TTL_SECONDS);
}

function ensureWatchlistWarm(pair: string): Promise<void> {
  const existing = watchlistInFlight.get(pair);
  if (existing) return existing;
  const job = (async () => {
    await acquireWatchlistWarmSlot();
    try {
      await refreshWatchlistPair(pair);
    } catch (err) {
      console.warn(`[tools/watchlist] warm ${pair}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      releaseWatchlistWarmSlot();
      watchlistInFlight.delete(pair);
    }
  })();
  watchlistInFlight.set(pair, job);
  return job;
}

async function resolveWatchlistItem(pair: string): Promise<WatchlistItem> {
  if (!isSupportedSymbol(pair)) return buildWatchlistItem(pair, null, false);

  const fresh = await getJsonCache<WatchlistItem>(watchlistFreshKey(pair));
  if (fresh) return fresh;

  // Cache miss: kick off a background refresh and serve the best we have now.
  void ensureWatchlistWarm(pair);
  const stale =
    watchlistLastGood.get(pair) ?? (await getJsonCache<WatchlistItem>(watchlistStaleKey(pair)));
  return stale ?? buildWatchlistItem(pair, null, true);
}

router.get("/tools/watchlist", async (req, res) => {
  const pairs = parseWatchlistPairsParam(req.query["pairs"]);
  if (pairs.length === 0) {
    res.status(400).json({ error: "Parametro pairs mancante o non valido" });
    return;
  }
  const items = await Promise.all(pairs.map((pair) => resolveWatchlistItem(pair)));
  res.json({ items });
});

// CFTC polling follows the data rather than a hardcoded EST/UTC release hour.
const cotTask = cron.schedule("5 * * * *", () => { void getCotOutlook().catch(onCotFetchError); }, { timezone: "UTC" });
let cotSchedulerClosed = false;
export const cotScheduler = { async close() { if(cotSchedulerClosed)return;cotSchedulerClosed=true;cotTask.stop(); cotTask.destroy(); } };
void getCotOutlook().catch(onCotFetchError);
router.get("/tools/cot", async (_req, res) => { res.json(await getCotOutlook()); });

// ─── 5. MACRO NEWS AI ─────────────────────────────────────────────────────────
interface MacroNewsResult {
  articles: Array<{
    title: string;
    summary: string;
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
    affectedPairs?: string[];
    primaryAssets?: string[];
    deepDive?: NewsDeepDive;
  }>;
  sentiment: string;
  sentimentIntensity?: string;
  summary: string;
  fetchedAt: string;
  citationUrls?: string[];     // all Perplexity citations for the full query
}

const macroNewsCache = new Map<string, { data: MacroNewsResult; expiresAt: number }>();
const MACRO_NEWS_TTL = 2 * 60 * 1000;
const MACRO_NEWS_ASSET_CACHE_VERSION = "shared-pair-evidence-v4";
const VALID_CURRENCIES = new Set(["EUR", "USD", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "XAU"]);

function normalizeCurrencies(raw: string): { key: string; label: string } {
  if (!raw || raw.trim().length === 0) {
    return { key: "all", label: "tutte le principali valute" };
  }
  const filtered = raw
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => VALID_CURRENCIES.has(c));
  const unique = [...new Set(filtered)].sort();
  if (unique.length === 0 || unique.length === VALID_CURRENCIES.size) {
    return { key: "all", label: "tutte le principali valute" };
  }
  return { key: unique.join(",").toLowerCase(), label: unique.join(", ") };
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

function stableImageLock(text: string, index: number): number {
  let hash = index + 1;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return hash || 1;
}

function buildMacroImageKeywords(keywords: string[] | undefined, currency: string, context = ""): string[] {
  const text = context.toLowerCase();
  const out: string[] = [];
  const add = (...items: string[]) => {
    for (const item of items) if (item && !out.includes(item)) out.push(item);
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
  add(...(keywords ?? []));
  add(...(ASSET_IMAGE_KEYWORDS[currency] ?? ASSET_IMAGE_KEYWORDS.GLOBALE));
  return out.slice(0, 3);
}

function buildMacroImageUrl(keywords: string[] | undefined, currency: string, index = 0, context = ""): string {
  const kws = buildMacroImageKeywords(keywords, currency, context).map((keyword) => encodeURIComponent(keyword));
  const query = kws.length > 0 ? kws.join(",") : "global,economy,markets";
  const lock = stableImageLock(context || `${currency} macro news`, index);
  return `https://loremflickr.com/800/400/${query}?lock=${lock}`;
}

function uniqueMacroToolImageUrl(
  article: Pick<MacroNewsResult["articles"][number], "title" | "summary" | "currency" | "imageUrl" | "imageKeywords">,
  index: number,
  seen: Set<string>,
): string {
  const sourceImage = article.imageUrl?.trim();
  if (sourceImage && !seen.has(sourceImage)) {
    seen.add(sourceImage);
    return sourceImage;
  }

  const context = `${article.title} ${article.summary}`;
  for (let offset = 0; offset < 20; offset++) {
    const fallback = buildMacroImageUrl(article.imageKeywords, article.currency, index + offset * 97, context);
    if (!seen.has(fallback)) {
      seen.add(fallback);
      return fallback;
    }
  }

  const fallback = buildMacroImageUrl(article.imageKeywords, article.currency, index + seen.size * 193, context);
  seen.add(fallback);
  return fallback;
}

function ensureUniqueMacroToolImageUrls<T extends Pick<MacroNewsResult["articles"][number], "title" | "summary" | "currency" | "imageUrl" | "imageKeywords">>(articles: T[]): T[] {
  const seenImageUrls = new Set<string>();
  return articles.map((article, index) => ({
    ...article,
    imageUrl: uniqueMacroToolImageUrl(article, index, seenImageUrls),
  }));
}

async function translateMacroArticle(
  title: string, summary: string, lang: string, source?: string | null
): Promise<{ title: string; summary: string }> {
  if (lang === "en") return { title, summary };
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
        if (sep !== -1) return finalize(translated.slice(0, sep), translated.slice(sep + 5));
        return finalize(translated, summary);
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
    if (sep === -1) return finalize(translated, summary);
    return finalize(translated.slice(0, sep), translated.slice(sep + 5));
  } catch {
    return { title, summary };
  }
}

const LANG_NAMES: Record<string, string> = {
  it: "italiano", en: "inglese", es: "spagnolo", fr: "francese", de: "tedesco",
};

async function fetchMacroNewsGroq(currencyLabel: string, currenciesRaw = "", lang = "it"): Promise<MacroNewsResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  // Step 1: fetch RSS articles first (real, current news)
  const rssResult = await fetchMacroRSSFallback(currenciesRaw, lang);
  const rssArticles = rssResult.articles.slice(0, 8);
  if (rssArticles.length === 0) throw new Error("No RSS articles to enrich");

  const today = new Date().toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const langName = LANG_NAMES[lang] ?? "italiano";

  const articlesInput = rssArticles
    .map((a, i) => `[${i}] "${a.title.slice(0, 120)}" — ${a.summary.slice(0, 200)}`)
    .join("\n");

  const systemPrompt = `Sei un analista macro-economico e geopolitico esperto. Classifica ogni notizia per impatto forex. Valute target: ${currencyLabel}. Oggi: ${today}. Rispondi SOLO con JSON valido, nessun testo extra.`;

  const userPrompt = `Analizza questi articoli di notizie:
${articlesInput}

Per ogni articolo scegli UNA SOLA valuta tra: EUR, USD, GBP, JPY, CHF, CAD, AUD, NZD, XAU, GLOBALE.
Scegli UNO impatto tra: alto, medio, basso.
Scegli UNA direzione tra: bullish, bearish, neutrale.
Scegli UNA categoria tra: banca-centrale, macro-dati, conflitto, sanzioni, elezioni, commercio, energia, commodities.

Rispondi SOLO con questo JSON (summary in ${langName}):
{
  "enriched": [
    { "idx": 0, "currency": "USD", "impact": "alto", "direction": "bullish", "category": "macro-dati" },
    { "idx": 1, "currency": "EUR", "impact": "medio", "direction": "neutrale", "category": "banca-centrale" }
  ],
  "sentiment": "risk-on",
  "summary": "Sintesi del quadro macro-geopolitico globale in 2-3 frasi."
}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Groq ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  const raw = data.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as {
    enriched?: Array<{ idx: number; currency: string; impact: string; direction: string; category: string }>;
    sentiment?: string;
    summary?: string;
  };

  // Step 2: merge Groq classification back into RSS articles
  const enrichMap = new Map<number, NonNullable<typeof parsed.enriched>[number]>();
  for (const e of (parsed.enriched ?? [])) enrichMap.set(e.idx, e);

  const articles = rssArticles.map((a, i) => {
    const e = enrichMap.get(i);
    return {
      ...a,
      currency: e?.currency || a.currency,
      impact: ((e?.impact as "alto" | "medio" | "basso") || a.impact),
      direction: ((e?.direction as "bullish" | "bearish" | "neutrale") || a.direction),
      category: e?.category,
      verified: false,
    };
  });

  console.log(`[tools/macro-news/groq] OK — ${articles.length} articoli classificati con Llama`);

  // RISK ON/OFF from the deterministic regime (consistent with every other path),
  // using Groq's per-article currency/impact/direction as input.
  const regime = computeRiskRegime(articles.map((a) => ({
    title: a.title,
    summary: a.summary,
    impactScore: a.impact === "alto" ? 9 : a.impact === "medio" ? 6 : 3,
    impactDirection: a.direction,
    primaryAssets: a.currency ? [a.currency] : [],
  })));

  return {
    articles: ensureUniqueMacroToolImageUrls(articles),
    sentiment: regime.regime,
    sentimentIntensity: regime.intensity ?? undefined,
    summary: parsed.summary || "",
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchMacroNewsPerplexity(currencyLabel: string, lang = "it"): Promise<MacroNewsResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY not set");

  const today = new Date().toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const langName = LANG_NAMES[lang] ?? "italiano";

  // Perplexity sonar performs real-time web search.
  // The response includes `citations: string[]` — actual URLs of pages it searched.
  // We extract these as verified source proof instead of asking the AI to invent names.
  const systemPrompt = `Sei un analista macro-economico e geopolitico esperto. Oggi è ${today}.
Usa la tua capacità di ricerca web in tempo reale per trovare e riassumere le ultime notizie delle ultime 24-48 ore.
Copri sia notizie MACRO-ECONOMICHE che GEOPOLITICHE che muovono i mercati forex e commodities:
- Macro: decisioni banche centrali (Fed/BCE/BoE/BoJ), inflazione CPI, NFP, PIL, PMI, dati occupazione
- Geopolitica: conflitti armati, sanzioni, elezioni politiche, crisi diplomatiche, guerre commerciali, dazi, crisi energetiche
Scrivi title e summary in ${langName}. Rispondi SOLO con JSON valido, nessun testo extra o markdown:
{
  "articles": [
    {
      "title": "Titolo breve e descrittivo in ${langName}",
      "summary": "2-3 frasi in ${langName}: la notizia, il contesto macro/geopolitico e l'impatto atteso sui mercati",
      "impact": "alto|medio|basso",
      "currency": "EUR|USD|GBP|JPY|CHF|CAD|AUD|NZD|XAU|GLOBALE",
      "direction": "bullish|bearish|neutrale",
      "source": "Nome della fonte primaria trovata online",
      "sources": ["Fonte 1", "Fonte 2", "Fonte 3"],
      "category": "banca-centrale|macro-dati|conflitto|sanzioni|elezioni|commercio|energia|commodities",
      "timestamp": "ISO timestamp approssimativo della notizia",
      "imageKeywords": ["english_word1", "english_word2"]
    }
  ],
  "sentiment": "risk-on|risk-off|neutrale",
  "summary": "Sintesi del quadro macro-geopolitico globale di oggi in ${langName}"
}
Genera 6-8 articoli bilanciati tra macro e geopolitica. imageKeywords: 2-3 parole inglesi per immagine rappresentativa.`;

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Ricerca le ultime notizie macro-economiche e geopolitiche delle ultime 24-48 ore rilevanti per ${currencyLabel}. Includi sia eventi economici (banche centrali, dati macro) che geopolitici (conflitti, sanzioni, elezioni, crisi commerciali) che impattano il forex e le commodities. Rispondi SOLO con JSON in ${langName}.`,
        },
      ],
      temperature: 0.1,
      max_tokens: 4000,
      search_recency_filter: "week",
      return_citations: true,
    }),
    signal: AbortSignal.timeout(35000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Perplexity ${response.status}: ${errText.slice(0, 200)}`);
  }

  // Perplexity returns `citations: string[]` — real URLs the model searched.
  // These are the actual verified sources, far more reliable than AI-invented names.
  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
    citations?: string[];
  };

  const realCitationUrls: string[] = (data.citations ?? []).filter(
    (u) => typeof u === "string" && u.startsWith("http"),
  );

  const raw = data.choices[0]?.message?.content ?? "{}";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as Partial<MacroNewsResult>;

  const totalArticles = Math.max((parsed.articles ?? []).length, 1);

  const articles = ensureUniqueMacroToolImageUrls((parsed.articles ?? []).map((a, i) => {
    const rawSources = Array.isArray(a.sources) && a.sources.length > 0
      ? a.sources
      : a.source ? [a.source] : [];
    const dedupedSources = [...new Set(rawSources.map((s) => String(s).trim()).filter(Boolean))];

    // Distribute Perplexity's real citation URLs across articles.
    // Each article gets up to 3 real URLs drawn from the full citations pool.
    let articleCitationUrls: string[] = [];
    if (realCitationUrls.length > 0) {
      const perArticle = 3;
      const startIdx = (i * perArticle) % realCitationUrls.length;
      const slice1 = realCitationUrls.slice(startIdx, startIdx + perArticle);
      const slice2 = realCitationUrls.slice(0, Math.max(0, perArticle - slice1.length));
      articleCitationUrls = [...new Set([...slice1, ...slice2])].slice(0, perArticle);
    }

    // Verified = Perplexity found ≥3 real sources OR AI listed ≥3 named sources
    const verified = realCitationUrls.length >= 3 || dedupedSources.length >= 3;

    return {
      ...a,
      source: a.source || dedupedSources[0] || "",
      sources: dedupedSources,
      citationUrls: articleCitationUrls,
      verified,
      imageUrl: buildMacroImageUrl(a.imageKeywords, a.currency ?? "GLOBALE", i, `${a.title ?? ""} ${a.summary ?? ""}`),
    };
  }));

  // Warn in dev if Perplexity returned no citations (may indicate key/model issue)
  if (realCitationUrls.length === 0) {
    console.warn("[macro-news] Perplexity returned 0 citations — falling back to AI-named sources only");
  } else {
    console.log(`[macro-news] Perplexity returned ${realCitationUrls.length} real citation URLs for ${totalArticles} articles`);
  }

  const regime = computeRiskRegime(articles.map((a) => ({
    title: a.title,
    summary: a.summary,
    impactScore: a.impact === "alto" ? 9 : a.impact === "medio" ? 6 : 3,
    impactDirection: a.direction,
    primaryAssets: a.currency ? [a.currency] : [],
  })));

  return {
    articles,
    sentiment: regime.regime,
    sentimentIntensity: regime.intensity ?? undefined,
    summary: parsed.summary ?? "",
    fetchedAt: new Date().toISOString(),
    citationUrls: realCitationUrls,
  };
}

// ─── RSS fallback for macro-news ──────────────────────────────────────────────
const RSS_MACRO_FEEDS = [
  { url: "https://www.cnbc.com/id/20409666/device/rss/rss.html", source: "CNBC Markets" },
  { url: "https://www.cnbc.com/id/15839135/device/rss/rss.html", source: "CNBC Finance" },
  { url: "https://seekingalpha.com/tag/forex.xml", source: "Seeking Alpha – Forex" },
  { url: "https://seekingalpha.com/tag/gold.xml", source: "Seeking Alpha – Gold" },
];

const CURRENCY_KW: Record<string, string[]> = {
  USD: ["dollar","usd","federal reserve","fed","fomc","powell","treasury","nonfarm","payroll","dxy"],
  EUR: ["euro","eur","ecb","lagarde","eurozone","bce","draghi"],
  GBP: ["pound","gbp","sterling","boe","bank of england","bailey"],
  JPY: ["yen","jpy","boj","bank of japan","ueda","nikkei"],
  CHF: ["swiss","chf","snb","franc"],
  CAD: ["canadian","cad","boc","loonie"],
  AUD: ["aussie","aud","rba"],
  NZD: ["kiwi","nzd","rbnz"],
  XAU: ["gold","xau","bullion","wgc","lbma","cftc"],
};

const BULLISH_KW = ["rally","surge","gain","rise","jump","strong","high","increase","growth","beat","above","positive","optimistic","hawkish","tightening"];
const BEARISH_KW = ["fall","drop","decline","plunge","weak","low","miss","below","cut","ease","dovish","selloff","recession","concern","risk","warn"];
const HIGH_IMPACT_KW = ["fomc","ecb","boe","boj","rate decision","nonfarm payroll","cpi","gdp","inflation","unemployment","recession","central bank","war","crisis","sanction","default"];

function detectCurrency(text: string): string {
  const t = text.toLowerCase();
  for (const [cur, kws] of Object.entries(CURRENCY_KW)) {
    if (kws.some((kw) => t.includes(kw))) return cur;
  }
  return "GLOBALE";
}

function detectDirection(text: string): "bullish" | "bearish" | "neutrale" {
  const t = text.toLowerCase();
  const bull = BULLISH_KW.filter((kw) => t.includes(kw)).length;
  const bear = BEARISH_KW.filter((kw) => t.includes(kw)).length;
  if (bull > bear) return "bullish";
  if (bear > bull) return "bearish";
  return "neutrale";
}

function detectImpact(text: string): "alto" | "medio" | "basso" {
  const t = text.toLowerCase();
  return HIGH_IMPACT_KW.some((kw) => t.includes(kw)) ? "alto" : "medio";
}

function extractRSSImageMacro(block: string, descRaw: string): string | null {
  return block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image[^"']*["']/i)?.[1]
    || block.match(/<media:content[^>]+url=["']([^"']+\.(?:jpg|jpeg|png|webp|gif))["']/i)?.[1]
    || block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1]
    || descRaw.match(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp|gif)[^"']*)["']/i)?.[1]
    || null;
}

async function fetchMacroRSSFallback(currenciesInput: string, lang = "it"): Promise<MacroNewsResult> {
  const results = await Promise.allSettled(
    RSS_MACRO_FEEDS.map(async (f) => {
      const res = await fetch(f.url, {
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/rss+xml, */*" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      const articles: Array<{
        title: string; summary: string; url: string | null; currency: string;
        direction: "bullish"|"bearish"|"neutrale"; impact: "alto"|"medio"|"basso";
        source: string; sources: string[]; verified: boolean;
        timestamp: string | null; imageUrl: string | null;
      }> = [];
      const itemRe = /<item>([\s\S]*?)<\/item>/g;
      let m;
      while ((m = itemRe.exec(xml)) !== null) {
        const block = m[1];
        const titleRaw = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] ?? "";
        const decodeEntities = (s: string) => s
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&#39;/g, "'")
          .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
          .trim();
        const title = decodeEntities(titleRaw);
        const descRaw = block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1] ?? "";
        const summary = decodeEntities(descRaw).slice(0, 280) || title;
        const pubDate = block.match(/<pubDate>([^<]*)<\/pubDate>/)?.[1];
        const link = block.match(/<link>([^<]*)<\/link>/)?.[1]
          || block.match(/<guid[^>]*isPermaLink=["']true["'][^>]*>([^<]*)<\/guid>/)?.[1]
          || block.match(/<guid[^>]*>([^<]*)<\/guid>/)?.[1];
        const url = link?.startsWith("http") ? link : null;
        if (!title || title.length < 5) continue;
        let ts: string | null = null;
        try { ts = pubDate ? new Date(pubDate).toISOString() : null; } catch { /* */ }
        const combined = `${title} ${summary}`;
        articles.push({
          title, summary, url, source: f.source, sources: [f.source],
          currency: detectCurrency(combined),
          direction: detectDirection(combined),
          impact: detectImpact(combined),
          verified: false, timestamp: ts,
          imageUrl: extractRSSImageMacro(block, descRaw),
        });
      }
      return articles;
    })
  );

  const targetCurrencies = currenciesInput
    ? currenciesInput.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean)
    : [];

  let all: MacroNewsResult["articles"] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all = [...all, ...r.value];
  }

  // Filter by target currencies if specified
  const filtered = targetCurrencies.length > 0
    ? all.filter((a) => targetCurrencies.includes(a.currency) || a.currency === "GLOBALE")
    : all;
  const pool = filtered.length >= 4 ? filtered : all;

  // Deduplicate and take top 8
  const seen = new Set<string>();
  const deduped = pool.filter((a) => {
    const k = a.title.toLowerCase().slice(0, 40);
    if (seen.has(k)) return false;
    seen.add(k); return true;
  }).slice(0, 8);

  // Sort by timestamp desc
  deduped.sort((a, b) => {
    if (!a.timestamp && !b.timestamp) return 0;
    if (!a.timestamp) return 1;
    if (!b.timestamp) return -1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const articles = ensureUniqueMacroToolImageUrls(deduped.map((a) => ({ ...a, imageKeywords: undefined })));

  // Translate title+summary if needed
  const translatedArticles = lang !== "en"
    ? await Promise.all(
        articles.map(async (a) => {
          const { title, summary } = await translateMacroArticle(a.title, a.summary, lang, a.source);
          return { ...a, title, summary };
        })
      )
    : articles;

  const regime = computeRiskRegime(translatedArticles.map((a) => ({
    title: a.title,
    summary: a.summary,
    impactScore: a.impact === "alto" ? 9 : a.impact === "medio" ? 6 : 3,
    impactDirection: a.direction,
    primaryAssets: a.currency ? [a.currency] : [],
  })));

  return {
    articles: translatedArticles,
    sentiment: regime.regime,
    sentimentIntensity: regime.intensity ?? undefined,
    summary: buildMacroTickerSummary(translatedArticles.map(macroArticleToNewsLike), regime),
    fetchedAt: new Date().toISOString(),
  };
}

/** Compatibility shape over the same corpus used by /news, including ALL/no parameters. */
export async function fetchMacroNews(
  _currencyLabel: string,
  currenciesRaw = "",
  lang = "it",
  options: { forceRefresh?: boolean; pairs?: string } = {},
): Promise<MacroNewsResult> {
  const pairs = options.pairs || pairsFromMacroCurrencies(currenciesRaw);
  const forceRefresh = options.forceRefresh === true;
  const news = await withTimeout(
    getNewsData({ noCache: forceRefresh === true, pairs, lang }),
    NEWS_HUB_MACRO_TIMEOUT_MS,
    "NewsHub",
  );
  return macroNewsFromNewsHub(news, { pairs, lang }) as MacroNewsResult;
}

const VALID_LANGS = new Set(["it", "en", "es", "fr", "de"]);
function sanitizeLang(raw: string | undefined): string {
  const l = (raw ?? "it").toLowerCase().slice(0, 2);
  return VALID_LANGS.has(l) ? l : "it";
}

const NEWS_HUB_MACRO_TIMEOUT_MS = process.env.VERCEL ? 25_000 : 45_000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

router.get("/tools/macro-news", async (req, res) => {
  let currenciesInput = (req.query.currencies as string) || "";
  const pairsInput = (req.query.pairs as string) || "";
  const lang = sanitizeLang(req.query.lang as string | undefined);
  if (!currenciesInput && pairsInput) {
    const symbols = pairsInput.split(",").map((s) => s.trim()).filter(Boolean);
    const derived = getCurrenciesFromPairs(symbols);
    currenciesInput = derived.join(",");
  }
  const { key: baseKey, label } = normalizeCurrencies(currenciesInput);
  const key = `${MACRO_NEWS_ASSET_CACHE_VERSION}:${baseKey}:${newsSubscriptionKey({pairs:pairsInput,lang})}`;
  const forceRefresh = req.query.force === "1";

  const cached = macroNewsCache.get(key);
  if (!forceRefresh && cached && Date.now() < cached.expiresAt) {
    res.json(cached.data);
    return;
  }

  try {
    const result = ensureMacroDeepDive(await fetchMacroNews(label, currenciesInput, lang, { forceRefresh, pairs: pairsInput }), lang) as MacroNewsResult;
    macroNewsCache.set(key, { data: result, expiresAt: Date.now() + MACRO_NEWS_TTL });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tools/macro-news GET]", msg);
    res.status(500).json({ error: msg });
  }
});

router.post("/tools/macro-news", async (req, res) => {
  const { currency = "", pairs = "", lang: langRaw = "" } = req.body as { currency?: string; pairs?: string; lang?: string };
  const lang = sanitizeLang(langRaw);
  let currencyInput = currency;
  const isGeneric = !currencyInput || currencyInput.toLowerCase().includes("tutte");
  if (isGeneric && pairs) {
    const symbols = pairs.split(",").map((s: string) => s.trim()).filter(Boolean);
    const derived = getCurrenciesFromPairs(symbols);
    if (derived.length > 0) {
      currencyInput = derived.join(",");
    }
  }
  const { key: baseKey, label } = normalizeCurrencies(currencyInput);
  const key = `${MACRO_NEWS_ASSET_CACHE_VERSION}:${baseKey}:${newsSubscriptionKey({pairs,lang})}`;

  const cached = macroNewsCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    res.json(cached.data);
    return;
  }

  try {
    const result = ensureMacroDeepDive(await fetchMacroNews(label, currencyInput, lang, { pairs }), lang) as MacroNewsResult;
    macroNewsCache.set(key, { data: result, expiresAt: Date.now() + MACRO_NEWS_TTL });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tools/macro-news]", msg);
    res.status(500).json({ error: msg });
  }
});

// ─── SUPPORTED PAIRS LIST ─────────────────────────────────────────────────────
router.get("/tools/pairs", (req, res) => {
  res.json({ pairs: Object.keys(YAHOO_VOLATILITY_PAIRS) });
});

export default router;
