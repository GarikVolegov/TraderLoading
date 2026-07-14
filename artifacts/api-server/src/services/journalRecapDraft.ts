// Data-driven recap drafting: feeds the edge + discipline numbers to the LLM and
// turns them into the eight free-text recap fields the journal already stores.
// Pure helpers (period filter, prompt builder, response parser) are unit-tested;
// the live LLM call lives in the route and degrades gracefully when unconfigured.

import { type EdgeReport, type EdgeTrade } from "./tradeAnalytics.js";
import { type DisciplineReport } from "./tradeDiscipline.js";

export interface RecapDraftFields {
  overallJudgment: string;
  wentWell: string;
  wentWrong: string;
  improvements: string;
  patterns: string;
  focusAreas: string;
  nextPeriodExpectations: string;
  nextPeriodGoals: string;
}

export const RECAP_DRAFT_KEYS: ReadonlyArray<keyof RecapDraftFields> = [
  "overallJudgment",
  "wentWell",
  "wentWrong",
  "improvements",
  "patterns",
  "focusAreas",
  "nextPeriodExpectations",
  "nextPeriodGoals",
];

const FIELD_MAX_LEN = 2000;

export interface RecapContext {
  kind: string;
  periodStart: string;
  periodEnd: string;
}

function tradeDay(trade: EdgeTrade): string | null {
  const raw = trade.closeTime ?? trade.openTime;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

/** Trades whose close day (fallback open day) falls within [start, end] inclusive. */
export function filterTradesByPeriod(
  trades: EdgeTrade[],
  periodStart: string,
  periodEnd: string,
): EdgeTrade[] {
  return trades.filter((trade) => {
    const day = tradeDay(trade);
    return day !== null && day >= periodStart && day <= periodEnd;
  });
}

function fmtR(value: number | null): string {
  if (value === null) return "n/d";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function fmtPct(value: number | null): string {
  return value === null ? "n/d" : `${value}%`;
}

function fmtNum(value: number | null): string {
  if (value === null) return "n/d";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("it-IT", { maximumFractionDigits: 2 })}`;
}

const DIMENSION_LABELS: Record<string, string> = {
  symbol: "strumento",
  direction: "direzione",
  session: "sessione",
  dayOfWeek: "giorno",
};

/** Builds a compact, number-grounded brief for the recap LLM call. */
export function buildRecapBrief(edge: EdgeReport, discipline: DisciplineReport, ctx: RecapContext): string {
  const o = edge.overall;
  const lines: string[] = [];
  lines.push(`PERIODO: ${ctx.kind} ${ctx.periodStart} → ${ctx.periodEnd}`);
  lines.push(`TRADE CHIUSI: ${o.closedTrades} (di cui ${o.tradesWithR} con R calcolabile)`);
  lines.push(
    `EXPECTANCY: ${fmtR(o.expectancyR)} | WIN RATE: ${fmtPct(o.winRate)} | ` +
      `PROFIT FACTOR: ${o.profitFactor === null ? "n/d" : o.profitFactor.toFixed(2)} | ` +
      `P&L NETTO: ${fmtNum(o.netProfit)}`,
  );
  lines.push(`R MEDIO VINCITE/PERDITE: ${fmtR(o.avgWinR)} / ${fmtR(o.avgLossR)}`);

  const best = edge.highlights.bestSlice;
  const worst = edge.highlights.worstSlice;
  if (best) lines.push(`PUNTO DI FORZA: ${DIMENSION_LABELS[best.dimension] ?? best.dimension} "${best.label}" ${fmtR(best.expectancyR)} su ${best.trades} trade`);
  if (worst) lines.push(`PERDITA RICORRENTE: ${DIMENSION_LABELS[worst.dimension] ?? worst.dimension} "${worst.label}" ${fmtR(worst.expectancyR)} su ${worst.trades} trade`);

  const postLoss = edge.highlights.postLoss;
  if (postLoss) lines.push(`REVENGE: ${postLoss.trades} trade entro 2h da una perdita rendono ${fmtR(postLoss.expectancyR)} vs ${fmtR(postLoss.baselineExpectancyR)} degli altri`);

  const stop = discipline.stopDiscipline;
  if (stop) lines.push(`DISCIPLINA STOP: ${stop.lossesBeyond1R}/${stop.losses} perdite oltre -1R (${stop.pct}%)`);

  const hold = discipline.holdTime;
  if (hold) lines.push(`TENUTA: perdite ${hold.avgLoserMinutes}min, vincite ${hold.avgWinnerMinutes}min`);

  const over = discipline.overtrading;
  if (over && over.busyExpectancyR !== null && over.calmExpectancyR !== null) {
    lines.push(`OVERTRADING: giorni con >${over.busyThreshold} trade rendono ${fmtR(over.busyExpectancyR)} vs ${fmtR(over.calmExpectancyR)} dei giorni normali`);
  }

  const dd = discipline.drawdown;
  if (dd) lines.push(`DRAWDOWN: striscia di ${dd.longestLossStreak} perdite, DD max ${fmtNum(-dd.maxDrawdown)}`);

  return lines.join("\n");
}

// Output language name per app language, so the recap is written in the user's
// language (like the risk-guard push) instead of always Italian.
const RECAP_OUTPUT_LANGUAGE: Record<string, string> = {
  it: "italiano",
  en: "English",
  es: "español",
  fr: "français",
  de: "Deutsch",
};

/** System prompt instructing the model to return the recap fields in `language`. */
export function recapSystemPrompt(language: string): string {
  const langName = RECAP_OUTPUT_LANGUAGE[language] ?? RECAP_OUTPUT_LANGUAGE.it;
  return (
    "Sei un trading coach esperto, diretto e onesto. Ricevi le statistiche oggettive di un periodo di trading " +
    "e produci un recap operativo per il trader. Basati SOLO sui numeri forniti, sii concreto e specifico, " +
    "niente disclaimer né premesse. Rispondi ESCLUSIVAMENTE con un oggetto JSON valido con esattamente queste " +
    `chiavi (valori stringa in ${langName}): overallJudgment, wentWell, wentWrong, improvements, patterns, ` +
    "focusAreas, nextPeriodExpectations, nextPeriodGoals. Ogni campo max 2-3 frasi."
  );
}

export function buildRecapMessages(
  edge: EdgeReport,
  discipline: DisciplineReport,
  ctx: RecapContext,
  language: string,
): { system: string; user: string } {
  return {
    system: recapSystemPrompt(language),
    user: `Statistiche del periodo:\n\n${buildRecapBrief(edge, discipline, ctx)}\n\nProduci il recap in JSON.`,
  };
}

function coerceField(value: unknown): string {
  if (typeof value === "string") return value.trim().slice(0, FIELD_MAX_LEN);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function emptyDraft(): RecapDraftFields {
  return {
    overallJudgment: "",
    wentWell: "",
    wentWrong: "",
    improvements: "",
    patterns: "",
    focusAreas: "",
    nextPeriodExpectations: "",
    nextPeriodGoals: "",
  };
}

/**
 * Parses the model output into recap fields. Tolerant of code fences and prose
 * around the JSON; if no JSON object is found, the raw text becomes the overall
 * judgment so the user still gets something usable.
 */
export function parseRecapDraft(content: string): RecapDraftFields {
  const draft = emptyDraft();
  const trimmed = content.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
      for (const key of RECAP_DRAFT_KEYS) draft[key] = coerceField(parsed[key]);
      if (RECAP_DRAFT_KEYS.some((key) => draft[key] !== "")) return draft;
    } catch {
      // fall through to raw-text fallback
    }
  }

  draft.overallJudgment = trimmed.slice(0, FIELD_MAX_LEN);
  return draft;
}
