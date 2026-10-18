import { cotForPair } from "./cotContext.js";
import type { CotOutlook, CotReport } from "./cot.js";
import { getPairEntry } from "@workspace/pair-catalog";
import type { Candle, CandlesResult } from "./candles.js";
import type { SentimentOutlook } from "./sentimentOutlook.js";
import type { NewsResponse } from "./newsHub/types.js";
import type { CalendarEvent } from "../routes/calendar.js";

// A descriptive, versioned model. These weights are hypotheses, not fitted odds.
export const CONTEXT_VERSION = "context-v2-experimental";
export type ContextComponent = {
  id: "price" | "news" | "retail" | "cot";
  weight: number;
  score: number | null;
  status: "available" | "unavailable" | "stale";
  reason: "source_unavailable" | "short_history" | "old_data" | "no_direction" | "not_configured" | null;
  source: string;
  fetchedAt: string | null;
  observedAt: string | null;
};
export type ContextEvidence = { title: string; url: string; source: string; publishedAt: string; direction: number; theme: "market" | "macro" | "geopolitics"; eventId?:string;sourceDocumentId?:string };
export interface MarketContext {
  pair: string;
  version: string;
  generatedAt: string;
  tradingDay: string;
  status: "warming" | "insufficient" | "partial" | "available";
  refreshing?: boolean;
  score: number | null;
  coverage: number;
  disagreement: boolean;
  components: ContextComponent[];
  news: ContextEvidence[];
  relatedNews?: Pick<ContextEvidence, "title" | "url" | "source" | "publishedAt">[];
  newsConsidered: number;
  calendarStatus: "available" | "unavailable";
  events: CalendarEvent[];
  rangePercent: number | null;
  price: number | null;
  priceChangePct: number | null;
  cotReports: CotReport[];
  priceHistory: { time: string; close: number }[];
  ranges: { days: number; samples: number; value: number | null }[];
}
export type ContextInputs = {
  candles?: CandlesResult;
  candlesFetchedAt?: string;
  sentiment?: SentimentOutlook;
  news?: NewsResponse;
  calendar?: CalendarEvent[];
  cot?: CotOutlook;
};

const DAY = 86_400_000;
const clamp = (n: number) => Math.max(-100, Math.min(100, n));
const positive = /\b(rises?|rising|rose|rall(?:y|ies|ied)|gains?|gained|surges?|surged|strengthens?|strengthened|climbs?|climbed|jumps?|jumped|higher)\b/i;
const negative = /\b(falls?|falling|fell|drops?|dropped|slips?|slipped|slumps?|slumped|weakens?|weakened|declines?|declined|lower)\b/i;
const ASSETS: Record<string, string> = {
  USD: "(?:us dollar|u\\.s\\. dollar|dollar|greenback)", EUR: "euro", GBP: "(?:pound|sterling)",
  JPY: "yen", CHF: "(?:swiss franc|franc)", AUD: "(?:australian dollar|aussie)", CAD: "(?:canadian dollar|loonie)",
  NZD: "(?:new zealand dollar|kiwi)", XAU: "gold", XAG: "silver", BTC: "bitcoin", ETH: "ethereum",
  NAS100: "(?:nasdaq|nas100)", SPX500: "(?:s&p 500|spx500)", US30: "(?:dow jones|dow|us30)",
};

/** Only explicit, English source headlines. Relevance/LLM confidence are never direction.
 * Conditional/negated claims abstain. Macro transmission is a declared v1 hypothesis.
 * Geopolitics contributes only when the headline states a move in a mapped asset.
 */
