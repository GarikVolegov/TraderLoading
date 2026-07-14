import { Router } from "express";
import cron from "node-cron";
import { getCurrenciesFromPairs } from "@workspace/pair-catalog";
import { getNewsData } from "./news.js";
import { cleanNewsText } from "../services/newsHub/contentQuality.js";
import { buildMacroTickerSummary, ensureMacroDeepDive, macroArticleToNewsLike, macroNewsFromNewsHub, pairsFromMacroCurrencies } from "../services/newsHub/macroNewsAdapter.js";
import type { NewsDeepDive } from "../services/newsHub/types.js";
import { computeRiskRegime } from "../services/newsHub/riskRegime.js";
import { fetchMyfxbookOutlook, type MyfxbookSymbol } from "../services/myfxbook.js";
import { parseMonteCarloParams } from "../services/monteCarloParams.js";
import {
  calculateVolatilityMetrics,
  candlesToVolatilityInput,
  trimToRecentDays,
  YAHOO_VOLATILITY_PAIRS,
  type VolatilityMetricResponse,
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

const FALLBACK_SYMBOLS: MyfxbookSymbol[] = [
  { name: "EURUSD", longPercentage: 58, shortPercentage: 42, longPositions: 58000, shortPositions: 42000, longVolume: 58, shortVolume: 42 },
  { name: "GBPUSD", longPercentage: 45, shortPercentage: 55, longPositions: 45000, shortPositions: 55000, longVolume: 45, shortVolume: 55 },
  { name: "USDJPY", longPercentage: 62, shortPercentage: 38, longPositions: 62000, shortPositions: 38000, longVolume: 62, shortVolume: 38 },
  { name: "USDCHF", longPercentage: 51, shortPercentage: 49, longPositions: 51000, shortPositions: 49000, longVolume: 51, shortVolume: 49 },
  { name: "AUDUSD", longPercentage: 39, shortPercentage: 61, longPositions: 39000, shortPositions: 61000, longVolume: 39, shortVolume: 61 },
  { name: "USDCAD", longPercentage: 54, shortPercentage: 46, longPositions: 54000, shortPositions: 46000, longVolume: 54, shortVolume: 46 },
  { name: "NZDUSD", longPercentage: 47, shortPercentage: 53, longPositions: 47000, shortPositions: 53000, longVolume: 47, shortVolume: 53 },
  { name: "EURGBP", longPercentage: 55, shortPercentage: 45, longPositions: 55000, shortPositions: 45000, longVolume: 55, shortVolume: 45 },
  { name: "EURJPY", longPercentage: 61, shortPercentage: 39, longPositions: 61000, shortPositions: 39000, longVolume: 61, shortVolume: 39 },
  { name: "GBPJPY", longPercentage: 43, shortPercentage: 57, longPositions: 43000, shortPositions: 57000, longVolume: 43, shortVolume: 57 },
  { name: "XAUUSD", longPercentage: 71, shortPercentage: 29, longPositions: 71000, shortPositions: 29000, longVolume: 71, shortVolume: 29 },
  { name: "XAGUSD", longPercentage: 66, shortPercentage: 34, longPositions: 66000, shortPositions: 34000, longVolume: 66, shortVolume: 34 },
  { name: "BTCUSD", longPercentage: 68, shortPercentage: 32, longPositions: 68000, shortPositions: 32000, longVolume: 68, shortVolume: 32 },
];

// Last successful live outlook, kept in memory so a transient Myfxbook failure
// degrades to the most recent real data instead of dropping straight to the
// static demo set (only relevant when MYFXBOOK_* credentials are configured).
let lastGoodSentiment: MyfxbookSymbol[] | null = null;

router.get("/tools/sentiment", async (req, res) => {
  const hasCredentials = !!(process.env.MYFXBOOK_EMAIL && process.env.MYFXBOOK_PASSWORD);
  try {
    const symbols = await fetchMyfxbookOutlook();
    lastGoodSentiment = symbols;
    res.json({ symbols, live: true, cached: false, hasCredentials });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[tools/sentiment]", msg);
    if (lastGoodSentiment) {
      res.json({ symbols: lastGoodSentiment, live: false, cached: true, hasCredentials, error: msg });
      return;
    }
    res.json({ symbols: FALLBACK_SYMBOLS, live: false, fallback: true, hasCredentials, error: msg });
  }
});

// ─── 3. VOLATILITY (Mataf-methodology daily ranges) ──────────────────────────
// Sources D1 candles via the shared candle service (Binance/TwelveData/Dukascopy
// ahead of Yahoo) so it keeps working on Railway, where Yahoo blocks the
// datacenter IP. Stale-while-revalidate: a request only ever reads cache and
// triggers a deduped, concurrency-capped background refresh, so the slow no-key
// source (Dukascopy pulls per-day files) never blocks the HTTP request.

const VOLATILITY_FRESH_TTL_SECONDS = 30 * 60;
const VOLATILITY_STALE_TTL_SECONDS = 7 * 24 * 60 * 60;
const VOLATILITY_LOOKBACK_DAYS = 366;
const VOLATILITY_WARM_MAX = 3;

const volatilityLastGood = new Map<string, VolatilityMetricResponse>();
const volatilityInFlight = new Map<string, Promise<void>>();
let volatilityWarmActive = 0;
const volatilityWarmWaiters: Array<() => void> = [];

const volatilityFreshKey = (pair: string) => `volatility:v2:${pair}`;
const volatilityStaleKey = (pair: string) => `volatility:stale:v1:${pair}`;

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
  const { candles } = await getCandles(pair, "D1");
  const recent = trimToRecentDays(candles, VOLATILITY_LOOKBACK_DAYS);
  const series = recent.length >= 5 ? recent : candles;
  const metrics = calculateVolatilityMetrics(pair, candlesToVolatilityInput(series));
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

  const fresh = await getJsonCache<VolatilityMetricResponse>(volatilityFreshKey(pair));
  if (fresh) {
    res.json(fresh);
    return;
  }

  // Cache miss: kick off a background refresh and serve the best we have now.
  void ensureVolatilityWarm(pair);
  const stale =
    volatilityLastGood.get(pair) ?? (await getJsonCache<VolatilityMetricResponse>(volatilityStaleKey(pair)));
  if (stale) {
    res.json(stale);
    return;
  }
  res.status(503).json({ error: "Dati di volatilita in aggiornamento" });
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

import { emitWatchlistUpdate } from "../services/watchlist/watchlistHub.js";

async function refreshWatchlistPair(pair: string): Promise<void> {
  const { candles } = await getCandles(pair, "D1");
  const item = buildWatchlistItem(pair, candles, true);
  watchlistLastGood.set(pair, item);
  await setJsonCache(watchlistFreshKey(pair), item, WATCHLIST_FRESH_TTL_SECONDS);
  await setJsonCache(watchlistStaleKey(pair), item, WATCHLIST_STALE_TTL_SECONDS);
  // Broadcast to any in-process WS subscribers
  try {
    emitWatchlistUpdate(pair, item);
  } catch {
    // ignore emitter errors
  }
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

// ─── 4. COT REPORT (CFTC, aggiornamento ogni venerdì) ────────────────────────

const COT_MARKET_MAP: Record<string, string> = {
  "EURO FX": "EUR",
  "BRITISH POUND": "GBP",
  "JAPANESE YEN": "JPY",
  "SWISS FRANC": "CHF",
  "CANADIAN DOLLAR": "CAD",
  "AUSTRALIAN DOLLAR": "AUD",
  "NZ DOLLAR": "NZD",        // rinominato dal CFTC nel 2022 (ex "NEW ZEALAND DOLLAR")
  "GOLD": "XAU",
  "USD INDEX": "USD",        // rinominato dal CFTC nel 2022 (ex "U.S. DOLLAR INDEX")
};

const COT_ORDER = ["EUR","GBP","JPY","CHF","CAD","AUD","NZD","XAU","USD"];
const COT_HISTORY_WEEKS = 12; // settimane di storico da mostrare

// Risolve un nome-mercato CFTC nella sua valuta. Accetta solo il contratto base
// ("<KEY> - EXCHANGE"): esclude i cross-rate ("EURO FX/BRITISH POUND XRATE") e le
// varianti ("MICRO GOLD", "GOLD -1 TROY OUNCE") che un semplice includes()
// attribuirebbe alla valuta sbagliata.
function matchCotCurrency(rawMarket: string): string | null {
  const market = (rawMarket ?? "").toUpperCase().trim();
  if (!market) return null;
  // Nome ICE legacy pre-2022 ("U.S. DOLLAR INDEX"); i dati correnti usano "USD INDEX".
  if (market.startsWith("U.S. DOLLAR INDEX")) return "USD";
  for (const key of Object.keys(COT_MARKET_MAP)) {
    if (market === key || market.startsWith(`${key} - `)) return COT_MARKET_MAP[key];
  }
  return null;
}

interface CotWeek {
  date: string;
  nonCommLong: number;
  nonCommShort: number;
  commLong: number;
  commShort: number;
  retailLong: number;
  retailShort: number;
  nonCommNet: number;
  commNet: number;
  retailNet: number;
}
interface CotEntry extends CotWeek {
  market: string;
  currency: string;
  history: { date: string; nonCommNet: number; commNet: number }[];
}

function parseCotCsv(text: string): CotEntry[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const col = (name: string) => headers.findIndex((h) => h.includes(name.toLowerCase()));

  const marketCol  = col("market_and_exchange_names");
  const dateCol    = col("report_date_as_yyyy");
  const ncLongCol  = col("noncomm_positions_long_all");
  const ncShortCol = col("noncomm_positions_short_all");
  const commLCol   = col("comm_positions_long_all");
  const commSCol   = col("comm_positions_short_all");
  const nrLCol     = col("nonrept_positions_long_all");
  const nrSCol     = col("nonrept_positions_short_all");

  const historyByMarket: Record<string, CotWeek[]> = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const market = cols[marketCol]?.toUpperCase() ?? "";
    const matchedKey = Object.keys(COT_MARKET_MAP).find((k) => market.includes(k));
    if (!matchedKey) continue;

    const currency = COT_MARKET_MAP[matchedKey];
    const date = cols[dateCol] ?? "";
    const ncLong  = parseInt(cols[ncLongCol])  || 0;
    const ncShort = parseInt(cols[ncShortCol]) || 0;
    const commL   = parseInt(cols[commLCol])   || 0;
    const commS   = parseInt(cols[commSCol])   || 0;
    const nrL     = parseInt(cols[nrLCol])     || 0;
    const nrS     = parseInt(cols[nrSCol])     || 0;

    if (!historyByMarket[currency]) historyByMarket[currency] = [];
    // Avoid duplicate dates
    if (!historyByMarket[currency].some((w) => w.date === date)) {
      historyByMarket[currency].push({
        date, nonCommLong: ncLong, nonCommShort: ncShort,
        commLong: commL, commShort: commS,
        retailLong: nrL, retailShort: nrS,
        nonCommNet: ncLong - ncShort,
        commNet: commL - commS,
        retailNet: nrL - nrS,
      });
    }
  }

  return Object.entries(historyByMarket)
    .map(([currency, weeks]) => {
      // Sort by date desc, take latest as "current"
      weeks.sort((a, b) => b.date.localeCompare(a.date));
      const latest = weeks[0];
      const history = weeks.slice(0, COT_HISTORY_WEEKS).reverse().map((w) => ({
        date: w.date, nonCommNet: w.nonCommNet, commNet: w.commNet,
      }));
      const matchedKey = Object.keys(COT_MARKET_MAP).find((k) => COT_MARKET_MAP[k] === currency) ?? "";
      return { ...latest, market: matchedKey, currency, history };
    })
    .sort((a, b) => COT_ORDER.indexOf(a.currency) - COT_ORDER.indexOf(b.currency));
}

// ─── Parser per FinFutWk.txt (Traders in Financial Futures, no header row) ────
// Colonne confermate (0-indexed) dal file CFTC live:
//   0  = Market name
//   2  = Date YYYY-MM-DD
//   7  = Open Interest All
//   8  = Dealer/Intermediary Long All   (commercials/market makers)
//   9  = Dealer Short All
//  10  = Dealer Spread All
//  11  = Asset Manager Long All         (commercials/institutional)
//  12  = Asset Manager Short All
//  13  = Asset Manager Spread All
//  14  = Leveraged Money Long All       (non-commercial / speculatori)
//  15  = Leveraged Money Short All
//  16  = Leveraged Money Spread All
//  17  = Other Reportables Long All
//  18  = Other Reportables Short All
//  19  = Other Reportables Spread All
//  20  = Total Reportable Longs (derived)
//  21  = Total Reportable Shorts (derived)
//  22  = Non-Reportable Long All
//  23  = Non-Reportable Short All
function parseCotTxt(text: string): CotEntry[] {
  const lines = text.trim().split("\n");
  if (lines.length < 1) return [];

  const historyByMarket: Record<string, CotWeek[]> = {};

  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 24) continue;

    const currency = matchCotCurrency(cols[0] ?? "");
    if (!currency) continue;
    const date = cols[2] ?? "";
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) continue;

    const n = (i: number) => parseInt(cols[i]) || 0;

    // Leveraged Money = speculators (equiv. "Non-Commercial")
    const levLong  = n(14);
    const levShort = n(15);
    // Dealer + Asset Manager = hedgers (equiv. "Commercial")
    const commL = n(8)  + n(11);
    const commS = n(9)  + n(12);
    // Non-Reportable
    const nrL = n(22);
    const nrS = n(23);

    if (!historyByMarket[currency]) historyByMarket[currency] = [];
    if (!historyByMarket[currency].some((w) => w.date === date)) {
      historyByMarket[currency].push({
        date,
        nonCommLong: levLong, nonCommShort: levShort,
        commLong: commL,      commShort: commS,
        retailLong: nrL,      retailShort: nrS,
        nonCommNet: levLong - levShort,
        commNet:    commL - commS,
        retailNet:  nrL - nrS,
      });
    }
  }

  return Object.entries(historyByMarket)
    .map(([currency, weeks]) => {
      weeks.sort((a, b) => b.date.localeCompare(a.date));
      const latest = weeks[0];
      const history = weeks.slice(0, COT_HISTORY_WEEKS).reverse().map((w) => ({
        date: w.date, nonCommNet: w.nonCommNet, commNet: w.commNet,
      }));
      const matchedKey = Object.keys(COT_MARKET_MAP).find((k) => COT_MARKET_MAP[k] === currency) ?? "";
      return { ...latest, market: matchedKey, currency, history };
    })
    .sort((a, b) => COT_ORDER.indexOf(a.currency) - COT_ORDER.indexOf(b.currency));
}

