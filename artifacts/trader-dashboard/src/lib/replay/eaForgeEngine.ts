// ─── AUREUS L'Automa della Forgia — EA Concept-to-Bot Compiler & Backtester ──
// Compiles natural-language trading concepts or AUREUS Script DSL into an
// executable algorithmic strategy, runs bar-by-bar historical backtesting,
// extracts institutional telemetry (Winrate, R:R, Profit Factor, Drawdown,
// Session breakdown), isolates Case Studies (Textbook, Momentum, Shield,
// Invalidation Lesson), and generates ready-to-use MQL5 (.mq5) & cTrader (.cs) code.

import { atr, bollinger, ema, rsi } from "../../components/chartIndicatorEngine";
import { computeLots, pipSize, pipValuePerLot } from "./lotSizing";
import type { ReplayCandleRaw } from "../replayCandlesApi";
import type { ClosedTrade, TradeDirection } from "./types";

export type EaTriggerType =
  | "liquidity_sweep"
  | "fvg_imbalance"
  | "wyckoff_spring"
  | "session_breakout"
  | "ema_cross_pullback"
  | "bollinger_reversion";

export type EaSessionFilter = "all" | "london" | "ny" | "london_ny" | "asia";

export type EaStopLossMode = "structure" | "atr" | "fixed_pips";

export type EaDirectionMode = "both" | "buy" | "sell";

export interface CompiledEaStrategy {
  id: string;
  name: string;
  conceptSummary: string;
  direction: EaDirectionMode;
  entryTrigger: EaTriggerType;
  lookbackBars: number;
  emaFastPeriod: number;
  emaSlowPeriod: number;
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  requireTrendAlignment: boolean;
  sessionFilter: EaSessionFilter;
  stopLossMode: EaStopLossMode;
  stopLossValue: number; // pips if fixed_pips, multiplier if atr, buffer pips if structure
  riskRewardTarget: number;
  breakEvenAtR: number | null;
  partialTakeProfitAtR: number | null;
  riskPctPerTrade: number;
  maxBarsInTrade: number;
}

export interface EaArchetypePreset {
  id: string;
  title: string;
  badge: string;
  shortDesc: string;
  conceptPrompt: string;
  strategy: CompiledEaStrategy;
}

export interface EaTradeIndicatorSnapshot {
  rsi: number;
  emaFast: number;
  emaSlow: number;
  atrPips: number;
  session: "Asia" | "Londra" | "New York";
  trendAligned: boolean;
  sweepDepthPips: number;
}

export interface EaExecutedTrade extends ClosedTrade {
  slPips: number;
  tpPips: number;
  riskAmount: number;
  breakEvenProtected: boolean;
  entryBarIndex: number;
  exitBarIndex: number;
  barsHeld: number;
  targetRR: number;
  realizedR: number;
  maeR: number;
  mfeR: number;
  snapshot: EaTradeIndicatorSnapshot;
  setupLabel: string;
}

export type EaCaseStudyCategory =
  | "textbook_gold"
  | "rapid_expansion"
  | "capital_shield"
  | "invalidation_lesson";

export interface EaCaseStudy {
  id: string;
  category: EaCaseStudyCategory;
  badge: string;
  title: string;
  trade: EaExecutedTrade;
  contextSummary: string;
  lessonOrEdge: string;
  optimizationHint: string;
}

export interface EaSessionBreakdownItem {
  session: "Asia" | "Londra" | "New York";
  total: number;
  wins: number;
  winRate: number;
  netR: number;
  netProfit: number;
}

export interface EaBacktestResult {
  strategy: CompiledEaStrategy;
  symbol: string;
  interval: string;
  initialBalance: number;
  finalBalance: number;
  netProfit: number;
  netProfitPct: number;
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  avgTargetRR: number;
  avgRealizedRR: number;
  profitFactor: number;
  expectancyR: number;
  expectancyCurrency: number;
  maxDrawdownPct: number;
  maxDrawdownAmount: number;
  longWinRate: number;
  shortWinRate: number;
  longCount: number;
  shortCount: number;
  candlesTested: number;
  periodStartTs: number;
  periodEndTs: number;
  equityCurve: Array<{ tradeIndex: number; time: number; balance: number; netR: number; drawdownPct: number }>;
  sessionBreakdown: EaSessionBreakdownItem[];
  trades: EaExecutedTrade[];
  caseStudies: EaCaseStudy[];
  dslCode: string;
  mql5Code: string;
  cTraderCode: string;
}

// ─── 1. ARCHETIPI ISTITUZIONALI PRE-FORGIATI ─────────────────────────────────

export const EA_ARCHETYPES: readonly EaArchetypePreset[] = [
  {
    id: "smc_sweep_fvg",
    title: "Sweep di Liquidità + FVG (SMC/ICT)",
    badge: "ISTITUZIONALE · SMC",
    shortDesc: "Caccia agli stop sopra/sotto il massimo/minimo a 20 barre con chiusura di rigetto e filtro sessione Londra/NY.",
    conceptPrompt:
      "Entra Long o Short quando il prezzo spazza la liquidità degli ultimi 20 periodi (Liquidity Sweep) durante Londra o New York, con rigetto confermato da RSI(14) < 42 per Long (> 58 per Short) e allineamento EMA 20/50. Stop Loss strutturale oltre lo spike, Break-Even a 1.2R e Target R:R 1:2.8 con rischio 0.5%.",
    strategy: {
      id: "smc_sweep_fvg",
      name: "Automa SMC Liquidity Sweep & FVG",
      conceptSummary: "Sweep di liquidità a 20 periodi con rigetto strutturale, filtro EMA 20/50 e sessioni Londra/NY.",
      direction: "both",
      entryTrigger: "liquidity_sweep",
      lookbackBars: 20,
      emaFastPeriod: 20,
      emaSlowPeriod: 50,
      rsiPeriod: 14,
      rsiOversold: 42,
      rsiOverbought: 58,
      requireTrendAlignment: true,
      sessionFilter: "london_ny",
      stopLossMode: "structure",
      stopLossValue: 4,
      riskRewardTarget: 2.8,
      breakEvenAtR: 1.2,
      partialTakeProfitAtR: 1.8,
      riskPctPerTrade: 0.5,
      maxBarsInTrade: 48,
    },
  },
  {
    id: "wyckoff_spring",
    title: "Wyckoff Spring & Test",
    badge: "DOTTRINA WYCKOFF",
    shortDesc: "Falsa rottura del range di accumulazione/distribuzione con recupero immediato e conferma di momento.",
    conceptPrompt:
      "Strategia Wyckoff Spring & Upthrust: identifica una compressione di 24 barre, attendi la falsa rottura del supporto/resistenza seguita da chiusura forte all'interno del range con RSI(14) reattivo. Stop Loss 1.5x ATR, Break-Even a 1.0R e Target R:R 1:3.0.",
    strategy: {
      id: "wyckoff_spring",
      name: "Automa Wyckoff Spring & Upthrust",
      conceptSummary: "Falsa rottura del box di accumulazione (Spring/Upthrust) a 24 barre con rientro impulsivo.",
      direction: "both",
      entryTrigger: "wyckoff_spring",
      lookbackBars: 24,
      emaFastPeriod: 21,
      emaSlowPeriod: 55,
      rsiPeriod: 14,
      rsiOversold: 45,
      rsiOverbought: 55,
      requireTrendAlignment: false,
      sessionFilter: "london_ny",
      stopLossMode: "atr",
      stopLossValue: 1.5,
      riskRewardTarget: 3.0,
      breakEvenAtR: 1.0,
      partialTakeProfitAtR: 2.0,
      riskPctPerTrade: 0.5,
      maxBarsInTrade: 60,
    },
  },
  {
    id: "london_breakout",
    title: "Breakout Range Asiatico (London Open)",
    badge: "FINESTRA BANCARIA",
    shortDesc: "Espansione direzionale alla rottura del consolidamento asiatico nelle prime ore della sessione di Londra.",
    conceptPrompt:
      "Misura il range delle ultime 16 candele e compra o vendi il breakout impulsivo durante l'apertura di Londra quando il prezzo chiude oltre il massimo/minimo del box in direzione della EMA 50. Stop Loss 1.4 ATR, Break-Even a 1.2R e Target R:R 1:2.5.",
    strategy: {
      id: "london_breakout",
      name: "Automa London Range Breakout",
      conceptSummary: "Rottura direzionale del consolidamento pre-sessione con filtro trend EMA 50 su Londra.",
      direction: "both",
      entryTrigger: "session_breakout",
      lookbackBars: 16,
      emaFastPeriod: 14,
      emaSlowPeriod: 50,
      rsiPeriod: 14,
      rsiOversold: 48,
      rsiOverbought: 52,
      requireTrendAlignment: true,
      sessionFilter: "london",
      stopLossMode: "atr",
      stopLossValue: 1.4,
      riskRewardTarget: 2.5,
      breakEvenAtR: 1.2,
      partialTakeProfitAtR: 1.5,
      riskPctPerTrade: 0.5,
      maxBarsInTrade: 36,
    },
  },
  {
    id: "ema_pullback_rsi",
    title: "Trend EMA 20/50 + Pullback RSI",
    badge: "TREND CONTINUATION",
    shortDesc: "Ingresso sul ritracciamento nella zona di valore tra EMA 20 ed EMA 50 durante trend istituzionale consolidato.",
    conceptPrompt:
      "Segui il trend quando EMA 20 è sopra EMA 50: entra sul pullback verso la EMA 20 quando RSI(14) scarica sotto 45 e riparte con candela di rifiuto. Stop Loss 15 pips, Break-Even a 1.2R e Target R:R 1:2.4.",
    strategy: {
      id: "ema_pullback_rsi",
      name: "Automa Trend Pullback EMA 20/50",
      conceptSummary: "Continuazione di trend su ritracciamento verso EMA 20 con scarico RSI e candela di spinta.",
      direction: "both",
      entryTrigger: "ema_cross_pullback",
      lookbackBars: 14,
      emaFastPeriod: 20,
      emaSlowPeriod: 50,
      rsiPeriod: 14,
      rsiOversold: 45,
      rsiOverbought: 55,
      requireTrendAlignment: true,
      sessionFilter: "all",
      stopLossMode: "fixed_pips",
      stopLossValue: 15,
      riskRewardTarget: 2.4,
      breakEvenAtR: 1.2,
      partialTakeProfitAtR: 1.5,
      riskPctPerTrade: 0.5,
      maxBarsInTrade: 45,
    },
  },
  {
    id: "bollinger_atr_reversion",
    title: "Mean Reversion Bollinger + ATR",
    badge: "QUANT · REVERSION",
    shortDesc: "Ritorno verso la media dopo eccesso statistico oltre 2 deviazioni standard con esaurimento RSI.",
    conceptPrompt:
      "Operatività Mean Reversion: entra quando il prezzo tocca la banda di Bollinger esterna (20, 2.0) in condizione di eccesso RSI (< 32 per Long, > 68 per Short) e chiude nuovamente dentro la banda. Stop Loss 1.5x ATR e Target R:R 1:2.2.",
    strategy: {
      id: "bollinger_atr_reversion",
      name: "Automa Statistical Bollinger Reversion",
      conceptSummary: "Rientro statistico dalle Bande di Bollinger (20, 2σ) con filtro di esaurimento RSI.",
      direction: "both",
      entryTrigger: "bollinger_reversion",
      lookbackBars: 20,
      emaFastPeriod: 20,
      emaSlowPeriod: 50,
      rsiPeriod: 14,
      rsiOversold: 32,
      rsiOverbought: 68,
      requireTrendAlignment: false,
      sessionFilter: "all",
      stopLossMode: "atr",
      stopLossValue: 1.5,
      riskRewardTarget: 2.2,
      breakEvenAtR: 1.0,
      partialTakeProfitAtR: null,
      riskPctPerTrade: 0.5,
      maxBarsInTrade: 32,
    },
  },
] as const;

