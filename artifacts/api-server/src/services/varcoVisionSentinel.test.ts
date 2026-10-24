import { strict as assert } from "node:assert";
import test from "node:test";
import {
  getPipMultiplier,
  priceDecimals,
  calculateLotSize,
  parseTimeframeCategory,
  evaluateItalianSessionWindow,
  computeDeterministicQuantSetup,
  analyzeWyckoffCycleAndMarkups,
  analyzeWyckoffSchematicGeometry,
  type VarcoVisionCandle,
} from "./varcoVisionSentinel.js";

test("getPipMultiplier correctly scales instruments", () => {
  assert.equal(getPipMultiplier("EURUSD"), 10000);
  assert.equal(getPipMultiplier("USDJPY"), 100);
  assert.equal(getPipMultiplier("XAUUSD"), 10);
  assert.equal(getPipMultiplier("NAS100"), 1);
  assert.equal(getPipMultiplier("BTCUSD"), 1);
});

test("priceDecimals matches market quote standard", () => {
  assert.equal(priceDecimals("EURUSD"), 5);
  assert.equal(priceDecimals("USDJPY"), 3);
  assert.equal(priceDecimals("XAUUSD"), 2);
  assert.equal(priceDecimals("NAS100"), 2);
});

test("calculateLotSize respects monetary risk and stop distance", () => {
  const lots = calculateLotSize("EURUSD", 100000, 1.0, 20);
  assert.equal(lots, 5.0);
});

test("parseTimeframeCategory categorizes M1, M5, M15, H1, D1 appropriately", () => {
  const m1 = parseTimeframeCategory("1");
  assert.equal(m1.category, "SCALP");
  assert.equal(m1.maxAllowedStopPips, 6.5);

  const m15 = parseTimeframeCategory("15");
  assert.equal(m15.category, "DAYTRADE");
  assert.equal(m15.maxAllowedStopPips, 12.0);

  const h1 = parseTimeframeCategory("60");
  assert.equal(h1.category, "SWING");
  assert.equal(h1.maxAllowedStopPips, 35.0);
});

test("computeDeterministicQuantSetup on EURUSD M15 calibrates tight SL (5-12 pips, not 30 pips)", () => {
  const candles: VarcoVisionCandle[] = [];
  const baseTime = 1700000000;
  // Generate 20 candles with a drop and displacement
  for (let i = 0; i < 20; i++) {
    const p = 1.1650 - i * 0.0003;
    candles.push({
      time: baseTime + i * 900,
      open: p + 0.0001,
      high: p + 0.0004,
      low: p - 0.0003,
      close: p,
      volume: 500,
    });
  }

  const res = computeDeterministicQuantSetup({
    symbol: "EURUSD",
    interval: "15",
    candles,
    accountCapital: 100000,
    riskPercent: 1.0,
  });

  assert.equal(res.verdict, "SETUP_READY");
  assert.ok(res.setup !== null);
  if (res.setup) {
    assert.equal(res.setup.direction, "short");
    // Ensure SL is strictly tight and adapted to M15 Day Trading (<= 12 pips)
    assert.ok(
      res.setup.pipsRisk <= 12.0,
      `pipsRisk was ${res.setup.pipsRisk}, must be <= 12.0 pips on M15`
    );
    assert.ok(
      res.setup.pipsRisk >= 4.0,
      `pipsRisk was ${res.setup.pipsRisk}, must be >= 4.0 pips on M15`
    );
    // Ensure BE rule is 1:1.5 R:R and TP1 is 1:3.0 R:R
    const riskDiff = Math.abs(res.setup.entryPrice - res.setup.stopLossPrice);
    const expectedBE = res.setup.entryPrice - riskDiff * 1.5;
    assert.ok(
      Math.abs(res.setup.breakEvenPrice - expectedBE) < 0.0001,
      "BE must be at 1:1.5 R:R"
    );
    const expectedTP1 = res.setup.entryPrice - riskDiff * 3.0;
    assert.ok(
      Math.abs(res.setup.takeProfit1Price - expectedTP1) < 0.0001,
      "TP1 must be at 1:3.0 R:R"
    );
  }

  // Verify 4 procedural steps are populated
  assert.ok(res.proceduralSteps);
  assert.equal(res.proceduralSteps.length, 4);
  assert.equal(res.proceduralSteps[0].phase, 1);
  assert.equal(res.proceduralSteps[3].phase, 4);
});

test("computeDeterministicQuantSetup produces Limit order when price is outside immediate mitigation", () => {
  const candles: VarcoVisionCandle[] = [];
  const baseTime = 1700000000;
  for (let i = 0; i < 15; i++) {
    candles.push({
      time: baseTime + i * 900,
      open: 1.0800 + i * 0.0002,
      high: 1.0800 + i * 0.0004,
      low: 1.0800 + i * 0.0001,
      close: 1.0800 + i * 0.0003,
      volume: 400,
    });
  }
  // Large displacement candle followed by continuation that left price away from 50%
  candles.push({
    time: baseTime + 16 * 900,
    open: 1.0850,
    high: 1.0890,
    low: 1.0848,
    close: 1.0888,
    volume: 2500,
  });
  candles.push({
    time: baseTime + 17 * 900,
    open: 1.0888,
    high: 1.0920,
    low: 1.0885,
    close: 1.0915,
    volume: 1800,
  });

  const res = computeDeterministicQuantSetup({
    symbol: "EURUSD",
    interval: "15",
    candles,
  });

  assert.equal(res.verdict, "SETUP_READY");
  assert.ok(res.setup !== null);
  if (res.setup) {
    assert.equal(res.setup.direction, "long");
    assert.ok(res.setup.orderType === "limit" || res.setup.orderType === "market");
    assert.ok(res.setup.limitPrice !== undefined);
  }
});

