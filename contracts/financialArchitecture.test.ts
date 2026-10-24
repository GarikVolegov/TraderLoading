import assert from "node:assert/strict";
import {
  calculateVitalLiquidity,
  checkReserveConstraint,
  calculatePsychologicalPressure,
  evaluateExpectation,
  calculateOptimalLimenAllocation,
  calculatePillarsPercentages,
  validateFinancialProfile,
  simulateMonteCarloEquity,
  DEFAULT_FINANCIAL_PROFILE,
} from "./financialArchitecture.js";

// 1. Regola 1: Liquidità Vitale
{
  const res = calculateVitalLiquidity({
    totalNetWorth: 50000,
    monthlyExpenses: 2000,
    liquidityMonthsCovered: 6,
  });
  assert.equal(res.liquidityRequired, 12000);
  assert.equal(res.liquidityAllocation, 12000);
  assert.equal(res.investableCapital, 38000);
  assert.equal(res.isSufficient, true);
  assert.equal(res.errorMessage, null);

  // Insufficient capital
  const broke = calculateVitalLiquidity({
    totalNetWorth: 10000,
    monthlyExpenses: 2000,
    liquidityMonthsCovered: 6,
  });
  assert.equal(broke.liquidityRequired, 12000);
  assert.equal(broke.liquidityAllocation, 10000);
  assert.equal(broke.investableCapital, 0);
  assert.equal(broke.isSufficient, false);
  assert.ok(broke.errorMessage?.includes("Patrimonio insufficiente"));

  // Zero / negative edge cases
  const zero = calculateVitalLiquidity({
    totalNetWorth: 0,
    monthlyExpenses: 0,
    liquidityMonthsCovered: 6,
  });
  assert.equal(zero.liquidityAllocation, 0);
  assert.equal(zero.investableCapital, 0);
}

// 2. Regola 2: Vincolo 1:1 Riserva vs Trading
{
  const valid = checkReserveConstraint({
    totalNetWorth: 50000,
    liquidityAllocation: 12000,
    reserveAllocation: 10000,
    tradingAllocation: 10000,
  });
  assert.equal(valid.isValid, true);
  assert.equal(valid.status, "VALID");
  assert.equal(valid.errorMessage, null);

  const invalid = checkReserveConstraint({
    totalNetWorth: 50000,
    liquidityAllocation: 12000,
    reserveAllocation: 8000,
    tradingAllocation: 10000,
  });
  assert.equal(invalid.isValid, false);
  assert.equal(invalid.status, "CRITICAL_ERROR");
  assert.ok(invalid.errorMessage?.includes("Violazione Regola di Riserva"));

  // Max allowed trading capital calculation
  const maxCalc = checkReserveConstraint({
    totalNetWorth: 50000,
    liquidityAllocation: 10000,
    reserveAllocation: 10000,
    tradingAllocation: 8000,
    investmentsAllocation: 15000,
    futureProjectsAllocation: 5000,
  });
  // investable = 40000, remaining = 40000 - 15000 - 5000 = 20000, max allowed trading = 10000
  assert.equal(maxCalc.maxAllowedTradingCapital, 10000);
}