// ─── 2. COMPILATORE LINGUAGGIO NATURALE → STRATEGIA ──────────────────────────

export function compileConceptToStrategy(
  conceptText: string,
  baseArchetypeId?: string,
): CompiledEaStrategy {
  const base =
    EA_ARCHETYPES.find((a) => a.id === baseArchetypeId)?.strategy ??
    EA_ARCHETYPES[0].strategy;

  const raw = conceptText.trim();
  if (!raw) {
    return { ...base };
  }

  const lower = raw.toLowerCase();

  // 1. Detect Entry Trigger
  let entryTrigger: EaTriggerType = base.entryTrigger;
  if (/(wyckoff|spring|upthrust|accumul|distribuz)/i.test(lower)) {
    entryTrigger = "wyckoff_spring";
  } else if (/(bollinger|bande|deviazion|mean reversion|ipercomprato|ipervenduto)/i.test(lower)) {
    entryTrigger = "bollinger_reversion";
  } else if (/(breakout|rottura|range asiatico|asian range|apertura londra|box)/i.test(lower)) {
    entryTrigger = "session_breakout";
  } else if (/(fvg|fair value gap|imbalance|sbilanciamento|inefficienza)/i.test(lower) && !/sweep/i.test(lower)) {
    entryTrigger = "fvg_imbalance";
  } else if (/(incrocio|cross|pullback|ritracciamento|media mobile|ema)/i.test(lower) && !/(sweep|liquidit)/i.test(lower)) {
    entryTrigger = "ema_cross_pullback";
  } else if (/(sweep|liquidit|caccia|stop hunt|massimo|minimo|spike)/i.test(lower)) {
    entryTrigger = "liquidity_sweep";
  }

  // 2. Detect Direction
  let direction: EaDirectionMode = "both";
  const mentionsLong = /\b(solo long|only long|solo buy|solo acquisto|rialzista)\b/i.test(lower);
  const mentionsShort = /\b(solo short|only short|solo sell|solo vendita|ribassista)\b/i.test(lower);
  if (mentionsLong && !mentionsShort) direction = "buy";
  else if (mentionsShort && !mentionsLong) direction = "sell";

  // 3. Detect Session Filter
  let sessionFilter: EaSessionFilter = base.sessionFilter;
  const hasLondon = /(londra|london)/i.test(lower);
  const hasNy = /(new york|\bny\b|americana)/i.test(lower);
  const hasAsia = /(asia|asiatica|tokyo)/i.test(lower) && !/(range asiatico|asian range)/i.test(lower);
  const hasAllSessions = /(tutte le sessioni|24h|sempre|qualsiasi sessione)/i.test(lower);
  if (hasAllSessions) sessionFilter = "all";
  else if (hasLondon && hasNy) sessionFilter = "london_ny";
  else if (hasLondon) sessionFilter = "london";
  else if (hasNy) sessionFilter = "ny";
  else if (hasAsia) sessionFilter = "asia";

  // 4. Detect Risk:Reward Target (e.g. "1:3", "1:2.5", "RR 3", "3R")
  let riskRewardTarget = base.riskRewardTarget;
  const rrColonMatch = lower.match(/1\s*[:/]\s*(\d+(?:[.,]\d+)?)/);
  const rrWordMatch = lower.match(/(?:r:?r|target|tp)\s*(?:di|a|=)?\s*(\d+(?:[.,]\d+)?)\s*r?\b/);
  const rSuffixMatch = lower.match(/\b(\d+(?:[.,]\d+)?)\s*r\b/);
  if (rrColonMatch) {
    const val = parseFloat(rrColonMatch[1].replace(",", "."));
    if (val >= 0.8 && val <= 15) riskRewardTarget = val;
  } else if (rrWordMatch) {
    const val = parseFloat(rrWordMatch[1].replace(",", "."));
    if (val >= 0.8 && val <= 15) riskRewardTarget = val;
  } else if (rSuffixMatch) {
    const val = parseFloat(rSuffixMatch[1].replace(",", "."));
    if (val >= 1.2 && val <= 15) riskRewardTarget = val;
  }

  // 5. Detect EMA periods (e.g. "EMA 20", "EMA 50", "EMA 200")
  let emaFastPeriod = base.emaFastPeriod;
  let emaSlowPeriod = base.emaSlowPeriod;
  const emaMatches = [...lower.matchAll(/(?:ema|sma|media)\s*(\d{1,3})/g)].map((m) => parseInt(m[1], 10));
  const validEmas = emaMatches.filter((n) => n >= 5 && n <= 300).sort((a, b) => a - b);
  if (validEmas.length >= 2) {
    emaFastPeriod = validEmas[0];
    emaSlowPeriod = validEmas[1];
  } else if (validEmas.length === 1) {
    if (validEmas[0] >= 40) emaSlowPeriod = validEmas[0];
    else emaFastPeriod = validEmas[0];
  }

  // 6. Detect RSI thresholds (e.g. "RSI < 30", "sotto 35", "sopra 70")
  let rsiOversold = base.rsiOversold;
  let rsiOverbought = base.rsiOverbought;
  const oversoldMatch = lower.match(/(?:rsi\s*(?:\(\d+\))?\s*(?:<|sotto|minore di|inferiore a))\s*(\d{2})/);
  const overboughtMatch = lower.match(/(?:rsi\s*(?:\(\d+\))?\s*(?:>|sopra|maggiore di|superiore a))\s*(\d{2})/);
  if (oversoldMatch) {
    const v = parseInt(oversoldMatch[1], 10);
    if (v >= 15 && v <= 50) {
      rsiOversold = v;
      rsiOverbought = 100 - v;
    }
  }
  if (overboughtMatch) {
    const v = parseInt(overboughtMatch[1], 10);
    if (v >= 50 && v <= 85) rsiOverbought = v;
  }

  // 7. Detect Stop Loss Mode & Value
  let stopLossMode: EaStopLossMode = base.stopLossMode;
  let stopLossValue = base.stopLossValue;
  const slPipsMatch = lower.match(/(?:sl|stop(?:\s*loss)?)\s*(?:di|a|=)?\s*(\d+(?:[.,]\d+)?)\s*pip/);
  const slAtrMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*x?\s*atr/);
  if (slPipsMatch) {
    stopLossMode = "fixed_pips";
    stopLossValue = Math.max(3, Math.min(200, parseFloat(slPipsMatch[1].replace(",", "."))));
  } else if (slAtrMatch) {
    stopLossMode = "atr";
    stopLossValue = Math.max(0.5, Math.min(5, parseFloat(slAtrMatch[1].replace(",", "."))));
  } else if (/(sotto lo spike|sotto il minimo|struttur|swing)/i.test(lower)) {
    stopLossMode = "structure";
    stopLossValue = 4;
  }

  // 8. Detect Risk % per trade
  let riskPctPerTrade = base.riskPctPerTrade;
  const riskMatch = lower.match(/rischio\s*(?:del|di|=)?\s*(\d+(?:[.,]\d+)?)\s*%/);
  if (riskMatch) {
    const r = parseFloat(riskMatch[1].replace(",", "."));
    if (r >= 0.1 && r <= 5) riskPctPerTrade = r;
  }

  // 9. Detect Lookback Bars
  let lookbackBars = base.lookbackBars;
  const lookbackMatch = lower.match(/(\d{1,3})\s*(?:periodi|barre|candele)/);
  if (lookbackMatch) {
    const lb = parseInt(lookbackMatch[1], 10);
    if (lb >= 5 && lb <= 120) lookbackBars = lb;
  }

  // 10. Detect Break-Even
  let breakEvenAtR: number | null = base.breakEvenAtR;
  if (/(senza break-?even|no be\b)/i.test(lower)) {
    breakEvenAtR = null;
  } else {
    const beMatch = lower.match(/(?:break-?even|be)\s*(?:a|at|=)?\s*(\d+(?:[.,]\d+)?)\s*r?/);
    if (beMatch) {
      const beVal = parseFloat(beMatch[1].replace(",", "."));
      if (beVal >= 0.5 && beVal < riskRewardTarget) breakEvenAtR = beVal;
    }
  }

  const triggerTitles: Record<EaTriggerType, string> = {
    liquidity_sweep: "Automa Liquidity Sweep & Rigetto",
    fvg_imbalance: "Automa Fair Value Gap (FVG)",
    wyckoff_spring: "Automa Wyckoff Spring & Test",
    session_breakout: "Automa Session Range Breakout",
    ema_cross_pullback: `Automa Trend EMA ${emaFastPeriod}/${emaSlowPeriod}`,
    bollinger_reversion: "Automa Bollinger Mean Reversion",
  };

  return {
    id: `custom_${entryTrigger}_${Date.now()}`,
    name: triggerTitles[entryTrigger],
    conceptSummary: raw.length > 140 ? `${raw.slice(0, 137)}...` : raw,
    direction,
    entryTrigger,
    lookbackBars,
    emaFastPeriod,
    emaSlowPeriod,
    rsiPeriod: 14,
    rsiOversold,
    rsiOverbought,
    requireTrendAlignment: !/(contro-?trend|mean reversion|reversal puro)/i.test(lower),
    sessionFilter,
    stopLossMode,
    stopLossValue,
    riskRewardTarget,
    breakEvenAtR,
    partialTakeProfitAtR: riskRewardTarget >= 2.2 ? Number((riskRewardTarget * 0.6).toFixed(1)) : null,
    riskPctPerTrade,
    maxBarsInTrade: base.maxBarsInTrade,
  };
}

