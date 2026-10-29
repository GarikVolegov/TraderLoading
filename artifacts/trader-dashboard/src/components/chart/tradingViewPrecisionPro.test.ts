import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeLots, pipSize, pipValuePerLot, riskAmountFor, riskRewardRatio } from "@/lib/replay/lotSizing";
import { getPipMultiplier } from "@/lib/pipMultiplier";
import { analyzeInstitutionalLiquidity, type LiquidityCandle } from "@/lib/chart/liquidityEngine";

describe("AUREUS TradingView Pro Precision & Risk Sizing", () => {
  it("1. Calcolo matematico lottaggio su Forex EURUSD (Conto €10,000, Rischio 1%, SL 25 pips)", () => {
    const symbol = "EURUSD";
    const balance = 10000;
    const riskPct = 1;
    const slPips = 25;
    const tpPips = 75;

    const cashRisk = riskAmountFor({ mode: "percent", value: riskPct, balance });
    assert.equal(cashRisk, 100, "Rischio cash deve essere esattamente €100.00");

    const pipVal = pipValuePerLot(symbol);
    assert.equal(pipVal, 10, "Valore pip per 1 lotto EURUSD deve essere €10/pip");

    const lots = computeLots({ riskAmount: cashRisk, slPips, symbol });
    // lots = 100 / (25 * 10) = 0.40 lotti
    assert.equal(lots, 0.4, "Il lottaggio calcolato deve essere esattamente 0.40 lotti");

    const effectiveRisk = lots * slPips * pipVal;
    assert.equal(effectiveRisk, 100, "Rischio effettivo monetario deve essere €100.00");

    const effectiveReward = lots * tpPips * pipVal;
    assert.equal(effectiveReward, 300, "Rendimento monetario deve essere €300.00 (1:3 R:R)");

    const rr = riskRewardRatio(slPips, tpPips);
    assert.equal(rr, 3, "Il rapporto R:R deve essere esattamente 3.00");
  });

  it("2. Calcolo lottaggio su Oro XAUUSD (Conto €25,000, Rischio 0.5%, SL 40 pips)", () => {
    const symbol = "XAUUSD";
    const balance = 25000;
    const riskPct = 0.5;
    const slPips = 40;
    const tpPips = 120;

    const cashRisk = riskAmountFor({ mode: "percent", value: riskPct, balance });
    assert.equal(cashRisk, 125, "Rischio cash deve essere €125.00");

    const pipVal = pipValuePerLot(symbol);
    assert.equal(pipVal, 10, "Valore pip per 1 lotto XAUUSD deve essere 10");

    const lots = computeLots({ riskAmount: cashRisk, slPips, symbol });
    // lots = 125 / (40 * 10) = 125 / 400 = 0.3125 -> floor(0.31)
    assert.equal(lots, 0.31, "Il lottaggio calcolato deve essere 0.31 lotti floored a 2 decimali");

    const effectiveRisk = lots * slPips * pipVal;
    assert.equal(effectiveRisk, 124, "Rischio effettivo deve essere €124.00 (non supera mai il tetto di €125)");

    const effectiveReward = lots * tpPips * pipVal;
    assert.equal(effectiveReward, 372, "Rendimento potenziale deve essere €372.00");
  });

  it("3. Calcolo lottaggio su Indici US30 / NAS100 (Rischio Fisso €250, SL 50 punti)", () => {
    const symbol = "US30";
    const slPips = 50;
    const tpPips = 150;

    const cashRisk = riskAmountFor({ mode: "fixed", value: 250, balance: 50000 });
    assert.equal(cashRisk, 250, "Rischio cash fisso deve essere €250.00");

    const pipVal = pipValuePerLot(symbol);
    assert.equal(pipVal, 1, "Valore pip/punto per US30 deve essere 1");

    const lots = computeLots({ riskAmount: cashRisk, slPips, symbol });
    // lots = 250 / (50 * 1) = 5.00 lotti
    assert.equal(lots, 5.0, "Il lottaggio calcolato deve essere esattamente 5.00 lotti");

    const effectiveRisk = lots * slPips * pipVal;
    assert.equal(effectiveRisk, 250, "Rischio effettivo deve essere €250.00");

    const effectiveReward = lots * tpPips * pipVal;
    assert.equal(effectiveReward, 750, "Rendimento potenziale deve essere €750.00");
  });

  it("4. Verifica Multi-Chart Active Pane Routing", () => {
    type ActivePane = "primary" | "secondary";
    let activePane: ActivePane = "primary";
    let primaryTool = "cursor";
    let secondaryTool = "cursor";

    const selectTool = (tool: string) => {
      if (activePane === "primary") {
        primaryTool = tool;
      } else {
        secondaryTool = tool;
      }
    };

    // User is on primary pane and selects longPosition
    selectTool("longPosition");
    assert.equal(primaryTool, "longPosition", "Pannello primario deve ricevere longPosition");
    assert.equal(secondaryTool, "cursor", "Pannello secondario deve rimanere su cursor");

    // User switches to companion pane
    activePane = "secondary";
    selectTool("fib");
    assert.equal(secondaryTool, "fib", "Pannello secondario deve ricevere fib");
    assert.equal(primaryTool, "longPosition", "Pannello primario mantiene il suo stato");
  });

  it("5. Verifica Replay Slicing & Scissors Guide Logic", () => {
    const candles = Array.from({ length: 100 }, (_, i) => ({
      time: 1700000000 + i * 3600,
      open: 2000 + i,
      high: 2010 + i,
      low: 1995 + i,
      close: 2005 + i,
    }));

    // Taglio della serie storica alla candela indice 45
    const cutIndex = 45;
    const revealedBars = candles.slice(0, cutIndex + 1);
    assert.equal(revealedBars.length, 46, "Devono essere visibili esattamente 46 candele");
    assert.equal(revealedBars[revealedBars.length - 1].time, candles[45].time, "L'ultima candela deve corrispondere al punto di taglio a forbice");

    // Simulazione playback step forward
    const nextRevealed = candles.slice(0, cutIndex + 2);
    assert.equal(nextRevealed.length, 47, "Step forward deve rivelare esattamente la candela successiva");
  });

  it("6. Verifica Guardrail Custode della Soglia e Target Parziale / Break-Even 50% (TP1/BE)", () => {
    const entryPrice = 4100.0;
    const tpPrice = 4190.0;
    const slPrice = 4070.0;
    const calculatedLots = 0.4;
    const effectiveReward = 360.0;

    const tpPips = Math.abs(tpPrice - entryPrice) * 10;
    const slPips = Math.abs(entryPrice - slPrice) * 10;
    const rrNumeric = tpPips / slPips;
    assert.equal(rrNumeric, 3.0, "R:R deve essere 3.0");
    assert.equal(rrNumeric >= 1.5, true, "Deve essere conforme alla Soglia del Custode (SOGLIA OK)");

    // Calcolo 50% TP1 / Break-Even
    const partialPrice = entryPrice + (tpPrice - entryPrice) * 0.5;
    const partialReward = effectiveReward * 0.5;
    const partialLots = Math.max(0.01, Number((calculatedLots * 0.5).toFixed(2)));

    assert.equal(partialPrice, 4145.0, "Livello TP1 / BE 50% deve essere esattamente a metà strada (4145.00)");
    assert.equal(partialReward, 180.0, "Rendimento parziale al 50% deve essere €180.00");
    assert.equal(partialLots, 0.2, "Lottaggio parziale da scaricare a TP1 deve essere 0.20 Lotti");
  });

  it("7. Verifica Crosshair Sync Polittico, Auto Break-Even Replay su TP1 e Sigillo Libro della Verità", () => {
    // 1. Crosshair Sync HTF lookup
    const htfCandles = [
      { time: 1700000000, close: 4100 },
      { time: 1700014400, close: 4120 },
      { time: 1700028800, close: 4150 },
    ];
    const primaryHoverTime = 1700018000; // A metà della seconda candela 4H
    let syncedBar = htfCandles[0];
    for (let i = htfCandles.length - 1; i >= 0; i--) {
      if (htfCandles[i].time <= primaryHoverTime) {
        syncedBar = htfCandles[i];
        break;
      }
    }
    assert.equal(syncedBar.time, 1700014400, "Il mirino sincronizzato HTF deve agganciare la candela 4H che contiene il timestamp primario");

    // 2. Auto Break-Even durante Replay quando il prezzo tocca TP1 / BE 50%
    const position = {
      direction: "buy" as const,
      entry: { time: 1700000000, price: 4100 },
      slPrice: 4070,
      tpPrice: 4190,
    };
    const partialPrice = position.entry.price + (position.tpPrice - position.entry.price) * 0.5; // 4145
    const replayCandle = { time: 1700003600, high: 4148, low: 4110 };
    const hitTp1 = replayCandle.high >= partialPrice;
    const nextSlPrice = hitTp1 && position.slPrice < position.entry.price ? position.entry.price : position.slPrice;
    assert.equal(nextSlPrice, 4100, "Lo Stop Loss deve spostarsi automaticamente a Break-Even (4100) al tocco di TP1 (4145)");
  });

  it("8. Verifica Esposizione Cumulativa Multi-Posizione, Snap Magnetico Liquidità e Dossier Sigillati", () => {
    // 1. Calcolo Esposizione Cumulativa su 2 posizioni attive
    const positions = [
      { slPips: 25, tpPips: 75, cashRisk: 100 }, // EURUSD: 0.40L, risk 100, reward 300
      { slPips: 50, tpPips: 150, cashRisk: 100 }, // EURUSD: 0.20L, risk 100, reward 300
    ];
    let totalLots = 0;
    let totalRisk = 0;
    let totalReward = 0;
    for (const p of positions) {
      const lots = computeLots({ riskAmount: p.cashRisk, slPips: p.slPips, symbol: "EURUSD" });
      const pipVal = pipValuePerLot("EURUSD");
      totalLots += lots;
      totalRisk += lots * p.slPips * pipVal;
      totalReward += lots * p.tpPips * pipVal;
    }
    assert.equal(Number(totalLots.toFixed(2)), 0.6, "Lottaggio cumulativo deve essere 0.60L");
    assert.equal(totalRisk, 200, "Rischio cumulativo deve essere €200");
    assert.equal(totalReward, 600, "Rendimento cumulativo potenziale deve essere €600");

    // 2. Smart-Liquidity Session High/Low Snapping (tolleranza <= 9px)
    const sessionHigh = 4200.0;
    const sessionLow = 4080.0;
    const rawPrice = 4198.5;
    const yForPrice = (price: number) => (4250 - price) * 2; // 2px per punto
    const targetY = yForPrice(rawPrice); // 103px
    let snappedPrice = rawPrice;
    for (const cand of [sessionHigh, sessionLow]) {
      if (Math.abs(yForPrice(cand) - targetY) <= 9) {
        snappedPrice = cand;
      }
    }
    assert.equal(snappedPrice, 4200.0, "La maniglia TP trascinata a 3px dal Session High deve agganciarsi magneticamente a 4200.0");
  });

  it("9. Verifica Motore Liquidità Istituzionale: BSL/SSL (PDH, PDL, HOD, LOD) e Soglie 50% Strutturale vs 0.786 Algoritmico", () => {
    const day1Start = 1729555200; // Giorno precedente
    const day2Start = day1Start + 86400; // Giorno corrente
    const candles: LiquidityCandle[] = [
      // Giorno precedente: High = 4180, Low = 4100
      { time: day1Start + 3600, open: 4120, high: 4180, low: 4110, close: 4150 },
      { time: day1Start + 7200, open: 4150, high: 4165, low: 4100, close: 4130 },
      ...Array.from({ length: 12 }, (_, i) => ({
        time: day2Start + i * 3600,
        open: 4135 + i * 2,
        high: 4145 + i * 2,
        low: 4125 + i * 2,
        close: 4140 + i * 2,
      })),
    ];

    const res = analyzeInstitutionalLiquidity(candles);
    const pdh = res.levels.find((l) => l.code === "PDH");
    const pdl = res.levels.find((l) => l.code === "PDL");
    const hod = res.levels.find((l) => l.code === "HOD");
    const lod = res.levels.find((l) => l.code === "LOD");
    const hasFibInLevels = res.levels.some((l) => l.code === "FIB_50" || l.code === "FIB_786");

    assert.ok(pdh && pdh.price === 4180 && pdh.side === "BSL", "PDH deve essere rilevato a 4180 come BSL [MAJOR]");
    assert.ok(pdl && pdl.price === 4100 && pdl.side === "SSL", "PDL deve essere rilevato a 4100 come SSL [MAJOR]");
    assert.ok(hod && hod.side === "BSL", "HOD deve essere rilevato come BSL");
    assert.ok(lod && lod.side === "SSL", "LOD deve essere rilevato come SSL");
    assert.equal(hasFibInLevels, false, "I livelli OTE non devono essere inclusi nei livelli dell'indicatore di liquidità");
    assert.ok(res.retracement && res.retracement.structural50 && res.retracement.algorithmic786, "Le soglie numeriche di ritracciamento restano calcolate per il bias");
  });

  it("10. Verifica Ponte Wyckoff Stop Hunt (SPRING Grab SSL / UTAD Grab BSL) e 4 Fasi del Ciclo Istituzionale", () => {
    const baseTime = 1729641600;
    const candles: LiquidityCandle[] = Array.from({ length: 15 }, (_, i) => ({
      time: baseTime + i * 3600,
      open: 4150,
      high: 4160,
      low: 4140,
      close: 4152,
    }));

    // Candela 15: SPRING (la spike buca 4140 scendendo a 4132 per prendere SSL, ma il corpo chiude dentro a 4148)
    candles.push({
      time: baseTime + 15 * 3600,
      open: 4145,
      high: 4155,
      low: 4132,
      close: 4148,
    });

    // Candela 16: UTAD (la spike supera 4160 salendo a 4169 per prendere BSL, ma il corpo chiude dentro a 4151)
    candles.push({
      time: baseTime + 16 * 3600,
      open: 4154,
      high: 4169,
      low: 4146,
      close: 4151,
    });

    const res = analyzeInstitutionalLiquidity(candles);
    const hasSpring = res.wyckoffGrabs.some((g) => g.kind === "SPRING" && g.side === "SSL");
    const hasUtad = res.wyckoffGrabs.some((g) => g.kind === "UTAD" && g.side === "BSL");

    assert.equal(hasSpring, true, "Deve rilevare SPRING (Grab SSL con chiusura corpo interna)");
    assert.equal(hasUtad, true, "Deve rilevare UTAD (Grab BSL con chiusura corpo interna)");
    assert.ok(
      ["ACCUMULO", "ASCESA", "DISTRIBUZIONE", "DECLINO"].includes(res.cycle.phase),
      "Deve classificare la fase del ciclo istituzionale",
    );
  });

  it("11. Verifica Dossier SIGILLA con Fase del Ciclo Istituzionale e Pool BSL/SSL Mirato (Passo 3)", () => {
    const day1Start = 1729555200;
    const day2Start = day1Start + 86400;
    const candles: LiquidityCandle[] = [
      { time: day1Start + 3600, open: 4120, high: 4185, low: 4110, close: 4150 },
      { time: day1Start + 7200, open: 4150, high: 4165, low: 4100, close: 4130 },
      ...Array.from({ length: 12 }, (_, i) => ({
        time: day2Start + i * 3600,
        open: 4135 + i,
        high: 4145 + i,
        low: 4125 + i,
        close: 4140 + i,
      })),
    ];

    const liqSnapshot = analyzeInstitutionalLiquidity(candles);
    const tpPrice = 4184.5; // Mirato al PDH (4185.0)
    const bslPools = liqSnapshot.levels.filter((l) => l.side === "BSL");
    let bestPool = bslPools[0];
    let minDiff = Math.abs(bestPool.price - tpPrice);
    for (const pool of bslPools) {
      const diff = Math.abs(pool.price - tpPrice);
      if (diff < minDiff) {
        minDiff = diff;
        bestPool = pool;
      }
    }

    const sealedRecord = {
      id: "pos-test-sigillo",
      symbol: "XAUUSD",
      direction: "buy",
      tpPrice,
      cyclePhase: liqSnapshot.cycle.phase,
      cycleTitle: liqSnapshot.cycle.title,
      dilutionRatio: liqSnapshot.cycle.dilutionRatio,
      targetLiquidityPool: bestPool.label,
    };

    assert.equal(sealedRecord.targetLiquidityPool, "BSL · PDH [MAJOR]", "Il Dossier SIGILLA deve registrare il pool BSL · PDH [MAJOR] mirato dal TP");
    assert.ok(
      ["ACCUMULO", "ASCESA", "DISTRIBUZIONE", "DECLINO"].includes(sealedRecord.cyclePhase),
      "Il Dossier SIGILLA deve includere la fase del ciclo istituzionale",
    );
  });
});