export function directionalHeadline(title: string, pair: string): { direction: number; theme: ContextEvidence["theme"] } | null {
  const entry = getPairEntry(pair);
  if (!entry || /\b(not|no|never|fails?|failed|unlikely|may|might|could|would|will|expected|forecast|forecasts|prediction|if|whether|miners?|mining|shares)\b|n['’]t\b|\?/i.test(title)) return null;
  const theme = /\b(war|conflict|geopolitic|ceasefire|missile|invasion|sanctions|military|tensions)\b/i.test(title) ? "geopolitics"
    : /\b(fed|ecb|boj|boe|rates?|yields?|inflation|cpi|gdp|payrolls?|employment|central bank)\b/i.test(title) ? "macro" : "market";
  const base = ["index"].includes(entry.category) ? pair : pair.slice(0, 3);
  const quote = entry.category === "index" ? null : pair.slice(3, 6);
  const polarity = (asset: string): number | null => {
    if (!ASSETS[asset]) return null;
    // Dollar alone means USD only if no other national dollar is named.
    if (asset === "USD" && /\b(australian|canadian|new zealand) dollar/i.test(title)) return null;
    const clause = new RegExp(`\\b${ASSETS[asset]}\\b([^,;:.]{0,45})`, "i").exec(title)?.[1];
    if (!clause) return null;
    const up = positive.test(clause), down = negative.test(clause);
    return up === down ? null : up ? 1 : -1;
  };
  const direct = polarity(base);
  if (quote && entry.category.startsWith("forex")) {
    const quoted = polarity(quote);
    if (direct !== null && quoted !== null) return direct === quoted ? null : { direction: direct, theme };
    if (direct !== null) return { direction: direct, theme };
    if (quoted !== null) return { direction: -quoted, theme };
  }
  if (direct !== null) return { direction: direct, theme };
  // Rates/yields affect XAUUSD or the USD leg of FX in this explicit hypothesis;
  // do not infer a direction for crypto, equity indices or a non-USD cross.
  const usdSign = pair === "XAUUSD" ? -1 : entry.category.startsWith("forex") && (base === "USD" || quote === "USD") ? (base === "USD" ? 1 : -1) : null;
  if (usdSign === null) return null;
  let rateDirection: number | null = null;
  const yields = /\b(?:us |u\.s\. )?treasury yields?\b([^,;:.]{0,40})/i.exec(title)?.[1];
  if (yields && positive.test(yields) !== negative.test(yields)) rateDirection = positive.test(yields) ? 1 : -1;
  if (/\bfed\b/i.test(title)) {
    const cut = /\b(?:rate cuts?|cuts? rates?|lowers? rates?)\b/i.test(title);
    const hike = /\b(?:rate hikes?|hikes? rates?|raises? rates?)\b/i.test(title);
    if (cut !== hike) rateDirection = hike ? 1 : -1;
  }
  return rateDirection === null ? null : { direction: usdSign * rateDirection, theme: "macro" };
}

function validCandle(c: Candle, now: number): boolean {
  return Number.isFinite(c.time) && c.time * 1000 <= now && [c.open, c.high, c.low, c.close].every(v => Number.isFinite(v) && v > 0) &&
    c.high >= Math.max(c.low, c.open, c.close) && c.low <= Math.min(c.open, c.close);
}
const ageValid = (stamp: string | null | undefined, now: number, maxAge: number) => {
  const ts = Date.parse(stamp ?? "");
  return Number.isFinite(ts) && ts <= now && now - ts <= maxAge;
};

export function buildMarketContext(pair: string, input: ContextInputs, now = new Date()): MarketContext {
  const time = now.getTime();
  const component = (id: ContextComponent["id"], weight: number, source: string): ContextComponent =>
    ({ id, weight, source, score: null, status: "unavailable", reason: "source_unavailable", fetchedAt: null, observedAt: null });
  const price = component("price", 35, input.candles?.source ?? "candles");
  const yahooProxy: Record<string, string> = { XAUUSD: "GC=F", XAGUSD: "SI=F", US30: "YM=F", NAS100: "NQ=F", SPX500: "ES=F" };
  if (price.source === "yahoo" && yahooProxy[pair]) price.source = `Yahoo · futures ${yahooProxy[pair]} (proxy)`;
  const news = component("news", 30, "NewsHub");
  const retail = component("retail", 15, "myfxbook");
  const cot = component("cot", 20, "CFTC · Legacy Futures Only");
  const cotReading = cotForPair(pair, input.cot, time);
  cot.fetchedAt = input.cot?.fetchedAt ?? null;
  cot.observedAt = cotReading.reports.length ? `${cotReading.reports[0].date}T00:00:00Z` : null;
  if(cotReading.score !== null) { cot.score=cotReading.score;cot.status="available";cot.reason=null; }
  else if(cotReading.reports.length) {cot.status="stale";cot.reason="old_data";}
  let priceHistory: MarketContext["priceHistory"] = [];
  let ranges: MarketContext["ranges"] = [];
  let rangePercent: number | null = null, currentPrice: number | null = null, priceChangePct: number | null = null;
  if (input.candles?.symbol === pair && input.candles.interval === "D1") {
    price.fetchedAt = input.candlesFetchedAt ?? null;
    const bars = [...new Map(input.candles.candles.filter(c => validCandle(c, time)).map(c => [c.time, c])).values()].sort((a, b) => a.time - b.time);
    const last = bars.at(-1);
    price.observedAt = last ? new Date(last.time * 1000).toISOString() : null;
    price.reason = "short_history";
    if (last && (input.candles.stale || price.observedAt?.slice(0, 10) !== now.toISOString().slice(0, 10) || !ageValid(price.fetchedAt, time, 15 * 60_000))) {
      price.status = "stale"; price.reason = "old_data";
    } else if (last && bars.length >= 22 && time - bars.at(-22)!.time * 1000 <= 60 * DAY && last.time - bars.at(-2)!.time <= 4 * 86_400) {
      const history = bars.slice(-22, -1);
      const atr = history.slice(1).reduce((sum, bar, i) => sum + Math.max(bar.high - bar.low, Math.abs(bar.high - history[i].close), Math.abs(bar.low - history[i].close)), 0) / 20;
      const adr = history.slice(1).reduce((sum, bar) => sum + bar.high - bar.low, 0) / 20;
      const previous = history.at(-1)!.close;
      if (atr > 0 && adr > 0) {
        price.score = Math.round(clamp((last.close - previous) / atr * 100)); price.status = "available"; price.reason = null;
        rangePercent = Math.round((last.high - last.low) / adr * 100);
        priceHistory = bars.slice(-30).map(c=>({time:new Date(c.time*1000).toISOString(),close:c.close}));
        const completed=bars.slice(0,-1);
        ranges=[5,22,66,132,252].map(days=>{
          const sample=completed.slice(-days);
          return {days,samples:sample.length,value:sample.length===days?sample.reduce((sum,c)=>sum+c.high-c.low,0)/days:null};
        });
        currentPrice = last.close; priceChangePct = (last.close / previous - 1) * 100;
      }
    }
  }
  if (input.sentiment) {
    const sentiment = input.sentiment;
    retail.fetchedAt = sentiment.fetchedAt; retail.observedAt = sentiment.observedAt;
    const symbol = sentiment.symbols.find(s => s.name === pair);
    if (sentiment.reason === "not_configured") retail.reason = "not_configured";
    else if (sentiment.status === "stale" || (sentiment.fetchedAt && !ageValid(sentiment.fetchedAt, time, 15 * 60_000))) { retail.status = "stale"; retail.reason = "old_data"; }
    else if (sentiment.status === "available" && !sentiment.fallback && symbol && ageValid(sentiment.fetchedAt, time, 15 * 60_000) &&
      Number.isFinite(symbol.longPercentage) && Number.isFinite(symbol.shortPercentage) && symbol.longPercentage >= 0 && symbol.shortPercentage >= 0 &&
      symbol.longPercentage <= 100 && symbol.shortPercentage <= 100 && Math.abs(symbol.longPercentage + symbol.shortPercentage - 100) <= 1) {
      retail.score = Math.round(clamp(symbol.longPercentage - symbol.shortPercentage)); retail.status = "available"; retail.reason = null;
    }
  }
  const evidence: ContextEvidence[] = [];
  const relatedNews: NonNullable<MarketContext["relatedNews"]> = [];
  const seenTitles = new Set<string>(), seenUrls = new Set<string>();
  if (input.news) {
    news.fetchedAt = input.news.fetchedAt;
    if (!ageValid(input.news.fetchedAt, time, 30 * 60_000)) { news.status = "stale"; news.reason = "old_data"; }
    else {
      news.reason = "no_direction";
      for (const article of [...input.news.articles].sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""))) {
        if (article.isFallback || !ageValid(article.publishedAt, time, DAY) || !article.url || !/^https?:\/\//i.test(article.url)) continue;
        const title = article.originalTitle || article.title;
        const titleKey = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        let url: URL;
        try { url = new URL(article.url); } catch { continue; }
        url.hash = ""; url.search = "";
        if (seenTitles.has(titleKey) || seenUrls.has(url.href)) continue;
        seenTitles.add(titleKey); seenUrls.add(url.href);
        relatedNews.push({ title: article.title, url: article.resolvedUrl ?? article.url, source: article.source, publishedAt: article.publishedAt! });
        const result = directionalHeadline(title, pair);
        if (result) evidence.push({ title: article.title, eventId:article.eventId,sourceDocumentId:article.sourceDocumentId,url: article.resolvedUrl ?? article.url, source: article.source, publishedAt: article.publishedAt!, ...result });
      }
      // A single headline is not a news component. Lack of scored news isn't neutral.
      if (evidence.length >= 2) {
        let total = 0, weights = 0;
        for (const e of evidence.slice(0, 30)) {
          const weight = Math.exp(-(time - Date.parse(e.publishedAt)) / (6 * 3_600_000));
          total += e.direction * weight; weights += weight;
        }
        news.score = Math.round(clamp(100 * total / weights)); news.status = "available"; news.reason = null;
        news.observedAt = evidence[0].publishedAt;
      }
    }
  }
  const components = [price, news, retail, cot];
  const available = components.filter(c => c.status === "available" && c.score !== null);
  const coverage = available.reduce((sum, c) => sum + c.weight, 0);
  const canScore = price.status === "available" && available.length >= 2;
  const score = canScore ? Math.round(available.reduce((sum, c) => sum + c.score! * c.weight, 0) / coverage) : null;
  const currencies = getPairEntry(pair)?.currencies ?? [];
  return {
    pair, version: CONTEXT_VERSION, generatedAt: now.toISOString(),
    tradingDay: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(now),
    status: !canScore ? "insufficient" : coverage === 100 ? "available" : "partial", score, coverage,
    disagreement: available.some(c => c.score! > 15) && available.some(c => c.score! < -15),
    components, news: evidence.slice(0, 6), relatedNews: relatedNews.slice(0, 6), newsConsidered: Math.min(evidence.length, 30),
    calendarStatus: input.calendar ? "available" : "unavailable",
    events: (input.calendar ?? []).filter(e => currencies.includes(e.country) && e.impact === "High" && Date.parse(e.date) >= time && Date.parse(e.date) <= time + DAY)
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date)).slice(0, 3),
    cotReports: cotReading.reports, priceHistory, ranges,
    rangePercent, price: currentPrice, priceChangePct,
  };
}