// 14-week realistic synthetic history (2026-01-26 → 2026-04-28)
// Based on known CFTC values (2026-03-11 confirmed, 2026-04-28 live)
const COT_FALLBACK: CotEntry[] = [
  { market:"EURO FX",          currency:"EUR", date:"2026-04-28", nonCommLong:174050, nonCommShort:162456, commLong:136200, commShort:211400, retailLong:42100, retailShort:42040, nonCommNet:11594,  commNet:-75200, retailNet:60,
    history:[{date:"2026-01-26",nonCommNet:92000,commNet:-90000},{date:"2026-02-02",nonCommNet:86000,commNet:-84000},{date:"2026-02-09",nonCommNet:82000,commNet:-80000},{date:"2026-02-16",nonCommNet:78000,commNet:-76000},{date:"2026-02-23",nonCommNet:76000,commNet:-74000},{date:"2026-03-02",nonCommNet:74000,commNet:-72000},{date:"2026-03-09",nonCommNet:76140,commNet:-75200},{date:"2026-03-16",nonCommNet:68000,commNet:-66000},{date:"2026-03-23",nonCommNet:52000,commNet:-50000},{date:"2026-03-30",nonCommNet:38000,commNet:-36000},{date:"2026-04-06",nonCommNet:29000,commNet:-27000},{date:"2026-04-13",nonCommNet:21000,commNet:-19000},{date:"2026-04-20",nonCommNet:16000,commNet:-14000},{date:"2026-04-28",nonCommNet:11594,commNet:-75200}] },
  { market:"BRITISH POUND",    currency:"GBP", date:"2026-04-28", nonCommLong:143700, nonCommShort:114818, commLong:124800, commShort:78900,  retailLong:18200, retailShort:20010, nonCommNet:28882,  commNet:45900,  retailNet:-1810,
    history:[{date:"2026-01-26",nonCommNet:-55000,commNet:56000},{date:"2026-02-02",nonCommNet:-52000,commNet:53000},{date:"2026-02-09",nonCommNet:-50000,commNet:51000},{date:"2026-02-16",nonCommNet:-48000,commNet:49000},{date:"2026-02-23",nonCommNet:-46000,commNet:47000},{date:"2026-03-02",nonCommNet:-44000,commNet:45000},{date:"2026-03-09",nonCommNet:-44090,commNet:45900},{date:"2026-03-16",nonCommNet:-30000,commNet:31000},{date:"2026-03-23",nonCommNet:-15000,commNet:16000},{date:"2026-03-30",nonCommNet:2000,commNet:-1000},{date:"2026-04-06",nonCommNet:12000,commNet:-11000},{date:"2026-04-13",nonCommNet:20000,commNet:-19000},{date:"2026-04-20",nonCommNet:25000,commNet:-24000},{date:"2026-04-28",nonCommNet:28882,commNet:45900}] },
  { market:"JAPANESE YEN",     currency:"JPY", date:"2026-04-28", nonCommLong:42100,  nonCommShort:117902, commLong:62100,  commShort:107500, retailLong:13400, retailShort:12900, nonCommNet:-75802, commNet:-45400, retailNet:500,
    history:[{date:"2026-01-26",nonCommNet:48000,commNet:-48000},{date:"2026-02-02",nonCommNet:46000,commNet:-46000},{date:"2026-02-09",nonCommNet:44000,commNet:-44000},{date:"2026-02-16",nonCommNet:44000,commNet:-44000},{date:"2026-02-23",nonCommNet:45000,commNet:-45000},{date:"2026-03-02",nonCommNet:44000,commNet:-44000},{date:"2026-03-09",nonCommNet:43900,commNet:-45400},{date:"2026-03-16",nonCommNet:22000,commNet:-22000},{date:"2026-03-23",nonCommNet:-5000,commNet:5000},{date:"2026-03-30",nonCommNet:-30000,commNet:30000},{date:"2026-04-06",nonCommNet:-52000,commNet:52000},{date:"2026-04-13",nonCommNet:-65000,commNet:65000},{date:"2026-04-20",nonCommNet:-72000,commNet:72000},{date:"2026-04-28",nonCommNet:-75802,commNet:-45400}] },
  { market:"SWISS FRANC",      currency:"CHF", date:"2026-04-28", nonCommLong:28200,  nonCommShort:36400,  commLong:41200,  commShort:24900,  retailLong:6800,  retailShort:6700,  nonCommNet:-8200,  commNet:16300,  retailNet:100,
    history:[{date:"2026-01-26",nonCommNet:-22000,commNet:22000},{date:"2026-02-02",nonCommNet:-21000,commNet:21000},{date:"2026-02-09",nonCommNet:-19000,commNet:19000},{date:"2026-02-16",nonCommNet:-18000,commNet:18000},{date:"2026-02-23",nonCommNet:-17000,commNet:17000},{date:"2026-03-02",nonCommNet:-16000,commNet:16000},{date:"2026-03-09",nonCommNet:-16400,commNet:16300},{date:"2026-03-16",nonCommNet:-15000,commNet:15000},{date:"2026-03-23",nonCommNet:-13000,commNet:13000},{date:"2026-03-30",nonCommNet:-12000,commNet:12000},{date:"2026-04-06",nonCommNet:-10000,commNet:10000},{date:"2026-04-13",nonCommNet:-9000,commNet:9000},{date:"2026-04-20",nonCommNet:-8500,commNet:8500},{date:"2026-04-28",nonCommNet:-8200,commNet:16300}] },
  { market:"CANADIAN DOLLAR",  currency:"CAD", date:"2026-04-28", nonCommLong:55800,  nonCommShort:110800, commLong:118700, commShort:51200,  retailLong:11400, retailShort:10600, nonCommNet:-55000, commNet:67500,  retailNet:800,
    history:[{date:"2026-01-26",nonCommNet:-75000,commNet:74000},{date:"2026-02-02",nonCommNet:-74000,commNet:73000},{date:"2026-02-09",nonCommNet:-73000,commNet:72000},{date:"2026-02-16",nonCommNet:-72000,commNet:71000},{date:"2026-02-23",nonCommNet:-70000,commNet:69000},{date:"2026-03-02",nonCommNet:-69000,commNet:68000},{date:"2026-03-09",nonCommNet:-68300,commNet:67500},{date:"2026-03-16",nonCommNet:-67000,commNet:66000},{date:"2026-03-23",nonCommNet:-65000,commNet:64000},{date:"2026-03-30",nonCommNet:-63000,commNet:62000},{date:"2026-04-06",nonCommNet:-61000,commNet:60000},{date:"2026-04-13",nonCommNet:-59000,commNet:58000},{date:"2026-04-20",nonCommNet:-57000,commNet:56000},{date:"2026-04-28",nonCommNet:-55000,commNet:67500}] },
  { market:"AUSTRALIAN DOLLAR",currency:"AUD", date:"2026-04-28", nonCommLong:58300,  nonCommShort:91300,  commLong:94800,  commShort:57100,  retailLong:12300, retailShort:12100, nonCommNet:-33000, commNet:37700,  retailNet:200,
    history:[{date:"2026-01-26",nonCommNet:-45000,commNet:44000},{date:"2026-02-02",nonCommNet:-43000,commNet:42000},{date:"2026-02-09",nonCommNet:-41000,commNet:40000},{date:"2026-02-16",nonCommNet:-40000,commNet:39000},{date:"2026-02-23",nonCommNet:-38000,commNet:37000},{date:"2026-03-02",nonCommNet:-38000,commNet:37000},{date:"2026-03-09",nonCommNet:-37900,commNet:37700},{date:"2026-03-16",nonCommNet:-37000,commNet:36000},{date:"2026-03-23",nonCommNet:-36000,commNet:35000},{date:"2026-03-30",nonCommNet:-35000,commNet:34000},{date:"2026-04-06",nonCommNet:-35000,commNet:34000},{date:"2026-04-13",nonCommNet:-35000,commNet:34000},{date:"2026-04-20",nonCommNet:-34000,commNet:33000},{date:"2026-04-28",nonCommNet:-33000,commNet:37700}] },
  { market:"NEW ZEALAND DOLLAR",currency:"NZD",date:"2026-04-28", nonCommLong:17500,  nonCommShort:30300,  commLong:34100,  commShort:19900,  retailLong:4500,  retailShort:4500,  nonCommNet:-12800, commNet:14200,  retailNet:0,
    history:[{date:"2026-01-26",nonCommNet:-13000,commNet:13200},{date:"2026-02-02",nonCommNet:-13500,commNet:13700},{date:"2026-02-09",nonCommNet:-14000,commNet:14200},{date:"2026-02-16",nonCommNet:-14200,commNet:14400},{date:"2026-02-23",nonCommNet:-14500,commNet:14700},{date:"2026-03-02",nonCommNet:-14200,commNet:14400},{date:"2026-03-09",nonCommNet:-14200,commNet:14200},{date:"2026-03-16",nonCommNet:-14000,commNet:14200},{date:"2026-03-23",nonCommNet:-14000,commNet:14200},{date:"2026-03-30",nonCommNet:-13800,commNet:14000},{date:"2026-04-06",nonCommNet:-14000,commNet:14200},{date:"2026-04-13",nonCommNet:-13500,commNet:13700},{date:"2026-04-20",nonCommNet:-13000,commNet:13200},{date:"2026-04-28",nonCommNet:-12800,commNet:14200}] },
  { market:"GOLD",             currency:"XAU", date:"2026-04-28", nonCommLong:340800, nonCommShort:39800,  commLong:48200,  commShort:320700, retailLong:18400, retailShort:16600, nonCommNet:301000, commNet:-272500,retailNet:1800,
    history:[{date:"2026-01-26",nonCommNet:240000,commNet:-241000},{date:"2026-02-02",nonCommNet:245000,commNet:-246000},{date:"2026-02-09",nonCommNet:250000,commNet:-251000},{date:"2026-02-16",nonCommNet:255000,commNet:-256000},{date:"2026-02-23",nonCommNet:262000,commNet:-263000},{date:"2026-03-02",nonCommNet:268000,commNet:-269000},{date:"2026-03-09",nonCommNet:270700,commNet:-272500},{date:"2026-03-16",nonCommNet:275000,commNet:-276000},{date:"2026-03-23",nonCommNet:280000,commNet:-281000},{date:"2026-03-30",nonCommNet:285000,commNet:-286000},{date:"2026-04-06",nonCommNet:290000,commNet:-291000},{date:"2026-04-13",nonCommNet:295000,commNet:-296000},{date:"2026-04-20",nonCommNet:298000,commNet:-299000},{date:"2026-04-28",nonCommNet:301000,commNet:-272500}] },
  { market:"US DOLLAR INDEX",  currency:"USD", date:"2026-04-28", nonCommLong:21100,  nonCommShort:56100,  commLong:51400,  commShort:31200,  retailLong:6400,  retailShort:6500,  nonCommNet:-35000, commNet:20200,  retailNet:-100,
    history:[{date:"2026-01-26",nonCommNet:-5000,commNet:5000},{date:"2026-02-02",nonCommNet:-8000,commNet:8000},{date:"2026-02-09",nonCommNet:-12000,commNet:12000},{date:"2026-02-16",nonCommNet:-15000,commNet:15000},{date:"2026-02-23",nonCommNet:-18000,commNet:18000},{date:"2026-03-02",nonCommNet:-20000,commNet:20000},{date:"2026-03-09",nonCommNet:-20100,commNet:20200},{date:"2026-03-16",nonCommNet:-22000,commNet:22000},{date:"2026-03-23",nonCommNet:-25000,commNet:25000},{date:"2026-03-30",nonCommNet:-27000,commNet:27000},{date:"2026-04-06",nonCommNet:-29000,commNet:29000},{date:"2026-04-13",nonCommNet:-31000,commNet:31000},{date:"2026-04-20",nonCommNet:-33000,commNet:33000},{date:"2026-04-28",nonCommNet:-35000,commNet:20200}] },
];