// 3. Regola 3: Indice di Pressione Psicologica
{
  // ZONA OTTIMALE: reserve >= trading, weight <= 20%, income >= expenses
  const opt = calculatePsychologicalPressure({
    totalNetWorth: 100000,
    reserveAllocation: 20000,
    tradingAllocation: 15000, // 15%
    externalStableIncome: 3000,
    monthlyExpenses: 2000,
    simulatedDrawdownPct: 10,
  });
  assert.equal(opt.zone, "OPTIMAL");
  assert.equal(opt.badgeTone, "optimal");
  assert.equal(opt.tradingWeightPct, 15);
  assert.equal(opt.simulatedDrawdownEuro, 1500);
  assert.equal(opt.netWorthDrawdownImpactPct, 1.5);

  // ZONA DI ATTENZIONE: weight > 20% or income < expenses
  const att1 = calculatePsychologicalPressure({
    totalNetWorth: 50000,
    reserveAllocation: 15000,
    tradingAllocation: 12000, // 24% (> 20%)
    externalStableIncome: 3000,
    monthlyExpenses: 2000,
  });
  assert.equal(att1.zone, "ATTENTION");

  const att2 = calculatePsychologicalPressure({
    totalNetWorth: 100000,
    reserveAllocation: 20000,
    tradingAllocation: 15000, // 15%
    externalStableIncome: 1500, // < 2000 expenses
    monthlyExpenses: 2000,
  });
  assert.equal(att2.zone, "ATTENTION");

  // ZONA CRITICA: reserve < trading OR weight > 40%
  const crit1 = calculatePsychologicalPressure({
    totalNetWorth: 50000,
    reserveAllocation: 5000,
    tradingAllocation: 10000, // reserve < trading
    externalStableIncome: 3000,
    monthlyExpenses: 2000,
  });
  assert.equal(crit1.zone, "CRITICAL");
  assert.equal(crit1.badgeTone, "critical");

  const crit2 = calculatePsychologicalPressure({
    totalNetWorth: 50000,
    reserveAllocation: 25000,
    tradingAllocation: 22000, // 44% (> 40%)
    externalStableIncome: 3000,
    monthlyExpenses: 2000,
  });
  assert.equal(crit2.zone, "CRITICAL");
}

// 4. Regola 4: Termometro delle Aspettative
{
  const s = evaluateExpectation({ expectedMonthlyReturnPct: 2.5, tradingAllocation: 10000 });
  assert.equal(s.level, "SUSTAINABLE");
  assert.equal(s.isWarning, false);
  assert.equal(s.expectedMonthlyProfitEuro, 250);

  const c = evaluateExpectation({ expectedMonthlyReturnPct: 5, tradingAllocation: 10000 });
  assert.equal(c.level, "CHALLENGING");
  assert.equal(c.isWarning, false);
  assert.equal(c.expectedMonthlyProfitEuro, 500);

  const a = evaluateExpectation({ expectedMonthlyReturnPct: 10, tradingAllocation: 10000 });
  assert.equal(a.level, "AGGRESSIVE_DANGEROUS");
  assert.equal(a.isWarning, true);
  assert.equal(a.expectedMonthlyProfitEuro, 1000);
}

// 5. Allocazione Ottimale LIMEN
{
  const opt = calculateOptimalLimenAllocation({
    totalNetWorth: 60000,
    monthlyExpenses: 2000,
    liquidityMonthsCovered: 6,
    externalStableIncome: 3000,
    hasDependents: false,
  });
  assert.equal(opt.liquidityAllocation, 12000);
  assert.ok(opt.reserveAllocation >= opt.tradingAllocation, "Riserva deve essere >= Trading");
  assert.ok(opt.tradingAllocation <= 60000 * 0.20, "Trading non deve superare il 20% del totale");

  const sum =
    opt.liquidityAllocation +
    opt.reserveAllocation +
    opt.tradingAllocation +
    opt.investmentsAllocation +
    opt.futureProjectsAllocation;
  assert.equal(sum, 60000, "La somma dei 5 pilastri deve essere esattamente 60000");

  const pct = calculatePillarsPercentages(opt, 60000);
  const sumPct = Math.round(
    pct.liquidityPct +
      pct.reservePct +
      pct.tradingPct +
      pct.investmentsPct +
      pct.futureProjectsPct,
  );
  assert.equal(sumPct, 100, "Le percentuali devono sommare a 100%");

  // Allocazione con Familiari a Carico (hasDependents = true)
  const optDep = calculateOptimalLimenAllocation({
    totalNetWorth: 80000,
    monthlyExpenses: 2500,
    liquidityMonthsCovered: 6,
    externalStableIncome: 3000,
    hasDependents: true,
  });
  assert.equal(optDep.liquidityAllocation, 15000);
  assert.ok(optDep.reserveAllocation >= optDep.tradingAllocation, "Riserva >= Trading con familiari a carico");
  assert.ok(optDep.tradingAllocation <= 80000 * 0.15, "Trading cap 15% con familiari a carico");
  const sumDep =
    optDep.liquidityAllocation +
    optDep.reserveAllocation +
    optDep.tradingAllocation +
    optDep.investmentsAllocation +
    optDep.futureProjectsAllocation;
  assert.equal(sumDep, 80000, "Somma con familiari a carico deve essere esattamente 80000");

  // Allocazione con Deficit Flussi Esterni (income < expenses)
  const optDeficit = calculateOptimalLimenAllocation({
    totalNetWorth: 100000,
    monthlyExpenses: 3000,
    liquidityMonthsCovered: 6,
    externalStableIncome: 1500, // Deficit rispetto alle spese
    hasDependents: false,
  });
  assert.ok(optDeficit.reserveAllocation >= optDeficit.tradingAllocation * 1.5, "Riserva rafforzata con deficit di cashflow");
  const sumDeficit =
    optDeficit.liquidityAllocation +
    optDeficit.reserveAllocation +
    optDeficit.tradingAllocation +
    optDeficit.investmentsAllocation +
    optDeficit.futureProjectsAllocation;
  assert.equal(sumDeficit, 100000, "Somma con deficit deve essere esattamente 100000");

  // Allocazione con importo irregolare/dispari (es. 77777 €)
  const optOdd = calculateOptimalLimenAllocation({
    totalNetWorth: 77777,
    monthlyExpenses: 1850,
    liquidityMonthsCovered: 5,
    externalStableIncome: 2200,
    hasDependents: false,
  });
  const sumOdd =
    optOdd.liquidityAllocation +
    optOdd.reserveAllocation +
    optOdd.tradingAllocation +
    optOdd.investmentsAllocation +
    optOdd.futureProjectsAllocation;
  assert.equal(sumOdd, 77777, "Somma esatta al centesimo anche per cifre dispari");
}

