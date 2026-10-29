import type { JournalEntry } from "@workspace/api-client-react";
import { parseTradeContent } from "./parseTradeContent.js";
import { VIRTU_TAGS, LEAK_TAGS } from "../components/journal/SessionDetailInspector.js";

export interface ChronosSessionDef {
  index: number;
  code: "asia" | "london" | "ny_overlap" | "ny_close";
  label: string;
  hoursRange: string;
  startHour: number;
  endHour: number;
}

export const CHRONOS_SESSIONS: ChronosSessionDef[] = [
  { index: 0, code: "asia", label: "Asia", hoursRange: "00-08", startHour: 0, endHour: 8 },
  { index: 1, code: "london", label: "Londra", hoursRange: "08-14", startHour: 8, endHour: 14 },
  { index: 2, code: "ny_overlap", label: "NY Overlap", hoursRange: "14-18", startHour: 14, endHour: 18 },
  { index: 3, code: "ny_close", label: "NY Close", hoursRange: "18-24", startHour: 18, endHour: 24 },
];

export const CHRONOS_WEEKDAYS = [
  { index: 0, dayOfWeek: 1, label: "LUN", fullName: "Lunedì" },
  { index: 1, dayOfWeek: 2, label: "MAR", fullName: "Martedì" },
  { index: 2, dayOfWeek: 3, label: "MER", fullName: "Mercoledì" },
  { index: 3, dayOfWeek: 4, label: "GIO", fullName: "Giovedì" },
  { index: 4, dayOfWeek: 5, label: "VEN", fullName: "Venerdì" },
];

export interface ChronosCell {
  dayIndex: number;
  dayLabel: string;
  sessionIndex: number;
  sessionLabel: string;
  sessionRange: string;
  tradesCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  netPnl: number;
  virtuesCount: number;
  leaksCount: number;
  integrityScore: number; // 0 to 100
  leakBreakdown: Record<string, number>;
  virtueBreakdown: Record<string, number>;
  dominantLeak?: string;
  dominantVirtue?: string;
  entries: JournalEntry[];
}

export interface ChronosMatrixSummary {
  matrix: ChronosCell[][];
  bestExecutionWindow: ChronosCell | null;
  dangerWindow: ChronosCell | null;
  totalTrades: number;
  totalVirtues: number;
  totalLeaks: number;
  globalIntegrityScore: number;
}

const VIRTUE_IDS = new Set<string>(VIRTU_TAGS.map((t) => t.id.toLowerCase()));
const LEAK_IDS = new Set<string>(LEAK_TAGS.map((t) => t.id.toLowerCase()));

/**
 * Determina la sessione di mercato in base all'ora (0-23)
 */
export function getSessionFromHour(hour: number): ChronosSessionDef {
  const normalized = Math.max(0, Math.min(23, Math.floor(hour)));
  for (const session of CHRONOS_SESSIONS) {
    if (normalized >= session.startHour && normalized < session.endHour) {
      return session;
    }
  }
  return CHRONOS_SESSIONS[0];
}

/**
 * Estrae l'ora (0-23) e il giorno della settimana normalizzato (1=Lun ... 5=Ven)
 */
export function extractTradeHourAndDay(entry: JournalEntry): { dayOfWeek: number; hour: number } {
  const parsed = parseTradeContent(entry.content ?? "");

  let dateObj: Date | null = null;

  // 1. Prova openTime da trade importato (formati: "YYYY.MM.DD HH:mm:ss" o ISO)
  const rawOpenTime =
    parsed?.openTime ||
    entry.content?.match(/(?:Open Time|Open|Apertura|Ora Apertura):\s*([0-9\.\-\:\sT]+)/i)?.[1]?.trim();

  if (rawOpenTime) {
    const sanitized = rawOpenTime.replace(/\./g, "-").replace(" ", "T");
    const d = new Date(sanitized);
    if (!isNaN(d.getTime())) {
      dateObj = d;
    }
  }

  // 2. Prova createdAt
  if (!dateObj && entry.createdAt) {
    const d = new Date(entry.createdAt);
    if (!isNaN(d.getTime())) {
      dateObj = d;
    }
  }

  // 3. Fallback su tradeDate
  if (!dateObj && entry.tradeDate) {
    const d = new Date(entry.tradeDate.includes("T") ? entry.tradeDate : `${entry.tradeDate}T14:00:00`);
    if (!isNaN(d.getTime())) {
      dateObj = d;
    }
  }

  if (!dateObj) {
    return { dayOfWeek: 1, hour: 14 }; // Fallback Lunedì NY Overlap
  }

  let dayOfWeek = dateObj.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  if (dayOfWeek === 0) dayOfWeek = 7; // Convert Sun to 7

  const hour = dateObj.getHours();
  return { dayOfWeek, hour };
}

/**
 * Calcola la matrice bidimensionale di dispersione temporale (Giorni x Sessioni)
 */
