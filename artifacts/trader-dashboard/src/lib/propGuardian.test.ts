import { describe, it } from "node:test";
import assert from "node:assert";
import {
  PROP_PROFILES,
  computePropGuardianTelemetry,
  formatSetupForClipboard,
  formatSetupSingleLine,
} from "./propGuardian.js";

describe("AUREUS Prop Guardian & Setup Exporter Engine", () => {
  const ftmo = PROP_PROFILES.find((p) => p.id === "ftmo")!;

  it("1. Profili Prop Firm contengono FTMO, The 5%ers, FundedNext e Alpha Capital con regole standard 5%", () => {
    assert.ok(ftmo, "Profilo FTMO deve esistere");
    assert.strictEqual(ftmo.maxDailyLossPct, 5.0, "FTMO deve avere 5.0% Max Daily Loss");
    assert.strictEqual(ftmo.maxTotalLossPct, 10.0, "FTMO deve avere 10.0% Max Total Loss");

    const fivePct = PROP_PROFILES.find((p) => p.id === "five_percenters");
    assert.ok(fivePct, "The 5%ers deve esistere");
    assert.strictEqual(fivePct.maxDailyLossPct, 5.0);
  });

  it("2. Calcola stato 'secure' (< 50% drawdown budget) con saldo integro", () => {
    // Balance 100k, Equity 99.5k (perdita 500€ su 5000€ consentiti = 10% del budget, ovvero 0.5% del conto)
    const tel = computePropGuardianTelemetry(100_000, 99_500, 0, ftmo, "EUR");
    assert.strictEqual(tel.currentDailyDrawdownAmount, 500);
    assert.strictEqual(tel.currentDailyDrawdownPct, 0.5);
    assert.strictEqual(tel.maxDailyLossAmount, 5000);
    assert.strictEqual(tel.dailyLossRemainingBudget, 4500);
    assert.strictEqual(tel.status, "secure");
    assert.strictEqual(tel.isCriticalBreachRisk, false);
    assert.strictEqual(tel.isDisqualified, false);
    assert.strictEqual(tel.statusBadgeTone, "emerald");
  });

  it("3. Calcola stato 'vigilance' (50% - 74% drawdown budget)", () => {
    // Balance 100k, Equity 97k (perdita 3000€ su 5000€ = 60% del budget, ovvero 3.0% del conto)
    const tel = computePropGuardianTelemetry(100_000, 97_000, -1000, ftmo, "EUR");
    assert.strictEqual(tel.currentDailyDrawdownAmount, 3000);
    assert.strictEqual(tel.currentDailyDrawdownPct, 3.0);
    assert.strictEqual(tel.status, "vigilance");
    assert.strictEqual(tel.isCriticalBreachRisk, false);
    assert.strictEqual(tel.statusBadgeTone, "amber");
  });

  it("4. Rileva soglia critica 75%+ e attiva isCriticalBreachRisk per il Bio-Lock", () => {
    // Balance 100k, Equity 96k (perdita 4000€ su 5000€ = 80% del budget, ovvero 4.0% del conto)
    const tel = computePropGuardianTelemetry(100_000, 96_000, -2500, ftmo, "EUR");
    assert.strictEqual(tel.currentDailyDrawdownAmount, 4000);
    assert.strictEqual(tel.currentDailyDrawdownPct, 4.0);
    assert.strictEqual(tel.status, "critical");
    assert.strictEqual(tel.isCriticalBreachRisk, true);
    assert.strictEqual(tel.isDisqualified, false);
    assert.strictEqual(tel.statusBadgeTone, "crimson");
  });

  it("5. Rileva violazione completa (breach >= 100%)", () => {
    // Balance 100k, Equity 94.5k (perdita 5500€ su 5000€ = 110%)
    const tel = computePropGuardianTelemetry(100_000, 94_500, -5500, ftmo, "EUR");
    assert.strictEqual(tel.status, "critical");
    assert.strictEqual(tel.isCriticalBreachRisk, true);
    assert.strictEqual(tel.isDisqualified, true);
  });

  it("6. Esportazione Setup per MT5 / cTrader genera parametri formattati e sintassi terminale", () => {
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