// 6. Validazione Profilo Finanziario
{
  const valid = validateFinancialProfile({
    ...DEFAULT_FINANCIAL_PROFILE,
    totalNetWorth: 50000,
    liquidityAllocation: 12000,
    reserveAllocation: 12000,
    tradingAllocation: 8000,
    investmentsAllocation: 12000,
    futureProjectsAllocation: 6000,
  });
  assert.equal(valid.isValid, true);
  assert.equal(valid.errors.length, 0);

  const broken = validateFinancialProfile({
    ...DEFAULT_FINANCIAL_PROFILE,
    totalNetWorth: 50000,
    liquidityAllocation: 12000,
    reserveAllocation: 5000,
    tradingAllocation: 15000, // reserve < trading
    investmentsAllocation: 12000,
    futureProjectsAllocation: 6000,
  });
  assert.equal(broken.isValid, false);
  assert.ok(broken.errors.some((e) => e.includes("Violazione Regola di Riserva")));
}

// 7. Simulazione Monte Carlo per il Capitale Trading
{
  const mcZero = simulateMonteCarloEquity({
    initialCapital: 0,
    expectedMonthlyReturnPct: 3,
    simulatedDrawdownPct: 10,
    horizonMonths: 12,
    accountObjective: "GROWTH",
  });
  assert.equal(mcZero.endP50, 0);
  assert.equal(mcZero.samplePaths.length, 0);

  const mcGrowth = simulateMonteCarloEquity({
    initialCapital: 8000,
    expectedMonthlyReturnPct: 3,
    simulatedDrawdownPct: 10,
    horizonMonths: 12,
    accountObjective: "GROWTH",
    iterations: 200,
    seed: 42,
  });
  assert.equal(mcGrowth.p5.length, 13);
  assert.equal(mcGrowth.p10.length, 13); // 0 to 12 months
  assert.equal(mcGrowth.p50.length, 13);
  assert.equal(mcGrowth.p90.length, 13);
  assert.equal(mcGrowth.p95.length, 13);
  assert.ok(mcGrowth.endP95 >= mcGrowth.endP90, "P95 >= P90");
  assert.ok(mcGrowth.endP90 >= mcGrowth.endP50, "P90 >= P50");
  assert.ok(mcGrowth.endP50 >= mcGrowth.endP10, "P50 >= P10");
  assert.ok(mcGrowth.endP10 >= mcGrowth.endP5, "P10 >= P5");
  assert.ok(mcGrowth.samplePaths.length > 0, "sample paths generated");
  assert.equal(mcGrowth.samplePaths[0][0], 8000, "starts at initial capital");
  assert.equal(mcGrowth.histogram.length, 10, "10-bin distribution histogram");
  assert.equal(mcGrowth.monthDetails.length, 13, "13 month details");
  assert.ok(mcGrowth.monthlyCVaR95Pct >= mcGrowth.monthlyVaR95Pct, "CVaR >= VaR");
  assert.ok(mcGrowth.maxDrawdownP95Pct >= mcGrowth.maxDrawdownMedianPct, "MaxDD P95 >= Median");

  // Scalping vs Swing style verification
  const mcScalp = simulateMonteCarloEquity({
    initialCapital: 8000,
    expectedMonthlyReturnPct: 3,
    simulatedDrawdownPct: 10,
    horizonMonths: 12,
    accountObjective: "GROWTH",
    tradingStyle: "SCALPING",
    iterations: 200,
    seed: 42,
  });
  assert.equal(mcScalp.tradingStyle, "SCALPING");

  // Determinism check with same seed
  const mcGrowth2 = simulateMonteCarloEquity({
    initialCapital: 8000,
    expectedMonthlyReturnPct: 3,
    simulatedDrawdownPct: 10,
    horizonMonths: 12,
    accountObjective: "GROWTH",
    iterations: 200,
    seed: 42,
  });
  assert.equal(mcGrowth.endP50, mcGrowth2.endP50);
}

