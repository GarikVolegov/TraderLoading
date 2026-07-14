import assert from "node:assert/strict";
import { ema, rsi, sma } from "../../components/chartIndicatorEngine";
import { evaluateFormula, FormulaError, parseFormula } from "./formulaParser";
import type { ReplayCandle } from "./types";

const candles: ReplayCandle[] = Array.from({ length: 30 }, (_, i) => ({
  time: i * 60,
  open: 100 + i,
  high: 102 + i,
  low: 99 + i,
  close: 101 + i,
  volume: 10 * (i + 1),
}));
const closes = candles.map((c) => c.close);

function run(src: string): (number | null)[] {
  return evaluateFormula(parseFormula(src), candles);
}

function code(src: string): string {
  try {
    parseFormula(src);
    return "no-error";
  } catch (err) {
    if (err instanceof FormulaError) return err.code;
    throw err;
  }
}

// ── identifiers and arithmetic ───────────────────────────────────────────────
assert.deepEqual(run("c"), closes);
assert.deepEqual(run("o"), candles.map((c) => c.open));
assert.deepEqual(run("v"), candles.map((c) => c.volume));
assert.deepEqual(run("i"), candles.map((_, i) => i));
assert.deepEqual(run("hl2"), candles.map((c) => (c.high + c.low) / 2));
assert.deepEqual(run("ohlc4"), candles.map((c) => (c.open + c.high + c.low + c.close) / 4));
assert.deepEqual(run("(h + l) / 2"), run("hl2"));
assert.deepEqual(run("c - o"), candles.map((c) => c.close - c.open));
assert.deepEqual(run("-c"), closes.map((v) => -v));
assert.deepEqual(run("c * 2 + 1"), closes.map((v) => v * 2 + 1));
assert.deepEqual(run("2"), candles.map(() => 2));
// precedence: 1 + 2*3 = 7
assert.deepEqual(run("1 + 2 * 3"), candles.map(() => 7));

// division by zero → null, not Infinity
assert.deepEqual(run("c / (c - c)"), candles.map(() => null));

// ── functions ────────────────────────────────────────────────────────────────
assert.deepEqual(run("ema(c, 3)"), ema(closes, 3));
assert.deepEqual(run("ema(3)"), ema(closes, 3), "single-arg sugar defaults the series to close");
assert.deepEqual(run("sma(hl2, 2)"), sma(candles.map((c) => (c.high + c.low) / 2), 2));
assert.deepEqual(run("rsi(14)"), rsi(closes, 14));

// arithmetic over a function result keeps warm-up nulls
const spread = run("c - ema(c, 3)");
assert.equal(spread[0], null);
assert.equal(spread[1], null);
assert.ok(Math.abs((spread[5] as number) - (closes[5] - (ema(closes, 3)[5] as number))) < 1e-9);

// nested calls: outer fn is applied over the non-null tail of the inner result
const nested = run("ema(sma(c, 2), 2)");
const inner = sma(closes, 2);
const innerTail = inner.filter((v): v is number => v != null);
const outerTail = ema(innerTail, 2);
assert.equal(nested[0], null, "warm-up of the inner series stays null");
assert.equal(nested[1], null, "outer warm-up consumes the first non-null inner value");
assert.deepEqual(nested.slice(2), outerTail.slice(1));

// ── parse errors (typed, for i18n mapping) ───────────────────────────────────
assert.equal(code(""), "empty");
assert.equal(code("   "), "empty");
assert.equal(code("c +"), "unexpected_token");
assert.equal(code("foo"), "unknown_identifier");
assert.equal(code("pippo(c, 3)"), "unknown_function");
assert.equal(code("2 $ 3"), "unexpected_char");
assert.equal(code("(c"), "unbalanced_paren");
assert.equal(code("ema()"), "bad_args");
assert.equal(code("ema(c, 3, 4)"), "bad_args");
assert.equal(code("ema(c, h)"), "bad_period");
assert.equal(code("ema(c, 0)"), "bad_period");
assert.equal(code("ema(c, 2.5)"), "bad_period");
assert.equal(code("ema(c, 9999)"), "bad_period");
assert.equal(code("c c"), "unexpected_token");

// no eval-based escape hatches: anything outside the whitelist fails to parse
assert.equal(code("window"), "unknown_identifier");
assert.equal(code("constructor"), "unknown_identifier");

console.log("formulaParser checks passed");