// ─── 3. AUREUS DSL SCRIPT PARSER & GENERATORI CODICE (MQL5 / cTrader) ────────

export function formatStrategyToDsl(strategy: CompiledEaStrategy): string {
  return [
    `// ═══ AUREUS AUTOMA SCRIPT v1.0 ═══`,
    `// Modifica qualsiasi parametro per ricompilare l'EA in tempo reale`,
    `STRATEGY_NAME = "${strategy.name}"`,
    `DIRECTION = ${strategy.direction.toUpperCase()}`,
    `ENTRY_TRIGGER = ${strategy.entryTrigger.toUpperCase()}`,
    `LOOKBACK_BARS = ${strategy.lookbackBars}`,
    `EMA_FAST = ${strategy.emaFastPeriod}`,
    `EMA_SLOW = ${strategy.emaSlowPeriod}`,
    `TREND_ALIGNMENT = ${strategy.requireTrendAlignment ? "TRUE" : "FALSE"}`,
    `RSI_PERIOD = ${strategy.rsiPeriod}`,
    `RSI_OVERSOLD = ${strategy.rsiOversold}`,
    `RSI_OVERBOUGHT = ${strategy.rsiOverbought}`,
    `SESSION_FILTER = ${strategy.sessionFilter.toUpperCase()}`,
    `STOP_LOSS_MODE = ${strategy.stopLossMode.toUpperCase()}`,
    `STOP_LOSS_VALUE = ${strategy.stopLossValue}`,
    `TARGET_RR = ${strategy.riskRewardTarget}`,
    `BREAKEVEN_AT_R = ${strategy.breakEvenAtR ?? 0}`,
    `PARTIAL_TP_AT_R = ${strategy.partialTakeProfitAtR ?? 0}`,
    `RISK_PERCENT = ${strategy.riskPctPerTrade}`,
    `MAX_BARS_IN_TRADE = ${strategy.maxBarsInTrade}`,
  ].join("\n");
}

