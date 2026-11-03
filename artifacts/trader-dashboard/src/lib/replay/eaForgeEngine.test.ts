import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EA_ARCHETYPES,
  compileConceptToStrategy,
  formatStrategyToDsl,
  parseDslToStrategy,
  runEaHistoricalBacktest,
  generateMql5Code,
  generateCTraderCode,
} from "./eaForgeEngine";
import { resolveLimenEntitlements, LIMEN_TIERS } from "../../../../../contracts/limenServices";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("AUREUS L'Automa della Forgia — EA Concept-to-Bot, Casi Studio & Gate 150€", () => {
  it("1. Include 5 archetipi istituzionali pre-forgiati completi", () => {
    assert.equal(EA_ARCHETYPES.length, 5);
    const ids = EA_ARCHETYPES.map((a) => a.id);
    assert.ok(ids.includes("smc_sweep_fvg"));
    assert.ok(ids.includes("wyckoff_spring"));
    assert.ok(ids.includes("london_breakout"));
    assert.ok(ids.includes("ema_pullback_rsi"));
    assert.ok(ids.includes("bollinger_atr_reversion"));
  });

  it("2. Compila una spiegazione in linguaggio naturale in una strategia eseguibile (compileConceptToStrategy)", () => {
    const prompt =
      "Entra solo long su Wyckoff Spring a 30 candele durante la sessione di Londra con EMA 21 ed EMA 89, RSI < 35, stop di 18 pips, break-even a 1.5R, target 1:3.5 e rischio 0.75%";
    const compiled = compileConceptToStrategy(prompt);

    assert.equal(compiled.entryTrigger, "wyckoff_spring");
    assert.equal(compiled.direction, "buy");
    assert.equal(compiled.lookbackBars, 30);
    assert.equal(compiled.sessionFilter, "london");
    assert.equal(compiled.emaFastPeriod, 21);
    assert.equal(compiled.emaSlowPeriod, 89);
    assert.equal(compiled.rsiOversold, 35);
    assert.equal(compiled.stopLossMode, "fixed_pips");
    assert.equal(compiled.stopLossValue, 18);
    assert.equal(compiled.breakEvenAtR, 1.5);
    assert.equal(compiled.riskRewardTarget, 3.5);
    assert.equal(compiled.riskPctPerTrade, 0.75);
  });

  it("3. Converte e ricompila codice AUREUS Script DSL bidirezionalmente", () => {
    const base = EA_ARCHETYPES[0].strategy;
    const dsl = formatStrategyToDsl(base);
    assert.ok(dsl.includes("ENTRY_TRIGGER = LIQUIDITY_SWEEP"));

    const modifiedDsl = dsl
      .replace("TARGET_RR = 2.8", "TARGET_RR = 4.2")
      .replace("RISK_PERCENT = 0.5", "RISK_PERCENT = 1.25")
      .replace("SESSION_FILTER = LONDON_NY", "SESSION_FILTER = NY");

    const reparsed = parseDslToStrategy(modifiedDsl, base);
    assert.equal(reparsed.riskRewardTarget, 4.2);
    assert.equal(reparsed.riskPctPerTrade, 1.25);
    assert.equal(reparsed.sessionFilter, "ny");
  });

  it("4. Esegue il backtest storico candela-per-candela calcolando Winrate, R:R, Profit Factor e Casi Studio", () => {
    const result = runEaHistoricalBacktest({
      strategy: EA_ARCHETYPES[0].strategy,
      symbol: "EUR/USD",
      interval: "H1",
      initialBalance: 100_000,
    });

    assert.ok(result.totalTrades > 0, "Deve generare operazioni sullo storico");
    assert.ok(result.winRate >= 0 && result.winRate <= 100);
    assert.ok(result.avgRealizedRR > 0);
    assert.ok(result.profitFactor >= 0);
    assert.equal(result.sessionBreakdown.length, 3);
    assert.ok(result.equityCurve.length > 1);
    assert.ok(result.caseStudies.length >= 1, "Deve estrarre automaticamente i Casi Studio");

    const firstStudy = result.caseStudies[0];
    assert.ok(firstStudy.title.length > 0);
    assert.ok(firstStudy.lessonOrEdge.length > 0);
    assert.ok(firstStudy.optimizationHint.length > 0);
    assert.ok(firstStudy.trade.entryPrice > 0);
  });

  it("5. Genera codice completo per MetaTrader 5 (.mq5) e cTrader (.cs)", () => {
    const strategy = EA_ARCHETYPES[1].strategy;
    const mql5 = generateMql5Code(strategy, "XAU/USD", "M15");
    const ctrader = generateCTraderCode(strategy, "XAU/USD", "M15");

    assert.ok(mql5.includes("#include <Trade\\Trade.mqh>"));
    assert.ok(mql5.includes("void OnTick()"));
    assert.ok(mql5.includes("InpTargetRR"));
    assert.ok(ctrader.includes("namespace cAlgo.Robots"));
    assert.ok(ctrader.includes("public class AureusAutomaBot : Robot"));
  });

  it("6. Verifica che L'Automa della Forgia sia sbloccato solo sul Piano da 150€ (complete_150)", () => {
    const freeTier = resolveLimenEntitlements({
      status: "ammesso",
      approvedServices: ["base_protocol"],
    });
    assert.equal(freeTier.eaForgeStudio, false);

    const founders10Tier = resolveLimenEntitlements({
      status: "ammesso",
      approvedServices: ["base_protocol", "forge_of_the_past", "financial_architecture"],
    });
    assert.equal(founders10Tier.forgeOfThePast, true);
    assert.equal(founders10Tier.eaForgeStudio, false, "Il piano da 10€ non deve sbloccare l'Automa EA");

    const complete150Tier = resolveLimenEntitlements({
      status: "ammesso",
      approvedServices: ["base_protocol", "forge_of_the_past", "financial_architecture", "doctrine_of_time"],
    });
    assert.equal(complete150Tier.doctrineOfTime, true);
    assert.equal(complete150Tier.eaForgeStudio, true, "Il piano da 150€ deve sbloccare l'Automa EA");

    const tier150Def = LIMEN_TIERS.find((t) => t.id === "complete_150");
    assert.ok(tier150Def);
    assert.equal(tier150Def.monthlyEur, 150);
    assert.ok(tier150Def.features.some((f) => f.includes("Automa della Forgia")));
  });

  it("7. Verifica integrazione UI in EaForgeStudioPanel, Backtest.tsx e BacktestTerminal.tsx", () => {
    const panelSrc = fs.readFileSync(
      path.resolve(__dirname, "../../components/backtest-terminal/EaForgeStudioPanel.tsx"),
      "utf-8",
    );
    const backtestPageSrc = fs.readFileSync(
      path.resolve(__dirname, "../../pages/Backtest.tsx"),
      "utf-8",
    );
    const terminalSrc = fs.readFileSync(
      path.resolve(__dirname, "../../components/backtest-terminal/BacktestTerminal.tsx"),
      "utf-8",
    );

    assert.ok(panelSrc.includes("ESCLUSIVA PIANO 150 €/MESE"));
    assert.ok(panelSrc.includes('defaultTierId="complete_150"'));
    assert.ok(panelSrc.includes("Casi Studio Estratti"));
    assert.ok(backtestPageSrc.includes("EaForgeStudioPanel"));
    assert.ok(terminalSrc.includes("EaForgeStudioPanel"));
  });
});
