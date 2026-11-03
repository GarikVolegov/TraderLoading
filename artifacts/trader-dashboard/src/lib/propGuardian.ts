/**
 * AUREUS PROTOCOL — Il Custode della Soglia: Prop Guardian Engine
 *
 * Motore di monitoraggio in tempo reale del Max Daily Drawdown, Total Drawdown
 * e Profit Target per Prop Firm sovrane (FTMO, The 5%ers, FundedNext, Alpha Capital).
 * Include:
 * 1. Telemetria del Max Daily Drawdown e del Profit Target con notch 75%
 * 2. 1-Tap Prop Risk Sizing (Calcolo automatico lotti adattivo su buffer residuo)
 * 3. Esportazione chirurgica dei parametri di setup per MT5 / cTrader
 * 4. Bio-Lock difensivo su soglia critica del 75%+
 */

import { computeLots, pipValuePerLot } from "./replay/lotSizing.js";

export interface PropProfile {
  id: string;
  name: string;
  maxDailyLossPct: number; // e.g. 5.0%
  maxTotalLossPct: number; // e.g. 10.0%
  profitTargetPhase1Pct: number; // e.g. 10.0% (Fase 1)
  profitTargetPhase2Pct: number; // e.g. 5.0% (Fase 2)
  recommendedRiskPct: number; // e.g. 0.5% (Golden Standard Prop)
  drawdownType: "balance" | "equity" | "relative";
  badge: string;
}

export const PROP_PROFILES: PropProfile[] = [
  {
    id: "ftmo",
    name: "FTMO",
    maxDailyLossPct: 5.0,
    maxTotalLossPct: 10.0,
    profitTargetPhase1Pct: 10.0,
    profitTargetPhase2Pct: 5.0,
    recommendedRiskPct: 0.5,
    drawdownType: "balance",
    badge: "5% Daily · 10% Total · 10% Target",
  },
  {
    id: "five_percenters",
    name: "The 5%ers",
    maxDailyLossPct: 5.0,
    maxTotalLossPct: 8.0,
    profitTargetPhase1Pct: 8.0,
    profitTargetPhase2Pct: 5.0,
    recommendedRiskPct: 0.5,
    drawdownType: "balance",
    badge: "5% Daily · 8% Total · 8% Target",
  },
  {
    id: "funded_next",
    name: "FundedNext",
    maxDailyLossPct: 5.0,
    maxTotalLossPct: 10.0,
    profitTargetPhase1Pct: 8.0,
    profitTargetPhase2Pct: 5.0,
    recommendedRiskPct: 0.5,
    drawdownType: "balance",
    badge: "5% Daily · 10% Total · 8% Target",
  },
  {
    id: "alpha_capital",
    name: "Alpha Capital",
    maxDailyLossPct: 5.0,
    maxTotalLossPct: 10.0,
    profitTargetPhase1Pct: 8.0,
    profitTargetPhase2Pct: 4.0,
    recommendedRiskPct: 0.5,
    drawdownType: "balance",
    badge: "5% Daily · 10% Total · 8% Target",
  },
  {
    id: "ic_markets",
    name: "IC Markets (Broker)",
    maxDailyLossPct: 3.0,
    maxTotalLossPct: 6.0,
    profitTargetPhase1Pct: 10.0,
    profitTargetPhase2Pct: 5.0,
    recommendedRiskPct: 1.0,
    drawdownType: "balance",
    badge: "3% Daily · 6% Total · Raw ECN",
  },
  {
    id: "custom",
    name: "Presidio Personalizzato",
    maxDailyLossPct: 5.0,
    maxTotalLossPct: 10.0,
    profitTargetPhase1Pct: 10.0,
    profitTargetPhase2Pct: 5.0,
    recommendedRiskPct: 0.5,
    drawdownType: "balance",
    badge: "Parametri Manuali",
  },
];

const PROP_STORAGE_KEY = "aureus_prop_guardian_profile_v1";

export interface StoredPropConfig {
  profileId: string;
  phase?: 1 | 2;
  customDailyPct?: number;
  customTotalPct?: number;
}