// Merge live 1-week data with synthetic fallback history for a rich chart
function mergeWithFallbackHistory(liveReports: CotEntry[]): CotEntry[] {
  return liveReports.map((live) => {
    const fallback = COT_FALLBACK.find((f) => f.currency === live.currency);
    if (!fallback?.history || fallback.history.length <= 1) return live;
    // Keep all fallback history entries older than the live date, then add live
    const olderWeeks = fallback.history.filter((h) => h.date < live.date);
    const mergedHistory = [
      ...olderWeeks,
      { date: live.date, nonCommNet: live.nonCommNet, commNet: live.commNet },
    ].slice(-COT_HISTORY_WEEKS);
    return { ...live, history: mergedHistory };
  });
}

const CFTC_URLS = [
  "https://www.cftc.gov/dea/newcot/FinFutWk.txt",   // Settimanale (solo ultima settimana)
  "https://www.cftc.gov/dea/newcot/FinComWk.txt",   // Combined fallback
];

// Smart cache — porta la data del prossimo venerdì CFTC come scadenza
function nextCftcPublishMs(): number {
  const now = new Date();
  const day = now.getUTCDay(); // 0=dom, 5=ven
  const hour = now.getUTCHours() * 60 + now.getUTCMinutes();
  // CFTC pubblica ogni venerdì alle 15:30 EST = 20:30 UTC = 1230 minuti
  const daysToFriday = (5 - day + 7) % 7;
  const todayIsFridayAfterPublish = day === 5 && hour >= 1230;
  const daysUntilNext = todayIsFridayAfterPublish ? 7 : daysToFriday === 0 ? 7 : daysToFriday;
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + daysUntilNext);
  next.setUTCHours(20, 35, 0, 0);
  return next.getTime();
}

