import assert from "node:assert/strict";
import {
  DEFAULT_WATCHLIST_PAIRS,
  buildTradingViewDeepLink,
  formatWatchlistPrice,
  mapCatalogPairToTradingViewSymbol,
  resolveWatchlistPairs,
  watchlistFreshness,
  type WatchlistItem,
} from "./tradingViewWatchlist";

// Finding 2.4: the widget always showed a pulsing "Live" badge even when the D1 data
// was hours/days stale. Freshness is derived from the newest bar time (unix seconds).
const item = (time: number | null): WatchlistItem => ({ pair: "EURUSD", price: 1, changePct: 0, spark: [], time, supported: true });
const NOW = 1_800_000_000_000; // fixed ms

// No usable bar time → not live.
assert.deepEqual(watchlistFreshness([], NOW), { latestBarMs: null, isLive: false });
assert.deepEqual(watchlistFreshness([item(null)], NOW), { latestBarMs: null, isLive: false });

// A bar within the max age is live; one well past it is not (but still surfaces its time).
const oneHourAgo = NOW / 1000 - 3600;
assert.equal(watchlistFreshness([item(oneHourAgo)], NOW).isLive, true);
const thirtyHoursAgo = NOW / 1000 - 30 * 3600;
const stale = watchlistFreshness([item(thirtyHoursAgo)], NOW);
assert.equal(stale.isLive, false);
assert.equal(stale.latestBarMs, thirtyHoursAgo * 1000);

// Freshness uses the NEWEST bar across items.
assert.equal(watchlistFreshness([item(thirtyHoursAgo), item(oneHourAgo)], NOW).isLive, true);

// resolveWatchlistPairs: favorites when present, else fall back to defaults
// (same convention as the rest of the dashboard via deriveEffectiveFilterItems).
assert.deepEqual(resolveWatchlistPairs(["EURUSD", "USDJPY"]), ["EURUSD", "USDJPY"]);
assert.deepEqual(resolveWatchlistPairs([]), DEFAULT_WATCHLIST_PAIRS);
// Unsupported-only selection also falls back to defaults
assert.deepEqual(resolveWatchlistPairs(["NOTAPAIR"]), DEFAULT_WATCHLIST_PAIRS);
// Mixed: keep the supported ones, drop the unsupported
assert.deepEqual(resolveWatchlistPairs(["XAUUSD", "NOTAPAIR"]), ["XAUUSD"]);
// Defaults are real catalog symbols
assert.ok(DEFAULT_WATCHLIST_PAIRS.length > 0);

// Forex → FX: prefix (majors, minors, exotics)
assert.equal(mapCatalogPairToTradingViewSymbol("EURUSD"), "FX:EURUSD");
assert.equal(mapCatalogPairToTradingViewSymbol(" eurusd "), "FX:EURUSD");
assert.equal(mapCatalogPairToTradingViewSymbol("USDMXN"), "FX:USDMXN");
assert.equal(mapCatalogPairToTradingViewSymbol("CHFJPY"), "FX:CHFJPY");

// Metals → OANDA:
assert.equal(mapCatalogPairToTradingViewSymbol("XAUUSD"), "OANDA:XAUUSD");
assert.equal(mapCatalogPairToTradingViewSymbol("XAGUSD"), "OANDA:XAGUSD");

// Indices → CAPITALCOM, with TradingView naming
assert.equal(mapCatalogPairToTradingViewSymbol("US30"), "CAPITALCOM:US30");
assert.equal(mapCatalogPairToTradingViewSymbol("NAS100"), "CAPITALCOM:US100");
assert.equal(mapCatalogPairToTradingViewSymbol("SPX500"), "CAPITALCOM:US500");

// Crypto → COINBASE:
assert.equal(mapCatalogPairToTradingViewSymbol("BTCUSD"), "COINBASE:BTCUSD");
assert.equal(mapCatalogPairToTradingViewSymbol("ETHUSD"), "COINBASE:ETHUSD");

// Fallbacks for symbols not in the catalog
assert.equal(mapCatalogPairToTradingViewSymbol("ZZZZZZ"), "FX:ZZZZZZ"); // 6-letter → assume forex
assert.equal(mapCatalogPairToTradingViewSymbol("FOO"), "FOO"); // not 6-letter → raw

// Deep link = TradingView universal chart URL with encoded symbol
assert.equal(
  buildTradingViewDeepLink("FX:EURUSD"),
  "https://www.tradingview.com/chart/?symbol=FX%3AEURUSD",
);
assert.equal(
  buildTradingViewDeepLink("OANDA:XAUUSD"),
  "https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD",
);

// Price formatting: decimals follow the pair-catalog category
assert.equal(formatWatchlistPrice("EURUSD", 1.084234), "1.08423"); // FX → 5
assert.equal(formatWatchlistPrice("USDJPY", 157.3312), "157.331"); // JPY-quoted → 3
assert.equal(formatWatchlistPrice("EURJPY", 169.1), "169.100"); // JPY-quoted minor → 3
assert.equal(formatWatchlistPrice("XAUUSD", 2329.4467), "2329.45"); // metal → 2
assert.equal(formatWatchlistPrice("US30", 39112.31), "39112.3"); // index → 1
assert.equal(formatWatchlistPrice("BTCUSD", 64123.55), "64124"); // crypto ≥1000 → 0
assert.equal(formatWatchlistPrice("ETHUSD", 934.234), "934.23"); // crypto <1000 → 2
assert.equal(formatWatchlistPrice("ZZZUSD", 1.23), "1.23000"); // unknown forex-shaped → 5

console.log("tradingView watchlist helper checks passed");
