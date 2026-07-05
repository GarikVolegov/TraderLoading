import assert from "node:assert/strict";
import { parseMonteCarloParams } from "./monteCarloParams.js";

// Defaults when the body is empty or garbage.
const d = parseMonteCarloParams({});
assert.equal(d.numTrades, 100);
assert.equal(d.simCount, 50);
assert.equal(d.winrate, 0.55);
assert.equal(d.avgR, 1.5);
assert.equal(d.lossR, 1);
assert.equal(d.riskPercent, 1);
assert.equal(d.initialBalance, 10000);

// Findings 0.7 + 2.8: numTrades (inner loop) and simCount are clamped so a huge
// request can't spin the CPU / allocate unbounded curves. Total work <= 200 * 1000.
const huge = parseMonteCarloParams({ numTrades: 1e9, simCount: 999999 });
assert.equal(huge.numTrades, 1000);
assert.equal(huge.simCount, 200);

// Winrate accepts 0-100 or 0-1 and is bounded to 0..1.
assert.equal(parseMonteCarloParams({ winrate: 70 }).winrate, 0.7);
assert.equal(parseMonteCarloParams({ winrate: 0.4 }).winrate, 0.4);
assert.equal(parseMonteCarloParams({ winrate: 250 }).winrate, 1);

// Non-numeric / NaN / negative never yield NaN — they clamp or fall back.
assert.equal(parseMonteCarloParams({ numTrades: "abc" }).numTrades, 100);
assert.equal(parseMonteCarloParams({ numTrades: -5 }).numTrades, 1);
assert.equal(parseMonteCarloParams({ simCount: NaN }).simCount, 50);
assert.equal(parseMonteCarloParams(null).numTrades, 100);
assert.equal(parseMonteCarloParams({ initialBalance: 0 }).initialBalance, 1);

// String numbers (JSON bodies often arrive stringified) are coerced.
assert.equal(parseMonteCarloParams({ numTrades: "250" }).numTrades, 250);
// Integer fields are rounded.
assert.equal(parseMonteCarloParams({ numTrades: 12.7 }).numTrades, 13);

console.log("monte carlo params checks passed");
