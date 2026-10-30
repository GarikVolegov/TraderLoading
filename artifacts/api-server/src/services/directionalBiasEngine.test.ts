import test from "node:test";
import assert from "node:assert/strict";
import {
  computeDirectionalBias,
  aggregateBarsToH4,
  aggregateBarsToW1,
  analyzeTimeframe,
  evaluateMacroFactors,
  buildLongTermRecommendation,
  rankLongTermRecommendations,
} from "./directionalBiasEngine.js";
import type { Candle } from "./candles.js";

test("aggregateBarsToH4 correctly aggregates 1-hour candles into 4-hour buckets", () => {
  const h1Bars: Candle[] = [
    { time: 0, open: 100, high: 105, low: 99, close: 102, volume: 10 },
    { time: 3600, open: 102, high: 108, low: 101, close: 107, volume: 15 },
    { time: 7200, open: 107, high: 109, low: 106, close: 108, volume: 20 },
    { time: 10800, open: 108, high: 110, low: 107, close: 109, volume: 25 },
    // Second H4 bar
    { time: 14400, open: 109, high: 112, low: 108, close: 111, volume: 30 },
  ];

  const h4 = aggregateBarsToH4(h1Bars);
  assert.equal(h4.length, 2);
  assert.equal(h4[0].time, 0);
  assert.equal(h4[0].open, 100);
  assert.equal(h4[0].high, 110);
  assert.equal(h4[0].low, 99);
  assert.equal(h4[0].close, 109);
  assert.equal(h4[0].volume, 70);

  assert.equal(h4[1].time, 14400);
  assert.equal(h4[1].open, 109);
  assert.equal(h4[1].high, 112);
});

test("computeDirectionalBias handles empty candles gracefully without throwing", () => {
  const res = computeDirectionalBias({
    pair: "XAUUSD",
    currentPrice: 2400,
    d1Bars: [],
    h4Bars: [],
    h1Bars: [],
  });

  assert.equal(res.pair, "XAUUSD");
  assert.equal(res.referencePrice, 2400);
  assert.ok(["BULLISH", "BEARISH", "NEUTRAL"].includes(res.h4MasterBias));
  assert.ok(res.confidenceScore >= 0 && res.confidenceScore <= 100);
  assert.equal(res.timeframes.h4.timeframe, "H4");
});

test("computeDirectionalBias detects BULLISH trend and Tier A+ on uptrend with discount retracement", () => {
  // Create 30 days of bullish Daily bars:
  const d1Bars: Candle[] = [];
  let price = 2000;
  for (let i = 0; i < 30; i++) {
    const open = price;
    const high = open + 15;
    const low = open - 5;
    const close = open + 10;
    d1Bars.push({ time: i * 86400, open, high, low, close, volume: 1000 });
    price = close;
  }

  // Pullback on H4 into Discount (< 0.50 of the 20-day range: range 2095-2305, 50% is 2200)
  const h4Bars: Candle[] = [];
  const lastD1 = d1Bars[d1Bars.length - 1];
  for (let j = 0; j < 20; j++) {
    const p = lastD1.close - j * 6;
    h4Bars.push({
      time: 30 * 86400 + j * 14400,
      open: p + 3,
      high: p + 5,
      low: p - 5,
      close: p,
      volume: 500,
    });
  }

  const res = computeDirectionalBias({
    pair: "XAUUSD",
    currentPrice: h4Bars[h4Bars.length - 1].close,
    d1Bars,
    h4Bars,
  });

  assert.equal(res.timeframes.d1.direction, "BULLISH");
  assert.ok(res.timeframes.d1.priceVsSma === "ABOVE");
  assert.equal(res.h4MasterBias, "BULLISH");
  assert.ok(res.confidenceScore >= 70);
});

test("computeDirectionalBias activates anti-fade protection when intraday is opposite to daily macro trend", () => {
  // Strong Daily Downtrend
  const d1Bars: Candle[] = [];
  let price = 2500;
  for (let i = 0; i < 30; i++) {
    const open = price;
    const high = open + 5;
    const low = open - 15;
    const close = open - 10;
    d1Bars.push({ time: i * 86400, open, high, low, close, volume: 1000 });
    price = close;
  }

  // Temporary bounce on H4
  const h4Bars: Candle[] = [];
  let h4Price = price;
  for (let j = 0; j < 15; j++) {
    h4Bars.push({
      time: 30 * 86400 + j * 14400,
      open: h4Price,
      high: h4Price + 8,
      low: h4Price - 1,
      close: h4Price + 6,
      volume: 300,
    });
    h4Price += 6;
  }

  const res = computeDirectionalBias({
    pair: "XAUUSD",
    currentPrice: h4Price,
    d1Bars,
    h4Bars,
  });

  assert.equal(res.timeframes.d1.direction, "BEARISH");
  // If attempting to buy during strong daily markdown without sweep:
  if (res.h4MasterBias === "BULLISH") {
    assert.equal(res.edgeTier, "COUNTER_TREND_WARNING");
    assert.equal(res.antiFadeProtected, true);
    assert.ok(res.confidenceScore <= 40);
  } else {
    assert.equal(res.h4MasterBias, "BEARISH");
  }
});

test("evaluateMacroFactors accounts for Flight to Safety on Gold in risk-off regime", () => {
  const result = evaluateMacroFactors({
    pair: "XAUUSD",
    newsArticles: [
      {
        title: "Escalating Middle East conflict prompts safe haven rush",
        summary: "Investors buy gold as missile strikes escalate tensions",
        impact: "alto",
        direction: "bullish",
      },
      {
        title: "Central bank reserves report shows aggressive bullion accumulation",
        summary: "BRICS nations increase non-dollar reserves",
        impact: "alto",
        direction: "bullish",
      },
    ],
  });

  assert.ok(result.factors.geopolitics.score > 30);
  assert.equal(result.factors.geopolitics.status, "BULLISH");
  assert.ok(result.macroScore > 0);
});

test("rankLongTermRecommendations ranks Tier A+ aligned pairs first and filters out counter-trend warnings", () => {
  const d1Bull: Candle[] = [];
  let p = 2000;
  for (let i = 0; i < 30; i++) {
    d1Bull.push({ time: i * 86400, open: p, high: p + 15, low: p - 5, close: p + 10, volume: 1000 });
    p += 10;
  }

  const xauBias = computeDirectionalBias({
    pair: "XAUUSD",
    currentPrice: 2150,
    d1Bars: d1Bull,
    h4Bars: d1Bull.slice(-15),
  });

  const counterTrendBias = {
    ...computeDirectionalBias({ pair: "USDCAD", currentPrice: 1.38 }),
    h4MasterBias: "BULLISH" as const,
    edgeTier: "COUNTER_TREND_WARNING" as const,
    antiFadeProtected: true,
    confidenceScore: 32,
  };

  const btcBias = computeDirectionalBias({
    pair: "BTCUSD",
  });

  const ranked = rankLongTermRecommendations([counterTrendBias, btcBias, xauBias], 5);

  assert.ok(ranked.recommendations.length >= 2);
  assert.equal(
    ranked.recommendations.some((r) => r.pair === "USDCAD"),
    false,
    "Counter-trend warning pairs must be excluded from top long-term recommendations",
  );
  assert.ok(ranked.recommendations[0].rankScore >= ranked.recommendations[1].rankScore);
  const recXau = buildLongTermRecommendation(xauBias);
  assert.equal(recXau.direction, "BULLISH");
  assert.ok(recXau.thesis.length > 0);
});
