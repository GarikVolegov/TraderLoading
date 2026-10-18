import { parseCotRows } from "./cot.js";
import assert from "node:assert/strict";
import { GetMarketContextResponse } from "@workspace/api-zod";
import { buildMarketContext, directionalHeadline, type ContextInputs } from "./marketContext.js";

const now = new Date("2026-09-24T12:00:00Z");
const midnight = Date.parse("2026-09-24T00:00:00Z") / 1000;
const candles = Array.from({ length: 22 }, (_, i) => ({ time: midnight - (21 - i) * 86400, open: 1.1, close: i === 21 ? 1.105 : 1.1, high: 1.11, low: 1.09 }));
const input: ContextInputs = {
  candles: { symbol: "EURUSD", interval: "D1", source: "fixture", candles }, candlesFetchedAt: now.toISOString(),
  sentiment: { status: "available", source: "myfxbook", fetchedAt: now.toISOString(), observedAt: null, reason: null, live: true, cached: false, fallback: false, hasCredentials: true,
    symbols: [{ name: "EURUSD", longPercentage: 60, shortPercentage: 40, longPositions: 6, shortPositions: 4, longVolume: 6, shortVolume: 4 }] },
  news: { fetchedAt: now.toISOString(), hasApiKey: false, source: "rss", articles: ["Euro rises on stronger demand", "US dollar falls after data"].map((title, i) => ({ title, summary: "", source: `source${i}`, url: `https://example.test/${i}`, publishedAt: now.toISOString(), sentiment: "bearish", impactDirection: "bearish", imageUrl: null })) },
  cot: { status:"available", source:"CFTC", fetchedAt:now.toISOString(), cached:false, fallback:false, nextUpdate:now.toISOString(), reports:parseCotRows([{market_and_exchange_names:"EURO FX - CME",report_date_as_yyyy_mm_dd:"2026-09-15",noncomm_positions_long_all:"70",noncomm_positions_short_all:"30",comm_positions_long_all:"20",comm_positions_short_all:"30",nonrept_positions_long_all:"20",nonrept_positions_short_all:"30"}],now.toISOString()) },
  calendar: [{ title: "US event", country: "USD", impact: "High", date: "2026-09-24T13:00:00Z", forecast: null, previous: null }, { title: "JPY event", country: "JPY", impact: "High", date: "2026-09-24T13:00:00Z", forecast: null, previous: null }],
};
const full = buildMarketContext("EURUSD", input, now);
assert.equal(full.score, 50); // round(25*.35 + 100*.30 + 20*.15 + 40*.20)
assert.equal(full.coverage, 100);
assert.equal(full.status, "available");
assert.equal(full.events.length, 1);
assert.equal(full.rangePercent, 100);
assert.equal(full.components[1].score, 100, "ignore the legacy classifier's supplied bearish direction");
GetMarketContextResponse.parse(full);
const informationalNews = buildMarketContext("EURUSD", { ...input, news: { ...input.news!, articles: [{ ...input.news!.articles[0], title: "Fed may cut rates", url: "https://example.test/scenario" }] } }, now);
assert.equal(informationalNews.relatedNews?.length, 1, "relevant headlines without a direction remain readable");
assert.equal(informationalNews.news.length, 0, "readable news never invents a directional contribution");
assert.equal(informationalNews.components[1].score, null);
GetMarketContextResponse.parse(informationalNews);

