import assert from "node:assert/strict";
import { atr, bollinger, ema, macd, rsi, sma, stochastic, wma } from "./chartIndicatorEngine.js";

const approx = (a: number | null, b: number, eps = 1e-9) =>
  a != null && Math.abs(a - b) < eps;

// ── SMA ──────────────────────────────────────────────────────────────────────
assert.deepEqual(sma([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);

// ── WMA (linear weights, latest heaviest) ────────────────────────────────────
{
  // wma([1,2,3], 3) = (1·1 + 2·2 + 3·3) / 6 = 14/6
  const w = wma([1, 2, 3, 4, 5], 3);
  assert.equal(w[0], null);
  assert.equal(w[1], null);
  assert.ok(approx(w[2], 14 / 6));
  assert.ok(approx(w[3], (2 * 1 + 3 * 2 + 4 * 3) / 6));
  assert.ok(approx(w[4], (3 * 1 + 4 * 2 + 5 * 3) / 6));
  assert.deepEqual(wma([1, 2], 0), [null, null], "degenerate period");
}

// ── EMA (SMA-seeded) ─────────────────────────────────────────────────────────
{
  const e = ema([1, 2, 3, 4, 5], 3); // seed mean(1,2,3)=2; k=0.5
  assert.equal(e[1], null);
  assert.ok(approx(e[2], 2) && approx(e[3], 3) && approx(e[4], 4));
}

// ── RSI: monotonic extremes ──────────────────────────────────────────────────
{
  const up = rsi([1, 2, 3, 4, 5, 6], 3);
  assert.equal(up[2], null, "warm-up before index = period");
  assert.equal(up[3], 100, "all gains → RSI 100");
  const down = rsi([6, 5, 4, 3, 2, 1], 3);
  assert.equal(down[3], 0, "all losses → RSI 0");
  // mixed stays within bounds
  for (const v of rsi([1, 3, 2, 4, 3, 5, 4, 6], 3)) {
    if (v != null) assert.ok(v >= 0 && v <= 100);
  }
}

// ── Bollinger: zero variance ─────────────────────────────────────────────────
{
  const b = bollinger([5, 5, 5, 5, 5], 3);
  assert.equal(b[1], null);
  assert.deepEqual(b[4], { middle: 5, upper: 5, lower: 5 });
}

// ── ATR (hand-computed, period 2) ────────────────────────────────────────────
{
  const candles = [
    { high: 10, low: 8, close: 9 },
    { high: 11, low: 9, close: 10 },
    { high: 12, low: 10, close: 11 },
  ];
  const a = atr(candles, 2); // TR1=2, TR2=2 → ATR[2]=2
  assert.equal(a[1], null);
  assert.ok(approx(a[2], 2));
}

// ── MACD: structural alignment ───────────────────────────────────────────────
{
  const series = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 3) * 5);
  const m = macd(series); // default 12/26/9
  assert.equal(m.length, series.length);
  assert.equal(m[24].macd, null, "MACD null before slow EMA seeds (index 25)");
  assert.notEqual(m[25].macd, null, "MACD defined from index 25");
  const last = m[m.length - 1];
  assert.ok(last.macd != null && last.signal != null && last.histogram != null);
  assert.ok(approx(last.histogram, (last.macd as number) - (last.signal as number)));
}

// ── Stochastic: close at top of range ────────────────────────────────────────
{
  const candles = Array.from({ length: 14 }, (_, i) => ({ high: i + 1, low: 0, close: i + 1 }));
  const s = stochastic(candles, 14, 3);
  assert.equal(s[12].k, null, "warm-up");
  assert.equal(s[13].k, 100, "close == highest high → %K 100");
}

console.log("chartIndicatorEngine.test.ts: all assertions passed");