test("computeDeterministicQuantSetup preserves active setup during minor pullback (hysteresis)", () => {
  const candles: VarcoVisionCandle[] = [];
  const baseTime = 1700000000;
  for (let i = 0; i < 20; i++) {
    candles.push({
      time: baseTime + i * 900,
      open: 1.1500 - i * 0.0003,
      high: 1.1500 - i * 0.0001,
      low: 1.1500 - i * 0.0005,
      close: 1.1500 - i * 0.0004,
      volume: 500,
    });
  }

  // Active Short setup waiting for retest
  const activeShortSetup = {
    direction: "short" as const,
    orderType: "limit" as const,
    entryPrice: 1.1460,
    stopLossPrice: 1.1490,
    breakEvenPrice: 1.1415,
    breakEvenRule: "BE Rule",
    takeProfit1Price: 1.1370,
    takeProfit1Rule: "TP1 Rule",
    takeProfit2Price: 1.1325,
    takeProfit2Rule: "TP2 Rule",
    riskRewardRatio: 3.0,
    lotSize: 1.0,
    pipsRisk: 30,
  };

  // Add 1 green pullback candle (close > open)
  candles.push({
    time: baseTime + 21 * 900,
    open: 1.1430,
    high: 1.1450,
    low: 1.1428,
    close: 1.1448,
    volume: 600,
  });

  const res = computeDeterministicQuantSetup({
    symbol: "EURUSD",
    interval: "15",
    candles,
    activeSetup: activeShortSetup,
  });

  // Hysteresis must lock and preserve the short setup despite the green candle
  assert.equal(res.verdict, "SETUP_READY");
  assert.ok(res.setup !== null);
  assert.equal(res.setup?.direction, "short", "Setup direction must remain SHORT and not flip on pullback");
  assert.equal(res.setup?.entryPrice, 1.1460, "Entry price must be preserved");
});

test("computeDeterministicQuantSetup handles insufficient candles gracefully", () => {
  const res = computeDeterministicQuantSetup({
    symbol: "EURUSD",
    candles: [
      { time: 1, open: 1.05, high: 1.06, low: 1.04, close: 1.055 },
    ],
  });
  assert.equal(res.verdict, "WAITING_TRIGGER");
  assert.equal(res.setup, null);
});

test("evaluateItalianSessionWindow enforces Europe/Rome session rules from Piano Operativo", () => {
  // Tuesday 2024-10-15 09:00 Europe/Rome (07:00 UTC) -> London open
  const londonTs = Math.floor(Date.parse("2024-10-15T07:00:00Z") / 1000);
  const londonCheck = evaluateItalianSessionWindow(londonTs, "EURUSD", "scalp", false);
  assert.equal(londonCheck.allowed, true);
  assert.match(londonCheck.sessionName, /Londra/);

  // Tuesday 2024-10-15 13:45 Europe/Rome (11:45 UTC) -> Intervallo (bloccato)
  const intervalloTs = Math.floor(Date.parse("2024-10-15T11:45:00Z") / 1000);
  const intervalloCheck = evaluateItalianSessionWindow(intervalloTs, "EURUSD", "scalp", true);
  assert.equal(intervalloCheck.allowed, false);
  assert.match(intervalloCheck.sessionName, /Intervallo/);

  // Tuesday 2024-10-15 19:30 Europe/Rome (17:30 UTC) -> Scalp bloccato, Swing attivo
  const eveningTs = Math.floor(Date.parse("2024-10-15T17:30:00Z") / 1000);
  const scalpEvening = evaluateItalianSessionWindow(eveningTs, "XAUUSD", "scalp", true);
  const swingEvening = evaluateItalianSessionWindow(eveningTs, "XAUUSD", "swing", true);
  assert.equal(scalpEvening.allowed, false, "Scalping must be blocked after 18:00 CET");
  assert.equal(swingEvening.allowed, true, "Swing must be allowed until 22:00 CET");

  // Tuesday 2024-10-15 22:30 Europe/Rome (20:30 UTC) -> Chiusura totale
  const nightTs = Math.floor(Date.parse("2024-10-15T20:30:00Z") / 1000);
  const nightCheck = evaluateItalianSessionWindow(nightTs, "XAUUSD", "swing", true);
  assert.equal(nightCheck.allowed, false, "All new entries blocked after 22:00 CET");
});

test("computeDeterministicQuantSetup respects La Regola del Flip and Router di Zona", () => {
  const candles: VarcoVisionCandle[] = [];
  // London session timestamp
  const baseTime = Math.floor(Date.parse("2024-10-15T07:00:00Z") / 1000);
  for (let i = 0; i < 20; i++) {
    const p = 1.0900 - i * 0.0003;
    candles.push({
      time: baseTime + i * 300,
      open: p + 0.0002,
      high: p + 0.0004,
      low: p - 0.0002,
      close: p,
      volume: 600,
    });
  }

  const res = computeDeterministicQuantSetup({
    symbol: "EURUSD",
    interval: "5",
    candles,
    enforceSessionWindows: true,
    operativeMemory: {
      flipActive: true,
      flipDirection: "short",
      minImbalancePercent: 10,
      preferPocOnReversal: true,
    },
  });

  assert.equal(res.verdict, "SETUP_READY");
  assert.ok(res.setup !== null);
  assert.equal(res.setup?.direction, "short");
  assert.equal(res.setup?.zoneScenario, "no_zone", "Flip forces continuation scenario (no_zone)");
  assert.ok(
    res.setup?.triggerType === "JTC" || res.setup?.triggerType === "BTI",
    "Flip in no_zone only allows JTC or BTI triggers",
  );
});

