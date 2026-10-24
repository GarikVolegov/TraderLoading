import { useState, useMemo } from "react";
import type { EquityCurvePoint } from "@/lib/backtestStats";
import { TrendingUp, DollarSign } from "lucide-react";

interface ReplayEquityCurveProps {
  data: EquityCurvePoint[];
  height?: number;
  className?: string;
  currency?: string;
  initialBalance?: number;
}

export function ReplayEquityCurve({
  data,
  height = 140,
  className = "",
  currency = "EUR",
  initialBalance = 10000,
}: ReplayEquityCurveProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [curveMode, setCurveMode] = useState<"pnl" | "pips">("pnl");

  const {
    points,
    zeroY,
    pathD,
    areaD,
    latestVal,
    peakVal,
    maxDrawdown,
    latestRoi,
    peakRoi,
  } = useMemo(() => {
    if (!data || data.length < 2) {
      return {
        points: [],
        minVal: 0,
        maxVal: 0,
        zeroY: height / 2,
        pathD: "",
        areaD: "",
        latestVal: 0,
        peakVal: 0,
        maxDrawdown: 0,
        latestRoi: 0,
        peakRoi: 0,
      };
    }

    const isPnl = curveMode === "pnl";
    const valuesList = data.map((d) => (isPnl ? d.cumulativePnl ?? 0 : d.cumulativePips ?? 0));
    let min = Math.min(...valuesList);
    let max = Math.max(...valuesList);
    let peak = 0;
    let dd = 0;

    data.forEach((d) => {
      const v = isPnl ? d.cumulativePnl ?? 0 : d.cumulativePips ?? 0;
      if (v > peak) peak = v;
      const curDd = peak - v;
      if (curDd > dd) dd = curDd;
    });

    // Ensure 0 is included in range for baseline
    if (min > 0) min = 0;
    if (max < 0) max = 0;

    // Add padding to range
    const range = max - min;
    const padding = range === 0 ? (isPnl ? 50 : 10) : range * 0.12;
    min -= padding;
    max += padding;

    const svgWidth = 600;
    const svgHeight = height;
    const paddingTop = 12;
    const paddingBottom = 16;
    const usableHeight = svgHeight - paddingTop - paddingBottom;

    const getY = (val: number) => {
      const normalized = (val - min) / (max - min || 1);
      return svgHeight - paddingBottom - normalized * usableHeight;
    };

    const getX = (index: number) => {
      return (index / (data.length - 1)) * svgWidth;
    };

    const pts = data.map((d, i) => {
      const currentVal = isPnl ? d.cumulativePnl ?? 0 : d.cumulativePips ?? 0;
      return {
        ...d,
        val: currentVal,
        x: getX(i),
        y: getY(currentVal),
      };
    });

    // Generate path commands
    let path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      path += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
    }

    const baselineY = getY(0);
    const clampedZeroY = Math.max(paddingTop, Math.min(svgHeight - paddingBottom, baselineY));

    // Area path down to zero line (or bottom)
    const area = `${path} L ${pts[pts.length - 1].x.toFixed(1)} ${svgHeight - paddingBottom} L ${pts[0].x.toFixed(1)} ${svgHeight - paddingBottom} Z`;

    const lastPoint = data[data.length - 1];
    const latestValue = isPnl ? lastPoint.cumulativePnl ?? 0 : lastPoint.cumulativePips ?? 0;
    const latestRoiVal = initialBalance > 0 ? (lastPoint.cumulativePnl / initialBalance) * 100 : 0;
    const peakRoiVal = initialBalance > 0 ? (peak / initialBalance) * 100 : 0;

    return {
      points: pts,
      minVal: min + padding,
      maxVal: max - padding,
      zeroY: clampedZeroY,
      pathD: path,
      areaD: area,
      latestVal: latestValue,
      peakVal: peak,
      maxDrawdown: dd,
      latestRoi: latestRoiVal,
      peakRoi: peakRoiVal,
    };
  }, [data, height, curveMode, initialBalance]);

  const activePoint = hoveredIndex != null && points[hoveredIndex] ? points[hoveredIndex] : null;

  if (!data || data.length < 2) {
    return (
      <div
        className={`border border-border/70 bg-card/75 p-3 flex flex-col justify-center items-center text-center select-none ${className}`}
        style={{ height }}
      >
        <TrendingUp className="w-5 h-5 text-muted-foreground/40 mb-1" />
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          Curva di Rendimento Cumulato
        </span>
        <p className="text-[11px] text-muted-foreground/60 mt-0.5">
          Esegui simulazioni nel replay per visualizzare la curva equity
        </p>
      </div>
    );
  }

  const isNetPositive = latestVal >= 0;
  const strokeColor = isNetPositive ? "#10B981" : "#F43F5E";
  const gradientId = `equityGrad-${curveMode}-${isNetPositive ? "win" : "loss"}`;

  const formatDisplayValue = (val: number) => {
    if (curveMode === "pnl") {
      const sign = val >= 0 ? "+" : "-";
      return `${sign}${Math.abs(val).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
    }
    return `${val >= 0 ? "+" : ""}${val.toFixed(1)} pips`;
  };

  return (
    <div className={`border border-border/80 bg-card/85 p-3 flex flex-col justify-between relative overflow-hidden select-none ${className}`}>
      {/* Header Info */}
      <div className="flex items-center justify-between mb-2 z-10 gap-2 shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#C5A059] flex items-center gap-1.5 shrink-0">
            {curveMode === "pnl" ? (
              <DollarSign className="w-3.5 h-3.5 text-[#C5A059]" />
            ) : (
              <TrendingUp className="w-3.5 h-3.5 text-[#C5A059]" />
            )}
            <span>Curva Equity</span>
          </span>

          {/* Mode Switcher Toggle */}
          <div className="inline-flex items-center rounded border border-[#C5A059]/30 bg-background/90 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setCurveMode("pnl")}
              className={`px-1.5 py-0.5 font-mono text-[8.5px] uppercase font-bold transition-all ${
                curveMode === "pnl"
                  ? "bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/50 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              P&L
            </button>
            <button
              type="button"
              onClick={() => setCurveMode("pips")}
              className={`px-1.5 py-0.5 font-mono text-[8.5px] uppercase font-bold transition-all ${
                curveMode === "pips"
                  ? "bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/50 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pips
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 font-mono text-[9.5px] shrink-0 ml-auto">
          {maxDrawdown > 0 && (
            <div className="hidden 2xl:flex items-center gap-1 text-muted-foreground">
              <span>Max DD:</span>
              <span className="text-rose-400 font-semibold tabular-nums whitespace-nowrap">
                -{curveMode === "pnl"
                  ? `${maxDrawdown.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
                  : `${maxDrawdown.toFixed(1)}p`}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground/80">Netto:</span>
            <strong className={`font-bold tabular-nums whitespace-nowrap ${isNetPositive ? "text-emerald-400" : "text-rose-400"}`}>
              {formatDisplayValue(latestVal)}
            </strong>
            {curveMode === "pnl" && (
              <span className={`text-[8.5px] font-bold tabular-nums ml-0.5 whitespace-nowrap ${latestRoi >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                ({latestRoi >= 0 ? "+" : ""}{latestRoi.toFixed(2)}%)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full flex-1 min-h-0">
        <svg
          viewBox={`0 0 600 ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
              <stop offset="90%" stopColor={strokeColor} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Zero baseline */}
          <line
            x1="0"
            y1={zeroY}
            x2="600"
            y2={zeroY}
            stroke="hsl(var(--border))"
            strokeDasharray="3 3"
            strokeWidth="1"
          />

          {/* Area fill */}
          <path d={areaD} fill={`url(#${gradientId})`} />

          {/* Line stroke */}
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive vertical hover zones */}
          {points.map((pt, idx) => (
            <rect
              key={idx}
              x={Math.max(0, pt.x - 600 / (points.length * 2))}
              y={0}
              width={600 / points.length}
              height={height}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIndex(idx)}
            />
          ))}

          {/* Hover indicator dot & guide */}
          {activePoint && (
            <g>
              <line
                x1={activePoint.x}
                y1={0}
                x2={activePoint.x}
                y2={height}
                stroke="#C5A059"
                strokeDasharray="2 2"
                strokeWidth="1"
                opacity="0.8"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="4.5"
                fill="#0C0D12"
                stroke={activePoint.val >= 0 ? "#10B981" : "#F43F5E"}
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Floating Tooltip */}
        {activePoint && activePoint.index > 0 && (
          <div
            className="absolute pointer-events-none z-30 top-5 bg-[#0B0D13]/95 border border-[#C5A059]/45 px-2.5 py-1.5 shadow-2xl backdrop-blur rounded text-[9.5px] font-mono transform -translate-x-1/2 whitespace-nowrap"
            style={{
              left: `${Math.min(88, Math.max(12, (activePoint.x / 600) * 100))}%`,
              maxWidth: "220px",
            }}
          >
            <div className="flex items-center gap-1.5 font-bold text-foreground mb-0.5">
              <span>Trade #{activePoint.index}</span>
              <span className={`uppercase px-1 py-0.2 text-[8px] border font-bold ${
                activePoint.direction === "buy" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : "text-rose-400 border-rose-500/30 bg-rose-500/10"
              }`}>
                {activePoint.direction}
              </span>
              <span className={activePoint.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {activePoint.pnl >= 0 ? "+" : ""}{activePoint.pnl.toFixed(2)} {currency}
              </span>
            </div>
            <div className="text-muted-foreground flex items-center justify-between gap-3 text-[9px]">
              <span>Pips:</span>
              <span className={activePoint.pips >= 0 ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                {activePoint.pips >= 0 ? "+" : ""}{activePoint.pips} pips
              </span>
            </div>
            <div className="text-muted-foreground flex items-center justify-between gap-3 text-[9px] pt-0.5 border-t border-border/40 mt-0.5">
              <span>PNL Totale:</span>
              <strong className={activePoint.cumulativePnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {activePoint.cumulativePnl >= 0 ? "+" : ""}{activePoint.cumulativePnl.toFixed(2)} {currency}
              </strong>
            </div>
            <div className="text-muted-foreground flex items-center justify-between gap-3 text-[9px]">
              <span>ROI:</span>
              <strong className={activePoint.roiPct >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {activePoint.roiPct >= 0 ? "+" : ""}{activePoint.roiPct.toFixed(2)}%
              </strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