// 7. Dottrina Fiscale Italiana & Proiezioni Post-Tax (Drag Fiscale)
{
  const { ITALY_TAX_DOCTRINE, calculateWealthProjections, DEFAULT_WEALTH_SUB_ALLOCATIONS } = await import("./financialArchitecture.js");
  
  // Verifica specifiche fiscali italiane
  assert.equal(ITALY_TAX_DOCTRINE.countryCode, "IT");
  assert.equal(ITALY_TAX_DOCTRINE.standardCapitalGainRatePct, 26.0);
  assert.equal(ITALY_TAX_DOCTRINE.governmentBondRatePct, 12.5);
  assert.equal(ITALY_TAX_DOCTRINE.stampDutyInvestmentsPct, 0.20);
  assert.equal(ITALY_TAX_DOCTRINE.lossCarryForwardYears, 4);
  assert.equal(ITALY_TAX_DOCTRINE.primaryRegime, "DICHIARATIVO");
  assert.ok(ITALY_TAX_DOCTRINE.reportingDuties.some((d: any) => d.code === "QUADRO RT"));
  assert.ok(ITALY_TAX_DOCTRINE.reportingDuties.some((d: any) => d.code === "QUADRO RW"));
  assert.ok(ITALY_TAX_DOCTRINE.propFirmDoctrine.options.length >= 2);

  // Proiezioni a 5 anni: Lordo vs Netto Fiscale
  const grossProj = calculateWealthProjections({
    liquidityAllocation: 12000,
    reserveAllocation: 12000,
    tradingAllocation: 8000,
    subAllocations: DEFAULT_WEALTH_SUB_ALLOCATIONS,
    params: {
      timeHorizonYears: 5,
      monthlySavingsCapacity: 500,
      showNetOfTax: false,
    },
  });

  const netProj = calculateWealthProjections({
    liquidityAllocation: 12000,
    reserveAllocation: 12000,
    tradingAllocation: 8000,
    subAllocations: DEFAULT_WEALTH_SUB_ALLOCATIONS,
    params: {
      timeHorizonYears: 5,
      monthlySavingsCapacity: 500,
      showNetOfTax: true,
    },
  });

  assert.equal(grossProj.isNetOfTaxApplied, false);
  assert.equal(netProj.isNetOfTaxApplied, true);
  assert.ok(grossProj.endProjectedNetWorth > netProj.endProjectedNetWorth, "Gross NW > Net NW due to tax drag");
  assert.ok(netProj.taxDragEuro > 0, "Tax drag euro must be positive");
  assert.ok(netProj.taxDragPct > 0, "Tax drag pct must be positive");
  assert.ok(netProj.estimatedStampDutyTotalEuro > 0, "Stamp duty must be quantified");
  assert.ok(netProj.grossProjectedNetWorth === grossProj.endProjectedNetWorth, "Gross values match across calculations");
  assert.ok(netProj.trajectory[netProj.trajectory.length - 1].taxDragEuro > 0);
}

console.log("financialArchitecture contract tests passed!");

