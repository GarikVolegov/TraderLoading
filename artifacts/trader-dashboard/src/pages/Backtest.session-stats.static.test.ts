import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const backtest = readFileSync(new URL("./Backtest.tsx", import.meta.url), "utf8");

assert.match(backtest, /session\.stats/);
assert.match(backtest, /Win Rate/);
assert.match(backtest, /R:R/);
assert.match(backtest, /Profitto/);
assert.match(backtest, /totalPips/);

console.log("backtest session card stats checks passed");