interface CotCache {
  data: CotEntry[];
  fetchedAt: number;
  expiresAt: number;
  fallback: boolean;
}
let cotCache: CotCache | null = null;

// ─── Socrata API (CFTC Public Reporting Portal) ───────────────────────────────
// Dataset: "Commitments of Traders - Legacy - Futures Only" (6dca-aqww).
// Endpoint pubblico, no auth. Espone le colonne legacy noncomm_/comm_/nonrept_ e
// include l'oro. A differenza dei file .txt settimanali (solo ultima settimana),
// restituisce storico reale multi-settimana per mercato in un'unica chiamata.
const SOCRATA_COT_URL = "https://publicreporting.cftc.gov/resource/6dca-aqww.json";

async function fetchCotFromSocrata(): Promise<CotEntry[] | null> {
  try {
    // Filtro server-side sui soli contratti base. starts_with('<KEY> - ') esclude i
    // cross-rate ("EURO FX/BRITISH POUND XRATE") e le varianti ("MICRO GOLD",
    // "GOLD -1 TROY OUNCE"), evitando sia l'attribuzione errata sia un payload enorme.
    const where = Object.keys(COT_MARKET_MAP)
      .map((k) => `starts_with(market_and_exchange_names, '${k} - ')`)
      .join(" OR ");

    const socrataUrl = new URL(SOCRATA_COT_URL);
    socrataUrl.searchParams.set("$where", where);
    socrataUrl.searchParams.set("$order", "report_date_as_yyyy_mm_dd DESC");
    socrataUrl.searchParams.set("$limit", "400");
    socrataUrl.searchParams.set("$select", [
      "market_and_exchange_names",
      "report_date_as_yyyy_mm_dd",
      "noncomm_positions_long_all",
      "noncomm_positions_short_all",
      "comm_positions_long_all",
      "comm_positions_short_all",
      "nonrept_positions_long_all",
      "nonrept_positions_short_all",
    ].join(","));

    const res = await fetch(socrataUrl.toString(), {
      headers: {
        "User-Agent": "TraderLoading/1.0",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.warn(`[tools/cot] Socrata HTTP ${res.status}`);
      return null;
    }

    type SocrataRow = {
      market_and_exchange_names: string;
      report_date_as_yyyy_mm_dd: string;
      noncomm_positions_long_all?: string;
      noncomm_positions_short_all?: string;
      comm_positions_long_all?: string;
      comm_positions_short_all?: string;
      nonrept_positions_long_all?: string;
      nonrept_positions_short_all?: string;
    };

    const rows: SocrataRow[] = await res.json() as SocrataRow[];
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const historyByMarket: Record<string, CotWeek[]> = {};

    for (const row of rows) {
      const currency = matchCotCurrency(row.market_and_exchange_names ?? "");
      if (!currency) continue;

      const date = row.report_date_as_yyyy_mm_dd?.slice(0, 10) ?? "";
      const ncLong  = parseInt(row.noncomm_positions_long_all  ?? "0") || 0;
      const ncShort = parseInt(row.noncomm_positions_short_all ?? "0") || 0;
      const commL   = parseInt(row.comm_positions_long_all     ?? "0") || 0;
      const commS   = parseInt(row.comm_positions_short_all    ?? "0") || 0;
      const nrL     = parseInt(row.nonrept_positions_long_all  ?? "0") || 0;
      const nrS     = parseInt(row.nonrept_positions_short_all ?? "0") || 0;

      if (!historyByMarket[currency]) historyByMarket[currency] = [];
      if (!historyByMarket[currency].some((w) => w.date === date)) {
        historyByMarket[currency].push({
          date, nonCommLong: ncLong, nonCommShort: ncShort,
          commLong: commL, commShort: commS,
          retailLong: nrL, retailShort: nrS,
          nonCommNet: ncLong - ncShort,
          commNet: commL - commS,
          retailNet: nrL - nrS,
        });
      }
    }

    if (Object.keys(historyByMarket).length === 0) return null;

    const results: CotEntry[] = Object.entries(historyByMarket).map(([currency, weeks]) => {
      weeks.sort((a, b) => b.date.localeCompare(a.date));
      const latest = weeks[0];
      const history = weeks.slice(0, COT_HISTORY_WEEKS).reverse().map((w) => ({
        date: w.date, nonCommNet: w.nonCommNet, commNet: w.commNet,
      }));
      const matchedKey = Object.keys(COT_MARKET_MAP).find((k) => COT_MARKET_MAP[k] === currency) ?? "";
      return { ...latest, market: matchedKey, currency, history };
    }).sort((a, b) => COT_ORDER.indexOf(a.currency) - COT_ORDER.indexOf(b.currency));

    console.info(`[tools/cot] Socrata OK — ${results.length} markets, ${results[0]?.history?.length ?? 0}wk history`);
    return results;
  } catch (err) {
    console.warn("[tools/cot] Socrata error:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Parser Legacy COT (deafut.txt) ──────────────────────────────────────────
// Formato Legacy senza header. Colonne confermate (0-indexed):
//   0  = Market name
//   2  = Date YYYY-MM-DD
//   7  = Open Interest All
//   8  = NonComm Long All    (Large Speculators)
//   9  = NonComm Short All
//  10  = NonComm Spread All
//  11  = Comm Long All       (Commercial Hedgers)
//  12  = Comm Short All
//  13  = Total Reportable Longs (derived)
//  14  = Total Reportable Shorts (derived)
//  15  = NonRept Long All
//  16  = NonRept Short All
function parseCotLegacyTxt(text: string, onlyCurrencies?: Set<string>): CotEntry[] {
  const lines = text.trim().split("\n");
  if (lines.length < 1) return [];

  const historyByMarket: Record<string, CotWeek[]> = {};

  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 17) continue;

    const currency = matchCotCurrency(cols[0] ?? "");
    if (!currency) continue;
    if (onlyCurrencies && !onlyCurrencies.has(currency)) continue;

    const date = cols[2] ?? "";
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) continue;

    const n = (i: number) => parseInt(cols[i]) || 0;
    const ncLong  = n(8);
    const ncShort = n(9);
    const commL   = n(11);
    const commS   = n(12);
    const nrL     = n(15);
    const nrS     = n(16);

    if (!historyByMarket[currency]) historyByMarket[currency] = [];
    if (!historyByMarket[currency].some((w) => w.date === date)) {
      historyByMarket[currency].push({
        date, nonCommLong: ncLong, nonCommShort: ncShort,
        commLong: commL, commShort: commS,
        retailLong: nrL, retailShort: nrS,
        nonCommNet: ncLong - ncShort,
        commNet: commL - commS,
        retailNet: nrL - nrS,
      });
    }
  }

  return Object.entries(historyByMarket)
    .map(([currency, weeks]) => {
      weeks.sort((a, b) => b.date.localeCompare(a.date));
      const latest = weeks[0];
      const history = weeks.slice(0, COT_HISTORY_WEEKS).reverse().map((w) => ({
        date: w.date, nonCommNet: w.nonCommNet, commNet: w.commNet,
      }));
      const matchedKey = Object.keys(COT_MARKET_MAP).find((k) => COT_MARKET_MAP[k] === currency) ?? "";
      return { ...latest, market: matchedKey, currency, history };
    })
    .sort((a, b) => COT_ORDER.indexOf(a.currency) - COT_ORDER.indexOf(b.currency));
}

const LEGACY_COT_URLS = [
  "https://www.cftc.gov/dea/newcot/deafut.txt",
];

// Recupera dai file .txt settimanali (solo l'ultima settimana) le sole valute
// passate in `onlyCurrencies`. deafut.txt = Legacy futures-only (FX + metalli);
// FinFutWk.txt = Financial Futures. Usato per coprire ciò che Socrata non espone.
async function fetchCotFromTxt(onlyCurrencies: Set<string>): Promise<CotEntry[]> {
  const out: CotEntry[] = [];
  const stillMissing = () =>
    new Set([...onlyCurrencies].filter((c) => !out.some((r) => r.currency === c)));

  for (const url of LEGACY_COT_URLS) {
    if (stillMissing().size === 0) break;
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; TraderLoading/1.0)" },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) { console.warn(`[tools/cot] ${url} → HTTP ${response.status}`); continue; }
      const text = await response.text();
      if (text.trim().startsWith("<!")) { console.warn(`[tools/cot] ${url} → HTML (blocked)`); continue; }
      for (const r of parseCotLegacyTxt(text, stillMissing())) {
        if (!out.some((x) => x.currency === r.currency)) out.push(r);
      }
    } catch (err) {
      console.warn(`[tools/cot] ${url} →`, err instanceof Error ? err.message : err);
    }
  }

  for (const url of CFTC_URLS) {
    if (stillMissing().size === 0) break;
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; TraderLoading/1.0)" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) { console.warn(`[tools/cot] ${url} → HTTP ${response.status}`); continue; }
      const text = await response.text();
      if (text.trim().startsWith("<!")) continue;
      const need = stillMissing();
      for (const r of parseCotTxt(text)) {
        if (need.has(r.currency) && !out.some((x) => x.currency === r.currency)) out.push(r);
      }
    } catch (err) {
      console.warn(`[tools/cot] ${url} →`, err instanceof Error ? err.message : err);
    }
  }

  return out;
}