export function getStoredPropConfig(): StoredPropConfig {
  if (typeof window === "undefined" || !window.localStorage) {
    return { profileId: "ftmo", phase: 1 };
  }
  try {
    const raw = window.localStorage.getItem(PROP_STORAGE_KEY);
    if (!raw) return { profileId: "ftmo", phase: 1 };
    const parsed = JSON.parse(raw);
    return {
      profileId: parsed.profileId || "ftmo",
      phase: parsed.phase === 2 ? 2 : 1,
      customDailyPct: typeof parsed.customDailyPct === "number" ? parsed.customDailyPct : undefined,
      customTotalPct: typeof parsed.customTotalPct === "number" ? parsed.customTotalPct : undefined,
    };
  } catch {
    return { profileId: "ftmo", phase: 1 };
  }
}

export function setStoredPropConfig(config: StoredPropConfig): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(PROP_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage errors
  }
}

export interface PropGuardianTelemetry {
  profile: PropProfile;
  phase: 1 | 2;
  balance: number;
  equity: number;
  dailyProfit: number;
  currency: string;
  currentDailyDrawdownAmount: number;
  currentDailyDrawdownPct: number;
  maxDailyLossAmount: number;
  dailyLossRemainingBudget: number;
  drawdownUsageRatio: number; // e.g. 0.75 = 75% of allowed limit
  status: "secure" | "vigilance" | "critical";
  isCriticalBreachRisk: boolean; // >= 75%
  isDisqualified: boolean; // >= 100%
  statusLabel: string;
  statusBadgeTone: "emerald" | "amber" | "crimson";

  // Telemetria Obiettivo Profit Target
  profitTargetPct: number;
  profitTargetAmount: number;
  currentProfitAmount: number;
  profitProgressPct: number;
  targetRemainingAmount: number;
  isTargetAchieved: boolean;
}

/**
 * Calcola chirurgicamente la telemetria di conformità al Max Daily Drawdown e al Profit Target
 */
export function computePropGuardianTelemetry(
  balance: number,
  equity: number,
  dailyProfit: number,
  profile: PropProfile,
  currency = "EUR",
  phase: 1 | 2 = 1,
): PropGuardianTelemetry {
  const safeBalance = Math.max(0, balance);
  const safeEquity = Math.max(0, equity);

  // Perdita odierna calcolata tra equity galleggiante e P&L chiuso oggi
  const floatingLoss = safeBalance > safeEquity ? safeBalance - safeEquity : 0;
  const realizedDailyLoss = dailyProfit < 0 ? Math.abs(dailyProfit) : 0;
  const currentDailyDrawdownAmount = Math.max(floatingLoss, realizedDailyLoss);

  const currentDailyDrawdownPct =
    safeBalance > 0 ? (currentDailyDrawdownAmount / safeBalance) * 100 : 0;

  const maxDailyLossAmount = (safeBalance * profile.maxDailyLossPct) / 100;
  const dailyLossRemainingBudget = Math.max(0, maxDailyLossAmount - currentDailyDrawdownAmount);

  const drawdownUsageRatio =
    profile.maxDailyLossPct > 0 ? currentDailyDrawdownPct / profile.maxDailyLossPct : 0;

  let status: "secure" | "vigilance" | "critical" = "secure";
  let statusLabel = "INTEGRITÀ ELEVATA";
  let statusBadgeTone: "emerald" | "amber" | "crimson" = "emerald";

  if (drawdownUsageRatio >= 1.0) {
    status = "critical";
    statusLabel = "VIOLAZIONE DRAWDOWN (BREACH)";
    statusBadgeTone = "crimson";
  } else if (drawdownUsageRatio >= 0.75) {
    status = "critical";
    statusLabel = "SOGLIA CRITICA 75%+ (BIO-LOCK)";
    statusBadgeTone = "crimson";
  } else if (drawdownUsageRatio >= 0.5) {
    status = "vigilance";
    statusLabel = "VIGILANZA ATTIVA (50%-74%)";
    statusBadgeTone = "amber";
  }

  // Profit Target Telemetry
  const profitTargetPct = phase === 2 ? profile.profitTargetPhase2Pct : profile.profitTargetPhase1Pct;
  const profitTargetAmount = (safeBalance * profitTargetPct) / 100;
  const floatingProfit = safeEquity > safeBalance ? safeEquity - safeBalance : 0;
  const currentProfitAmount = Math.max(floatingProfit, dailyProfit > 0 ? dailyProfit : 0);
  const profitProgressPct =
    profitTargetAmount > 0
      ? Math.min(100, Math.max(0, (currentProfitAmount / profitTargetAmount) * 100))
      : 0;
  const targetRemainingAmount = Math.max(0, profitTargetAmount - currentProfitAmount);
  const isTargetAchieved = currentProfitAmount >= profitTargetAmount && currentProfitAmount > 0;

  return {
    profile,
    phase,
    balance: safeBalance,
    equity: safeEquity,
    dailyProfit,
    currency,
    currentDailyDrawdownAmount,
    currentDailyDrawdownPct,
    maxDailyLossAmount,
    dailyLossRemainingBudget,
    drawdownUsageRatio,
    status,
    isCriticalBreachRisk: drawdownUsageRatio >= 0.75,
    isDisqualified: drawdownUsageRatio >= 1.0,
    statusLabel,
    statusBadgeTone,
    profitTargetPct,
    profitTargetAmount,
    currentProfitAmount,
    profitProgressPct,
    targetRemainingAmount,
    isTargetAchieved,
  };
}