export function parseDslToStrategy(
  dslCode: string,
  fallback: CompiledEaStrategy = EA_ARCHETYPES[0].strategy,
): CompiledEaStrategy {
  const next: CompiledEaStrategy = { ...fallback };
  const lines = dslCode.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.replace(/\/\/.*$/, "").trim();
    if (!line) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim().toUpperCase();
    const rawVal = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");

    switch (key) {
      case "STRATEGY_NAME":
        if (rawVal) next.name = rawVal;
        break;
      case "DIRECTION": {
        const d = rawVal.toLowerCase();
        if (d === "buy" || d === "long") next.direction = "buy";
        else if (d === "sell" || d === "short") next.direction = "sell";
        else next.direction = "both";
        break;
      }
      case "ENTRY_TRIGGER": {
        const t = rawVal.toLowerCase() as EaTriggerType;
        if (
          [
            "liquidity_sweep",
            "fvg_imbalance",
            "wyckoff_spring",
            "session_breakout",
            "ema_cross_pullback",
            "bollinger_reversion",
          ].includes(t)
        ) {
          next.entryTrigger = t;
        }
        break;
      }
      case "LOOKBACK_BARS": {
        const v = parseInt(rawVal, 10);
        if (Number.isFinite(v) && v >= 5 && v <= 150) next.lookbackBars = v;
        break;
      }
      case "EMA_FAST": {
        const v = parseInt(rawVal, 10);
        if (Number.isFinite(v) && v >= 3 && v <= 200) next.emaFastPeriod = v;
        break;
      }
      case "EMA_SLOW": {
        const v = parseInt(rawVal, 10);
        if (Number.isFinite(v) && v >= 10 && v <= 300) next.emaSlowPeriod = v;
        break;
      }
      case "TREND_ALIGNMENT":
        next.requireTrendAlignment = rawVal.toUpperCase() === "TRUE" || rawVal === "1";
        break;
      case "RSI_OVERSOLD": {
        const v = parseFloat(rawVal);
        if (Number.isFinite(v) && v >= 10 && v <= 55) next.rsiOversold = v;
        break;
      }
      case "RSI_OVERBOUGHT": {
        const v = parseFloat(rawVal);
        if (Number.isFinite(v) && v >= 45 && v <= 90) next.rsiOverbought = v;
        break;
      }
      case "SESSION_FILTER": {
        const s = rawVal.toLowerCase() as EaSessionFilter;
        if (["all", "london", "ny", "london_ny", "asia"].includes(s)) {
          next.sessionFilter = s;
        }
        break;
      }
      case "STOP_LOSS_MODE": {
        const m = rawVal.toLowerCase() as EaStopLossMode;
        if (["structure", "atr", "fixed_pips"].includes(m)) {
          next.stopLossMode = m;
        }
        break;
      }
      case "STOP_LOSS_VALUE": {
        const v = parseFloat(rawVal);
        if (Number.isFinite(v) && v > 0) next.stopLossValue = v;
        break;
      }
      case "TARGET_RR": {
        const v = parseFloat(rawVal);
        if (Number.isFinite(v) && v >= 0.5 && v <= 20) next.riskRewardTarget = v;
        break;
      }
      case "BREAKEVEN_AT_R": {
        const v = parseFloat(rawVal);
        next.breakEvenAtR = Number.isFinite(v) && v > 0 ? v : null;
        break;
      }
      case "PARTIAL_TP_AT_R": {
        const v = parseFloat(rawVal);
        next.partialTakeProfitAtR = Number.isFinite(v) && v > 0 ? v : null;
        break;
      }
      case "RISK_PERCENT": {
        const v = parseFloat(rawVal);
        if (Number.isFinite(v) && v >= 0.05 && v <= 10) next.riskPctPerTrade = v;
        break;
      }
      case "MAX_BARS_IN_TRADE": {
        const v = parseInt(rawVal, 10);
        if (Number.isFinite(v) && v >= 5 && v <= 500) next.maxBarsInTrade = v;
        break;
      }
    }
  }

  return next;
}

export function generateMql5Code(
  strategy: CompiledEaStrategy,
  symbol: string,
  interval: string,
): string {
  const cleanSym = symbol.replace("/", "");
  return `//+------------------------------------------------------------------+
//|                     AUREUS_Automa_${strategy.entryTrigger}.mq5   |
//|         Forgiato da L'Automa della Forgia · Protocollo AUREUS    |
//|         Mercato: ${cleanSym} · Timeframe: ${interval} · Target R:R 1:${strategy.riskRewardTarget}          |
//+------------------------------------------------------------------+
#property copyright "Protocollo AUREUS — L'Automa della Forgia"
#property version   "1.00"
#property strict

#include <Trade\\Trade.mqh>
CTrade trade;

// --- Input Parametri Operativi ---
input double InpRiskPercent      = ${strategy.riskPctPerTrade.toFixed(2)}; // Rischio % per Operazione
input double InpTargetRR         = ${strategy.riskRewardTarget.toFixed(2)}; // Target R:R
input double InpBreakEvenAtR     = ${(strategy.breakEvenAtR ?? 0).toFixed(2)}; // Break-Even a R (0 = disattivato)
input int    InpLookbackBars     = ${strategy.lookbackBars};    // Periodi Lookback Strutturale
input int    InpEmaFast          = ${strategy.emaFastPeriod};    // Periodo EMA Veloce
input int    InpEmaSlow          = ${strategy.emaSlowPeriod};    // Periodo EMA Lenta
input int    InpRsiPeriod        = ${strategy.rsiPeriod};    // Periodo RSI
input double InpRsiOversold      = ${strategy.rsiOversold};    // Soglia RSI Long
input double InpRsiOverbought    = ${strategy.rsiOverbought};    // Soglia RSI Short
input double InpStopLossParam    = ${strategy.stopLossValue};    // Parametro Stop Loss (${strategy.stopLossMode})
input ulong  InpMagicNumber      = 948100; // Sigillo AUREUS Magic Number

int handleEmaFast, handleEmaSlow, handleRsi, handleAtr;
datetime lastBarTime = 0;

int OnInit() {
   trade.SetExpertMagicNumber(InpMagicNumber);
   handleEmaFast = iMA(_Symbol, _Period, InpEmaFast, 0, MODE_EMA, PRICE_CLOSE);
   handleEmaSlow = iMA(_Symbol, _Period, InpEmaSlow, 0, MODE_EMA, PRICE_CLOSE);
   handleRsi     = iRSI(_Symbol, _Period, InpRsiPeriod, PRICE_CLOSE);
   handleAtr     = iATR(_Symbol, _Period, 14);
   if(handleEmaFast == INVALID_HANDLE || handleEmaSlow == INVALID_HANDLE || handleRsi == INVALID_HANDLE)
      return(INIT_FAILED);
   return(INIT_SUCCEEDED);
}

bool IsWithinSessionWindow() {
   MqlDateTime dt;
   TimeCurrent(dt);
   int h = dt.hour;
   string mode = "${strategy.sessionFilter}";
   if(mode == "london")    return (h >= 7 && h < 16);
   if(mode == "ny")        return (h >= 12 && h < 21);
   if(mode == "london_ny") return (h >= 7 && h < 21);
   if(mode == "asia")      return (h >= 0 && h < 8);
   return true;
}

void ManageBreakEven() {
   if(InpBreakEvenAtR <= 0) return;
   for(int i = PositionsTotal() - 1; i >= 0; i--) {
      ulong ticket = PositionGetTicket(i);
      if(!PositionSelectByTicket(ticket)) continue;
      if(PositionGetInteger(POSITION_MAGIC) != (long)InpMagicNumber) continue;
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      double sl        = PositionGetDouble(POSITION_SL);
      double tp        = PositionGetDouble(POSITION_TP);
      double curPrice  = PositionGetDouble(POSITION_PRICE_CURRENT);
      long   type      = PositionGetInteger(POSITION_TYPE);
      double riskDist  = MathAbs(openPrice - sl);
      if(riskDist <= 0) continue;
      if(type == POSITION_TYPE_BUY && curPrice >= openPrice + riskDist * InpBreakEvenAtR && sl < openPrice)
         trade.PositionModify(ticket, openPrice, tp);
      if(type == POSITION_TYPE_SELL && curPrice <= openPrice - riskDist * InpBreakEvenAtR && (sl > openPrice || sl == 0))
         trade.PositionModify(ticket, openPrice, tp);
   }
}

void OnTick() {
   ManageBreakEven();
   datetime curBar = iTime(_Symbol, _Period, 0);
   if(curBar == lastBarTime) return;
   lastBarTime = curBar;

   if(!IsWithinSessionWindow() || PositionsTotal() > 0) return;

   double emaF[2], emaS[2], rsiVal[2], atrVal[2];
   if(CopyBuffer(handleEmaFast, 0, 1, 2, emaF) < 2) return;
   if(CopyBuffer(handleEmaSlow, 0, 1, 2, emaS) < 2) return;
   if(CopyBuffer(handleRsi, 0, 1, 2, rsiVal) < 2) return;
   if(CopyBuffer(handleAtr, 0, 1, 2, atrVal) < 2) return;

   double close1 = iClose(_Symbol, _Period, 1);
   double low1   = iLow(_Symbol, _Period, 1);
   double high1  = iHigh(_Symbol, _Period, 1);
   int lowestIdx = iLowest(_Symbol, _Period, MODE_LOW, InpLookbackBars, 2);
   int highestIdx = iHighest(_Symbol, _Period, MODE_HIGH, InpLookbackBars, 2);
   double swingLow = iLow(_Symbol, _Period, lowestIdx);
   double swingHigh = iHigh(_Symbol, _Period, highestIdx);

   bool trendLong  = ${strategy.requireTrendAlignment ? "(emaF[1] >= emaS[1])" : "true"};
   bool trendShort = ${strategy.requireTrendAlignment ? "(emaF[1] <= emaS[1])" : "true"};

   // Segnale ${strategy.entryTrigger.toUpperCase()}
   bool signalLong  = trendLong  && (low1 <= swingLow  && close1 > swingLow)  && (rsiVal[1] <= InpRsiOversold + 12);
   bool signalShort = trendShort && (high1 >= swingHigh && close1 < swingHigh) && (rsiVal[1] >= InpRsiOverbought - 12);

   double slDist = atrVal[1] * 1.5;
   if(slDist <= 0) slDist = 150 * _Point;

   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double riskCash = balance * (InpRiskPercent / 100.0);
   double tickVal = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
   double lots = (slDist > 0 && tickVal > 0 && tickSize > 0)
      ? NormalizeDouble(MathMax(0.01, riskCash / ((slDist / tickSize) * tickVal)), 2)
      : 0.10;

   if(signalLong && "${strategy.direction}" != "sell") {
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      double sl  = NormalizeDouble(ask - slDist, _Digits);
      double tp  = NormalizeDouble(ask + slDist * InpTargetRR, _Digits);
      trade.Buy(lots, _Symbol, ask, sl, tp, "AUREUS_EA_LONG");
   }
   else if(signalShort && "${strategy.direction}" != "buy") {
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      double sl  = NormalizeDouble(bid + slDist, _Digits);
      double tp  = NormalizeDouble(bid - slDist * InpTargetRR, _Digits);
      trade.Sell(lots, _Symbol, bid, sl, tp, "AUREUS_EA_SHORT");
   }
}
//+------------------------------------------------------------------+`;
}