export function computeChronosMatrix(entries: JournalEntry[]): ChronosMatrixSummary {
  // Inizializza matrice vuota 5 righe x 4 colonne
  const matrix: ChronosCell[][] = CHRONOS_WEEKDAYS.map((w) =>
    CHRONOS_SESSIONS.map((s) => ({
      dayIndex: w.index,
      dayLabel: w.label,
      sessionIndex: s.index,
      sessionLabel: s.label,
      sessionRange: s.hoursRange,
      tradesCount: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      netPnl: 0,
      virtuesCount: 0,
      leaksCount: 0,
      integrityScore: 100,
      leakBreakdown: {},
      virtueBreakdown: {},
      entries: [],
    })),
  );

  let totalTrades = 0;
  let totalVirtues = 0;
  let totalLeaks = 0;

  for (const entry of entries) {
    const { dayOfWeek, hour } = extractTradeHourAndDay(entry);

    // Consideriamo i giorni feriali (Lunedì 1 a Venerdì 5)
    const weekdayIdx = dayOfWeek - 1;
    if (weekdayIdx < 0 || weekdayIdx >= 5) {
      continue;
    }

    const session = getSessionFromHour(hour);
    const cell = matrix[weekdayIdx][session.index];

    const parsed = parseTradeContent(entry.content ?? "");
    let pnl = parsed?.profit;
    if (pnl === undefined && entry.content) {
      const match = entry.content.match(/(?:Profit|Profitto|P&L|PnL):\s*([+\-]?[0-9\.]+)/i);
      if (match) {
        const val = parseFloat(match[1]);
        if (!isNaN(val)) pnl = val;
      }
    }
    if (pnl === undefined) {
      pnl = entry.result === "win" ? 100 : entry.result === "loss" ? -100 : 0;
    }

    cell.tradesCount += 1;
    totalTrades += 1;
    cell.netPnl += pnl;
    cell.entries.push(entry);

    if (entry.result === "win" || pnl > 0) {
      cell.winCount += 1;
    } else if (entry.result === "loss" || pnl < 0) {
      cell.lossCount += 1;
    }

    // Estrazione e classificazione tag
    const rawTags = (entry.tags ? entry.tags.split(",") : [])
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    for (const tag of rawTags) {
      if (VIRTUE_IDS.has(tag)) {
        cell.virtuesCount += 1;
        totalVirtues += 1;
        cell.virtueBreakdown[tag] = (cell.virtueBreakdown[tag] ?? 0) + 1;
      } else if (LEAK_IDS.has(tag)) {
        cell.leaksCount += 1;
        totalLeaks += 1;
        cell.leakBreakdown[tag] = (cell.leakBreakdown[tag] ?? 0) + 1;
      }
    }
  }

  // Normalizzazione, Win Rate e calcolo dominanze
  let bestExecutionWindow: ChronosCell | null = null;
  let dangerWindow: ChronosCell | null = null;

  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      const cell = matrix[r][c];

      if (cell.tradesCount > 0) {
        cell.winRate = Math.round((cell.winCount / cell.tradesCount) * 100);

        const totalTagsInCell = cell.virtuesCount + cell.leaksCount;
        cell.integrityScore =
          totalTagsInCell > 0
            ? Math.round((cell.virtuesCount / totalTagsInCell) * 100)
            : cell.winRate >= 50
            ? 85
            : 40;

        // Dominant Leak
        let maxLeakCount = 0;
        for (const [leak, cnt] of Object.entries(cell.leakBreakdown)) {
          if (cnt > maxLeakCount) {
            maxLeakCount = cnt;
            cell.dominantLeak = leak;
          }
        }

        // Dominant Virtue
        let maxVirtueCount = 0;
        for (const [virtue, cnt] of Object.entries(cell.virtueBreakdown)) {
          if (cnt > maxVirtueCount) {
            maxVirtueCount = cnt;
            cell.dominantVirtue = virtue;
          }
        }

        // Criteri Finestra d'Oro (miglior score integrità + pnl positivo)
        if (
          !bestExecutionWindow ||
          cell.integrityScore > bestExecutionWindow.integrityScore ||
          (cell.integrityScore === bestExecutionWindow.integrityScore && cell.netPnl > bestExecutionWindow.netPnl)
        ) {
          bestExecutionWindow = cell;
        }

        // Criteri Finestra di Pericolo (massimi leak o pnl peggiore)
        if (
          !dangerWindow ||
          cell.leaksCount > dangerWindow.leaksCount ||
          (cell.leaksCount === dangerWindow.leaksCount && cell.netPnl < dangerWindow.netPnl)
        ) {
          if (cell.leaksCount > 0 || cell.netPnl < 0) {
            dangerWindow = cell;
          }
        }
      }
    }
  }

  const allTags = totalVirtues + totalLeaks;
  const globalIntegrityScore = allTags > 0 ? Math.round((totalVirtues / allTags) * 100) : 100;

  return {
    matrix,
    bestExecutionWindow,
    dangerWindow,
    totalTrades,
    totalVirtues,
    totalLeaks,
    globalIntegrityScore,
  };
}
