import React, { useMemo, useState } from "react";
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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { parseTradeContent } from "@/lib/parseTradeContent";
import type { JournalEntry } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface SovereignChronosHeatmapProps {
  entries?: JournalEntry[];
  onSelectDay?: (dateIso: string) => void;
  className?: string;
}

const WEEKDAYS = ["LUN", "MAR", "MER", "GIO", "VEN", "SAB", "DOM"];

export function SovereignChronosHeatmap({
  entries = [],
  onSelectDay,
  className,
}: SovereignChronosHeatmapProps) {
  // Aggregate daily trades and find the most recent trade date to set initial month
  const { dailyData, initialMonth } = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number; trades: JournalEntry[] }>();
    let latestDate: Date | null = null;

    for (const e of entries) {
      if (!e.tradeDate) continue;
      const key = e.tradeDate.slice(0, 10);
      const parsed = parseTradeContent(e.content ?? "");
      const pnl = parsed?.profit ?? 0;

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

  // Calendar days grid for the full month
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  // Monthly stats
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

  return (
    <div
      className={cn(
        "flex flex-col justify-between h-full min-h-0 bg-surface-0/60 rounded-xl border border-border-subtle/80 p-3 shadow-inner overflow-hidden select-none",
        className
      )}
    >
      {/* ── TOP HEADER (CLEAN 1-LINE, NO AWKWARD WRAPPING) ── */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5 shrink-0 whitespace-nowrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <img
            src="/images/emblems/la-forgia.png"
            alt="La Forgia"
            className="w-4 h-4 object-contain drop-shadow-[0_0_8px_rgba(197,160,89,0.3)] shrink-0"
          />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-text-hi">
            Resa Mensile
          </span>
        </div>

        {/* Month Navigation (< Mese Anno >) */}
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
      </div>

      {/* ── FULL MONTH CALENDAR GRID (PERFECTLY FITTED, NO CUTOFF) ── */}
      <div className="flex-1 min-h-0 flex flex-col justify-center py-1">
        {/* Weekdays Row */}
        <div className="grid grid-cols-7 gap-1 mb-1 font-mono text-[9px] text-text-lo/70 text-center uppercase font-bold shrink-0">
          {WEEKDAYS.map((w, idx) => (
            <span key={idx}>{w}</span>
          ))}
        </div>

        {/* Days Matrix */}
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
                    : "bg-surface-2/30 border border-border-subtle/40 text-text-lo/40"
                )}
              >
                <span className="text-[10px] font-bold leading-none">{format(day, "d")}</span>
                {hasData && (
                  <span className="text-[8px] font-bold leading-none truncate max-w-full">
                    {pnl >= 0 ? `+${pnl.toFixed(0)}€` : `${pnl.toFixed(0)}€`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── FOOTER: CLEAN SINGLE-LINE SUMMARY ── */}
      <div className="flex items-center justify-between text-[9px] font-mono text-text-lo border-t border-white/[0.06] pt-1 shrink-0 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <span>Sessioni: <strong className="text-text-hi">{monthStats.activeDays}</strong></span>
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
            {monthStats.totalPnl >= 0 ? `+${monthStats.totalPnl.toFixed(2)}` : monthStats.totalPnl.toFixed(2)} €
          </strong>
        </div>
      </div>
    </div>
  );
}
