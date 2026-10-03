import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./TradingViewWatchlistWidget.tsx", import.meta.url), "utf8");

// Claude Design sparkline rows — no TradingView embed/iframe machinery remains
assert.doesNotMatch(source, /embed-widget/);
assert.doesNotMatch(source, /TRADING_VIEW_MINI_SYMBOL_SCRIPT/);
assert.doesNotMatch(source, /buildTradingViewMiniSymbolConfig/);
assert.doesNotMatch(source, /tradingview-widget-container/);

// Data: single batched /tools/watchlist query, polled (daily closes → sparkline)
assert.match(source, /useQuery/);
assert.match(source, /apiFetch<WatchlistResponse>/);
assert.match(source, /\/api\/tools\/watchlist\?pairs=/);
assert.match(source, /refetchInterval/);

// Kit row: Sparkline primitive, tone by daily change sign, price + change %
assert.match(source, /<Sparkline\b/);
assert.match(source, /tone=/);
assert.match(source, /formatWatchlistPrice\(/);
assert.match(source, /text-success/);
assert.match(source, /text-destructive/);
assert.match(source, /tabular-nums/);

// Driven by favorites from the shared context, never empty
assert.match(source, /useBackground\(\)/);
assert.match(source, /selectedPairs/);
assert.match(source, /resolveWatchlistPairs/);
assert.match(source, /pairs\.map\(/);

// Whole row is the TradingView deep link; mobile same-tab for app handoff
assert.match(source, /href=\{buildTradingViewDeepLink\(/);
assert.match(source, /mapCatalogPairToTradingViewSymbol/);
assert.match(source, /isMobile \? "_self" : "_blank"/);
assert.match(source, /tradingview\.watchlist\.open_aria/);

// Loading skeletons + error banner with retry
assert.match(source, /<Skeleton\b/);
assert.match(source, /tradingview\.watchlist\.error/);
assert.match(source, /refetch/);

// Chrome kept: LIVE badge + gear → favorites settings
assert.match(source, /tradingview\.watchlist\.live/);
assert.match(source, /\/settings\?section=pairs/);
assert.match(source, /tradingview\.watchlist\.manage/);

// All copy through uiText (i18n discipline)
assert.match(source, /uiText\("tradingview\.watchlist\.daily"\)/);

console.log("tradingview watchlist widget structure checks passed");
