import assert from "node:assert/strict";
import { bollinger, ema, rsi, sma } from "../../components/chartIndicatorEngine";
import {
  computeIndicator,
  createIndicator,
  defaultIndicators,
  INDICATOR_META,
  INDICATOR_SWATCHES,
  indicatorLabel,
  indicatorPane,
  type IndicatorConfig,
} from "./indicatorCatalog";
import type { ReplayCandle } from "./types";

const candles: ReplayCandle[] = Array.from({ length: 60 }, (_, i) => ({
  time: 1_700_000_000 + i * 3600,
  open: 100 + Math.sin(i / 3) * 5,
  high: 103 + Math.sin(i / 3) * 5,
  low: 98 + Math.sin(i / 3) * 5,
  close: 101 + Math.sin(i / 2) * 4,
  volume: 500 + i,
}));
const closes = candles.map((c) => c.close);

// ── meta / registry ──────────────────────────────────────────────────────────
assert.equal(INDICATOR_META.ema.pane, "price");
assert.equal(INDICATOR_META.bb.pane, "price");
assert.equal(INDICATOR_META.vwap.pane, "price");
assert.equal(INDICATOR_META.rsi.pane, "sub");
assert.equal(INDICATOR_META.macd.pane, "sub");
assert.equal(INDICATOR_META.atr.pane, "sub");
assert.equal(INDICATOR_META.stoch.pane, "sub");
assert.equal(INDICATOR_META.volume.pane, "volume");
assert.ok(INDICATOR_META.rsi.labelKey.length > 0, "dialog names come from i18n keys");
assert.equal(INDICATOR_SWATCHES.length, 8);

// ── defaults: EMA 9 + EMA 21 + Volume, all enabled ───────────────────────────
const defaults = defaultIndicators();
assert.deepEqual(
  defaults.map((d) => [d.type, d.period ?? null, d.on]),
  [
    ["ema", 9, true],
    ["ema", 21, true],
    ["volume", null, true],
  ],
);
assert.notEqual(defaults[0].color, defaults[1].color);
assert.notEqual(defaults[0].id, defaults[1].id);

// ── createIndicator seeds defaults from meta ─────────────────────────────────
const created = createIndicator("macd", "x1");
assert.equal(created.id, "x1");
assert.equal(created.type, "macd");
assert.equal(created.on, true);
assert.equal(created.fast, 12);
assert.equal(created.slow, 26);
assert.equal(created.signal, 9);
const customCreated = createIndicator("custom", "x2");
assert.equal(customCreated.source, "close");
assert.equal(customCreated.ma, "ema");
assert.equal(customCreated.period, 14);

// ── labels (compact, technical — not localized copy) ─────────────────────────
assert.equal(indicatorLabel({ id: "1", type: "ema", on: true, color: "#fff", period: 9 }), "EMA 9");
assert.equal(indicatorLabel({ id: "1", type: "bb", on: true, color: "#fff" }), "BB 20");
assert.equal(indicatorLabel({ id: "1", type: "macd", on: true, color: "#fff" }), "MACD 12,26");
assert.equal(indicatorLabel({ id: "1", type: "stoch", on: true, color: "#fff", k: 10, d: 4 }), "Stoch 10,4");
assert.equal(indicatorLabel({ id: "1", type: "vwap", on: true, color: "#fff" }), "VWAP");
assert.equal(indicatorLabel({ id: "1", type: "volume", on: true, color: "#fff" }), "Vol");
assert.equal(indicatorLabel({ id: "1", type: "custom", on: true, color: "#fff", name: "Mio" }), "Mio");

// ── pane resolution (custom can choose its pane) ─────────────────────────────
assert.equal(indicatorPane({ id: "1", type: "rsi", on: true, color: "#fff" }), "sub");
assert.equal(indicatorPane({ id: "1", type: "custom", on: true, color: "#fff" }), "price");
assert.equal(indicatorPane({ id: "1", type: "custom", on: true, color: "#fff", pane: "sub" }), "sub");

// ── computeIndicator ─────────────────────────────────────────────────────────
// ema: single line over closes matching the engine
const emaOut = computeIndicator({ id: "1", type: "ema", on: true, color: "#f59e0b", period: 9 }, candles);
assert.equal(emaOut.pane, "price");
if (emaOut.pane === "price") {
  assert.equal(emaOut.lines.length, 1);
  assert.deepEqual(emaOut.lines[0].values, ema(closes, 9));
  assert.equal(emaOut.lines[0].color, "#f59e0b");
}

