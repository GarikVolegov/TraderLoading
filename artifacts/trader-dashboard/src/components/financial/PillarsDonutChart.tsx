import { useState, useId } from "react";
import type { PillarsAllocation, PillarsAllocationPct } from "../../../../../contracts/financialArchitecture";

interface DonutSegment {
  key: keyof PillarsAllocation;
  label: string;
  color: string;
  value: number;
  pct: number;
}

interface PillarsDonutChartProps {
  pillars: PillarsAllocation;
  percentages: PillarsAllocationPct;
  totalNetWorth: number;
  className?: string;
  onSelectSegment?: (key: keyof PillarsAllocation) => void;
}

export const PILLAR_COLORS: Record<keyof PillarsAllocation, string> = {
  liquidityAllocation: "#8E92A0", // Pietra / Liquidità Vitale
  reserveAllocation: "#C5A059", // Oro Brunito / Fondo di Riserva
  tradingAllocation: "#D4AF37", // Oro Chiaro / Conto Trading
  investmentsAllocation: "#9C772C", // Bronzo Nobile / Investimenti Passivi
  futureProjectsAllocation: "#5A6275", // Acciaio Vulcanico / Progetti Futuri
};

export const PILLAR_LABELS: Record<keyof PillarsAllocation, string> = {
  liquidityAllocation: "Liquidità Vitale",
  reserveAllocation: "Fondo di Riserva",
  tradingAllocation: "Conto Trading",
  investmentsAllocation: "Investimenti Passivi",
  futureProjectsAllocation: "Progetti Futuri",
};

export function PillarsDonutChart({
  pillars,
  percentages,
  totalNetWorth,
  className = "",
  onSelectSegment,
}: PillarsDonutChartProps) {
  const [activeSegment, setActiveSegment] = useState<keyof PillarsAllocation | null>(null);
  const chartId = useId();

  const segments: DonutSegment[] = [
    {
      key: "liquidityAllocation",
      label: PILLAR_LABELS.liquidityAllocation,
      color: PILLAR_COLORS.liquidityAllocation,
      value: Math.max(0, pillars.liquidityAllocation),
      pct: percentages.liquidityPct,
    },
    {
      key: "reserveAllocation",
      label: PILLAR_LABELS.reserveAllocation,
      color: PILLAR_COLORS.reserveAllocation,
      value: Math.max(0, pillars.reserveAllocation),
      pct: percentages.reservePct,
    },
    {
      key: "tradingAllocation",
      label: PILLAR_LABELS.tradingAllocation,
      color: PILLAR_COLORS.tradingAllocation,
      value: Math.max(0, pillars.tradingAllocation),
      pct: percentages.tradingPct,
    },
    {
      key: "investmentsAllocation",
      label: PILLAR_LABELS.investmentsAllocation,
      color: PILLAR_COLORS.investmentsAllocation,
      value: Math.max(0, pillars.investmentsAllocation),
      pct: percentages.investmentsPct,
    },
    {
      key: "futureProjectsAllocation",
      label: PILLAR_LABELS.futureProjectsAllocation,
      color: PILLAR_COLORS.futureProjectsAllocation,
      value: Math.max(0, pillars.futureProjectsAllocation),
      pct: percentages.futureProjectsPct,
    },
  ];

  const totalSum = segments.reduce((acc, s) => acc + s.value, 0);

  // Calcolo delle coordinate SVG per archi donut
  const size = 260;
  const strokeWidth = 32;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let accumulatedPercent = 0;

  const activeData = activeSegment
    ? segments.find((s) => s.key === activeSegment)
    : null;

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      <div className="relative h-[260px] w-[260px]">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="h-full w-full -rotate-90 transform"
          aria-label="Grafico a ciambella dell'allocazione dei 5 pilastri"
        >
          {/* Sfondo anello vuoto */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#1E1E26"
            strokeWidth={strokeWidth}
          />

          {totalSum > 0 &&
            segments.map((seg) => {
              const fraction = seg.value / totalSum;
              const strokeDasharray = `${fraction * circumference} ${circumference}`;
              const strokeDashoffset = -(accumulatedPercent * circumference);
              accumulatedPercent += fraction;

              const isHighlighted = activeSegment === seg.key;

              return (
                <circle
                  key={`${chartId}-${seg.key}`}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth={isHighlighted ? strokeWidth + 6 : strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className="cursor-pointer transition-all duration-300 hover:opacity-90"
                  onMouseEnter={() => {
                    setActiveSegment(seg.key);
                    onSelectSegment?.(seg.key);
                  }}
                  onMouseLeave={() => setActiveSegment(null)}
                  onClick={() => onSelectSegment?.(seg.key)}
                />
              );
            })}
        </svg>

        {/* Centro del donut con importi / dettagli */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center pointer-events-none">
          {activeData ? (
            <>
              <p
                className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate max-w-[150px]"
                style={{ color: activeData.color }}
              >
                {activeData.label}
              </p>
              <p className="font-mono text-xl font-bold tracking-tight text-foreground mt-0.5">
                {activeData.value.toLocaleString("it-IT")} €
              </p>
              <span className="font-mono text-xs font-semibold text-muted-foreground">
                {activeData.pct.toFixed(1)}%
              </span>
            </>
          ) : (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Patrimonio Totale
              </p>
              <p className="font-mono text-xl sm:text-2xl font-bold tracking-tight text-[#C5A059] mt-0.5">
                {totalNetWorth.toLocaleString("it-IT")} €
              </p>
              <span className="font-mono text-[11px] text-[#F4F4F6]/60">
                100% Allocato
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legenda 5 pilastri in basso */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 w-full text-xs">
        {segments.map((seg) => (
          <button
            key={seg.key}
            type="button"
            className={`flex items-center gap-2 p-1.5 rounded border text-left transition-colors ${
              activeSegment === seg.key
                ? "border-primary bg-primary/10"
                : "border-border/60 bg-[#141418] hover:border-border"
            }`}
            onMouseEnter={() => {
              setActiveSegment(seg.key);
              onSelectSegment?.(seg.key);
            }}
            onMouseLeave={() => setActiveSegment(null)}
            onClick={() => onSelectSegment?.(seg.key)}
          >
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[11px] truncate text-foreground">
                {seg.label}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {seg.value.toLocaleString("it-IT")} € ({seg.pct.toFixed(1)}%)
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