// ── 1-Tap Prop Risk Sizing Engine ───────────────────────────────────────────

export type PropRiskPreset = "conservative_025" | "recommended_05" | "standard_10" | "buffer_adaptive";

export interface PropAdaptiveLotsResult {
  preset: PropRiskPreset;
  presetLabel: string;
  lots: number;
  monetaryRisk: number;
  riskPctOfAccount: number;
  riskPctOfRemainingBuffer: number;
  maxConsecutiveLossesUntilBreach: number;
}

/**
 * Calcola istantaneamente i lotti operativi in base alle regole auree della Prop Firm
 * per evitare il sovradimensionamento e garantire che il trade rispetti il buffer giornaliero.
 */
export function calculatePropAdaptiveLots(input: {
  balance: number;
  remainingDailyBudget: number;
  slPips: number;
  symbol: string;
  preset?: PropRiskPreset;
}): PropAdaptiveLotsResult {
  const { balance, remainingDailyBudget, slPips, symbol, preset = "recommended_05" } = input;
  const safeBalance = Math.max(100, balance);
  const safeBudget = Math.max(10, remainingDailyBudget);
  const safeSl = Math.max(1, slPips);

  let targetRiskEur = 0;
  let presetLabel = "0.50% Consigliato Prop";

  if (preset === "conservative_025") {
    targetRiskEur = (safeBalance * 0.25) / 100;
    presetLabel = "0.25% Conservativo";
  } else if (preset === "standard_10") {
    targetRiskEur = (safeBalance * 1.0) / 100;
    presetLabel = "1.00% Standard Massimo";
  } else if (preset === "buffer_adaptive") {
    // 25% del buffer residuo odierno per garantire almeno 4 cartucce
    targetRiskEur = safeBudget * 0.25;
    presetLabel = "Adattivo (25% Buffer Residuo)";
  } else {
    // Default: 0.50% Golden Standard
    targetRiskEur = (safeBalance * 0.50) / 100;
    presetLabel = "0.50% Consigliato Prop";
  }

  // Tetto difensivo: mai rischiare più del 50% del buffer residuo in una singola operazione
  const cappedRiskEur = Math.min(targetRiskEur, safeBudget * 0.5);

  const rawLots = computeLots({ riskAmount: cappedRiskEur, slPips: safeSl, symbol });
  const lots = Math.max(0.01, rawLots);
  const pipVal = pipValuePerLot(symbol);
  const monetaryRisk = Math.round(lots * safeSl * pipVal * 100) / 100;
  const riskPctOfAccount = Math.round((monetaryRisk / safeBalance) * 10000) / 100;
  const riskPctOfRemainingBuffer = safeBudget > 0 ? Math.round((monetaryRisk / safeBudget) * 10000) / 100 : 100;
  const maxConsecutiveLossesUntilBreach = monetaryRisk > 0 ? Math.floor(safeBudget / monetaryRisk) : 0;

  return {
    preset,
    presetLabel,
    lots,
    monetaryRisk,
    riskPctOfAccount,
    riskPctOfRemainingBuffer,
    maxConsecutiveLossesUntilBreach,
  };
}

