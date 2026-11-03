import { describe, it } from "node:test";
import assert from "node:assert";
import {
  PROP_PROFILES,
  computePropGuardianTelemetry,
  calculatePropAdaptiveLots,
  formatSetupForClipboard,
  formatSetupSingleLine,
} from "./propGuardian.js";

describe("AUREUS Prop Guardian & Setup Exporter Engine", () => {
  const ftmo = PROP_PROFILES.find((p) => p.id === "ftmo")!;

  it("1. Profili Prop Firm contengono FTMO, The 5%ers, FundedNext e Alpha Capital con regole standard 5%", () => {
    assert.ok(ftmo, "Profilo FTMO deve esistere");
    assert.strictEqual(ftmo.maxDailyLossPct, 5.0, "FTMO deve avere 5.0% Max Daily Loss");
    assert.strictEqual(ftmo.maxTotalLossPct, 10.0, "FTMO deve avere 10.0% Max Total Loss");
    assert.strictEqual(ftmo.profitTargetPhase1Pct, 10.0, "FTMO Fase 1 deve avere target 10%");
    assert.strictEqual(ftmo.profitTargetPhase2Pct, 5.0, "FTMO Fase 2 deve avere target 5%");

    const fivePct = PROP_PROFILES.find((p) => p.id === "five_percenters");
    assert.ok(fivePct, "The 5%ers deve esistere");
    assert.strictEqual(fivePct.maxDailyLossPct, 5.0);
    assert.strictEqual(fivePct.profitTargetPhase1Pct, 8.0);
  });

  it("2. Calcola stato 'secure' (< 50% drawdown budget) con saldo integro e telemetria Profit Target", () => {
    // Balance 100k, Equity 104k (profitto 4000€ su 10000€ target FTMO = 40% avanzamento)
    const tel = computePropGuardianTelemetry(100_000, 104_000, 4000, ftmo, "EUR", 1);
    assert.strictEqual(tel.currentDailyDrawdownAmount, 0);
    assert.strictEqual(tel.currentDailyDrawdownPct, 0);
    assert.strictEqual(tel.maxDailyLossAmount, 5000);
    assert.strictEqual(tel.dailyLossRemainingBudget, 5000);
    assert.strictEqual(tel.status, "secure");
    assert.strictEqual(tel.isCriticalBreachRisk, false);
    assert.strictEqual(tel.isDisqualified, false);
    assert.strictEqual(tel.statusBadgeTone, "emerald");

    // Profit Target
    assert.strictEqual(tel.profitTargetAmount, 10000);
    assert.strictEqual(tel.currentProfitAmount, 4000);
    assert.strictEqual(tel.profitProgressPct, 40);
    assert.strictEqual(tel.targetRemainingAmount, 6000);
    assert.strictEqual(tel.isTargetAchieved, false);
  });

  it("3. Rileva completamento con successo del Profit Target della Challenge", () => {
    // Balance 100k, Equity 110.5k (profitto 10500€ su 10000€ target)
    const tel = computePropGuardianTelemetry(100_000, 110_500, 10500, ftmo, "EUR", 1);
    assert.strictEqual(tel.profitProgressPct, 100);
    assert.strictEqual(tel.targetRemainingAmount, 0);
    assert.strictEqual(tel.isTargetAchieved, true);
  });

  it("4. Calcola stato 'vigilance' (50% - 74% drawdown budget)", () => {
    // Balance 100k, Equity 97k (perdita 3000€ su 5000€ = 60% del budget, ovvero 3.0% del conto)
    const tel = computePropGuardianTelemetry(100_000, 97_000, -1000, ftmo, "EUR");
    assert.strictEqual(tel.currentDailyDrawdownAmount, 3000);
    assert.strictEqual(tel.currentDailyDrawdownPct, 3.0);
    assert.strictEqual(tel.status, "vigilance");
    assert.strictEqual(tel.isCriticalBreachRisk, false);
    assert.strictEqual(tel.statusBadgeTone, "amber");
  });

  it("5. Rileva soglia critica 75%+ e attiva isCriticalBreachRisk per il Bio-Lock", () => {
    // Balance 100k, Equity 96k (perdita 4000€ su 5000€ = 80% del budget, ovvero 4.0% del conto)
    const tel = computePropGuardianTelemetry(100_000, 96_000, -2500, ftmo, "EUR");
    assert.strictEqual(tel.currentDailyDrawdownAmount, 4000);
    assert.strictEqual(tel.currentDailyDrawdownPct, 4.0);
    assert.strictEqual(tel.status, "critical");
    assert.strictEqual(tel.isCriticalBreachRisk, true);
    assert.strictEqual(tel.isDisqualified, false);
    assert.strictEqual(tel.statusBadgeTone, "crimson");
  });

  it("6. Calcolo Automatico Lotti Adattivo 1-Tap (calculatePropAdaptiveLots)", () => {
    // Balance 100k, remaining buffer 5000€, SL 20 pips su EURUSD (pipVal = 10€)
    // Preset 0.50% consigliato prop -> rischio target = 500€
    // Lotti = 500 / (20 * 10) = 2.50 lotti
    const sizing05 = calculatePropAdaptiveLots({
      balance: 100_000,
      remainingDailyBudget: 5000,
      slPips: 20,
      symbol: "EURUSD",
      preset: "recommended_05",
    });
    assert.strictEqual(sizing05.lots, 2.5);
    assert.strictEqual(sizing05.monetaryRisk, 500);
    assert.strictEqual(sizing05.riskPctOfAccount, 0.5);
    assert.strictEqual(sizing05.maxConsecutiveLossesUntilBreach, 10);

    // Preset conservativo 0.25% -> rischio 250€ -> 1.25 lotti
    const sizing025 = calculatePropAdaptiveLots({
      balance: 100_000,
      remainingDailyBudget: 5000,
      slPips: 20,
      symbol: "EURUSD",
      preset: "conservative_025",
    });
    assert.strictEqual(sizing025.lots, 1.25);
    assert.strictEqual(sizing025.monetaryRisk, 250);
    assert.strictEqual(sizing025.riskPctOfAccount, 0.25);
    assert.strictEqual(sizing025.maxConsecutiveLossesUntilBreach, 20);

    // Sizing adattivo su buffer residuo degradato (es. rimangono solo 1000€ di buffer)
    // Con buffer 1000€, 25% del buffer = 250€ -> lotti 1.25
    const sizingAdaptive = calculatePropAdaptiveLots({
      balance: 100_000,
      remainingDailyBudget: 1000,
      slPips: 20,
      symbol: "EURUSD",
      preset: "buffer_adaptive",
    });
    assert.strictEqual(sizingAdaptive.lots, 1.25);
    assert.strictEqual(sizingAdaptive.monetaryRisk, 250);
    assert.strictEqual(sizingAdaptive.maxConsecutiveLossesUntilBreach, 4);
  });

  it("7. Esportazione Setup per MT5 / cTrader genera parametri formattati e sintassi terminale", () => {
    const formatted = formatSetupForClipboard({
      market: "XAUUSD",
      side: "BUY",
      entryPrice: "2752.40",
      stopLoss: "2745.00",
      takeProfit: "2775.00",
      lots: "1.25",
      riskReward: "3.05",
      riskAmount: "500",
      currency: "EUR",
      propFirmName: "FTMO",
      dailyDrawdownPct: 1.2,
      maxDailyLimitPct: 5.0,
    });

    assert.ok(formatted.includes("AUREUS PROTOCOL"), "Deve contenere intestazione AUREUS");
    assert.ok(formatted.includes("XAUUSD"), "Deve contenere l'asset XAUUSD");
    assert.ok(formatted.includes("BUY"), "Deve contenere la direzione BUY");
    assert.ok(formatted.includes("2752.40"), "Deve contenere il prezzo di ingresso");
    assert.ok(formatted.includes("2745.00"), "Deve contenere lo stop loss");
    assert.ok(formatted.includes("2775.00"), "Deve contenere il take profit");
    assert.ok(formatted.includes("1.25 Lotti"), "Deve contenere la size in lotti");
    assert.ok(formatted.includes("FTMO"), "Deve contenere il presidio Prop Firm");
    assert.ok(formatted.includes("#XAUUSD BUY"), "Deve contenere sintassi rapida terminale");

    const singleLine = formatSetupSingleLine({
      market: "EURUSD",
      side: "SELL",
      entryPrice: "1.08500",
      stopLoss: "1.08800",
      takeProfit: "1.07600",
      lots: "2.00",
    });
    assert.strictEqual(singleLine, "#EURUSD SELL 1.08500 SL 1.08800 TP 1.07600 LOTS 2.00");
  });
});
