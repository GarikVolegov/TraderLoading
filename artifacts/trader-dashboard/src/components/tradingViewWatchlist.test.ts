import assert from "node:assert/strict";
import {
  DEFAULT_WATCHLIST_PAIRS,
  TRADING_VIEW_MINI_SYMBOL_SCRIPT,
  buildTradingViewDeepLink,
  buildTradingViewMiniSymbolConfig,
  mapCatalogPairToTradingViewSymbol,
  resolveWatchlistPairs,
} from "./tradingViewWatchlist";

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

// Mini-symbol embed config unchanged behaviour
const config = buildTradingViewMiniSymbolConfig("FX:EURUSD");
assert.equal(config.symbol, "FX:EURUSD");
assert.equal(config.colorTheme, "dark");
assert.equal(config.locale, "it");
assert.equal(config.isTransparent, true);
assert.equal(config.width, "100%");
assert.equal(config.dateRange, "1D");
assert.equal(config.autosize, true);

assert.match(TRADING_VIEW_MINI_SYMBOL_SCRIPT, /embed-widget-mini-symbol-overview\.js/);

console.log("tradingView watchlist helper checks passed");
