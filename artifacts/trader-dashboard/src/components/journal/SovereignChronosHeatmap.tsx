import React, { memo, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { it } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Flame,
  Calendar,
  Clock,
  Sparkles,
} from "lucide-react";
import { parseTradeContent } from "@/lib/parseTradeContent";
import type { JournalEntry } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  computeChronosMatrix,
  CHRONOS_SESSIONS,
  CHRONOS_WEEKDAYS,
  type ChronosCell,
} from "@/lib/chronosMatrix";
import { synestheticClick } from "@/lib/soundFx";

interface SovereignChronosHeatmapProps {
  entries?: JournalEntry[];
  onSelectDay?: (dateIso: string) => void;
  className?: string;
}

const WEEKDAYS = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"];

export const SovereignChronosHeatmap = memo(function SovereignChronosHeatmap({
  entries = [],
  onSelectDay,
  className,
}: SovereignChronosHeatmapProps) {
  // Modalità di visualizzazione: Calendario Mensile vs Dispersione Oraria
  const [viewMode, setViewMode] = useState<"calendar" | "matrix">("calendar");
  const [matrixMetric, setMatrixMetric] = useState<"integrity" | "pnl">("integrity");
  const [activeCell, setActiveCell] = useState<ChronosCell | null>(null);

  // ── 1. MODALITÀ CALENDARIO (MESE) ──────────────────────────────────────────
  const { dailyData, initialMonth } = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number; trades: JournalEntry[] }>();
    let latestDate: Date | null = null;

    for (const e of entries) {
      if (!e.tradeDate) continue;
      const key = e.tradeDate.slice(0, 10);
      const parsed = parseTradeContent(e.content ?? "");
      const pnl = parsed?.profit ?? (e.result === "win" ? 100 : e.result === "loss" ? -100 : 0);

      const existing = map.get(key) ?? { pnl: 0, count: 0, trades: [] };
      existing.pnl += pnl;
      existing.count += 1;
      existing.trades.push(e);
      map.set(key, existing);

      const d = parseISO(e.tradeDate);
      if (!latestDate || d.getTime() > latestDate.getTime()) {
        latestDate = d;
      }
    }

    return {
      dailyData: map,
      initialMonth: latestDate ? startOfMonth(latestDate) : startOfMonth(new Date()),
    };
  }, [entries]);

  const [currentMonth, setCurrentMonth] = useState<Date>(initialMonth);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  const monthStats = useMemo(() => {
    let totalPnl = 0;
    let activeDays = 0;
    let winDays = 0;
    let lossDays = 0;

    for (const [dateStr, data] of dailyData.entries()) {
      const d = new Date(`${dateStr}T00:00:00`);
      if (isSameMonth(d, currentMonth)) {
        totalPnl += data.pnl;
        activeDays += 1;
        if (data.pnl > 0) winDays += 1;
        else if (data.pnl < 0) lossDays += 1;
      }
    }

    return { totalPnl, activeDays, winDays, lossDays };
  }, [dailyData, currentMonth]);

  const formattedMonthName = useMemo(() => {
    const raw = format(currentMonth, "MMMM yyyy", { locale: it });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [currentMonth]);

  // ── 2. MODALITÀ DISPERSIONE ORARIA (MATRICE 5x4) ───────────────────────────
  const chronosSummary = useMemo(() => {
    return computeChronosMatrix(entries);
  }, [entries]);

  return (
    <div
      className={cn(
        "flex flex-col justify-between h-full min-h-0 bg-surface-0/60 rounded-xl border border-border-subtle/80 p-3 shadow-inner overflow-hidden select-none",
        className,
      )}
    >
      {/* ── TOP HEADER (CLEAN 1-LINE, NO AWKWARD WRAPPING) ── */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5 shrink-0 whitespace-nowrap gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <img
            src="/images/emblems/la-forgia.png"
            alt="La Forgia"
            className="w-4 h-4 object-contain drop-shadow-[0_0_8px_rgba(197,160,89,0.3)] shrink-0"
          />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-text-hi">
            {viewMode === "calendar" ? "Resa Mensile" : "Dispersione Oraria"}
          </span>
        </div>

        {/* View Mode Toggle Pill (Mese vs Ore) */}
        <div className="flex items-center gap-1 p-0.5 rounded border border-[#C5A059]/25 bg-surface-2/60 shrink-0">
          <button
            type="button"
            onClick={() => {
              synestheticClick();
              setViewMode("calendar");
            }}
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase transition-all",
              viewMode === "calendar"
                ? "bg-[#C5A059]/25 text-[#E8C56A] border border-[#C5A059]/40 shadow-[0_0_6px_rgba(197,160,89,0.2)]"
                : "text-text-lo hover:text-text-hi",
            )}
            title="Vista Calendario Mensile"
          >
            <Calendar size={10} />
            <span>Mese</span>
          </button>
          <button
            type="button"
            onClick={() => {
              synestheticClick();
              setViewMode("matrix");
            }}
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase transition-all",
              viewMode === "matrix"
                ? "bg-[#C5A059]/25 text-[#E8C56A] border border-[#C5A059]/40 shadow-[0_0_6px_rgba(197,160,89,0.2)]"
                : "text-text-lo hover:text-text-hi",
            )}
            title="Vista Dispersione Oraria e Sessioni"
          >
            <Clock size={10} />
            <span>Ore</span>
          </button>
        </div>

        {/* Dynamic Navigation / Sub-filter according to mode */}
        {viewMode === "calendar" ? (
          <div className="flex items-center gap-1 font-mono text-xs shrink-0">
            <button
              type="button"
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              className="flex h-5 w-5 items-center justify-center rounded border border-border-subtle bg-surface-2 text-text-lo hover:text-text-hi hover:border-[#C5A059]/40 transition-colors"
              title="Mese Precedente"
            >
              <ChevronLeft size={12} />
            </button>
            <span className="font-bold text-[#C5A059] px-1 text-[11px] whitespace-nowrap text-center">
              {formattedMonthName}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              className="flex h-5 w-5 items-center justify-center rounded border border-border-subtle bg-surface-2 text-text-lo hover:text-text-hi hover:border-[#C5A059]/40 transition-colors"
              title="Mese Successivo"
            >
              <ChevronRight size={12} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 font-mono text-[9px] shrink-0">
            <button
              type="button"
              onClick={() => {
                synestheticClick();
                setMatrixMetric((m) => (m === "integrity" ? "pnl" : "integrity"));
              }}
              className="px-1.5 py-0.5 rounded border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#E8C56A] hover:bg-[#C5A059]/20 transition-all font-bold tracking-wider uppercase whitespace-nowrap"
            >
              {matrixMetric === "integrity" ? "Filtro: Integrità" : "Filtro: P&L (€)"}
            </button>
          </div>
        )}
      </div>

      {/* ── MAIN BODY: CONDITIONAL RENDERING ── */}
      {viewMode === "calendar" ? (
        /* VISTA 1: CALENDARIO MENSILE (FULL MONTH CALENDAR GRID) */
        <div className="flex-1 min-h-0 flex flex-col justify-center py-1">
          <div className="grid grid-cols-7 gap-1 mb-1 font-mono text-[9px] text-text-lo/70 text-center uppercase font-bold shrink-0">
            {WEEKDAYS.map((w, idx) => (
              <span key={idx}>{w}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 flex-1 min-h-0">
            {calendarDays.map((day, idx) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const inMonth = isSameMonth(day, currentMonth);
              const data = dailyData.get(dateKey);
              const hasData = inMonth && data !== undefined;
              const pnl = data?.pnl ?? 0;

              return (
                <div
                  key={idx}
                  onClick={() => hasData && onSelectDay?.(dateKey)}
                  title={
                    hasData
                      ? `${dateKey}: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}€ (${data.count} trade)`
                      : dateKey
                  }
                  className={cn(
                    "relative flex flex-col items-center justify-between rounded p-1 font-mono transition-all",
                    !inMonth
                      ? "opacity-15 bg-transparent border border-transparent pointer-events-none"
                      : hasData
                      ? pnl > 0
                        ? "bg-success/20 border border-success/40 text-success cursor-pointer hover:scale-105 shadow-[0_0_6px_rgba(16,185,129,0.2)]"
                        : pnl < 0
                        ? "bg-destructive/20 border border-destructive/40 text-destructive cursor-pointer hover:scale-105 shadow-[0_0_6px_rgba(239,68,68,0.2)]"
                        : "bg-[#C5A059]/15 border border-[#C5A059]/30 text-[#C5A059] cursor-pointer"
                      : "bg-surface-2/30 border border-border-subtle/40 text-text-lo/40",
                  )}
                >
                  <span className="text-[10px] font-bold leading-none">{format(day, "d")}</span>
                  {hasData && (
                    <span className="text-[8px] font-bold leading-none truncate max-w-full whitespace-nowrap">
                      {pnl >= 0 ? `+${pnl.toFixed(0)}€` : `${pnl.toFixed(0)}€`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* VISTA 2: DISPERSIONE ORARIA & SESSIONI (MATRICE 5x4 AUREUS) */
        <div className="flex-1 min-h-0 flex flex-col justify-between py-1 gap-1">
          {/* Micro Telemetry Bar (Finestra d'Oro & Pericolo) */}
          <div className="grid grid-cols-2 gap-1.5 shrink-0 text-[9px] font-mono">
            {chronosSummary.bestExecutionWindow ? (
              <div className="flex items-center gap-1.5 p-1 rounded border border-emerald-500/35 bg-emerald-500/10 min-w-0">
                <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0" />
                <div className="truncate leading-none">
                  <span className="text-emerald-400 font-bold whitespace-nowrap">
                    {chronosSummary.bestExecutionWindow.dayLabel} ·{" "}
                    {chronosSummary.bestExecutionWindow.sessionLabel}
                  </span>
                  <span className="text-text-lo ml-1 whitespace-nowrap">
                    ({chronosSummary.bestExecutionWindow.integrityScore}% Integrità)
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-1 rounded border border-border-subtle bg-surface-2/40 text-text-lo/60 text-center">
                In Attesa di Dati
              </div>
            )}

            {chronosSummary.dangerWindow ? (
              <div className="flex items-center gap-1.5 p-1 rounded border border-rose-500/35 bg-rose-500/10 min-w-0">
                <Flame className="h-3 w-3 text-rose-400 shrink-0" />
                <div className="truncate leading-none">
                  <span className="text-rose-400 font-bold whitespace-nowrap">
                    {chronosSummary.dangerWindow.dayLabel} ·{" "}
                    {chronosSummary.dangerWindow.sessionLabel}
                  </span>
                  <span className="text-rose-300 ml-1 whitespace-nowrap">
                    ({chronosSummary.dangerWindow.dominantLeak ? `#${chronosSummary.dangerWindow.dominantLeak}` : `${chronosSummary.dangerWindow.leaksCount} Leak`})
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-1 rounded border border-emerald-500/20 bg-emerald-500/5 text-emerald-400/80 text-center">
                Nessuna Deriva Rilevata
              </div>
            )}
          </div>

          {/* Session Matrix Table Headers */}
          <div className="grid grid-cols-5 gap-1 font-mono text-[9px] text-text-lo/70 uppercase font-bold shrink-0 text-center">
            <span className="text-left pl-1">Giorno</span>
            {CHRONOS_SESSIONS.map((s) => (
              <span key={s.code} className="truncate" title={`${s.label} (${s.hoursRange})`}>
                {s.label}
              </span>
            ))}
          </div>

          {/* Matrix Cells (5 Weekdays x 4 Sessions) */}
          <div className="flex-1 min-h-0 flex flex-col justify-between gap-1">
            {chronosSummary.matrix.map((row, dayIdx) => {
              const dayDef = CHRONOS_WEEKDAYS[dayIdx];
              return (
                <div key={dayDef.dayOfWeek} className="grid grid-cols-5 gap-1 flex-1 min-h-0">
                  <div className="flex items-center pl-1 font-mono text-[10px] font-bold text-text-lo">
                    {dayDef.label}
                  </div>
                  {row.map((cell) => {
                    const hasTrades = cell.tradesCount > 0;
                    const isIntegrityMode = matrixMetric === "integrity";

                    return (
                      <div
                        key={cell.sessionIndex}
                        onMouseEnter={() => setActiveCell(cell)}
                        onMouseLeave={() => setActiveCell(null)}
                        className={cn(
                          "flex flex-col items-center justify-center rounded p-1 font-mono transition-all text-center relative",
                          !hasTrades
                            ? "bg-surface-2/20 border border-border-subtle/30 text-text-lo/30"
                            : isIntegrityMode
                            ? cell.integrityScore >= 75
                              ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 hover:scale-105 shadow-[0_0_6px_rgba(16,185,129,0.2)] cursor-pointer"
                              : cell.integrityScore >= 50
                              ? "bg-[#C5A059]/15 border border-[#C5A059]/40 text-[#E8C56A] hover:scale-105 shadow-[0_0_6px_rgba(197,160,89,0.2)] cursor-pointer"
                              : "bg-rose-500/15 border border-rose-500/40 text-rose-400 hover:scale-105 shadow-[0_0_6px_rgba(239,68,68,0.2)] cursor-pointer"
                            : cell.netPnl > 0
                            ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 hover:scale-105 shadow-[0_0_6px_rgba(16,185,129,0.2)] cursor-pointer"
                            : cell.netPnl < 0
                            ? "bg-rose-500/15 border border-rose-500/40 text-rose-400 hover:scale-105 shadow-[0_0_6px_rgba(239,68,68,0.2)] cursor-pointer"
                            : "bg-[#C5A059]/15 border border-[#C5A059]/30 text-[#C5A059] cursor-pointer",
                        )}
                        title={
                          hasTrades
                            ? `${cell.dayLabel} · ${cell.sessionLabel}: ${cell.tradesCount} Trade | Win: ${cell.winRate}% | PnL: ${cell.netPnl >= 0 ? "+" : ""}${cell.netPnl.toFixed(2)}€ | Virtù: ${cell.virtuesCount} | Leak: ${cell.leaksCount}`
                            : undefined
                        }
                      >
                        {hasTrades ? (
                          <>
                            <span className="text-[8px] opacity-80 leading-none whitespace-nowrap">
                              {cell.tradesCount} Trade
                            </span>
                            <span className="text-[9px] font-bold leading-tight whitespace-nowrap">
                              {isIntegrityMode
                                ? `${cell.integrityScore}%`
                                : cell.netPnl >= 0
                                ? `+${cell.netPnl.toFixed(0)}€`
                                : `${cell.netPnl.toFixed(0)}€`}
                            </span>
                          </>
                        ) : (
                          <span className="text-[8px] opacity-30">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── FOOTER: CLEAN SINGLE-LINE SUMMARY ── */}
      <div className="flex items-center justify-between text-[9px] font-mono text-text-lo border-t border-white/[0.06] pt-1 shrink-0 whitespace-nowrap">
        {viewMode === "calendar" ? (
          <>
            <div className="flex items-center gap-1.5">
              <span>
                Sessioni: <strong className="text-text-hi">{monthStats.activeDays}</strong>
              </span>
              {monthStats.activeDays > 0 && (
                <span>
                  (<strong className="text-success">{monthStats.winDays}W</strong> /{" "}
                  <strong className="text-destructive">{monthStats.lossDays}L</strong>)
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span>Resa Ciclo:</span>
              <strong
                className={
                  monthStats.totalPnl > 0
                    ? "text-success font-bold"
                    : monthStats.totalPnl < 0
                    ? "text-destructive font-bold"
                    : "text-text-lo font-bold"
                }
              >
                {monthStats.totalPnl >= 0
                  ? `+${monthStats.totalPnl.toFixed(2)}`
                  : monthStats.totalPnl.toFixed(2)}{" "}
                €
              </strong>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span>
                Integrità Globale:{" "}
                <strong
                  className={cn(
                    "font-bold",
                    chronosSummary.globalIntegrityScore >= 75
                      ? "text-emerald-400"
                      : chronosSummary.globalIntegrityScore >= 50
                      ? "text-[#E8C56A]"
                      : "text-rose-400",
                  )}
                >
                  {chronosSummary.globalIntegrityScore}%
                </strong>
              </span>
              <span className="text-text-lo/60">
                ({chronosSummary.totalVirtues} Virtù / {chronosSummary.totalLeaks} Leak)
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span>Campione:</span>
              <strong className="text-text-hi font-bold">
                {chronosSummary.totalTrades} Trade
              </strong>
            </div>
          </>
        )}
      </div>
    </div>
  );
});
