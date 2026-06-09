import { useMemo, useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDateLocale } from "@/contexts/LanguageContext";
import { computeEquityStats, type EquityEntryInput } from "@/lib/equityStats";

const WEEKDAY_LABELS = ["L", "M", "M", "G", "V", "S", "D"];

function cellClasses(pnl: number | undefined, inMonth: boolean): string {
  if (!inMonth) return "bg-transparent border-transparent text-muted-foreground/20";
  if (pnl === undefined) return "bg-secondary/20 border-border/25 text-muted-foreground/50";
  if (pnl > 0) {
    const intensity = pnl >= 100 ? "bg-emerald-500/45" : pnl >= 30 ? "bg-emerald-500/30" : "bg-emerald-500/15";
    return `${intensity} border-emerald-500/40 text-emerald-100`;
  }
  if (pnl < 0) {
    const intensity = pnl <= -100 ? "bg-red-500/45" : pnl <= -30 ? "bg-red-500/30" : "bg-red-500/15";
    return `${intensity} border-red-500/40 text-red-100`;
  }
  return "bg-secondary/40 border-border/40 text-muted-foreground";
}

/** Calendario mensile con i giorni colorati per P&L netto dei trade importati. */
export function PnlHeatmap({ entries }: { entries: EquityEntryInput[] | undefined }) {
  const dateLocale = useDateLocale();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const { dailyPnl, currency, hasTrades } = useMemo(() => {
    const stats = computeEquityStats(entries);
    const map = new Map(stats.points.map((p) => [p.date, p.pnl]));
    return { dailyPnl: map, currency: stats.currency ?? "", hasTrades: stats.tradeCount > 0 };
  }, [entries]);

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  const monthTotal = useMemo(() => {
    let total = 0;
    for (const [date, pnl] of dailyPnl) {
      if (isSameMonth(new Date(`${date}T00:00:00`), month)) total += pnl;
    }
    return Math.round(total * 100) / 100;
  }, [dailyPnl, month]);

  if (!hasTrades) return null;

  return (
    <div className="rounded-2xl border border-border/30 bg-card/60 p-4 backdrop-blur-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">Calendario P&L</h3>
          <p className="text-xs text-muted-foreground">
            {format(month, "MMMM yyyy", { locale: dateLocale })}
            {" · "}
            <span className={`font-mono font-bold ${monthTotal > 0 ? "text-emerald-300" : monthTotal < 0 ? "text-red-300" : "text-muted-foreground"}`}>
              {monthTotal > 0 ? "+" : ""}{monthTotal.toFixed(2)} {currency}
            </span>
          </p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMonth((m) => subMonths(m, 1))}
            aria-label="Mese precedente"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border/40 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            aria-label="Mese successivo"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border/40 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={`${label}-${i}`} className="pb-1 text-center text-[10px] font-bold uppercase text-muted-foreground/60">
            {label}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const pnl = dailyPnl.get(key);
          const inMonth = isSameMonth(day, month);
          return (
            <div
              key={key}
              title={pnl !== undefined ? `${key}: ${pnl > 0 ? "+" : ""}${pnl.toFixed(2)} ${currency}` : key}
              className={`flex h-11 flex-col items-center justify-center rounded-md border text-[11px] font-semibold transition-colors sm:h-14 ${cellClasses(pnl, inMonth)}`}
            >
              <span>{format(day, "d")}</span>
              {inMonth && pnl !== undefined && (
                <span className="hidden font-mono text-[9px] leading-none sm:block">
                  {pnl > 0 ? "+" : ""}{Math.abs(pnl) >= 100 ? pnl.toFixed(0) : pnl.toFixed(1)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