// bollinger: three lines, middle dashed
const bbOut = computeIndicator({ id: "1", type: "bb", on: true, color: "#a855f7", period: 20, mult: 2 }, candles);
if (bbOut.pane === "price") {
  assert.equal(bbOut.lines.length, 3);
  const bands = bollinger(closes, 20, 2);
  assert.deepEqual(bbOut.lines[0].values, bands.map((b) => (b ? b.middle : null)));
  assert.deepEqual(bbOut.lines[1].values, bands.map((b) => (b ? b.upper : null)));
  assert.deepEqual(bbOut.lines[2].values, bands.map((b) => (b ? b.lower : null)));
  assert.equal(bbOut.lines[0].dashed, true);
}

// vwap: aligned to candles, finite where volume accumulates
const vwapOut = computeIndicator({ id: "1", type: "vwap", on: true, color: "#06b6d4" }, candles);
if (vwapOut.pane === "price") {
  assert.equal(vwapOut.lines[0].values.length, candles.length);
  assert.ok(vwapOut.lines[0].values.every((v) => v == null || Number.isFinite(v)));
  assert.ok(vwapOut.lines[0].values.some((v) => v != null));
}

// rsi: sub pane with 0-100 range and 30/70 levels
const rsiOut = computeIndicator({ id: "1", type: "rsi", on: true, color: "#a855f7", period: 14 }, candles);
assert.equal(rsiOut.pane, "sub");
if (rsiOut.pane === "sub") {
  assert.deepEqual(rsiOut.lines[0].values, rsi(closes, 14));
  assert.deepEqual(rsiOut.levels, [30, 70]);
  assert.deepEqual(rsiOut.range, { min: 0, max: 100 });
}

// stoch: two lines (K solid, D dashed), 20/80 levels
const stochOut = computeIndicator({ id: "1", type: "stoch", on: true, color: "#3b82f6", k: 14, d: 3 }, candles);
if (stochOut.pane === "sub") {
  assert.equal(stochOut.lines.length, 2);
  assert.equal(stochOut.lines[1].dashed, true);
  assert.deepEqual(stochOut.levels, [20, 80]);
}

// macd: line + signal + histogram
const macdOut = computeIndicator({ id: "1", type: "macd", on: true, color: "#3b82f6" }, candles);
if (macdOut.pane === "sub") {
  assert.equal(macdOut.lines.length, 2);
  assert.ok(macdOut.histogram, "macd exposes a histogram");
  assert.equal(macdOut.histogram?.values.length, candles.length);
}

// volume: pane marker only (the chart layer renders from candle volumes)
assert.deepEqual(computeIndicator({ id: "1", type: "volume", on: true, color: "#fff" }, candles), {
  pane: "volume",
});

// custom: raw source (ma none)
const rawCustom = computeIndicator(
  { id: "1", type: "custom", on: true, color: "#22c55e", source: "hl2", ma: "none" },
  candles,
);
if (rawCustom.pane === "price") {
  assert.deepEqual(rawCustom.lines[0].values, candles.map((c) => (c.high + c.low) / 2));
}

// custom: smoothed source
const smoothedCustom = computeIndicator(
  { id: "1", type: "custom", on: true, color: "#22c55e", source: "close", ma: "sma", period: 5 },
  candles,
);
if (smoothedCustom.pane === "price") {
  assert.deepEqual(smoothedCustom.lines[0].values, sma(closes, 5));
}

// custom: formula wins over source/ma
const formulaCustom = computeIndicator(
  { id: "1", type: "custom", on: true, color: "#22c55e", formula: "c - o", source: "close", ma: "sma", period: 5 },
  candles,
);
if (formulaCustom.pane === "price") {
  assert.deepEqual(formulaCustom.lines[0].values, candles.map((c) => c.close - c.open));
}

// custom: invalid formula never throws at render time — empty output
const brokenCustom = computeIndicator(
  { id: "1", type: "custom", on: true, color: "#22c55e", formula: "boom(" },
  candles,
);
if (brokenCustom.pane === "price") {
  assert.equal(brokenCustom.lines.length, 0);
}

// disabled indicator contributes nothing
const offOut = computeIndicator({ id: "1", type: "ema", on: false, color: "#fff", period: 9 }, candles);
if (offOut.pane === "price") assert.equal(offOut.lines.length, 0);

const configs: IndicatorConfig[] = defaults;
assert.ok(configs.every((c) => typeof c.id === "string"));

console.log("indicatorCatalog checks passed");
