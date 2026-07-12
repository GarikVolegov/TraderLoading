import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./Dashboard.tsx", import.meta.url), "utf8");

assert.match(source, /import \{ TradingViewWatchlistWidget \} from "@\/components\/TradingViewWatchlistWidget";/);
assert.match(
  source,
  /\{\s*id: "tradingview-watchlist",\s*labelKey: "auto\.ui\.b97144823c",\s*icon: Activity,\s*component: TradingViewWatchlistWidget\s*\}/s,
);
assert.match(
  readFileSync(new URL("../lib/i18n/dict.it.ts", import.meta.url), "utf8"),
  /"auto\.ui\.b97144823c":\s*"Watchlist Realtime"/,
);
assert.match(
  source,
  /const DEFAULT_ORDER = \[\s*"quote",\s*"tradingview-watchlist",\s*"account",/s,
);

console.log("dashboard tradingview watchlist registry checks passed");