export function generateCTraderCode(
  strategy: CompiledEaStrategy,
  symbol: string,
  interval: string,
): string {
  const cleanSym = symbol.replace("/", "");
  return `// ═══════════════════════════════════════════════════════════════════
// AUREUS cTrader cBot — ${strategy.name}
// Mercato: ${cleanSym} · Timeframe: ${interval} · R:R 1:${strategy.riskRewardTarget}
// ═══════════════════════════════════════════════════════════════════
using System;
using cAlgo.API;
using cAlgo.API.Indicators;

namespace cAlgo.Robots
{
    [Robot(TimeZone = TimeZones.UTC, AccessRights = AccessRights.None)]
    public class AureusAutomaBot : Robot
    {
        [Parameter("Risk %", DefaultValue = ${strategy.riskPctPerTrade})]
        public double RiskPercent { get; set; }

        [Parameter("Target R:R", DefaultValue = ${strategy.riskRewardTarget})]
        public double TargetRR { get; set; }

        [Parameter("Lookback Bars", DefaultValue = ${strategy.lookbackBars})]
        public int LookbackBars { get; set; }

        private ExponentialMovingAverage _emaFast;
        private ExponentialMovingAverage _emaSlow;
        private RelativeStrengthIndex _rsi;
        private AverageTrueRange _atr;

        protected override void OnStart()
        {
            _emaFast = Indicators.ExponentialMovingAverage(Bars.ClosePrices, ${strategy.emaFastPeriod});
            _emaSlow = Indicators.ExponentialMovingAverage(Bars.ClosePrices, ${strategy.emaSlowPeriod});
            _rsi = Indicators.RelativeStrengthIndex(Bars.ClosePrices, ${strategy.rsiPeriod});
            _atr = Indicators.AverageTrueRange(14, MovingAverageType.Exponential);
        }

        protected override void OnBar()
        {
            if (Positions.Count > 0) return;

            int idx = Bars.Count - 2;
            double close = Bars.ClosePrices[idx];
            double low = Bars.LowPrices[idx];
            double high = Bars.HighPrices[idx];
            double atrPips = _atr.Result[idx] / Symbol.PipSize;
            double slPips = Math.Max(5.0, atrPips * 1.5);
            double tpPips = slPips * TargetRR;

            bool trendLong = _emaFast.Result[idx] >= _emaSlow.Result[idx];
            bool trendShort = _emaFast.Result[idx] <= _emaSlow.Result[idx];

            double volume = Symbol.VolumeForFixedRisk(Account.Balance * (RiskPercent / 100.0), slPips);

            if (trendLong && _rsi.Result[idx] <= ${strategy.rsiOversold + 10} && "${strategy.direction}" != "sell")
            {
                ExecuteMarketOrder(TradeType.Buy, SymbolName, volume, "AUREUS_EA", slPips, tpPips);
            }
            else if (trendShort && _rsi.Result[idx] >= ${strategy.rsiOverbought - 10} && "${strategy.direction}" != "buy")
            {
                ExecuteMarketOrder(TradeType.Sell, SymbolName, volume, "AUREUS_EA", slPips, tpPips);
            }
        }
    }
}`;
}

// ─── 4. GENERATORE STORICO DETERMINISTICO DI FALLBACK ────────────────────────

export function generateDeterministicHistoricalCandles(
  symbol: string,
  interval: string,
  count = 500,
): ReplayCandleRaw[] {
  const clean = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  let seed = 0;
  for (let i = 0; i < clean.length; i++) {
    seed = (seed * 31 + clean.charCodeAt(i)) >>> 0;
  }
  const nextRand = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  const isGold = clean.includes("XAU") || clean.includes("GOLD");
  const isJpy = clean.includes("JPY");
  const isBtc = clean.includes("BTC");
  const isIndex = clean.includes("NAS") || clean.includes("US30") || clean.includes("SPX");

  let price = isGold ? 2350.0 : isJpy ? 154.5 : isBtc ? 64000 : isIndex ? 18500 : 1.085;
  const pSize = pipSize(symbol);
  const stepSec =
    interval === "M1"
      ? 60
      : interval === "M5"
        ? 300
        : interval === "M15"
          ? 900
          : interval === "M30"
            ? 1800
            : interval === "H4"
              ? 14400
              : interval === "D1"
                ? 86400
                : 3600;

  const baseTime = 1714550400; // 2024-05-01 08:00:00 UTC
  const out: ReplayCandleRaw[] = [];

  for (let i = 0; i < count; i++) {
    const t = baseTime + i * stepSec;
    const hourUtc = Math.floor((t % 86400) / 3600);
    const sessionVolMult = hourUtc >= 7 && hourUtc <= 19 ? 1.45 : 0.75;

    // Regime wave + occasional liquidity sweep every ~19 bars
    const wave = Math.sin(i / 18) * 3.2 + Math.cos(i / 7) * 1.8;
    const r = (nextRand() - 0.495) * 14 * sessionVolMult;
    const deltaPips = wave + r;

    const open = price;
    const close = Number((open + deltaPips * pSize).toFixed(5));
    const isSweepBar = i % 19 === 0 || i % 27 === 0;
    const wickUpPips = (isSweepBar ? 14 + nextRand() * 16 : 3 + nextRand() * 8) * sessionVolMult;
    const wickDnPips = (isSweepBar ? 14 + nextRand() * 16 : 3 + nextRand() * 8) * sessionVolMult;

    const high = Number((Math.max(open, close) + wickUpPips * pSize).toFixed(5));
    const low = Number((Math.min(open, close) - wickDnPips * pSize).toFixed(5));

    out.push({
      time: t,
      open,
      high,
      low,
      close,
      volume: Math.round(250 + nextRand() * 950 * sessionVolMult),
    });

    price = close;
  }

  return out;
}

// ─── 5. MOTORE DI BACKTEST CANDELA-PER-CANDELA & ESTRAZIONE CASI STUDIO ─────

function classifyUtcSession(timestampSec: number): "Asia" | "Londra" | "New York" {
  const hour = new Date(timestampSec * 1000).getUTCHours();
  if (hour >= 7 && hour < 13) return "Londra";
  if (hour >= 13 && hour < 21) return "New York";
  return "Asia";
}

function matchesSessionFilter(
  session: "Asia" | "Londra" | "New York",
  filter: EaSessionFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "london") return session === "Londra";
  if (filter === "ny") return session === "New York";
  if (filter === "london_ny") return session === "Londra" || session === "New York";
  if (filter === "asia") return session === "Asia";
  return true;
}

