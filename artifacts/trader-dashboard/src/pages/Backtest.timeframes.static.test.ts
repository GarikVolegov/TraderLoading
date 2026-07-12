import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Session creation offers the full ladder; the replay terminal serves the
// warehouse-backed M1→D1 set (W1/M30 sessions open on the H1 fallback).
const backtest = readFileSync(new URL("./Backtest.tsx", import.meta.url), "utf8");
const engine = readFileSync(
  new URL("../components/backtest-terminal/useReplayEngine.ts", import.meta.url),
  "utf8",
);

assert.match(backtest, /const TIMEFRAMES = \["M5", "M15", "M30", "H1", "H4", "D1", "W1"\]/);
assert.match(engine, /REPLAY_TIMEFRAMES = \["M1", "M5", "M15", "H1", "H4", "D1"\] as const/);

console.log("backtest timeframe checks passed");
