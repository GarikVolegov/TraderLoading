import { useState } from "react";
import { triggerHaptic } from "@/lib/hapticPulse";

export interface TrajectorySeries {
  id: string;
  symbol: string;
  name: string;
  color: string;
  points: number[]; // Percentage return relative to start of period
  currentChange: string;
}

const TIMEFRAMES = ["1 gg", "1 set", "1 m", "6 m", "1 a", "Max"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

const SAMPLE_SERIES: Record<string, TrajectorySeries[]> = {
  europe: [
    {
      id: "gb100",
      symbol: "GB100",
      name: "FTSE 100",
      color: "#a855f7", // Viola imperiale
      points: [0, 0.12, 0.18, 0.08, 0.22, 0.28, 0.33],
      currentChange: "+0,33%",
    },
    {
      id: "de40",
      symbol: "DE40",
      name: "DAX 40",
      color: "#E8C56A", // Oro imperiale
      points: [0, 0.35, 0.52, 0.41, 0.78, 0.95, 1.15],
      currentChange: "+1,15%",
    },
    {
      id: "fr40",
      symbol: "FR40",
      name: "CAC 40",
      color: "#38bdf8", // Azzurro zaffiro
      points: [0, 0.2, 0.45, 0.38, 0.62, 0.88, 1.05],
      currentChange: "+1,05%",
    },
  ],
  us: [
    {
      id: "us500",
      symbol: "US500",
      name: "S&P 500",
      color: "#E8C56A",
      points: [0, -0.4, -0.65, -0.5, -0.95, -1.2, -1.39],
      currentChange: "-1,39%",
    },
    {
      id: "us30",
      symbol: "US30",
      name: "Dow Jones",
      color: "#38bdf8",
      points: [0, -0.1, -0.22, -0.15, -0.38, -0.45, -0.53],
      currentChange: "-0,53%",
    },
    {
      id: "us100",
      symbol: "US100",
      name: "Nasdaq 100",
      color: "#ef4444",
      points: [0, -0.85, -1.4, -1.2, -2.1, -2.9, -3.66],
      currentChange: "-3,66%",
    },
  ],
  asia: [
    {
      id: "nikkei",
      symbol: "NIKKEI",
      name: "Nikkei 225",
      color: "#10b981",
      points: [0, 0.25, 0.4, 0.32, 0.55, 0.7, 0.82],
      currentChange: "+0,82%",
    },
    {
      id: "hk50",
      symbol: "HK50",
      name: "Hang Seng",
      color: "#E8C56A",
      points: [0, 0.3, 0.65, 0.48, 0.85, 1.05, 1.2],
      currentChange: "+1,20%",
    },
  ],
};

interface MarketComparativeChartProps {
  region: "all" | "us" | "europe" | "asia";
}

export function MarketComparativeChart({ region }: MarketComparativeChartProps) {
  const [selectedTf, setSelectedTf] = useState<Timeframe>("1 gg");

  const effectiveRegion = region === "all" ? "europe" : region;
  const seriesList = SAMPLE_SERIES[effectiveRegion] || SAMPLE_SERIES.europe;

  // Chart bounds & SVG dimensions
  const svgWidth = 360;
  const svgHeight = 180;
  const paddingX = 16;
  const paddingTop = 20;
  const paddingBottom = 25;

  // Min and max across all series
  const allValues = seriesList.flatMap((s) => s.points);
  const minVal = Math.min(-0.5, ...allValues);
  const maxVal = Math.max(0.5, ...allValues);
  const range = maxVal - minVal || 1;

  const getX = (idx: number, total: number) => paddingX + (idx / (total - 1)) * (svgWidth - paddingX * 2);
  const getY = (val: number) =>
    paddingTop + (1 - (val - minVal) / range) * (svgHeight - paddingTop - paddingBottom);

  return (
    <div className="w-full flex flex-col gap-3 py-2">
      {/* Legend header */}
      <div className="flex items-center gap-4 flex-wrap px-1">
        {seriesList.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5 font-mono text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="font-bold text-white tracking-wide">{s.symbol}</span>
            <span
              className={`font-semibold ${
                s.currentChange.startsWith("+") ? "text-[#10b981]" : "text-[#ef4444]"
              }`}
            >
              {s.currentChange}
            </span>
          </div>
        ))}
      </div>

      {/* SVG Multi-curve display */}
      <div className="relative w-full h-[180px] bg-[#07080b]/90 rounded-xl border border-white/5 overflow-hidden">
        {/* Zero guideline */}
        <div
          className="absolute left-0 right-0 border-b border-dashed border-white/15 pointer-events-none"
          style={{ top: `${getY(0)}px` }}
        >
          <span className="absolute right-2 -top-4 font-mono text-[9px] text-[#94a3b8]">0,00%</span>
        </div>

        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full">
          {seriesList.map((s) => {
            const pathData = s.points
              .map((val, idx) => {
                const x = getX(idx, s.points.length);
                const y = getY(val);
                return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
              })
              .join(" ");

            const lastVal = s.points[s.points.length - 1];
            const lastX = getX(s.points.length - 1, s.points.length);
            const lastY = getY(lastVal);

            return (
              <g key={s.id}>
                <path
                  d={pathData}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx={lastX} cy={lastY} r="3.5" fill={s.color} />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Timeframe pill selector */}
      <div className="flex items-center justify-between gap-1 bg-[#0d0f14] p-1 rounded-xl border border-[#C5A059]/20">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            type="button"
            onClick={() => {
              triggerHaptic("selection");
              setSelectedTf(tf);
            }}
            className={`flex-1 py-1 font-mono text-[11px] font-bold uppercase rounded-lg transition-all ${
              selectedTf === tf
                ? "bg-[#C5A059] text-[#07080b] shadow-[0_0_12px_rgba(197,160,89,0.3)]"
                : "text-[#94a3b8] hover:text-white"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>
    </div>
  );
}