// ── Esportazione Setup MT5 / cTrader ────────────────────────────────────────

export interface SetupExportParams {
  market: string;
  side: "BUY" | "SELL" | "ATTESA";
  entryPrice?: string | number;
  stopLoss?: string | number;
  takeProfit?: string | number;
  lots?: string | number;
  riskReward?: string | number;
  riskAmount?: string | number;
  currency?: string;
  propFirmName?: string;
  dailyDrawdownPct?: number;
  maxDailyLimitPct?: number;
}

/**
 * Formatta il setup in formato esteso istituzionale AUREUS per MT5 / cTrader
 */
export function formatSetupForClipboard(params: SetupExportParams): string {
  const asset = params.market.toUpperCase();
  const dir = params.side.toUpperCase();
  const entry = params.entryPrice ? String(params.entryPrice) : "A Mercato";
  const sl = params.stopLoss ? String(params.stopLoss) : "Non Definito";
  const tp = params.takeProfit ? String(params.takeProfit) : "Non Definito";
  const rr = params.riskReward ? `1:${params.riskReward}` : "N/D";
  const lots = params.lots ? String(params.lots) : "0.10";
  const risk = params.riskAmount ? `${params.riskAmount} ${params.currency || "EUR"}` : "Rischio Calcolato";
  const prop = params.propFirmName || "FTMO / Regola 5%";
  const dd =
    params.dailyDrawdownPct != null && params.maxDailyLimitPct != null
      ? `DD Oggi: ${params.dailyDrawdownPct.toFixed(2)}% / Max ${params.maxDailyLimitPct.toFixed(1)}%`
      : "Presidio Attivo";

  return [
    "══════════════════════════════════════════════════════════",
    "🏛️ AUREUS PROTOCOL — SPECIFICHE SETUP OPERATIVO MT5 / cTrader",
    "══════════════════════════════════════════════════════════",
    `• Strumento:       ${asset}`,
    `• Direzione:       ${dir}`,
    `• Prezzo Entry:    ${entry}`,
    `• Stop Loss:       ${sl}`,
    `• Take Profit:     ${tp}`,
    `• R:R Ratio:       ${rr}`,
    `• Size Suggerita:  ${lots} Lotti (${risk})`,
    `• Presidio Prop:   ${prop} (${dd})`,
    "──────────────────────────────────────────────────────────",
    `Sintassi Rapida Terminale / Copier:`,
    `#${asset} ${dir} Entry: ${entry} | SL: ${sl} | TP: ${tp} | Lotti: ${lots}`,
    "══════════════════════════════════════════════════════════",
  ].join("\n");
}

/**
 * Formatta il setup in sintassi a riga singola per copier o chat di trading
 */
export function formatSetupSingleLine(params: SetupExportParams): string {
  const asset = params.market.toUpperCase();
  const dir = params.side.toUpperCase();
  const entry = params.entryPrice ? String(params.entryPrice) : "CMP";
  const sl = params.stopLoss ? String(params.stopLoss) : "N/D";
  const tp = params.takeProfit ? String(params.takeProfit) : "N/D";
  const lots = params.lots ? String(params.lots) : "0.10";
  return `#${asset} ${dir} ${entry} SL ${sl} TP ${tp} LOTS ${lots}`;
}

/**
 * Copia i parametri negli appunti dell'operatore con gestione fallback
 */
export async function copySetupToClipboard(params: SetupExportParams): Promise<boolean> {
  const text = formatSetupForClipboard(params);
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback standard textarea
    if (typeof document !== "undefined") {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      return success;
    }
    return false;
  } catch {
    return false;
  }
}
