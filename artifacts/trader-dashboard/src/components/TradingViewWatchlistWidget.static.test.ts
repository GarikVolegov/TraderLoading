import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./TradingViewWatchlistWidget.tsx", import.meta.url), "utf8");

// Live mini-embed retained, other embed kinds still excluded
assert.match(source, /embed-widget-mini-symbol-overview\.js|TRADING_VIEW_MINI_SYMBOL_SCRIPT/);
assert.doesNotMatch(source, /embed-widget-market-quotes\.js/);
assert.doesNotMatch(source, /embed-widget-single-quote\.js/);

// Driven by favorites from the shared context, not a local list
assert.match(source, /useBackground\(\)/);
assert.match(source, /selectedPairs/);

// Manual editor / localStorage list fully removed
assert.doesNotMatch(source, /tl_tradingview_watchlist_symbols_v1/);
assert.doesNotMatch(source, /SymbolEditorDialog/);
assert.doesNotMatch(source, /tradingViewWatchlistStorage/);
assert.doesNotMatch(source, /suggestTradingViewSymbols/);

// Pure helpers imported from the dedicated module
assert.match(source, /from "\.\/tradingViewWatchlist"/);
assert.match(source, /mapCatalogPairToTradingViewSymbol/);
assert.match(source, /buildTradingViewDeepLink/);

// Tap → deep link; mobile same-tab for app handoff, desktop new tab
assert.match(source, /href=\{buildTradingViewDeepLink\(/);
assert.match(source, /isMobile \? "_self" : "_blank"/);

// Gear → favorites settings shortcut
assert.match(source, /\/settings\?section=pairs/);
assert.match(source, /tradingview\.watchlist\.manage/);

// New empty-state copy
assert.match(source, /tradingview\.watchlist\.empty_title/);
assert.match(source, /tradingview\.watchlist\.choose_pairs/);

// LIVE badge retained
assert.match(source, /tradingview\.watchlist\.live/);

console.log("tradingview watchlist widget structure checks passed");
