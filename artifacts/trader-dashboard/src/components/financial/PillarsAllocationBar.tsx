import type { PillarsAllocation, PillarsAllocationPct } from "../../../../../contracts/financialArchitecture";
import { PILLAR_COLORS, PILLAR_LABELS } from "./PillarsDonutChart";

interface PillarsAllocationBarProps {
  pillars: PillarsAllocation;
  percentages: PillarsAllocationPct;
  totalNetWorth: number;
}

export function PillarsAllocationBar({
  pillars,
  percentages,
  totalNetWorth,
}: PillarsAllocationBarProps) {
  const items: Array<{
    key: keyof PillarsAllocation;
    label: string;
    value: number;
    pct: number;
    color: string;
  }> = [
    {
      key: "liquidityAllocation",
      label: PILLAR_LABELS.liquidityAllocation,
      value: Math.max(0, pillars.liquidityAllocation),
      pct: percentages.liquidityPct,
      color: PILLAR_COLORS.liquidityAllocation,
    },
    {
      key: "reserveAllocation",
      label: PILLAR_LABELS.reserveAllocation,
      value: Math.max(0, pillars.reserveAllocation),
      pct: percentages.reservePct,
      color: PILLAR_COLORS.reserveAllocation,
    },
    {
      key: "tradingAllocation",
      label: PILLAR_LABELS.tradingAllocation,
      value: Math.max(0, pillars.tradingAllocation),
      pct: percentages.tradingPct,
      color: PILLAR_COLORS.tradingAllocation,
    },
    {
      key: "investmentsAllocation",
      label: PILLAR_LABELS.investmentsAllocation,
      value: Math.max(0, pillars.investmentsAllocation),
      pct: percentages.investmentsPct,
      color: PILLAR_COLORS.investmentsAllocation,
    },
    {
      key: "futureProjectsAllocation",
      label: PILLAR_LABELS.futureProjectsAllocation,
      value: Math.max(0, pillars.futureProjectsAllocation),
      pct: percentages.futureProjectsPct,
      color: PILLAR_COLORS.futureProjectsAllocation,
    },
  ];

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
        <span>Distribuzione dei 5 Pilastri</span>
        <span className="font-semibold text-foreground">
          {totalNetWorth.toLocaleString("it-IT")} € (100%)
        </span>
      </div>

      {/* Segmented bar */}
      <div className="h-4 w-full overflow-hidden rounded-md bg-[#1E1E26] flex border border-border/80">
        {items.map((item) => {
          if (item.pct <= 0) return null;
          return (
            <div
              key={item.key}
              style={{
                width: `${item.pct}%`,
                backgroundColor: item.color,
              }}
              className="h-full transition-all duration-300 relative group cursor-pointer first:rounded-l last:rounded-r"
              title={`${item.label}: ${item.value.toLocaleString("it-IT")} € (${item.pct}%)`}
            />
          );
        })}
      </div>

      {/* Pill values */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-muted-foreground pt-1">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-foreground font-medium">{item.label}:</span>
            <span>{item.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