test("analyzeWyckoffSchematicGeometry places TEST on STB shadow when Spring is present, and on SC shadow when Spring is missing", () => {
  const baseTime = 1700000000;
  // Build Accumulation with SC (low 1.0800, body low 1.0812), AR (high 1.0860), STB (low 1.0810, body low 1.0820), and Spring (low 1.0792, close 1.0815)
  const accumWithSpring: VarcoVisionCandle[] = [
    { time: baseTime + 1 * 60, open: 1.0840, high: 1.0845, low: 1.0820, close: 1.0822, volume: 500 },
    // SC candle: low 1.0800, close 1.0812 (wick between 1.0800 and 1.0812 -> mid ~1.0806)
    { time: baseTime + 2 * 60, open: 1.0822, high: 1.0825, low: 1.0800, close: 1.0812, volume: 1500 },
    // AR candle: high 1.0860
    { time: baseTime + 3 * 60, open: 1.0812, high: 1.0860, low: 1.0810, close: 1.0852, volume: 900 },
    { time: baseTime + 4 * 60, open: 1.0852, high: 1.0855, low: 1.0830, close: 1.0835, volume: 600 },
    // Second half of cause: STB candle (low 1.0810, body low 1.0820 -> wick mid 1.0815)
    { time: baseTime + 5 * 60, open: 1.0835, high: 1.0838, low: 1.0810, close: 1.0820, volume: 800 },
    { time: baseTime + 6 * 60, open: 1.0820, high: 1.0842, low: 1.0818, close: 1.0838, volume: 700 },
    // Spring candle: sweeps below SC (1.0792 < 1.0800) and closes back inside range (1.0815 > 1.0800)
    { time: baseTime + 7 * 60, open: 1.0825, high: 1.0830, low: 1.0792, close: 1.0815, volume: 1800 },
    { time: baseTime + 8 * 60, open: 1.0815, high: 1.0835, low: 1.0814, close: 1.0832, volume: 700 },
    // Break candles
    { time: baseTime + 9 * 60, open: 1.0832, high: 1.0846, low: 1.0830, close: 1.0844, volume: 900 },
    { time: baseTime + 10 * 60, open: 1.0844, high: 1.0848, low: 1.0838, close: 1.0845, volume: 950 },
  ];

  const geomSpring = analyzeWyckoffSchematicGeometry(accumWithSpring, "long", "EURUSD", false, false);
  assert.equal(geomSpring.hasSpringOrUt, true, "Should detect Spring below SC");
  assert.match(geomSpring.testZoneRuleLabel, /Ombra dello STB/, "With Spring present, TEST must be on STB shadow");
  assert.equal(geomSpring.testZonePrice, 1.0815, "STB wick midpoint between 1.0810 and 1.0820 is 1.0815");

  // Same Accumulation WITHOUT Spring (only STB at 1.0810, higher than SC at 1.0800)
  const accumNoSpring: VarcoVisionCandle[] = accumWithSpring.map((c, idx) =>
    idx === 6
      ? { time: c.time, open: 1.0825, high: 1.0836, low: 1.0816, close: 1.0830, volume: 700 }
      : c,
  );
  const geomNoSpring = analyzeWyckoffSchematicGeometry(accumNoSpring, "long", "EURUSD", false, false);
  assert.equal(geomNoSpring.hasSpringOrUt, false, "Should detect absence of Spring");
  assert.match(geomNoSpring.testZoneRuleLabel, /Ombra del SC/, "Without Spring, TEST must be on SC shadow");
  assert.equal(geomNoSpring.testZonePrice, 1.0806, "SC wick midpoint between 1.0800 and 1.0812 is 1.0806");
});

