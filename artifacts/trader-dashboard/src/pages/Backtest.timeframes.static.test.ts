import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const backtest = readFileSync(new URL("./Backtest.tsx", import.meta.url), "utf8");
const chartReplay = readFileSync(new URL("../components/ChartReplay.tsx", import.meta.url), "utf8");

const expected = /const TIMEFRAMES = \["M5", "M15", "M30", "H1", "H4", "D1", "W1"\]/;

assert.match(backtest, expected);
assert.match(chartReplay, expected);

console.log("backtest timeframe checks passed");
