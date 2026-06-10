import { useMemo, useState } from "react";
import { LineChart, TrendingDown } from "lucide-react";
import { computeAccountEquity } from "./accountEquity";
import type { BrokerDeal } from "./types";

const PERIODS = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "Tutto", days: null },
] as const;

const CHART_WIDTH = 320;
const CHART_HEIGHT = 88;

function buildPaths(balances: number[]): { line: string; area: string } {
  if (balances.length === 0) return { line: "", area: "" };
  const min = Math.min(...balances);
  const max = Math.max(...balances);
  const pad = (max - min || Math.abs(max) || 1) * 0.08;
  const lo = min - pad;
  const range = max + pad - lo || 1;
  const stepX = balances.length > 1 ? CHART_WIDTH / (balances.length - 1) : 0;
  const toY = (v: number) => CHART_HEIGHT - ((v - lo) / range) * CHART_HEIGHT;

  const coords = balances.map((v, i) => `${(i * stepX).toFixed(1)},${toY(v).toFixed(1)}`);
  const line = `M ${coords.join(" L ")}`;
  const area = `${line} L ${CHART_WIDTH},${CHART_HEIGHT} L 0,${CHART_HEIGHT} Z`;
  return { line, area };
}

function money(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

/**
 * Curva del balance del conto collegato al Broker Hub. L'ultimo punto è il
 * saldo reale dello snapshot; la storia è ricostruita dai deal chiusi.
 */
export function AccountEquityCurve({
  history,
  balance,
  currency,
  connected,
}: {
  history: BrokerDeal[];
  balance: number;
  currency: string;
  connected: boolean;
}) {
  const [periodIdx, setPeriodIdx] = useState(3);
  const stats = useMemo(
    () => computeAccountEquity(history, balance, PERIODS[periodIdx].days),
    [history, balance, periodIdx],
  );

  if (!connected || (stats.points.length === 0 && balance === 0)) {
    return (
      <div className="col-span-2 rounded-lg border border-dashed border-border/45 bg-secondary/20 px-3 py-3 text-center">
        <LineChart className="mx-auto h-5 w-5 text-muted-foreground/40" />
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Collega il conto per vedere l'andamento del balance.
        </p>
      </div>
    );
  }

  // Serie: balance di partenza + balance a fine di ogni giornata con trade.
  const series = [stats.startBalance, ...stats.points.map((p) => p.balance)];
  const { line, area } = buildPaths(series);
  const positive = stats.periodPnl >= 0;
  const strokeColor = positive ? "rgb(110 231 183)" : "rgb(252 165 165)";

  return (
    <div className="col-span-2 space-y-2 rounded-lg border border-border/40 bg-secondary/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className={`font-mono text-sm font-black ${positive ? "text-emerald-300" : "text-red-300"}`}>
            {positive ? "+" : ""}{money(stats.periodPnl)} {currency}
          </span>
          {stats.periodPct != null && (
            <span className={`font-mono text-[10px] font-bold ${positive ? "text-emerald-300/70" : "text-red-300/70"}`}>
              {positive ? "+" : ""}{stats.periodPct}%
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {PERIODS.map((period, i) => (
            <button
              key={period.label}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setPeriodIdx(i);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition-colors ${
                i === periodIdx
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {stats.points.length === 0 ? (
        <p className="py-3 text-center text-[11px] text-muted-foreground">
          Nessun trade chiuso nel periodo.
        </p>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="h-20 w-full"
            preserveAspectRatio="none"
            role="img"
            aria-label="Andamento balance del conto"
          >
            <path d={area} fill={strokeColor} fillOpacity="0.1" />
            <path d={line} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>
              {money(stats.startBalance)} → <span className="text-foreground/90">{money(stats.endBalance)}</span> {currency}
            </span>
            <span className="flex items-center gap-1">
              <TrendingDown className="h-2.5 w-2.5" />
              DD {stats.maxDrawdown < 0 ? money(stats.maxDrawdown) : "0.00"}
            </span>
            <span>{stats.dealCount} trade</span>
          </div>
        </>
      )}
    </div>
  );
}