async function fetchCotData(): Promise<void> {
  const now = Date.now();
  console.info("[tools/cot] Fetching CFTC data...");

  // 1. Sorgente primaria: Socrata Legacy Futures-Only — storico reale multi-settimana
  //    (12+ settimane) per EUR/GBP/JPY/CHF/CAD/AUD/XAU.
  const reports: CotEntry[] = (await fetchCotFromSocrata()) ?? [];

  // 2. Riempi le valute non coperte da Socrata (es. NZD, USD index) coi .txt settimanali.
  const covered = new Set(reports.map((r) => r.currency));
  const missing = new Set(COT_ORDER.filter((c) => !covered.has(c)));
  if (missing.size > 0) {
    for (const r of await fetchCotFromTxt(missing)) {
      if (!covered.has(r.currency)) { reports.push(r); covered.add(r.currency); }
    }
  }

  if (reports.length > 0) {
    // 3. Le voci con una sola settimana (dai .txt) ricevono storico sintetico; le
    //    valute prive di qualsiasi sorgente live usano il fallback statico.
    const enriched = reports.map((r) =>
      r.history.length > 1 ? r : (mergeWithFallbackHistory([r])[0] ?? r),
    );
    const present = new Set(enriched.map((r) => r.currency));
    const fallbackFill = COT_FALLBACK.filter((f) => !present.has(f.currency));
    const final = [...enriched, ...fallbackFill]
      .sort((a, b) => COT_ORDER.indexOf(a.currency) - COT_ORDER.indexOf(b.currency));
    const liveWithHistory = enriched.filter((r) => r.history.length > 1).length;
    cotCache = { data: final, fetchedAt: now, expiresAt: nextCftcPublishMs(), fallback: false };
    console.info(`[tools/cot] OK — ${enriched.length} live (${liveWithHistory} con storico reale) + ${fallbackFill.length} fallback, total ${final.length}`);
    return;
  }

  // 4. Tutte le sorgenti fallite — fallback statico hardcoded.
  console.info("[tools/cot] All sources failed — using static fallback");
  if (!cotCache) {
    cotCache = { data: COT_FALLBACK, fetchedAt: now, expiresAt: nextCftcPublishMs(), fallback: true };
  }
}