export function runEaHistoricalBacktest(params: {
  strategy: CompiledEaStrategy;
  candles?: ReplayCandleRaw[];
  symbol: string;
  interval: string;
  initialBalance?: number;
}): EaBacktestResult {
  const { strategy, symbol, interval, initialBalance = 100_000 } = params;
  const sourceCandles =
    params.candles && params.candles.length >= 80
      ? params.candles
      : generateDeterministicHistoricalCandles(symbol, interval, 520);

  const closes = sourceCandles.map((c) => c.close);
  const emaFastArr = ema(closes, strategy.emaFastPeriod);
  const emaSlowArr = ema(closes, strategy.emaSlowPeriod);
  const rsiArr = rsi(closes, strategy.rsiPeriod);
  const atrArr = atr(sourceCandles, 14);
  const bbArr = bollinger(closes, strategy.lookbackBars, 2.0);

  const pSize = pipSize(symbol);
  const pValPerLot = pipValuePerLot(symbol);

  const trades: EaExecutedTrade[] = [];
  let balance = initialBalance;
  let peakBalance = initialBalance;
  let maxDrawdownAmount = 0;
  let maxDrawdownPct = 0;

  const equityCurve: EaBacktestResult["equityCurve"] = [
    {
      tradeIndex: 0,
      time: sourceCandles[0]?.time ?? 0,
      balance: initialBalance,
      netR: 0,
      drawdownPct: 0,
    },
  ];

  let cumulativeR = 0;
  const warmup = Math.max(strategy.emaSlowPeriod, strategy.lookbackBars, 25);
  let i = warmup;

  while (i < sourceCandles.length - 2) {
    const bar = sourceCandles[i];
    const prevBar = sourceCandles[i - 1];
    const prev2Bar = sourceCandles[i - 2];
    const session = classifyUtcSession(bar.time);

    if (!matchesSessionFilter(session, strategy.sessionFilter)) {
      i++;
      continue;
    }

    const curEmaFast = emaFastArr[i] ?? bar.close;
    const curEmaSlow = emaSlowArr[i] ?? bar.close;
    const curRsi = rsiArr[i] ?? 50;
    const curAtr = atrArr[i] ?? pSize * 15;
    const curAtrPips = Math.max(3, curAtr / pSize);

    // Compute structural high/low over lookback window [i - lookback .. i - 1]
    let windowHigh = -Infinity;
    let windowLow = Infinity;
    const startLb = Math.max(0, i - strategy.lookbackBars);
    for (let k = startLb; k < i; k++) {
      if (sourceCandles[k].high > windowHigh) windowHigh = sourceCandles[k].high;
      if (sourceCandles[k].low < windowLow) windowLow = sourceCandles[k].low;
    }

    const trendUp = curEmaFast >= curEmaSlow;
    const trendDown = curEmaFast <= curEmaSlow;
    const alignLong = !strategy.requireTrendAlignment || trendUp;
    const alignShort = !strategy.requireTrendAlignment || trendDown;

    let signal: TradeDirection | null = null;
    let setupLabel = "";
    let sweepDepthPips = 0;

    switch (strategy.entryTrigger) {
      case "liquidity_sweep": {
        const sweptLow = bar.low <= windowLow && bar.close > windowLow && bar.close > bar.open;
        const sweptHigh = bar.high >= windowHigh && bar.close < windowHigh && bar.close < bar.open;
        const microSweepLow =
          bar.low <= prevBar.low &&
          prevBar.low <= prev2Bar.low &&
          bar.close > prevBar.close &&
          curRsi <= strategy.rsiOversold + 8;
        const microSweepHigh =
          bar.high >= prevBar.high &&
          prevBar.high >= prev2Bar.high &&
          bar.close < prevBar.close &&
          curRsi >= strategy.rsiOverbought - 8;

        if ((sweptLow || microSweepLow) && alignLong && curRsi <= strategy.rsiOversold + 14) {
          signal = "buy";
          sweepDepthPips = Math.max(1, (windowLow - bar.low) / pSize);
          setupLabel = sweptLow ? "Sweep Liquidità Minimo + Rigetto" : "Micro-Sweep Supporto + Impulso";
        } else if ((sweptHigh || microSweepHigh) && alignShort && curRsi >= strategy.rsiOverbought - 14) {
          signal = "sell";
          sweepDepthPips = Math.max(1, (bar.high - windowHigh) / pSize);
          setupLabel = sweptHigh ? "Sweep Liquidità Massimo + Rigetto" : "Micro-Sweep Resistenza + Impulso";
        }
        break;
      }

      case "fvg_imbalance": {
        const bullishFvg = bar.low > prev2Bar.high && prevBar.close > prevBar.open;
        const bearishFvg = bar.high < prev2Bar.low && prevBar.close < prevBar.open;
        if (bullishFvg && alignLong && curRsi < 68) {
          signal = "buy";
          setupLabel = "Fair Value Gap Rialzista (FVG)";
        } else if (bearishFvg && alignShort && curRsi > 32) {
          signal = "sell";
          setupLabel = "Fair Value Gap Ribassista (FVG)";
        }
        break;
      }

      case "wyckoff_spring": {
        const springLong =
          bar.low < windowLow &&
          bar.close > windowLow &&
          bar.close >= bar.open + (bar.high - bar.low) * 0.45;
        const upthrustShort =
          bar.high > windowHigh &&
          bar.close < windowHigh &&
          bar.close <= bar.open - (bar.high - bar.low) * 0.45;

        if (springLong && alignLong) {
          signal = "buy";
          sweepDepthPips = Math.max(1.5, (windowLow - bar.low) / pSize);
          setupLabel = "Wyckoff Spring & Riaccumulazione";
        } else if (upthrustShort && alignShort) {
          signal = "sell";
          sweepDepthPips = Math.max(1.5, (bar.high - windowHigh) / pSize);
          setupLabel = "Wyckoff Upthrust (UTAD)";
        }
        break;
      }

      case "session_breakout": {
        const breakoutLong = bar.close > windowHigh && prevBar.close <= windowHigh;
        const breakoutShort = bar.close < windowLow && prevBar.close >= windowLow;
        if (breakoutLong && alignLong && curRsi >= 50 && curRsi <= 74) {
          signal = "buy";
          setupLabel = `Breakout Range ${strategy.lookbackBars} Barre (${session})`;
        } else if (breakoutShort && alignShort && curRsi <= 50 && curRsi >= 26) {
          signal = "sell";
          setupLabel = `Breakout Ribassista Range (${session})`;
        }
        break;
      }

      case "ema_cross_pullback": {
        const touchedFastLong = bar.low <= curEmaFast && bar.close > curEmaFast && bar.close > bar.open;
        const touchedFastShort = bar.high >= curEmaFast && bar.close < curEmaFast && bar.close < bar.open;
        if (trendUp && touchedFastLong && curRsi <= strategy.rsiOversold + 12) {
          signal = "buy";
          setupLabel = `Pullback EMA ${strategy.emaFastPeriod}/${strategy.emaSlowPeriod} Long`;
        } else if (trendDown && touchedFastShort && curRsi >= strategy.rsiOverbought - 12) {
          signal = "sell";
          setupLabel = `Pullback EMA ${strategy.emaFastPeriod}/${strategy.emaSlowPeriod} Short`;
        }
        break;
      }

      case "bollinger_reversion": {
        const bb = bbArr[i];
        if (bb) {
          const piercedLower = bar.low <= bb.lower && bar.close > bb.lower && curRsi <= strategy.rsiOversold + 8;
          const piercedUpper = bar.high >= bb.upper && bar.close < bb.upper && curRsi >= strategy.rsiOverbought - 8;
          if (piercedLower && alignLong) {
            signal = "buy";
            setupLabel = "Rientro Banda Bollinger Inferiore (2σ)";
          } else if (piercedUpper && alignShort) {
            signal = "sell";
            setupLabel = "Rientro Banda Bollinger Superiore (2σ)";
          }
        }
        break;
      }
    }

    if (signal === "buy" && strategy.direction === "sell") signal = null;
    if (signal === "sell" && strategy.direction === "buy") signal = null;

    if (!signal) {
      i++;
      continue;
    }

    // Determine Stop Loss distance in pips
    const entryPrice = bar.close;
    let slPips = 15;
    if (strategy.stopLossMode === "fixed_pips") {
      slPips = Math.max(4, strategy.stopLossValue);
    } else if (strategy.stopLossMode === "atr") {
      slPips = Math.max(4, Number((curAtrPips * strategy.stopLossValue).toFixed(1)));
    } else {
      // structure mode
      const rawStructDist =
        signal === "buy"
          ? (entryPrice - Math.min(bar.low, windowLow)) / pSize + strategy.stopLossValue
          : (Math.max(bar.high, windowHigh) - entryPrice) / pSize + strategy.stopLossValue;
      slPips = Math.max(5, Math.min(curAtrPips * 2.5, Number(rawStructDist.toFixed(1))));
    }

    const tpPips = Number((slPips * strategy.riskRewardTarget).toFixed(1));
    const sign = signal === "buy" ? 1 : -1;
    const stopLossPrice = Number((entryPrice - sign * slPips * pSize).toFixed(5));
    const takeProfitPrice = Number((entryPrice + sign * tpPips * pSize).toFixed(5));

    const riskCash = (balance * strategy.riskPctPerTrade) / 100;
    const lots = Math.max(
      0.01,
      computeLots({ riskAmount: riskCash, slPips, symbol }) || Number((riskCash / (slPips * pValPerLot)).toFixed(2)) || 0.1,
    );

    // Walk forward to resolve trade outcome
    let exitBarIdx = Math.min(sourceCandles.length - 1, i + strategy.maxBarsInTrade);
    let exitPrice = sourceCandles[exitBarIdx].close;
    let exitReason: ClosedTrade["exitReason"] = "manual";
    let breakEvenProtected = false;
    let beActive = false;
    let partialTaken = false;
    let maxFavPips = 0;
    let maxAdvPips = 0;

    for (let j = i + 1; j <= Math.min(sourceCandles.length - 1, i + strategy.maxBarsInTrade); j++) {
      const fBar = sourceCandles[j];
      const favPrice = signal === "buy" ? fBar.high : fBar.low;
      const advPrice = signal === "buy" ? fBar.low : fBar.high;

      const curFavPips = Math.max(0, ((favPrice - entryPrice) * sign) / pSize);
      const curAdvPips = Math.max(0, ((entryPrice - advPrice) * sign) / pSize);

      if (curFavPips > maxFavPips) maxFavPips = curFavPips;
      if (curAdvPips > maxAdvPips) maxAdvPips = curAdvPips;

      const activeSlPrice = beActive ? entryPrice + sign * (slPips * 0.1) * pSize : stopLossPrice;

      // Check SL hit first (conservative rule)
      const hitSl = signal === "buy" ? fBar.low <= activeSlPrice : fBar.high >= activeSlPrice;
      const hitTp = signal === "buy" ? fBar.high >= takeProfitPrice : fBar.low <= takeProfitPrice;

      if (hitSl) {
        exitBarIdx = j;
        exitPrice = activeSlPrice;
        exitReason = "sl";
        breakEvenProtected = beActive;
        break;
      }

      if (hitTp) {
        exitBarIdx = j;
        exitPrice = takeProfitPrice;
        exitReason = "tp";
        break;
      }

      // Check Break-Even activation for subsequent bars
      if (!beActive && strategy.breakEvenAtR != null && curFavPips >= slPips * strategy.breakEvenAtR) {
        beActive = true;
      }
      if (!partialTaken && strategy.partialTakeProfitAtR != null && curFavPips >= slPips * strategy.partialTakeProfitAtR) {
        partialTaken = true;
      }
    }

    const rawPips = Number((((exitPrice - entryPrice) * sign) / pSize).toFixed(1));
    let realizedR = Number((rawPips / slPips).toFixed(2));

    // If partial TP was taken and later hit BE, blend realized R
    if (partialTaken && breakEvenProtected && strategy.partialTakeProfitAtR != null) {
      realizedR = Number(((strategy.partialTakeProfitAtR * 0.5) + 0.05).toFixed(2));
    }

    const effectivePips = Number((realizedR * slPips).toFixed(1));
    const profit = Number((realizedR * riskCash).toFixed(2));
    const result: ClosedTrade["result"] =
      realizedR > 0.15 ? "win" : realizedR < -0.15 ? "loss" : "breakeven";

    balance = Number((balance + profit).toFixed(2));
    if (balance > peakBalance) peakBalance = balance;
    const curDdAmount = Math.max(0, peakBalance - balance);
    const curDdPct = peakBalance > 0 ? (curDdAmount / peakBalance) * 100 : 0;
    if (curDdAmount > maxDrawdownAmount) maxDrawdownAmount = curDdAmount;
    if (curDdPct > maxDrawdownPct) maxDrawdownPct = curDdPct;

    cumulativeR = Number((cumulativeR + realizedR).toFixed(2));

    const tradeRecord: EaExecutedTrade = {
      id: trades.length + 1,
      direction: signal,
      entryPrice,
      exitPrice,
      entryTime: bar.time,
      exitTime: sourceCandles[exitBarIdx].time,
      stopLoss: stopLossPrice,
      takeProfit: takeProfitPrice,
      slPips,
      tpPips,
      pips: effectivePips,
      lots,
      profit,
      riskAmount: Number(riskCash.toFixed(2)),
      breakEvenProtected,
      rMultiple: realizedR,
      realizedR,
      targetRR: strategy.riskRewardTarget,
      maeR: Number((maxAdvPips / slPips).toFixed(2)),
      mfeR: Number((maxFavPips / slPips).toFixed(2)),
      result,
      exitReason,
      entryBarIndex: i,
      exitBarIndex: exitBarIdx,
      barsHeld: Math.max(1, exitBarIdx - i),
      setupLabel,
      tags: [strategy.entryTrigger, session],
      snapshot: {
        rsi: Number(curRsi.toFixed(1)),
        emaFast: Number(curEmaFast.toFixed(5)),
        emaSlow: Number(curEmaSlow.toFixed(5)),
        atrPips: Number(curAtrPips.toFixed(1)),
        session,
        trendAligned: signal === "buy" ? trendUp : trendDown,
        sweepDepthPips: Number(sweepDepthPips.toFixed(1)),
      },
    };

    trades.push(tradeRecord);
    equityCurve.push({
      tradeIndex: trades.length,
      time: tradeRecord.exitTime,
      balance,
      netR: cumulativeR,
      drawdownPct: Number(curDdPct.toFixed(2)),
    });

    // Advance cursor past trade exit to avoid overlapping positions
    i = Math.max(i + 2, exitBarIdx + 1);
  }

  const wins = trades.filter((t) => t.result === "win").length;
  const losses = trades.filter((t) => t.result === "loss").length;
  const breakevens = trades.filter((t) => t.result === "breakeven").length;
  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? Number(((wins / totalTrades) * 100).toFixed(1)) : 0;

  const grossWin = trades.filter((t) => t.profit > 0).reduce((s, t) => s + t.profit, 0);
  const grossLoss = Math.abs(trades.filter((t) => t.profit < 0).reduce((s, t) => s + t.profit, 0));
  const profitFactor =
    grossLoss > 0
      ? Number((grossWin / grossLoss).toFixed(2))
      : grossWin > 0
        ? 9.99
        : 0;

  const winningTrades = trades.filter((t) => t.result === "win");
  const avgRealizedRR =
    winningTrades.length > 0
      ? Number(
          (winningTrades.reduce((s, t) => s + t.realizedR, 0) / winningTrades.length).toFixed(2),
        )
      : strategy.riskRewardTarget;

  const expectancyR =
    totalTrades > 0
      ? Number((trades.reduce((s, t) => s + t.realizedR, 0) / totalTrades).toFixed(2))
      : 0;
  const netProfit = Number((balance - initialBalance).toFixed(2));
  const netProfitPct = Number(((netProfit / initialBalance) * 100).toFixed(2));
  const expectancyCurrency = totalTrades > 0 ? Number((netProfit / totalTrades).toFixed(2)) : 0;

  const longTrades = trades.filter((t) => t.direction === "buy");
  const shortTrades = trades.filter((t) => t.direction === "sell");
  const longWins = longTrades.filter((t) => t.result === "win").length;
  const shortWins = shortTrades.filter((t) => t.result === "win").length;

  const sessionsOrder: Array<"Londra" | "New York" | "Asia"> = ["Londra", "New York", "Asia"];
  const sessionBreakdown: EaSessionBreakdownItem[] = sessionsOrder.map((sess) => {
    const sub = trades.filter((t) => t.snapshot.session === sess);
    const w = sub.filter((t) => t.result === "win").length;
    const netR = Number(sub.reduce((s, t) => s + t.realizedR, 0).toFixed(2));
    const netP = Number(sub.reduce((s, t) => s + t.profit, 0).toFixed(2));
    return {
      session: sess,
      total: sub.length,
      wins: w,
      winRate: sub.length > 0 ? Math.round((w / sub.length) * 100) : 0,
      netR,
      netProfit: netP,
    };
  });

  const caseStudies = extractEaCaseStudies(trades, strategy);
  const dslCode = formatStrategyToDsl(strategy);
  const mql5Code = generateMql5Code(strategy, symbol, interval);
  const cTraderCode = generateCTraderCode(strategy, symbol, interval);

  return {
    strategy,
    symbol,
    interval,
    initialBalance,
    finalBalance: balance,
    netProfit,
    netProfitPct,
    totalTrades,
    wins,
    losses,
    breakevens,
    winRate,
    avgTargetRR: strategy.riskRewardTarget,
    avgRealizedRR,
    profitFactor,
    expectancyR,
    expectancyCurrency,
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
    maxDrawdownAmount: Number(maxDrawdownAmount.toFixed(2)),
    longWinRate: longTrades.length > 0 ? Math.round((longWins / longTrades.length) * 100) : 0,
    shortWinRate: shortTrades.length > 0 ? Math.round((shortWins / shortTrades.length) * 100) : 0,
    longCount: longTrades.length,
    shortCount: shortTrades.length,
    candlesTested: sourceCandles.length,
    periodStartTs: sourceCandles[0]?.time ?? 0,
    periodEndTs: sourceCandles[sourceCandles.length - 1]?.time ?? 0,
    equityCurve,
    sessionBreakdown,
    trades,
    caseStudies,
    dslCode,
    mql5Code,
    cTraderCode,
  };
}

