import assert from "node:assert/strict";
import type { CandlestickData, Time } from "lightweight-charts";
import { computeMtfContext, getContextTimeframe } from "./chartMtf.js";

const HOUR = 60 * 60;
const base = Date.UTC(2026, 0, 1) / 1000;

// ── Default higher-timeframe mapping ─────────────────────────────────────────
assert.equal(getContextTimeframe("M15"), "H4");
assert.equal(getContextTimeframe("M5"), "H1");
assert.equal(getContextTimeframe("H1"), "D1");
assert.equal(getContextTimeframe("W1"), "W1", "top timeframe maps to itself");
assert.equal(getContextTimeframe("ZZZ"), "ZZZ", "unknown maps to itself");

function h4(index: number): CandlestickData<Time> {
  return { time: (base + index * 4 * HOUR) as Time, open: 1, high: 1.8, low: 0.7, close: 1.5 };
}
const h4Series = Array.from({ length: 10 }, (_, i) => h4(i));

// ── Cursor mid-bar: context ends at the forming H4 bar, locked to cursor price ─
{
  // 10:00 falls inside the H4 bar that opens at 08:00 (index 2).
  const cursor = base + 10 * HOUR;
  const view = computeMtfContext(h4Series, "H4", cursor, 1.23, 120);
  assert.equal(view.formingIndex, view.candles.length - 1, "forming bar is the last visible bar");
  const forming = view.candles[view.formingIndex];
  assert.equal(forming.time, base + 8 * HOUR, "forming bar is the 08:00 H4 bucket");
  assert.equal(forming.close, 1.23, "forming bar close locked to cursor price");
  assert.equal(forming.high, 1.23, "forming high reflects cursor move up from open 1");
  assert.equal(forming.low, 1, "forming low keeps the bar open");
  for (const c of view.candles) {
    assert.ok((c.time as number) < cursor, "no bar opens at/after the cursor");
  }
}

// ── Cursor on an exact bar boundary: the just-closing bar is the current one ──
{
  const cursor = base + 8 * HOUR; // exactly the close of the 04:00 H4 bar
  const view = computeMtfContext(h4Series, "H4", cursor, 1.23, 120);
  assert.equal(view.candles.at(-1)?.time, base + 4 * HOUR, "last visible bar is the one closing at the cursor");
  assert.equal(view.formingIndex, view.candles.length - 1, "the just-closing bar is the current bar");
  assert.equal(view.candles.at(-1)?.close, 1.23, "current bar close locked to cursor price");
}

// ── Degenerate inputs ────────────────────────────────────────────────────────
assert.deepEqual(computeMtfContext([], "H4", base, 1.0), { candles: [], formingIndex: -1 });
assert.deepEqual(computeMtfContext(h4Series, "H4", Number.NaN, 1.0), { candles: [], formingIndex: -1 });

console.log("chartMtf.test.ts: all assertions passed");
