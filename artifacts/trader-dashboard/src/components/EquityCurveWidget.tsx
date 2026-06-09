import { useMemo, useState } from "react";
import { LineChart, Loader2, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getGetJournalEntriesQueryKey, useGetJournalEntries } from "@workspace/api-client-react";
import { computeEquityStats, filterEntriesByDays, type EquityEntryInput } from "@/lib/equityStats";

const PERIODS = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "Tutto", days: null },
] as const;

const CHART_WIDTH = 320;
const CHART_HEIGHT = 96;

function buildPath(values: number[]): { line: string; area: string; zeroY: number | null } {
  if (values.length === 0) return { line: "", area: "", zeroY: null };
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  const stepX = values.length > 1 ? CHART_WIDTH / (values.length - 1) : 0;
  const toY = (v: number) => CHART_HEIGHT - ((v - min) / range) * CHART_HEIGHT;

  const coords = values.map((v, i) => `${(i * stepX).toFixed(1)},${toY(v).toFixed(1)}`);
  const line = `M ${coords.join(" L ")}`;
  const baseline = toY(0).toFixed(1);
  const area = `${line} L ${CHART_WIDTH},${baseline} L 0,${baseline} Z`;
  return { line, area, zeroY: toY(0) };
}

export function EquityCurveWidget() {
  const [periodIdx, setPeriodIdx] = useState(3);
  const { data: entries, isLoading } = useGetJournalEntries({
    query: { queryKey: getGetJournalEntriesQueryKey(), refetchInterval: 30_000 },
  });

  const stats = useMemo(() => {
    const filtered = filterEntriesByDays(entries as EquityEntryInput[] | undefined, PERIODS[periodIdx].days);
    return computeEquityStats(filtered);
  }, [entries, periodIdx]);

  const values = stats.points.map((p) => p.cumulative);
  // La curva parte sempre da zero per leggere il P&L del periodo.
  const series = values.length > 0 ? [0, ...values] : [];
  const { line, area, zeroY } = buildPath(series);
  const positive = stats.totalPnl >= 0;
  const tone = positive ? "text-emerald-300" : "text-red-300";
  const strokeColor = positive ? "rgb(110 231 183)" : "rgb(252 165 165)";
  const currency = stats.currency ?? "";

  return (
    <Card className="h-full overflow-hidden border-border/30 bg-card/60 backdrop-blur-sm">
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <LineChart className="h-4 w-4 text-primary" />
              <h3 className="truncate text-base font-black leading-tight">Equity</h3>
            </div>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              P&L cumulativo dai trade sincronizzati
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            {PERIODS.map((period, i) => (
              <button
                key={period.label}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setPeriodIdx(i);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
                  i === periodIdx
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[10rem] items-center justify-center rounded-md border border-border/35 bg-secondary/25">
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Caricamento equity" />
          </div>
        ) : stats.tradeCount === 0 ? (
          <div className="rounded-md border border-dashed border-border/45 bg-secondary/20 p-5 text-center">
            <LineChart className="mx-auto h-8 w-8 text-muted-foreground/35" />
            <p className="mt-2 text-sm font-bold">Nessun trade nel periodo</p>
            <p className="mx-auto mt-1 max-w-[15rem] text-xs leading-snug text-muted-foreground">
              Collega il conto nel Broker Hub o registra trade nel Diario per vedere la curva equity.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <span className={`font-mono text-2xl font-black ${tone}`}>
                {positive ? "+" : ""}{stats.totalPnl.toFixed(2)} {currency}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {stats.tradeCount} trade
              </span>
            </div>

            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              className="h-24 w-full"
              preserveAspectRatio="none"
              role="img"
              aria-label="Curva equity cumulativa"
            >
              {zeroY != null && (
                <line
                  x1="0" y1={zeroY} x2={CHART_WIDTH} y2={zeroY}
                  stroke="currentColor" strokeOpacity="0.15" strokeDasharray="4 4"
                  className="text-muted-foreground"
                />
              )}
              <path d={area} fill={strokeColor} fillOpacity="0.12" />
              <path d={line} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </svg>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-border/35 bg-secondary/25 px-2 py-1.5">
                <p className="text-[0.55rem] font-bold uppercase text-muted-foreground">Best day</p>
                <p className="mt-0.5 font-mono text-xs font-bold text-emerald-300">
                  {stats.bestDay ? `+${stats.bestDay.pnl.toFixed(2)}` : "—"}
                </p>
              </div>
              <div className="rounded-md border border-border/35 bg-secondary/25 px-2 py-1.5">
                <p className="text-[0.55rem] font-bold uppercase text-muted-foreground">Worst day</p>
                <p className="mt-0.5 font-mono text-xs font-bold text-red-300">
                  {stats.worstDay ? stats.worstDay.pnl.toFixed(2) : "—"}
                </p>
              </div>
              <div className="rounded-md border border-border/35 bg-secondary/25 px-2 py-1.5">
                <p className="flex items-center justify-center gap-1 text-[0.55rem] font-bold uppercase text-muted-foreground">
                  <TrendingDown className="h-2.5 w-2.5" /> Drawdown
                </p>
                <p className="mt-0.5 font-mono text-xs font-bold text-red-300">
                  {stats.maxDrawdown < 0 ? stats.maxDrawdown.toFixed(2) : "0.00"}
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
