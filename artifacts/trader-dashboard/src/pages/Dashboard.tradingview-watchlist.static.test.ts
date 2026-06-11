import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./Dashboard.tsx", import.meta.url), "utf8");

assert.match(source, /import \{ TradingViewWatchlistWidget \} from "@\/components\/TradingViewWatchlistWidget";/);
assert.match(
  source,
  /\{\s*id: "tradingview-watchlist",\s*label: "Watchlist Realtime",\s*icon: Activity,\s*component: TradingViewWatchlistWidget\s*\}/s,
);
assert.match(
  source,
  /const DEFAULT_ORDER = \[\s*"clock",\s*"quote",\s*"tradingview-watchlist",\s*"account",/s,
);

console.log("dashboard tradingview watchlist registry checks passed");