// ─── 6. ESTRATTORE AUTOMATICO DI CASI STUDIO ─────────────────────────────────

export function extractEaCaseStudies(
  trades: EaExecutedTrade[],
  strategy: CompiledEaStrategy,
): EaCaseStudy[] {
  if (trades.length === 0) return [];

  const studies: EaCaseStudy[] = [];
  const usedIds = new Set<number>();

  // 1. Textbook Gold Case Study: Win with highest (realizedR - maeR)
  const wins = trades.filter((t) => t.result === "win");
  if (wins.length > 0) {
    const textbook = [...wins].sort(
      (a, b) => b.realizedR - b.maeR * 0.8 - (a.realizedR - a.maeR * 0.8),
    )[0];
    usedIds.add(textbook.id);
    studies.push({
      id: `cs_textbook_${textbook.id}`,
      category: "textbook_gold",
      badge: "ESECUZIONE AUREA · TEXTBOOK",
      title: `${textbook.setupLabel} (+${textbook.realizedR}R)`,
      trade: textbook,
      contextSummary: `Sessione ${textbook.snapshot.session} · RSI ${textbook.snapshot.rsi} · ATR ${textbook.snapshot.atrPips}p · Drawdown intra-trade minimo (${textbook.maeR}R).`,
      lessonOrEdge: `Ingresso ad altissima precisione: il prezzo ha rispettato lo Stop Loss di ${textbook.slPips} pips con escursione avversa quasi nulla (${textbook.maeR}R) espandendosi fino a +${textbook.realizedR}R in ${textbook.barsHeld} candele.`,
      optimizationHint: `Mantieni il filtro ${strategy.requireTrendAlignment ? `EMA ${strategy.emaFastPeriod}/${strategy.emaSlowPeriod}` : "strutturale"} nella sessione di ${textbook.snapshot.session}.`,
    });
  }

  // 2. Rapid Institutional Expansion: Win with fewest barsHeld
  const remainingWins = wins.filter((t) => !usedIds.has(t.id));
  if (remainingWins.length > 0) {
    const fastest = [...remainingWins].sort(
      (a, b) => a.barsHeld - b.barsHeld || b.realizedR - a.realizedR,
    )[0];
    usedIds.add(fastest.id);
    studies.push({
      id: `cs_momentum_${fastest.id}`,
      category: "rapid_expansion",
      badge: "IMPULSO ISTITUZIONALE · VELOCITÀ",
      title: `Target Raggiunto in ${fastest.barsHeld} Candele (+${fastest.realizedR}R)`,
      trade: fastest,
      contextSummary: `Sessione ${fastest.snapshot.session} · Direzione ${fastest.direction.toUpperCase()} · MFE +${fastest.mfeR}R · ATR ${fastest.snapshot.atrPips}p.`,
      lessonOrEdge: `Forte squilibrio tra domanda e offerta: l'ordine è andato a target in sole ${fastest.barsHeld} barre senza ritracciamenti profondi.`,
      optimizationHint: `Quando ATR supera ${Math.max(8, Math.round(fastest.snapshot.atrPips * 0.85))} pips su ${fastest.snapshot.session}, un trailing stop sopra 2R cattura le code di espansione.`,
    });
  }

  // 3. Capital Shield (Breakeven / Partial protection)
  const shielded = trades.filter(
    (t) => !usedIds.has(t.id) && (t.breakEvenProtected || (t.result === "win" && t.maeR <= 0.25)),
  );
  if (shielded.length > 0) {
    const shieldTrade = shielded[0];
    usedIds.add(shieldTrade.id);
    studies.push({
      id: `cs_shield_${shieldTrade.id}`,
      category: "capital_shield",
      badge: "SCUDO DEL CAPITALE · DIFESA",
      title:
        shieldTrade.breakEvenProtected
          ? `Capitale Protetto in Break-Even (${shieldTrade.realizedR >= 0 ? `+${shieldTrade.realizedR}R` : `${shieldTrade.realizedR}R`})`
          : `Controllo Rischio Chirurgico (+${shieldTrade.realizedR}R)`,
      trade: shieldTrade,
      contextSummary: `Escursione favorevole massima +${shieldTrade.mfeR}R prima del riassorbimento · Rischio protetto.`,
      lessonOrEdge: `La regola di Break-Even a ${strategy.breakEvenAtR ?? 1.0}R ha neutralizzato il rischio prima dell'inversione di mercato, preservando l'integrità del conto.`,
      optimizationHint: `Il Break-Even automatico a ${strategy.breakEvenAtR ?? 1.0}R riduce il drawdown consecutivo nelle fasi laterali.`,
    });
  }

  // 4. Invalidation Lesson (Loss analysis)
  const losses = trades.filter((t) => !usedIds.has(t.id) && t.result === "loss");
  if (losses.length > 0) {
    const lossTrade = losses[0];
    usedIds.add(lossTrade.id);
    const wasOffSession = lossTrade.snapshot.session === "Asia";
    const wasCounterTrend = !lossTrade.snapshot.trendAligned;
    studies.push({
      id: `cs_lesson_${lossTrade.id}`,
      category: "invalidation_lesson",
      badge: "STUDIO INVALIDAZIONE · FILTRO",
      title: `Stop di Studio su ${lossTrade.setupLabel} (${lossTrade.realizedR}R)`,
      trade: lossTrade,
      contextSummary: `Sessione ${lossTrade.snapshot.session} · RSI ${lossTrade.snapshot.rsi} · Allineamento Trend: ${lossTrade.snapshot.trendAligned ? "Sì" : "Contro-Trend"}.`,
      lessonOrEdge: wasCounterTrend
        ? `Il segnale si è formato contro l'inclinazione delle EMA ${strategy.emaFastPeriod}/${strategy.emaSlowPeriod}, subendo il riassorbimento del flusso primario.`
        : wasOffSession
          ? `Falsa espansione in sessione ${lossTrade.snapshot.session} con liquidità ridotta prima dell'apertura bancaria.`
          : `Caccia di liquidità estesa: il prezzo ha raggiunto +${lossTrade.mfeR}R prima di invertire sullo stop.`,
      optimizationHint: wasCounterTrend
        ? `Attiva TREND_ALIGNMENT = TRUE per filtrare gli ingressi contro la EMA ${strategy.emaSlowPeriod}.`
        : `Imposta SESSION_FILTER = LONDON_NY ed espandi il buffer SL strutturale di +2 pips.`,
    });
  }

  return studies;
}