let activeCotFetch: Promise<void> | null = null;

function runCotFetch(): Promise<void> {
  activeCotFetch = fetchCotData().finally(() => {
    activeCotFetch = null;
  });
  return activeCotFetch;
}

// Cron: ogni venerdì alle 21:00 UTC (30 min dopo pubblicazione CFTC)
const cotTask = cron.schedule("0 21 * * 5", () => {
  console.info("[tools/cot] Cron triggered — fetching new COT data");
  runCotFetch().catch(onCotFetchError);
}, { timezone: "UTC" });

export const cotScheduler = {
  async close(): Promise<void> {
    cotTask.stop();
    cotTask.destroy();
    await activeCotFetch;
  },
};

// Fetch iniziale al boot del server
runCotFetch().catch(onCotFetchError);

router.get("/tools/cot", async (req, res) => {
  const now = Date.now();
  const isStale = cotCache ? now >= cotCache.expiresAt : true;

  if (!cotCache || isStale) {
    await runCotFetch();
  }

  const cache = cotCache!;
  const nextUpdate = new Date(cache.expiresAt).toLocaleDateString("it-IT", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });

  res.json({
    reports: cache.data,
    cached: !isStale,
    fallback: cache.fallback,
    fetchedAt: new Date(cache.fetchedAt).toISOString(),
    nextUpdate,
  });
});

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
const MACRO_NEWS_ASSET_CACHE_VERSION = "asset-impact-v2";
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

