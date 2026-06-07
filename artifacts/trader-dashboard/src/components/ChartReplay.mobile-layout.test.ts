import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chartReplay = readFileSync("src/components/ChartReplay.tsx", "utf8");
const backtestPage = readFileSync("src/pages/Backtest.tsx", "utf8");
const brainPage = readFileSync("src/pages/Brain.tsx", "utf8");

assert.match(chartReplay, /data-testid="chart-replay"/);
assert.match(chartReplay, /min-h-\[320px\] sm:min-h-\[420px\]/);
assert.match(chartReplay, /flex-col sm:flex-row/);
assert.match(chartReplay, /grid-cols-2 sm:grid-cols-4/);
assert.match(chartReplay, /group\/trade/);
assert.doesNotMatch(chartReplay, /getPipDollarValue\(trade\.direction/);

assert.match(backtestPage, /min-w-0 overflow-hidden/);
assert.match(backtestPage, /grid-cols-1 min-\[420px\]:grid-cols-2 sm:grid-cols-3/);
assert.match(backtestPage, /opacity-100 sm:opacity-0/);
assert.match(backtestPage, /persistenceKey=\{`backtest-session-\$\{session\.id\}`\}/);

assert.match(brainPage, /grid-cols-1 xl:grid-cols-\[minmax\(0,1fr\)_360px\]/);
assert.match(brainPage, /w-full sm:w-auto/);

console.log("mobile backtest layout checks passed");
