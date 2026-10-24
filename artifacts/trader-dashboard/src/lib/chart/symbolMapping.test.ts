import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveTradingViewSymbol,
  resolveTradingViewTimeframe,
  timeframeToSeconds,
} from "./symbolMapping";

test("resolveTradingViewSymbol maps known symbols to broker feeds", () => {
  assert.equal(resolveTradingViewSymbol("XAUUSD"), "OANDA:XAUUSD");
  assert.equal(resolveTradingViewSymbol("XAU/USD"), "OANDA:XAUUSD");
  assert.equal(resolveTradingViewSymbol("EURUSD"), "OANDA:EURUSD");
  assert.equal(resolveTradingViewSymbol("BTCUSD"), "BINANCE:BTCUSDT");
  assert.equal(resolveTradingViewSymbol("US30"), "CAPITALCOM:US30");
  assert.equal(resolveTradingViewSymbol("NAS100"), "OANDA:NAS100USD");
});

test("resolveTradingViewTimeframe maps cockpit interval strings", () => {
  assert.equal(resolveTradingViewTimeframe("M1"), "1");
  assert.equal(resolveTradingViewTimeframe("1"), "1");
  assert.equal(resolveTradingViewTimeframe("M5"), "5");
  assert.equal(resolveTradingViewTimeframe("M15"), "15");
  assert.equal(resolveTradingViewTimeframe("H1"), "60");
  assert.equal(resolveTradingViewTimeframe("60"), "60");
  assert.equal(resolveTradingViewTimeframe("H4"), "240");
  assert.equal(resolveTradingViewTimeframe("240"), "240");
  assert.equal(resolveTradingViewTimeframe("D1"), "1D");
  assert.equal(resolveTradingViewTimeframe("D"), "1D");
});

test("timeframeToSeconds calculates duration for countdown", () => {
  assert.equal(timeframeToSeconds("M1"), 60);
  assert.equal(timeframeToSeconds("M5"), 300);
  assert.equal(timeframeToSeconds("M15"), 900);
  assert.equal(timeframeToSeconds("H1"), 3600);
  assert.equal(timeframeToSeconds("H4"), 14400);
  assert.equal(timeframeToSeconds("D1"), 86400);
});