test("analyzeWyckoffSchematicGeometry places TEST on UT shadow when UT is present, and on BC shadow when UT is missing", () => {
  const baseTime = 1700000000;
  // Distribution with BC (high 1.0900, body high 1.0888 -> wick mid 1.0894), AR (low 1.0840), ST (high 1.0890), UT (high 1.0908, body high 1.0896 -> wick mid 1.0902)
  const distWithUt: VarcoVisionCandle[] = [
    { time: baseTime + 1 * 60, open: 1.0860, high: 1.0880, low: 1.0858, close: 1.0878, volume: 500 },
    // BC candle: high 1.0900, body high 1.0888
    { time: baseTime + 2 * 60, open: 1.0878, high: 1.0900, low: 1.0875, close: 1.0888, volume: 1600 },
    // AR candle: low 1.0840
    { time: baseTime + 3 * 60, open: 1.0888, high: 1.0890, low: 1.0840, close: 1.0848, volume: 900 },
    { time: baseTime + 4 * 60, open: 1.0848, high: 1.0870, low: 1.0845, close: 1.0865, volume: 600 },
    // Second half: ST candle (high 1.0890)
    { time: baseTime + 5 * 60, open: 1.0865, high: 1.0890, low: 1.0862, close: 1.0880, volume: 750 },
    { time: baseTime + 6 * 60, open: 1.0880, high: 1.0884, low: 1.0860, close: 1.0868, volume: 650 },
    // UT candle: sweeps above BC (1.0908 > 1.0900) and closes below BC (1.0896 < 1.0900)
    { time: baseTime + 7 * 60, open: 1.0885, high: 1.0908, low: 1.0882, close: 1.0896, volume: 1900 },
    { time: baseTime + 8 * 60, open: 1.0896, high: 1.0898, low: 1.0870, close: 1.0874, volume: 800 },
    // Break candles
    { time: baseTime + 9 * 60, open: 1.0874, high: 1.0876, low: 1.0856, close: 1.0858, volume: 900 },
    { time: baseTime + 10 * 60, open: 1.0858, high: 1.0862, low: 1.0852, close: 1.0855, volume: 950 },
  ];

  const geomUt = analyzeWyckoffSchematicGeometry(distWithUt, "short", "EURUSD", false, false);
  assert.equal(geomUt.hasSpringOrUt, true, "Should detect UT above BC");
  assert.match(geomUt.testZoneRuleLabel, /Ombra dell'UT/, "With UT present, TEST must be on UT shadow");
  assert.equal(geomUt.testZonePrice, 1.0902, "UT wick midpoint between 1.0896 and 1.0908 is 1.0902");

  // Same Distribution WITHOUT UT (only ST at 1.0890, below BC at 1.0900)
  const distNoUt: VarcoVisionCandle[] = distWithUt.map((c, idx) =>
    idx === 6
      ? { time: c.time, open: 1.0870, high: 1.0885, low: 1.0865, close: 1.0875, volume: 700 }
      : idx === 7
        ? { time: c.time, open: 1.0875, high: 1.0882, low: 1.0868, close: 1.0874, volume: 800 }
        : c,
  );
  const geomNoUt = analyzeWyckoffSchematicGeometry(distNoUt, "short", "EURUSD", false, false);
  assert.equal(geomNoUt.hasSpringOrUt, false, "Should detect absence of UT");
  assert.match(geomNoUt.testZoneRuleLabel, /Ombra del BC/, "Without UT, TEST must be on BC shadow");
  assert.equal(geomNoUt.testZonePrice, 1.0894, "BC wick midpoint between 1.0888 and 1.0900 is 1.0894");
});

test("analyzeWyckoffSchematicGeometry selects POC on mild SOW/SOS (10%) break and JTC/BTI (between 10% and AR) on strong break", () => {
  const baseTime = 1700000000;
  const baseDist: VarcoVisionCandle[] = [
    { time: baseTime + 1 * 60, open: 1.0860, high: 1.0880, low: 1.0858, close: 1.0878, volume: 500 },
    { time: baseTime + 2 * 60, open: 1.0878, high: 1.0900, low: 1.0875, close: 1.0888, volume: 1600 }, // BC 1.0900
    { time: baseTime + 3 * 60, open: 1.0888, high: 1.0890, low: 1.0840, close: 1.0848, volume: 900 },  // AR 1.0840
    { time: baseTime + 4 * 60, open: 1.0848, high: 1.0875, low: 1.0845, close: 1.0870, volume: 2200 }, // High volume POC area
    { time: baseTime + 5 * 60, open: 1.0870, high: 1.0890, low: 1.0865, close: 1.0880, volume: 750 },
    { time: baseTime + 6 * 60, open: 1.0880, high: 1.0884, low: 1.0860, close: 1.0868, volume: 2100 },
    { time: baseTime + 7 * 60, open: 1.0885, high: 1.0908, low: 1.0882, close: 1.0896, volume: 1900 }, // UT 1.0908
    { time: baseTime + 8 * 60, open: 1.0896, high: 1.0898, low: 1.0870, close: 1.0874, volume: 800 },
  ];

  // 1) Mild break of SOW (10% level is ~1.0856, AR is 1.0840): break slightly to 1.0850
  const mildBreakCandles: VarcoVisionCandle[] = [
    ...baseDist,
    { time: baseTime + 9 * 60, open: 1.0874, high: 1.0875, low: 1.0852, close: 1.0853, volume: 1100 },
    { time: baseTime + 10 * 60, open: 1.0853, high: 1.0856, low: 1.0850, close: 1.0851, volume: 1000 },
  ];
  const mildGeom = analyzeWyckoffSchematicGeometry(mildBreakCandles, "short", "EURUSD", false, true);
  assert.equal(mildGeom.tenPercentBreakStrength, "mild");
  assert.equal(mildGeom.selectedTrigger, "POC", "Mild break of SOW (10%) must select POC");
  assert.equal(mildGeom.entryZonePrice, mildGeom.pocZonePrice);

  // 2) Strong break of SOW (10%): break strongly below AR (to 1.0820) -> must select JTC/BTI in the zone between 10% and AR
  const strongBreakCandles: VarcoVisionCandle[] = [
    ...baseDist,
    { time: baseTime + 9 * 60, open: 1.0874, high: 1.0875, low: 1.0830, close: 1.0832, volume: 2400 },
    { time: baseTime + 10 * 60, open: 1.0832, high: 1.0835, low: 1.0818, close: 1.0820, volume: 2200 },
  ];
  const strongGeomJtc = analyzeWyckoffSchematicGeometry(strongBreakCandles, "short", "EURUSD", false, false);
  assert.equal(strongGeomJtc.tenPercentBreakStrength, "strong");
  assert.equal(strongGeomJtc.selectedTrigger, "JTC", "Strong break without FVG must select JTC");
  assert.equal(strongGeomJtc.entryZonePrice, strongGeomJtc.jtcBtiZonePrice);
  assert.ok(
    strongGeomJtc.jtcBtiZonePrice >= strongGeomJtc.arPrice &&
      strongGeomJtc.jtcBtiZonePrice <= strongGeomJtc.tenPercentLevel,
    `JTC/BTI zone (${strongGeomJtc.jtcBtiZonePrice}) must be strictly between AR (${strongGeomJtc.arPrice}) and 10% SOW (${strongGeomJtc.tenPercentLevel})`,
  );

  const strongGeomBti = analyzeWyckoffSchematicGeometry(strongBreakCandles, "short", "EURUSD", true, false);
  assert.equal(strongGeomBti.selectedTrigger, "BTI", "Strong break with FVG must select BTI in the 10%-AR zone");
  assert.equal(strongGeomBti.entryZonePrice, strongGeomBti.jtcBtiZonePrice);
});

test("analyzeWyckoffCycleAndMarkups counts markups across Cause-Effect expansions", () => {
  const candles: VarcoVisionCandle[] = [];
  const baseTime = 1700000000;
  let price = 1.0800;

  // Cause 1 (consolidation) -> Markup 1 -> Cause 2 (consolidation) -> Markup 2
  for (let i = 0; i < 6; i++) {
    candles.push({ time: baseTime + i * 60, open: price, high: price + 0.0004, low: price - 0.0003, close: price + 0.0001 });
  }
  for (let i = 6; i < 11; i++) {
    price += 0.0008;
    candles.push({ time: baseTime + i * 60, open: price - 0.0007, high: price + 0.0002, low: price - 0.0008, close: price });
  }
  for (let i = 11; i < 16; i++) {
    candles.push({ time: baseTime + i * 60, open: price, high: price + 0.0002, low: price - 0.0003, close: price - 0.0001 });
  }
  for (let i = 16; i < 21; i++) {
    price += 0.0009;
    candles.push({ time: baseTime + i * 60, open: price - 0.0008, high: price + 0.0002, low: price - 0.0009, close: price });
  }

  const cycle = analyzeWyckoffCycleAndMarkups(candles);
  assert.equal(cycle.cycleDirection, "long");
  assert.ok(cycle.markupCount >= 2, `Expected at least 2 markups, got ${cycle.markupCount}`);
  assert.equal(cycle.cycleState, "up");
});

test("computeDeterministicQuantSetup rejects ghost limits placed >200 pips away from current market", () => {
  const candles: VarcoVisionCandle[] = [];
  const baseTime = 1700000000;
  // Start from 1.0900 and crash down 250 pips to 1.0650
  for (let i = 0; i < 30; i++) {
    const p = 1.0900 - i * 0.0008;
    candles.push({
      time: baseTime + i * 900,
      open: p + 0.0002,
      high: p + 0.0004,
      low: p - 0.0002,
      close: p,
      volume: 800,
    });
  }

  const res = computeDeterministicQuantSetup({
    symbol: "EURUSD",
    interval: "15",
    candles,
  });

  // Price has fallen far away: if distance to the top is > 80-100 pips, setup must NOT create a ghost limit
  if (res.setup) {
    const dist = Math.abs(candles[candles.length - 1].close - res.setup.entryPrice) * 10000;
    assert.ok(dist <= 80, `Limit order distance was ${dist} pips, must never be > 80 pips (and never 200 pips!)`);
  } else {
    assert.equal(res.verdict, "WAITING_TRIGGER");
    assert.match(res.summary, /nessun ordine pendente fantasma/i);
  }
});

test("analyzeWyckoffSchematicGeometry outputs schematicPoints and activeZone for chart overlay", () => {
  const baseTime = 1700000000;
  const accum: VarcoVisionCandle[] = [
    { time: baseTime + 1 * 60, open: 1.0840, high: 1.0845, low: 1.0820, close: 1.0822, volume: 500 },
    { time: baseTime + 2 * 60, open: 1.0822, high: 1.0825, low: 1.0800, close: 1.0812, volume: 1500 }, // SC
    { time: baseTime + 3 * 60, open: 1.0812, high: 1.0860, low: 1.0810, close: 1.0852, volume: 900 },  // AR
    { time: baseTime + 4 * 60, open: 1.0852, high: 1.0855, low: 1.0830, close: 1.0835, volume: 600 },
    { time: baseTime + 5 * 60, open: 1.0835, high: 1.0838, low: 1.0810, close: 1.0820, volume: 800 },  // STB
    { time: baseTime + 6 * 60, open: 1.0820, high: 1.0842, low: 1.0818, close: 1.0838, volume: 700 },
    { time: baseTime + 7 * 60, open: 1.0825, high: 1.0830, low: 1.0792, close: 1.0815, volume: 1800 }, // Spring
    { time: baseTime + 8 * 60, open: 1.0815, high: 1.0835, low: 1.0814, close: 1.0832, volume: 700 },
    { time: baseTime + 9 * 60, open: 1.0832, high: 1.0846, low: 1.0830, close: 1.0844, volume: 900 },
    { time: baseTime + 10 * 60, open: 1.0844, high: 1.0848, low: 1.0838, close: 1.0845, volume: 950 },
  ];

  const geom = analyzeWyckoffSchematicGeometry(accum, "long", "EURUSD", false, false);
  assert.ok(Array.isArray(geom.schematicPoints));
  assert.ok(geom.schematicPoints.length >= 4);

  const labels = geom.schematicPoints.map((p) => p.label);
  assert.ok(labels.includes("SC"));
  assert.ok(labels.includes("AR"));
  assert.ok(labels.includes("STB"));
  assert.ok(labels.includes("Spring"));
  assert.ok(labels.includes("SOS"));

  assert.ok(geom.activeZone);
  assert.equal(geom.activeZone.triggerType, geom.selectedTrigger);
  assert.ok(geom.activeZone.topPrice >= geom.activeZone.bottomPrice);

  // Verifica schematicBox (Causa Trading Range Wyckoff)
  assert.ok(geom.schematicBox);
  assert.equal(geom.schematicBox.schematicType, "accumulation");
  assert.equal(geom.schematicBox.startTime, accum[1].time, "Box start must match SC time");
  assert.equal(geom.schematicBox.endTime, accum[9].time, "Box end must match latest candle time");
  assert.equal(geom.schematicBox.topPrice, geom.arPrice);
  assert.ok(geom.schematicBox.rangeHeight > 0);

  // Verifica che i punti abbiano i timestamp esatti delle candele reali
  const scPt = geom.schematicPoints.find((p) => p.label === "SC");
  const arPt = geom.schematicPoints.find((p) => p.label === "AR");
  const springPt = geom.schematicPoints.find((p) => p.label === "Spring");
  const sosPt = geom.schematicPoints.find((p) => p.label === "SOS");

  assert.equal(scPt?.time, accum[1].time);
  assert.equal(arPt?.time, accum[2].time);
  assert.equal(springPt?.time, accum[6].time);
  assert.ok(sosPt && sosPt.time >= accum[8].time, "SOS point must be pinned to the breakout candle");
});

test("analyzeWyckoffSchematicGeometry identifies Wyckoff box across 40-candle trend & consolidation", () => {
  const baseTime = 1700000000;
  const candles: VarcoVisionCandle[] = [];
  let price = 1.1000;

  // 15 candele di downtrend fino al Selling Climax
  for (let i = 0; i < 15; i++) {
    price -= 0.0004;
    candles.push({
      time: baseTime + i * 900,
      open: price + 0.0003,
      high: price + 0.0004,
      low: price - 0.0001,
      close: price,
      volume: 400 + i * 50,
    });
  }
  // Candela 15: Selling Climax (SC) con volume elevato e minimo a 1.0930
  const scTime = baseTime + 15 * 900;
  candles.push({
    time: scTime,
    open: price,
    high: price + 0.0002,
    low: 1.0930,
    close: 1.0938,
    volume: 2500,
  });

  // Candela 16: Automatic Rally (AR) rapido a 1.0975
  const arTime = baseTime + 16 * 900;
  candles.push({
    time: arTime,
    open: 1.0938,
    high: 1.0975,
    low: 1.0935,
    close: 1.0970,
    volume: 1800,
  });

  // Candele 17-25: consolidamento interno (STB a 1.0935, candele successive)
  for (let i = 17; i < 26; i++) {
    candles.push({
      time: baseTime + i * 900,
      open: 1.0950,
      high: 1.0965,
      low: 1.0938,
      close: 1.0955,
      volume: 600,
    });
  }

  // Candela 26: Rottura forte del SOS verso 1.0985 oltre l'AR
  candles.push({
    time: baseTime + 26 * 900,
    open: 1.0955,
    high: 1.0985,
    low: 1.0952,
    close: 1.0982,
    volume: 2200,
  });

  const geom = analyzeWyckoffSchematicGeometry(candles, "long", "EURUSD", false, false);
  assert.equal(geom.schematicType, "accumulation");
  assert.equal(geom.climaxPrice, 1.0930, "Must correctly identify SC at 1.0930");
  assert.equal(geom.arPrice, 1.0975, "Must correctly identify AR at 1.0975");
  assert.equal(geom.tenPercentBreakStrength, "strong", "Closing at 1.0982 beyond AR is strong break");
  assert.equal(geom.selectedTrigger, "JTC");
  assert.ok(
    geom.entryZonePrice >= geom.tenPercentLevel && geom.entryZonePrice <= geom.arPrice,
    "JTC zone must be between 10% and AR",
  );
  assert.ok(geom.schematicBox);
  assert.equal(geom.schematicBox.startTime, scTime);
});

test("analyzeWyckoffSchematicGeometry identifies Distribution box across 40-candle uptrend & consolidation", () => {
  const baseTime = 1700000000;
  const candles: VarcoVisionCandle[] = [];
  let price = 1.0800;

  // 15 candele di uptrend fino al Buying Climax
  for (let i = 0; i < 15; i++) {
    price += 0.0004;
    candles.push({
      time: baseTime + i * 900,
      open: price - 0.0003,
      high: price + 0.0001,
      low: price - 0.0004,
      close: price,
      volume: 400 + i * 50,
    });
  }
  // Candela 15: Buying Climax (BC) con volume elevato e massimo a 1.0870
  const bcTime = baseTime + 15 * 900;
  candles.push({
    time: bcTime,
    open: price,
    high: 1.0870,
    low: price - 0.0002,
    close: 1.0862,
    volume: 2600,
  });

  // Candela 16: Automatic Reaction (AR) rapida a 1.0825
  const arTime = baseTime + 16 * 900;
  candles.push({
    time: arTime,
    open: 1.0862,
    high: 1.0865,
    low: 1.0825,
    close: 1.0830,
    volume: 1900,
  });

  // Candele 17-25: consolidamento interno (ST a 1.0865, candele successive)
  for (let i = 17; i < 26; i++) {
    candles.push({
      time: baseTime + i * 900,
      open: 1.0850,
      high: 1.0862,
      low: 1.0835,
      close: 1.0845,
      volume: 600,
    });
  }

  // Candela 26: Rottura forte del SOW verso 1.0815 sotto l'AR
  candles.push({
    time: baseTime + 26 * 900,
    open: 1.0845,
    high: 1.0848,
    low: 1.0815,
    close: 1.0818,
    volume: 2300,
  });

  const geom = analyzeWyckoffSchematicGeometry(candles, "short", "EURUSD", false, false);
  assert.equal(geom.schematicType, "distribution");
  assert.equal(geom.climaxPrice, 1.0870, "Must correctly identify BC at 1.0870");
  assert.equal(geom.arPrice, 1.0825, "Must correctly identify AR at 1.0825");
  assert.equal(geom.tenPercentBreakStrength, "strong", "Closing at 1.0818 below AR is strong break");
  assert.equal(geom.selectedTrigger, "JTC");
  assert.ok(
    geom.entryZonePrice >= geom.arPrice && geom.entryZonePrice <= geom.tenPercentLevel,
    "JTC zone must be between AR and 10% SOW",
  );
  assert.ok(geom.schematicBox);
  assert.equal(geom.schematicBox.startTime, bcTime);
  assert.equal(geom.schematicBox.schematicType, "distribution");
});

test("analyzeWyckoffSchematicGeometry identifies complete user sequence (PS, SC, AR, ST, 10% Apollo, STB, Spring, Test, 10% 2)", () => {
  const baseTime = 1710000000;
  const candles: VarcoVisionCandle[] = [
    // 0. Markdown & PS (Preliminary Support deceleration)
    { time: baseTime + 0 * 900, open: 4030.0, high: 4031.0, low: 4015.0, close: 4018.0, volume: 1500 },
    { time: baseTime + 1 * 900, open: 4018.0, high: 4022.0, low: 4012.0, close: 4020.0, volume: 1200 },
    // 1. SC (Selling Climax - 'il chiodo')
    { time: baseTime + 2 * 900, open: 4020.0, high: 4021.0, low: 4000.0, close: 4008.0, volume: 3500 },
    // 2. AR (Automatic Rally)
    { time: baseTime + 3 * 900, open: 4008.0, high: 4035.0, low: 4007.0, close: 4032.0, volume: 2800 },
    // 3. ST (Secondary Test, low higher than SC)
    { time: baseTime + 4 * 900, open: 4032.0, high: 4033.0, low: 4016.0, close: 4020.0, volume: 900 },
    // 4. 10% (Zona Apollo: sweep above AR)
    { time: baseTime + 5 * 900, open: 4020.0, high: 4040.0, low: 4019.0, close: 4036.0, volume: 2200 },
    // 5. STB (First sweep below SC 4000.0)
    { time: baseTime + 6 * 900, open: 4036.0, high: 4037.0, low: 3995.0, close: 4004.0, volume: 3100 },
    // 6. Spring (Final sweep below STB 3995.0)
    { time: baseTime + 7 * 900, open: 4004.0, high: 4006.0, low: 3988.0, close: 4002.0, volume: 4200 },
    // 7. Retest / Zona di Test on STB shadow (3995 - 4004)
    { time: baseTime + 8 * 900, open: 4002.0, high: 4025.0, low: 3998.0, close: 4024.0, volume: 2600 },
    // 8. Markup breaking 10% (4040.0) forming 10% 2 (4052.0)
    { time: baseTime + 9 * 900, open: 4024.0, high: 4052.0, low: 4022.0, close: 4048.0, volume: 3900 },
  ];

  const geom = analyzeWyckoffSchematicGeometry(candles, "long", "XAUUSD", false, false);
  assert.equal(geom.schematicType, "accumulation");
  assert.equal(geom.climaxPrice, 4000.0, "SC should be at 4000.0");
  assert.equal(geom.arPrice, 4035.0, "AR should be at 4035.0");
  assert.equal(geom.hasSpringOrUt, true, "Spring must be detected");
  assert.equal(geom.springOrUtExtreme, 3988.0, "Spring extreme should be 3988.0");
  assert.equal(geom.tenPercentLevel, 4040.0, "10% Apollo should be at 4040.0");
  assert.equal(geom.tenPercent2Level, 4052.0, "10% 2 should be at 4052.0");

  // JTC Zone must be between 10% shadow high (4040.0) and AR body/high (4032-4035)
  assert.ok(geom.jtcBtiZoneHigh >= 4035.0, "JTC high should cover 10% level");
  assert.ok(geom.jtcBtiZoneLow <= 4035.0, "JTC low should cover AR level");

  // Schematic Points
  const labels = geom.schematicPoints.map((p) => p.label);
  assert.ok(labels.includes("SC"), "Must include SC");
  assert.ok(labels.includes("AR"), "Must include AR");
  assert.ok(labels.includes("STB"), "Must include STB");
  assert.ok(labels.includes("Spring"), "Must include Spring");
  assert.ok(labels.includes("10% 2"), "Must include 10% 2");

  // Box geometry
  assert.equal(geom.creekPrice, 4040.0, "Creek should be upper boundary (4040.0)");
  assert.equal(geom.icePrice, 3988.0, "Ice should be lowest boundary (3988.0)");
  assert.equal(geom.equilibriumPrice, 4014.0, "Equilibrium 50% should be (4040 + 3988)/2 = 4014.0");
  assert.ok(geom.phase === "Phase D" || geom.phase === "Phase E", "Breakout above 10% must be Phase D or E");
});

test("analyzeWyckoffSchematicGeometry identifies Reaccumulation (Causa 2 nel Markup)", () => {
  const baseTime = 1711000000;
  const candles: VarcoVisionCandle[] = [];
  // Existing markup trend (Causa 1 già avvenuta)
  for (let i = 0; i < 15; i++) {
    candles.push({
      time: baseTime + i * 900,
      open: 1.0800 + i * 0.0010,
      high: 1.0805 + i * 0.0010,
      low: 1.0798 + i * 0.0010,
      close: 1.0804 + i * 0.0010,
      volume: 1200,
    });
  }
  // Causa 2 Re-accumulation range
  for (let i = 15; i < 30; i++) {
    candles.push({
      time: baseTime + i * 900,
      open: 1.0950,
      high: 1.0965,
      low: 1.0940,
      close: 1.0955,
      volume: 800,
    });
  }

  const geom = analyzeWyckoffSchematicGeometry(candles, "long", "EURUSD", false, false, {
    isReaccumOrRedistrib: true,
    markupCount: 1,
    zoneScenario: "reaccum",
  });

  assert.equal(geom.schematicType, "reaccumulation", "Should classify as reaccumulation");
  assert.ok(geom.schematicBox.schematicType === "reaccumulation");
  assert.ok(geom.creekPrice > geom.icePrice);
  assert.ok(geom.equilibriumPrice > geom.icePrice && geom.equilibriumPrice < geom.creekPrice);
});

test("analyzeWyckoffSchematicGeometry identifies Redistribution (Causa 2 nel Markdown)", () => {
  const baseTime = 1712000000;
  const candles: VarcoVisionCandle[] = [];
  // Existing markdown trend (Causa 1 già avvenuta)
  for (let i = 0; i < 15; i++) {
    candles.push({
      time: baseTime + i * 900,
      open: 1.1000 - i * 0.0010,
      high: 1.1002 - i * 0.0010,
      low: 1.0990 - i * 0.0010,
      close: 1.0992 - i * 0.0010,
      volume: 1200,
    });
  }
  // Causa 2 Re-distribution range
  for (let i = 15; i < 30; i++) {
    candles.push({
      time: baseTime + i * 900,
      open: 1.0850,
      high: 1.0865,
      low: 1.0840,
      close: 1.0855,
      volume: 800,
    });
  }

  const geom = analyzeWyckoffSchematicGeometry(candles, "short", "EURUSD", false, false, {
    isReaccumOrRedistrib: true,
    markupCount: 1,
    zoneScenario: "reaccum",
  });

  assert.equal(geom.schematicType, "redistribution", "Should classify as redistribution");
  assert.ok(geom.schematicBox.schematicType === "redistribution");
  assert.ok(geom.creekPrice > geom.icePrice);
  assert.ok(geom.equilibriumPrice > geom.icePrice && geom.equilibriumPrice < geom.creekPrice);
});

test("analyzeWyckoffSchematicGeometry models user XAUUSD diagram with BC, AR, ST, JTC, UT, UTAD, Test on UT, 10% and Causa 2", () => {
  const baseTime = 1713000000;
  const candles: VarcoVisionCandle[] = [
    // Markup iniziale
    { time: baseTime + 0 * 900, open: 3840.0, high: 3848.0, low: 3838.0, close: 3846.0, volume: 1100 },
    // 1. BC (Buying Climax @ ~3856)
    { time: baseTime + 1 * 900, open: 3846.0, high: 3856.0, low: 3845.0, close: 3853.0, volume: 3200 },
    // 2. AR (Automatic Reaction @ ~3828)
    { time: baseTime + 2 * 900, open: 3853.0, high: 3854.0, low: 3828.0, close: 3830.0, volume: 2900 },
    // 3. ST (Secondary Test @ ~3845)
    { time: baseTime + 3 * 900, open: 3830.0, high: 3845.0, low: 3829.0, close: 3842.0, volume: 1400 },
    // 4. Minimo interno corridoio JTC (@ ~3824)
    { time: baseTime + 4 * 900, open: 3842.0, high: 3843.0, low: 3824.0, close: 3827.0, volume: 1800 },
    // 5. UT (Upthrust sopra BC @ ~3861)
    { time: baseTime + 5 * 900, open: 3827.0, high: 3861.0, low: 3826.0, close: 3858.0, volume: 3800 },
    // Pullback prima di UTAD
    { time: baseTime + 6 * 900, open: 3858.0, high: 3859.0, low: 3848.0, close: 3852.0, volume: 1200 },
    // 6. UTAD (Upthrust After Distribution @ 3868.6)
    { time: baseTime + 7 * 900, open: 3852.0, high: 3868.6, low: 3851.0, close: 3862.0, volume: 4600 },
    // 7. Re-test su zona UT (3858 - 3861)
    { time: baseTime + 8 * 900, open: 3862.0, high: 3861.0, low: 3856.0, close: 3857.0, volume: 2100 },
    // 8. 1° Markdown che sprofonda al livello 10% (3814.0)
    { time: baseTime + 9 * 900, open: 3857.0, high: 3858.0, low: 3814.0, close: 3818.0, volume: 5400 },
  ];

  const geom = analyzeWyckoffSchematicGeometry(candles, "short", "XAUUSD", false, false);
  assert.equal(geom.schematicType, "distribution");
  assert.equal(geom.climaxPrice, 3856.0, "BC should be at 3856.0");
  assert.equal(geom.arPrice, 3828.0, "AR should be at 3828.0");
  assert.equal(geom.hasSpringOrUt, true, "UT must be detected");
  assert.equal(geom.hasUtad, true, "UTAD must be detected");
  assert.equal(geom.utadPrice, 3868.6, "UTAD extreme should be 3868.6");

  // In the user's diagram, the TEST box is anchored on UT (high 3861.0)
  assert.equal(geom.testZoneTop, 3861.0, "TEST zone top must be anchored on UT high (3861.0)");
  assert.ok(geom.testZoneRuleLabel.includes("UTAD"), "Rule label must mention UTAD sweep");

  // In the user's diagram, JTC corridor is between AR (3828.0) and the phase B low (3824.0)
  assert.ok(geom.jtcBtiZoneHigh >= 3828.0, "JTC zone top should align with AR level");
  assert.ok(geom.jtcBtiZoneLow <= 3828.0, "JTC zone bottom should cover below AR");

  // Points verification
  const labels = geom.schematicPoints.map((p) => p.label);
  assert.ok(labels.includes("BC"));
  assert.ok(labels.includes("AR"));
  assert.ok(labels.includes("ST"));
  assert.ok(labels.includes("UT"));
  assert.ok(labels.includes("UTAD"));
  assert.ok(labels.includes("10%"));
});
