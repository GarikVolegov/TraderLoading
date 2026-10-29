import test from "node:test";
import assert from "node:assert/strict";
import { analyzeWyckoffStructure, type WyckoffCandle } from "./wyckoffEngine.js";

test("analyzeWyckoffStructure handles empty or insufficient candles gracefully", () => {
  const emptyRes = analyzeWyckoffStructure([]);
  assert.equal(emptyRes.tradingRange, null);
  assert.equal(emptyRes.events.length, 0);

  const shortRes = analyzeWyckoffStructure([
    { time: 100, open: 10, high: 12, low: 9, close: 11 },
  ]);
  assert.equal(shortRes.tradingRange, null);
});

test("analyzeWyckoffStructure accurately identifies Trading Range (Creek and Ice)", () => {
  const baseTime = 1700000000;
  const candles: WyckoffCandle[] = [];

  // Generate 30 candles within a range 2000 - 2040
  for (let i = 0; i < 30; i++) {
    const isHigh = i % 2 === 0;
    candles.push({
      time: baseTime + i * 3600,
      open: isHigh ? 2020 : 2015,
      high: isHigh ? 2038 : 2025,
      low: isHigh ? 2018 : 2005,
      close: isHigh ? 2030 : 2010,
    });
  }

  const res = analyzeWyckoffStructure(candles);
  assert.ok(res.tradingRange !== null, "Trading Range deve essere rilevato");
  assert.ok(res.tradingRange.creekPrice > res.tradingRange.icePrice, "Creek deve essere superiore all'Ice");
  assert.ok(res.tradingRange.midpoint > res.tradingRange.icePrice && res.tradingRange.midpoint < res.tradingRange.creekPrice);
});

test("analyzeWyckoffStructure detects SPRING (SSL grab with wick below Ice and body close inside)", () => {
  const baseTime = 1700000000;
  const candles: WyckoffCandle[] = [];

  // 25 candles between 100 and 120
  for (let i = 0; i < 25; i++) {
    candles.push({
      time: baseTime + i * 3600,
      open: 105,
      high: 118,
      low: 102,
      close: 110,
    });
  }

  const rangeCheck = analyzeWyckoffStructure(candles);
  assert.ok(rangeCheck.tradingRange);
  const ice = rangeCheck.tradingRange.icePrice;

  // Candela 26: SPRING -> spike perfora l'Ice (low < ice), ma il corpo chiude sopra (close >= ice)
  candles.push({
    time: baseTime + 26 * 3600,
    open: ice + 2,
    high: ice + 5,
    low: ice - 6, // wick perfora l'Ice
    close: ice + 3, // rientra e chiude dentro
  });

  const res = analyzeWyckoffStructure(candles);
  const spring = res.events.find((e) => e.type === "SPRING");
  assert.ok(spring !== undefined, "Lo Spring deve essere rilevato");
  assert.equal(spring.side, "bullish");
  assert.ok(spring.label.includes("SPRING"));
});

test("analyzeWyckoffStructure detects UTAD (BSL grab with wick above Creek and body close inside)", () => {
  const baseTime = 1700000000;
  const candles: WyckoffCandle[] = [];

  for (let i = 0; i < 25; i++) {
    candles.push({
      time: baseTime + i * 3600,
      open: 105,
      high: 118,
      low: 102,
      close: 110,
    });
  }

  const rangeCheck = analyzeWyckoffStructure(candles);
  assert.ok(rangeCheck.tradingRange);
  const creek = rangeCheck.tradingRange.creekPrice;

  // Candela 26: UTAD -> spike perfora Creek (high > creek), ma chiude dentro (close <= creek)
  candles.push({
    time: baseTime + 26 * 3600,
    open: creek - 2,
    high: creek + 7, // wick perfora il Creek
    low: creek - 5,
    close: creek - 1, // chiude dentro
  });

  const res = analyzeWyckoffStructure(candles);
  const utad = res.events.find((e) => e.type === "UTAD");
  assert.ok(utad !== undefined, "L'UTAD deve essere rilevato");
  assert.equal(utad.side, "bearish");
});

test("analyzeWyckoffStructure detects SOW 10% on impulsive breakdown below Ice", () => {
  const baseTime = 1700000000;
  const candles: WyckoffCandle[] = [];

  for (let i = 0; i < 25; i++) {
    candles.push({
      time: baseTime + i * 3600,
      open: 105,
      high: 118,
      low: 102,
      close: 110,
    });
  }

  const rangeCheck = analyzeWyckoffStructure(candles);
  assert.ok(rangeCheck.tradingRange);
  const ice = rangeCheck.tradingRange.icePrice;

  // Candela 26: Rottura netta 10% SOW sotto l'Ice
  candles.push({
    time: baseTime + 26 * 3600,
    open: ice + 1,
    high: ice + 2,
    low: ice - 12,
    close: ice - 10,
  });

  const res = analyzeWyckoffStructure(candles);
  const sow = res.events.find((e) => e.type === "SOW_10");
  assert.ok(sow !== undefined, "SOW 10% deve essere rilevato");
  assert.equal(sow.side, "bearish");
  assert.ok(sow.label.includes("10%"));
});
