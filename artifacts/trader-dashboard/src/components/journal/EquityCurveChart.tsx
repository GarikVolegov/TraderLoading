import React, { memo, useState } from "react";
import { type ProjectionBands } from "@/lib/equityProjection";

export interface TradePointDetail {
  date?: string;
  title?: string;
  pnl?: number;
  r?: number;
  cumulativeEuro?: number;
  idealCumulativeEuro?: number;
  hasLeak?: boolean;
  leakNames?: string[];
  bleedAmount?: number;
}

interface EquityCurveChartProps {
  realized: number[];
  ideal?: number[];
  showIdealCurve?: boolean;
  bands: ProjectionBands;
  projectionSteps: number;
  tradeDetails?: TradePointDetail[];
  currency?: string;
}

const W = 560;
const H = 145;
const PAD_TOP = 24; // Space for fixed top HUD
const PAD_BOTTOM = 8;
const PAD_X = 10;
const ACCENT_GREEN = "#10B981";
const PROJ_GOLD = "#C5A059";
const PROJ_GOLD_MEDIAN = "#E5C378";

export const EquityCurveChart = memo(function EquityCurveChart({
  realized,
  ideal,
  showIdealCurve = false,
  bands,
  projectionSteps,
  tradeDetails,
  currency = "€",
}: EquityCurveChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const histN = realized.length;
  const span = Math.max(1, histN - 1 + projectionSteps);
  const effectiveIdeal = showIdealCurve && ideal && ideal.length === histN ? ideal : [];
  const allV = [...realized, ...effectiveIdeal, ...bands.p10, ...bands.p90];
  const max = Math.max(...allV, 5);
  const min = Math.min(...allV, -5);

  const xOf = (idx: number) => PAD_X + (idx / span) * (W - PAD_X * 2);
  const yOf = (v: number) =>
    H - PAD_BOTTOM - ((v - min) / (max - min || 1)) * (H - PAD_TOP - PAD_BOTTOM);

  const histPts = realized.map((v, i) => [xOf(i), yOf(v)] as const);
  const histLine = histPts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const lastPt = histPts[histPts.length - 1] ?? ([xOf(0), yOf(0)] as const);
  const histArea = `${histLine} L${lastPt[0].toFixed(1)},${H} L${(histPts[0]?.[0] ?? PAD_X).toFixed(1)},${H} Z`;

  // Ideal (Zero-Leak) Curve calculations
  const idealPts = effectiveIdeal.map((v, i) => [xOf(i), yOf(v)] as const);
  const idealLine = idealPts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const lastIdealPt = idealPts[idealPts.length - 1];

  // Friction Bleed Area (gap between Ideal and Realized line)
  const bleedArea =
    idealPts.length > 0 && histPts.length === idealPts.length
      ? `${idealPts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")} ${histPts
          .slice()
          .reverse()
          .map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`)
          .join(" ")} Z`
      : "";

  const px = (k: number) => xOf(histN - 1 + k);
  const bandPath = (lo: number[], hi: number[]) => {
    const up = hi.map((v, k) => `${k === 0 ? "M" : "L"}${px(k).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
    const down = lo
      .map((_, k) => `L${px(lo.length - 1 - k).toFixed(1)},${yOf(lo[lo.length - 1 - k]).toFixed(1)}`)
      .join(" ");
    return `${up} ${down} Z`;
  };
  const medianLine = bands.p50.map((v, k) => `${k === 0 ? "M" : "L"}${px(k).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
  const simPath = (path: number[]) =>
    path.map((v, k) => `${k === 0 ? "M" : "L"}${px(k).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
  const divX = px(0);

  // Zero horizontal line
  const zeroY = yOf(0);

  // Mouse handler to calculate closest trade or projection step
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const relX = (mouseX / rect.width) * W;
    const clampedRelX = Math.max(PAD_X, Math.min(W - PAD_X, relX));
    const rawIdx = ((clampedRelX - PAD_X) / (W - PAD_X * 2)) * span;
    const closestIdx = Math.round(rawIdx);
    setHoverIndex(Math.max(0, Math.min(histN - 1 + projectionSteps, closestIdx)));
  };

  const isHistoricalHover = hoverIndex !== null && hoverIndex < histN;
  const isProjectionHover = hoverIndex !== null && hoverIndex >= histN;
  const hoverTrade = isHistoricalHover && tradeDetails ? tradeDetails[hoverIndex] : null;
  const hoverVal = isHistoricalHover ? realized[hoverIndex] : null;

  return (
    <div className="relative w-full h-full flex flex-col justify-between select-none overflow-hidden">
      {/* ── TOP INTEGRATED HUD BAR (NEVER CLIPS, ZERO CUTOFF!) ── */}
      <div className="h-5 px-1 flex items-center justify-between font-mono text-[10px] shrink-0 border-b border-white/[0.04]">
        {hoverIndex !== null ? (
          isHistoricalHover ? (
            <div className="flex items-center gap-2 truncate">
              {hoverIndex === 0 ? (
                <span className="text-[#C5A059] font-bold">Punto Zero</span>
              ) : (
                <span className="text-[#C5A059] font-bold">Trade #{hoverIndex}</span>
              )}
              {hoverTrade?.date && <span className="text-text-lo/70">· {hoverTrade.date}</span>}
              {hoverTrade?.title && <span className="text-text-hi font-semibold">{hoverTrade.title}</span>}
              {hoverTrade?.pnl != null && hoverIndex > 0 && (
                <span
                  className={
                    hoverTrade.pnl >= 0 ? "text-success font-bold" : "text-destructive font-bold"
                  }
                >
                  {hoverTrade.pnl >= 0 ? "+" : ""}{hoverTrade.pnl.toFixed(2)} {currency}
                </span>
              )}
              <span className="text-text-lo">| Realizzato:</span>
              <strong className={hoverVal != null && hoverVal >= 0 ? "text-success" : "text-destructive"}>
                {hoverVal != null ? `${hoverVal >= 0 ? "+" : ""}${hoverVal.toFixed(2)} ${currency}` : ""}
              </strong>
              {showIdealCurve && hoverTrade?.idealCumulativeEuro != null && (
                <>
                  <span className="text-text-lo">| Ideale:</span>
                  <strong className="text-[#E8C56A]">
                    +{hoverTrade.idealCumulativeEuro.toFixed(2)} {currency}
                  </strong>
                </>
              )}
              {hoverTrade?.hasLeak && hoverTrade.bleedAmount != null && hoverTrade.bleedAmount > 0 && (
                <span className="px-1.5 py-0.5 text-[9px] rounded bg-red-950/60 border border-red-500/40 text-red-300 font-mono whitespace-nowrap">
                  Leak: {hoverTrade.leakNames?.join(", ") ?? "Deriva"} (-{hoverTrade.bleedAmount.toFixed(2)} {currency})
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 truncate">
              <span className="text-[#C5A059] font-bold">Proiezione Monte Carlo (+{hoverIndex - histN + 1})</span>
              <span className="text-text-lo">Fascia:</span>
              <strong className="text-text-hi">
                {bands.p10[hoverIndex - histN + 1]?.toFixed(0)}€ ↔ {bands.p90[hoverIndex - histN + 1]?.toFixed(0)}€
              </strong>
              <span className="text-text-lo">| Mediana:</span>
              <strong className="text-[#E5C378]">
                {bands.p50[hoverIndex - histN + 1]?.toFixed(0)}€
              </strong>
            </div>
          )
        ) : (
          <div className="flex items-center gap-2 text-text-lo/60 text-[9px]">
            <span>Passa il mouse per ispezionare i trade storici</span>
          </div>
        )}
      </div>

      {/* ── INTERACTIVE SVG CHART ── */}
      <div className="flex-1 min-h-0 relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          className="cursor-crosshair block"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="eqfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT_GREEN} stopOpacity="0.22" />
              <stop offset="100%" stopColor={ACCENT_GREEN} stopOpacity="0" />
            </linearGradient>
            <linearGradient id="bleedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#C5A059" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Zero baseline */}
          <line
            x1={PAD_X}
            y1={zeroY}
            x2={W - PAD_X}
            y2={zeroY}
            stroke="rgba(255,255,255,0.12)"
            strokeDasharray="2 2"
            strokeWidth="1"
          />

          {/* Friction Bleed Area (Gap between Ideal and Realized) */}
          {showIdealCurve && bleedArea && (
            <path d={bleedArea} fill="url(#bleedFill)" />
          )}

          {/* Monte Carlo Percentile Bands in EUR */}
          <path d={bandPath(bands.p10, bands.p90)} fill={PROJ_GOLD} fillOpacity="0.08" />
          <path d={bandPath(bands.p25, bands.p75)} fill={PROJ_GOLD} fillOpacity="0.16" />
          {bands.samplePaths.slice(0, 12).map((p, i) => (
            <path key={i} d={simPath(p)} fill="none" stroke={PROJ_GOLD} strokeOpacity="0.12" strokeWidth="0.8" />
          ))}
          <path
            d={medianLine}
            fill="none"
            stroke={PROJ_GOLD_MEDIAN}
            strokeWidth="1.8"
            strokeDasharray="4 3"
            strokeLinecap="round"
          />

          {/* Transition Divider */}
          <line
            x1={divX}
            y1={PAD_TOP}
            x2={divX}
            y2={H - PAD_BOTTOM}
            stroke="#C5A059"
            strokeOpacity="0.45"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Realized Historical Area and Line */}
          <path d={histArea} fill="url(#eqfill)" />
          <path
            d={histLine}
            fill="none"
            stroke={ACCENT_GREEN}
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Ideal Zero-Leak Trajectory Line */}
          {showIdealCurve && idealLine && (
            <path
              d={idealLine}
              fill="none"
              stroke="#E8C56A"
              strokeWidth="1.8"
              strokeDasharray="4 2"
              strokeLinecap="round"
            />
          )}

          {/* Realized end marker */}
          {histPts.length > 0 && <circle cx={lastPt[0]} cy={lastPt[1]} r="3.5" fill={ACCENT_GREEN} />}
          {showIdealCurve && lastIdealPt && (
            <circle cx={lastIdealPt[0]} cy={lastIdealPt[1]} r="3" fill="#E8C56A" />
          )}
          {bands.p50.length > 0 && (
            <circle cx={px(projectionSteps)} cy={yOf(bands.p50[projectionSteps])} r="3" fill={PROJ_GOLD_MEDIAN} />
          )}

          {/* Hover Crosshair & Point Indicator */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={xOf(hoverIndex)}
                y1={PAD_TOP}
                x2={xOf(hoverIndex)}
                y2={H - PAD_BOTTOM}
                stroke="#D4AF37"
                strokeWidth="1"
                strokeDasharray="2 2"
                strokeOpacity="0.75"
              />
              {isHistoricalHover && hoverVal !== null && (
                <circle
                  cx={xOf(hoverIndex)}
                  cy={yOf(hoverVal)}
                  r="4"
                  fill="#D4AF37"
                  stroke="#0A0A0C"
                  strokeWidth="1.5"
                />
              )}
              {showIdealCurve && isHistoricalHover && effectiveIdeal[hoverIndex] !== undefined && (
                <circle
                  cx={xOf(hoverIndex)}
                  cy={yOf(effectiveIdeal[hoverIndex])}
                  r="3.5"
                  fill="#E8C56A"
                  stroke="#0A0A0C"
                  strokeWidth="1.5"
                />
              )}
              {isProjectionHover && bands.p50[hoverIndex - histN + 1] !== undefined && (
                <circle
                  cx={xOf(hoverIndex)}
                  cy={yOf(bands.p50[hoverIndex - histN + 1])}
                  r="4"
                  fill="#C5A059"
                  stroke="#0A0A0C"
                  strokeWidth="1.5"
                />
              )}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
});