for (const [title, direction] of [["US Treasury yields rise", -1], ["US Treasury yields fall", 1], ["Fed signals a rate cut", 1], ["Fed signals a rate hike", -1]] as const) {
  assert.equal(directionalHeadline(title, "XAUUSD")?.direction, direction);
}
assert.equal(directionalHeadline("US dollar rises", "EURUSD")?.direction, -1);
assert.equal(directionalHeadline("US dollar rises", "USDJPY")?.direction, 1);
assert.equal(directionalHeadline("US Treasury yields rise", "EURJPY"), null);
assert.equal(directionalHeadline("Fed may cut rates", "XAUUSD"), null);
assert.equal(directionalHeadline("Gold does not rise", "XAUUSD"), null);
assert.equal(directionalHeadline("War escalates", "XAUUSD"), null, "geopolitical relevance alone has no sign");
assert.equal(directionalHeadline("Gold rises as war escalates", "XAUUSD")?.theme, "geopolitics");
assert.equal(directionalHeadline("Gold miners rise", "XAUUSD"), null);
assert.equal(directionalHeadline("Australian dollar rises", "EURUSD"), null);
assert.equal(directionalHeadline("Gold falls then rises", "XAUUSD"), null);
assert.equal(directionalHeadline("Gold fails to rise", "XAUUSD"), null);
assert.equal(directionalHeadline("Gold doesn't rise", "XAUUSD"), null);
assert.equal(directionalHeadline("Euro rises; US dollar rises", "EURUSD"), null, "two appreciating currencies do not imply a relative direction");

const onlyPrice = buildMarketContext("EURUSD", { candles: input.candles, candlesFetchedAt: input.candlesFetchedAt }, now);
assert.equal(onlyPrice.score, null); assert.equal(onlyPrice.coverage, 35);
const partial = buildMarketContext("EURUSD", { ...input, news: undefined }, now);
assert.equal(partial.status, "partial"); assert.equal(partial.coverage, 70); assert.equal(partial.score, 28);
const outage = buildMarketContext("EURUSD", {}, now);
assert.equal(outage.score, null); assert.equal(outage.rangePercent, null); assert.equal(outage.calendarStatus, "unavailable");
GetMarketContextResponse.parse(outage);
assert.equal(buildMarketContext("EURUSD", input, new Date("2026-09-25T00:00:00Z")).score, null);
assert.equal(buildMarketContext("GBPUSD", input, now).score, null, "never use another pair's candle series");
assert.equal(buildMarketContext("EURUSD", { ...input, candles: { ...input.candles!, stale: true } }, now).score, null, "failed price refresh excludes cached prices even within the current day");
const zeroBars = candles.map((c, i) => i === 21 ? { ...c, open: 1.1, high: 1.1, low: 1.1, close: 1.1 } : c);
const zero = buildMarketContext("EURUSD", { ...input, candles: { ...input.candles!, candles: zeroBars } }, now);
assert.equal(zero.rangePercent, 0); assert.equal(zero.components[0].score, 0);
const duplicateNews = { ...input.news!, articles: [input.news!.articles[0], { ...input.news!.articles[0], url: "https://another.test/story" }] };
assert.equal(buildMarketContext("EURUSD", { ...input, news: duplicateNews }, now).components[1].score, null);
const oldNews = { ...input.news!, articles: input.news!.articles.map(a => ({ ...a, publishedAt: "2026-09-22T00:00:00Z" })) };
assert.equal(buildMarketContext("EURUSD", { ...input, news: oldNews }, now).components[1].score, null);
const futureNews = { ...input.news!, articles: input.news!.articles.map(a => ({ ...a, publishedAt: "2026-09-25T00:00:00Z" })) };
assert.equal(buildMarketContext("EURUSD", { ...input, news: futureNews }, now).components[1].score, null);
assert.equal(buildMarketContext("EURUSD", { ...input, news: futureNews }, now).relatedNews?.length, 0);
assert.equal(buildMarketContext("EURUSD", { ...input, news: { ...input.news!, fetchedAt: "2026-09-23T12:00:00Z" } }, now).relatedNews?.length, 0, "stale fetches cannot masquerade as live news");
const short = buildMarketContext("EURUSD", { ...input, candles: { ...input.candles!, candles: candles.slice(-5) } }, now);
assert.equal(short.score, null);
const conflict = buildMarketContext("EURUSD", { ...input, sentiment: { ...input.sentiment!, symbols: [{ ...input.sentiment!.symbols[0], longPercentage: 20, shortPercentage: 80 }] } }, now);
assert.equal(conflict.disagreement, true);
assert.equal(buildMarketContext("EURUSD", {}, new Date("2026-09-24T22:30:00Z")).tradingDay, "2026-09-25");
console.log("market context: direction, coverage, zero, provenance and contract checks passed");