async function fetchMacroNews(
  currencyLabel: string,
  currenciesRaw = "",
  lang = "it",
  options: { forceRefresh?: boolean } = {},
): Promise<MacroNewsResult> {
  const pairs = pairsFromMacroCurrencies(currenciesRaw);
  const forceRefresh = options.forceRefresh === true;
  if (pairs) {
    try {
      const news = await withTimeout(
        getNewsData({ noCache: forceRefresh === true, pairs, lang }),
        NEWS_HUB_MACRO_TIMEOUT_MS,
        "NewsHub",
      );
      return macroNewsFromNewsHub(news, { pairs, lang }) as MacroNewsResult;
    } catch (err) {
      console.warn("[tools/macro-news] NewsHub timed out, falling back to RSS:", err instanceof Error ? err.message : String(err));
      return fetchMacroRSSFallback(currenciesRaw, lang);
    }
  }

  try {
    return await fetchMacroNewsGroq(currencyLabel, currenciesRaw, lang);
  } catch (err) {
    console.warn("[tools/macro-news] Groq failed, falling back to RSS:", err instanceof Error ? err.message : String(err));
    return fetchMacroRSSFallback(currenciesRaw, lang);
  }
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
  const key = `${MACRO_NEWS_ASSET_CACHE_VERSION}:${baseKey}:${lang}`;
  const forceRefresh = req.query.force === "1";

  const cached = macroNewsCache.get(key);
  if (!forceRefresh && cached && Date.now() < cached.expiresAt) {
    res.json(cached.data);
    return;
  }

  try {
    const result = ensureMacroDeepDive(await fetchMacroNews(label, currenciesInput, lang, { forceRefresh }), lang) as MacroNewsResult;
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
  const key = `${MACRO_NEWS_ASSET_CACHE_VERSION}:${baseKey}:${lang}`;

  const cached = macroNewsCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    res.json(cached.data);
    return;
  }

  try {
    const result = ensureMacroDeepDive(await fetchMacroNews(label, currencyInput, lang), lang) as MacroNewsResult;
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
