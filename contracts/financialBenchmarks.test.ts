import assert from "node:assert/strict";
import {
  TOP_50_EQUITIES_AND_ETFS,
  TOP_50_DIVIDENDS_BASKET,
  TOP_50_CRYPTO_BASKET,
  CURRENT_GOLD_BENCHMARK,
  LIMEN_TRADING_KELLY_MODEL,
  calculateEquityBasketTiming,
  calculateDividendBasketTiming,
  calculateCryptoBasketTiming,
  calculateGoldMarketTiming,
  calculateTradingKellyPositioning,
  calculateCrossAssetAllocationMatrix,
} from "./financialArchitecture.js";

// 1. Verifica Integrità Panieri Top 50
assert.equal(TOP_50_EQUITIES_AND_ETFS.length, 50, "Il paniere Azioni & ETF deve contenere esattamente 50 titoli");
assert.equal(TOP_50_DIVIDENDS_BASKET.length, 50, "Il paniere Dividendi Aristocratici deve contenere esattamente 50 titoli");
assert.equal(TOP_50_CRYPTO_BASKET.length, 50, "Il paniere Criptovalute deve contenere esattamente 50 asset");

// Helper di verifica pesi fattori
function assertFactorsNormalized(factors: any[], name: string) {
  assert.ok(Array.isArray(factors), `${name}: factors deve essere un array`);
  assert.equal(factors.length, 4, `${name}: devono esserci esattamente 4 fattori`);
  const totalWeight = factors.reduce((sum, f) => sum + f.weightPct, 0);
  assert.equal(totalWeight, 100, `${name}: la somma dei pesi dei fattori deve essere rigorosamente 100%`);
  for (const factor of factors) {
    assert.ok(factor.score >= 0 && factor.score <= 100, `${name} - ${factor.name}: score compreso tra 0 e 100`);
    assert.ok(typeof factor.rawMetric === "string" && factor.rawMetric.length > 0);
    assert.ok(typeof factor.benchmarkNeutral === "string" && factor.benchmarkNeutral.length > 0);
    assert.ok(["OTTIMALE", "FAVOREVOLE", "NEUTRALE", "PRUDENZA"].includes(factor.status));
  }
}

// 2. Verifica Calcolo Timing Multi-Fattore Azionario
const equityTiming = calculateEquityBasketTiming(TOP_50_EQUITIES_AND_ETFS);
{
  assert.ok(equityTiming.score >= 0 && equityTiming.score <= 100);
  assert.ok(equityTiming.expectedAnnualReturnPct >= 11.0 && equityTiming.expectedAnnualReturnPct <= 16.0);
  assert.ok(typeof equityTiming.regimeLabel === "string" && equityTiming.regimeLabel.length > 0);
  assertFactorsNormalized(equityTiming.factors, "Azionario");
}

// 3. Verifica Calcolo Timing Multi-Fattore Dividendi
const divTiming = calculateDividendBasketTiming(TOP_50_DIVIDENDS_BASKET);
{
  assert.ok(divTiming.score >= 0 && divTiming.score <= 100);
  assert.ok(divTiming.expectedAnnualReturnPct >= 8.0 && divTiming.expectedAnnualReturnPct <= 12.0);
  assert.ok(divTiming.triggerSummary.includes("Yield") || divTiming.triggerSummary.includes("Rendimento"));
  assertFactorsNormalized(divTiming.factors, "Dividendi");
}

// 4. Verifica Calcolo Timing Multi-Fattore Crypto & Staking
const cryptoTiming = calculateCryptoBasketTiming(TOP_50_CRYPTO_BASKET);
{
  assert.ok(cryptoTiming.score >= 0 && cryptoTiming.score <= 100);
  assert.ok(cryptoTiming.weightedStakingApyPct >= 4.0 && cryptoTiming.weightedStakingApyPct <= 8.0);
  assert.ok(cryptoTiming.expectedAnnualReturnPct >= 20.0);
  assertFactorsNormalized(cryptoTiming.factors, "Crypto");
}

// 5. Verifica Calcolo Timing Multi-Fattore Oro XAU/USD
const goldTiming = calculateGoldMarketTiming(CURRENT_GOLD_BENCHMARK);
{
  assert.ok(goldTiming.score >= 0 && goldTiming.score <= 100);
  assert.ok(goldTiming.expectedAnnualReturnPct >= 8.0 && goldTiming.expectedAnnualReturnPct <= 12.0);
  assert.equal(CURRENT_GOLD_BENCHMARK.symbol, "XAUUSD");
  assert.ok(CURRENT_GOLD_BENCHMARK.spotPriceUsd > 2000);
  assert.ok(CURRENT_GOLD_BENCHMARK.sma200Usd > 1800);
  assertFactorsNormalized(goldTiming.factors, "Oro");
}

// 6. Verifica Posizionamento Trading Half-Kelly & Probabilità di Rovina
const kelly = calculateTradingKellyPositioning(8000, 50000, LIMEN_TRADING_KELLY_MODEL);
{
  assert.equal(kelly.halfKellyRiskPct, 0.81);
  assert.equal(kelly.riskPerTradeEuro, 65);
  assert.ok(kelly.netWorthRiskPct >= 0.12 && kelly.netWorthRiskPct <= 0.14);
  assert.ok(kelly.consecutiveLossTolerance >= 30);
  assert.ok(kelly.probabilityOfRuinPct >= 0 && kelly.probabilityOfRuinPct < 0.001);
  assert.ok(kelly.expectedValuePerTradeEuro > 0);
  assertFactorsNormalized(kelly.factors, "Trading");
}

// 7. Verifica Matrice di Rotazione Tattica Cross-Asset
{
  const matrix = calculateCrossAssetAllocationMatrix(
    equityTiming,
    divTiming,
    cryptoTiming,
    goldTiming,
    kelly
  );

  assert.ok(matrix.rankings.length === 5, "La matrice deve classificare esattamente le 5 configurazioni strategiche");
  assert.equal(matrix.rankings[0].rank, 1, "Il primo elemento deve avere rank 1");
  assert.equal(matrix.rankings[4].rank, 5, "L'ultimo elemento deve avere rank 5");
  assert.ok(matrix.topOpportunity.score >= matrix.rankings[1].score);
  assert.ok(typeof matrix.rotationHeadline === "string" && matrix.rotationHeadline.length > 0);
  assert.ok(matrix.pairwiseInsights.equityVsDividends.length > 0);
  assert.ok(matrix.pairwiseInsights.cryptoVsGold.length > 0);
  assert.ok(matrix.pairwiseInsights.tradingVsPassive.length > 0);
}

console.log("all quantitative multi-factor and cross-asset timing tests passed successfully");
