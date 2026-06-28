import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_TRADING_VIEW_WATCHLIST_SYMBOLS,
  TRADING_VIEW_WATCHLIST_STORAGE_KEY,
  buildTradingViewChartUrl,
  buildTradingViewMiniSymbolConfig,
  normalizeTradingViewSymbol,
  normalizeTradingViewWatchlistSettings,
  suggestTradingViewSymbols,
  tradingViewWatchlistStorage,
} from "./TradingViewWatchlistWidget";

assert.equal(TRADING_VIEW_WATCHLIST_STORAGE_KEY, "tl_tradingview_watchlist_symbols_v1");
assert.deepEqual(DEFAULT_TRADING_VIEW_WATCHLIST_SYMBOLS, ["FX:EURUSD", "OANDA:XAUUSD", "FX:GBPUSD"]);

assert.equal(normalizeTradingViewSymbol(" fx:eurusd "), "FX:EURUSD");
assert.equal(normalizeTradingViewSymbol("oanda:xauusd"), "OANDA:XAUUSD");
assert.equal(normalizeTradingViewSymbol("EURUSD"), null);
assert.equal(normalizeTradingViewSymbol("FX:"), null);

assert.deepEqual(
  normalizeTradingViewWatchlistSettings({
    symbols: [" fx:eurusd ", "bad", "OANDA:XAUUSD", "FX:EURUSD"],
  }),
  {
    symbols: ["FX:EURUSD", "OANDA:XAUUSD"],
    invalidSymbols: ["bad"],
  },
);

assert.deepEqual(normalizeTradingViewWatchlistSettings(null), {
  symbols: DEFAULT_TRADING_VIEW_WATCHLIST_SYMBOLS,
  invalidSymbols: [],
});

const config = buildTradingViewMiniSymbolConfig("FX:EURUSD");
assert.equal(config.colorTheme, "dark");
assert.equal(config.locale, "it");
assert.equal(config.isTransparent, true);
assert.equal(config.symbol, "FX:EURUSD");
assert.equal(config.width, "100%");
assert.equal(config.dateRange, "1D");
assert.equal(config.autosize, true);

assert.equal(
  buildTradingViewChartUrl("OANDA:XAUUSD"),
  "https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD",
);

assert.deepEqual(
  suggestTradingViewSymbols("eurusd").map((item) => item.symbol).slice(0, 4),
  ["FX:EURUSD", "OANDA:EURUSD", "FOREXCOM:EURUSD", "CAPITALCOM:EURUSD"],
);
assert.ok(suggestTradingViewSymbols("eurusd").length >= 14);
assert.ok(suggestTradingViewSymbols("eurusd").some((item) => item.symbol === "PEPPERSTONE:EURUSD"));
assert.ok(suggestTradingViewSymbols("eurusd").some((item) => item.symbol === "ICMARKETS:EURUSD"));
assert.ok(suggestTradingViewSymbols("eurusd").some((item) => item.symbol === "SAXO:EURUSD"));
assert.deepEqual(
  suggestTradingViewSymbols("xau").map((item) => item.symbol).slice(0, 3),
  ["OANDA:XAUUSD", "FXOPEN:XAUUSD", "FOREXCOM:XAUUSD"],
);
assert.ok(suggestTradingViewSymbols("xauusd").some((item) => item.symbol === "PEPPERSTONE:XAUUSD"));
assert.ok(suggestTradingViewSymbols("pepper eurusd").some((item) => item.symbol === "PEPPERSTONE:EURUSD"));
assert.ok(suggestTradingViewSymbols("fpmarket xauusd").some((item) => item.symbol === "FPMARKETS:XAUUSD"));
assert.ok(suggestTradingViewSymbols("black bull eurusd").some((item) => item.symbol === "BLACKBULL:EURUSD"));

const store: Record<string, string> = {};
const storage: Storage = {
  get length() {
    return Object.keys(store).length;
  },
  clear() {
    for (const key of Object.keys(store)) delete store[key];
  },
  getItem(key) {
    return store[key] ?? null;
  },
  key(index) {
    return Object.keys(store)[index] ?? null;
  },
  removeItem(key) {
    delete store[key];
  },
  setItem(key, value) {
    store[key] = value;
  },
};

tradingViewWatchlistStorage.save({ symbols: ["nasdaq:aapl", "invalid"] }, storage);
assert.deepEqual(tradingViewWatchlistStorage.load(storage), {
  symbols: ["NASDAQ:AAPL"],
  invalidSymbols: [],
});

const source = readFileSync(new URL("./TradingViewWatchlistWidget.tsx", import.meta.url), "utf8");
assert.match(source, /embed-widget-mini-symbol-overview\.js/);
assert.doesNotMatch(source, /embed-widget-market-quotes\.js/);
assert.doesNotMatch(source, /embed-widget-single-quote\.js/);
assert.match(source, /auto\.ui\.33357d724e/);
assert.match(source, /tradingview\.watchlist\.suggestions/);
assert.match(source, /max-h-\[min\(720px,calc\(100dvh-2rem\)\)\]/);
assert.match(source, /max-h-\[280px\]/);
assert.match(source, /TradingViewWatchlistSettings/);
assert.match(source, /onerror/);
assert.match(source, /href=\{buildTradingViewChartUrl\(symbol\)\}/);
assert.match(source, /target="_blank"/);
assert.match(source, /h-\[116px\]/);
assert.match(source, /tradingview\.watchlist\.live/);

console.log("tradingview watchlist widget checks passed");
