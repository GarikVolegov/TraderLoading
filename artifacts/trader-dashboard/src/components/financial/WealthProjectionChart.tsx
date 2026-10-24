import React, { useState, useId } from "react";
import type { WealthProjectionPoint } from "../../../../../contracts/financialArchitecture";

interface WealthProjectionChartProps {
  trajectory: WealthProjectionPoint[];
  horizonYears: number;
  targetNetWorth?: number;
  className?: string;
}

/**
 * Costruisce una curva Bezier cubica liscia (Catmull-Rom splines) attraverso una serie di punti 2D.
 */
function getSmoothSvgPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  if (pts.length === 2) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;

  let path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

/**
 * Genera il percorso chiuso per il corridoio Monte Carlo con curve cubiche continue.
 */
function getSmoothCorridorPath(
  topPts: Array<{ x: number; y: number }>,
  botPts: Array<{ x: number; y: number }>,
): string {
  if (topPts.length === 0 || botPts.length === 0) return "";
  const topPath = getSmoothSvgPath(topPts);
  const botReversed = botPts.slice().reverse();
  let botPath = ` L ${botReversed[0].x.toFixed(1)} ${botReversed[0].y.toFixed(1)}`;
  for (let i = 0; i < botReversed.length - 1; i++) {
    const p0 = botReversed[Math.max(0, i - 1)];
    const p1 = botReversed[i];
    const p2 = botReversed[i + 1];
    const p3 = botReversed[Math.min(botReversed.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    botPath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return `${topPath}${botPath} Z`;
}

export const WealthProjectionChart: React.FC<WealthProjectionChartProps> = ({
  trajectory,
  horizonYears,
  targetNetWorth,
  className = "",
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const chartId = useId();

  if (!trajectory || trajectory.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center font-mono text-xs text-muted-foreground">
        Nessuna proiezione disponibile
      </div>
    );
  }

  // Dimensioni SVG ottimizzate per visibilità e proporzione
  const width = 540;
  const height = 150;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 14;
  const padBottom = 22;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  // Calcolo Min e Max con fasce probabilistiche Monte Carlo (p10, p50, p90)
  const p50Values = trajectory.map((p) => p.totalProjectedNetWorth);
  const p10Values = trajectory.map((p) => p.p10NetWorth ?? p.totalProjectedNetWorth);
  const p90Values = trajectory.map((p) => p.p90NetWorth ?? p.totalProjectedNetWorth);
  const investedValues = trajectory.map((p) => p.cumulativeInvested ?? p.baseCapital);

  const maxTrajectory = Math.max(...p90Values, ...p50Values, ...investedValues);
  const minVal = Math.min(...p10Values, ...investedValues) * 0.95;

  const isTargetInScale =
    targetNetWorth !== undefined &&
    targetNetWorth > 0 &&
    targetNetWorth <= maxTrajectory * 1.5;

  const maxVal = (isTargetInScale ? Math.max(maxTrajectory, targetNetWorth) : maxTrajectory) * 1.08;
  const valRange = maxVal - minVal || 1;

  // Coordinate punti e fasce probabilistiche
  const points = trajectory.map((p, idx) => {
    const x = padLeft + (idx / (trajectory.length - 1 || 1)) * chartW;
    const y = padTop + chartH - ((p.totalProjectedNetWorth - minVal) / valRange) * chartH;
    const p10Y = padTop + chartH - (((p.p10NetWorth ?? p.totalProjectedNetWorth) - minVal) / valRange) * chartH;
    const p90Y = padTop + chartH - (((p.p90NetWorth ?? p.totalProjectedNetWorth) - minVal) / valRange) * chartH;
    const invested = p.cumulativeInvested ?? p.baseCapital;
    const investedY = padTop + chartH - ((invested - minVal) / valRange) * chartH;
    return { x, y, p10Y, p90Y, investedY, point: p, invested };
  });

  // Costruzione curve Bezier continue
  const medianPts = points.map((p) => ({ x: p.x, y: p.y }));
  const p90Pts = points.map((p) => ({ x: p.x, y: p.p90Y }));
  const p10Pts = points.map((p) => ({ x: p.x, y: p.p10Y }));
  const investedPts = points.map((p) => ({ x: p.x, y: p.investedY }));

  const linePath = getSmoothSvgPath(medianPts);
  const p90LinePath = getSmoothSvgPath(p90Pts);
  const p10LinePath = getSmoothSvgPath(p10Pts);
  const investedLinePath = getSmoothSvgPath(investedPts);

  const areaPath = `${linePath} L ${points[points.length - 1]!.x.toFixed(1)} ${(padTop + chartH).toFixed(1)} L ${points[0]!.x.toFixed(1)} ${(padTop + chartH).toFixed(1)} Z`;
  const corridorPath = getSmoothCorridorPath(p90Pts, p10Pts);

  // Coordinata Y per linea target (SOLO se in scala, per non creare confusioni su valori fuori asse)
  const targetY =
    isTargetInScale && targetNetWorth
      ? padTop + chartH - ((targetNetWorth - minVal) / valRange) * chartH
      : null;

  const active = hoverIndex !== null ? points[hoverIndex] : points[points.length - 1];

  return (
    <div className={`relative flex flex-col justify-between ${className}`}>
      {/* Header telemetria interattiva */}
      <div className="flex items-center justify-between pb-1.5 border-b border-border/50 text-[10.5px] font-mono">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[#C5A059] font-bold uppercase whitespace-nowrap">
            {active ? active.point.stepLabel : `${horizonYears}A`}
          </span>
          {active && active.point.year > 0 && (
            <span className="text-emerald-400 font-bold whitespace-nowrap text-[10px]">
              +
              {(
                ((active.point.totalProjectedNetWorth - active.invested) /
                  (active.invested || 1)) *
                100
              ).toFixed(1)}
              % su versato
            </span>
          )}
        </div>

        {active && (
          <div className="flex items-center gap-2.5 shrink-0 text-[10px]">
            {active.point.taxDragEuro !== undefined && active.point.taxDragEuro > 0 && (
              <span className="text-red-400 font-semibold whitespace-nowrap hidden sm:inline" title="Impatto fiscale cumulato a questo step">
                Drag: -{active.point.taxDragEuro.toLocaleString("it-IT")} €
              </span>
            )}
            <span className="text-muted-foreground whitespace-nowrap">
              Rendita:{" "}
              <strong className="text-[#E8C56A] font-bold">
                +{(active.point.totalMonthlyPassiveCashflow ?? active.point.monthlyDividendCashflow).toLocaleString("it-IT")} €/m
              </strong>
            </span>
            <span className="text-foreground font-bold whitespace-nowrap">
              {active.point.totalProjectedNetWorth.toLocaleString("it-IT")} €
            </span>
          </div>
        )}
      </div>

      {/* SVG Canvas Unificato Proiezione + Monte Carlo */}
      <div className="relative w-full pt-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            {/* Gradiente Aureo per l'area mediana */}
            <linearGradient id={`${chartId}-gold-grad`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C5A059" stopOpacity="0.45" />
              <stop offset="70%" stopColor="#C5A059" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#C5A059" stopOpacity="0" />
            </linearGradient>

            {/* Gradiente Monte Carlo per il corridoio di confidenza */}
            <linearGradient id={`${chartId}-mc-corridor`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E8C56A" stopOpacity="0.16" />
              <stop offset="50%" stopColor="#C5A059" stopOpacity="0.09" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
            </linearGradient>

            {/* Filtro Bagliore Dorato LIMEN */}
            <filter id={`${chartId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Linee di griglia orizzontali */}
          {[0, 0.5, 1].map((pct, idx) => {
            const y = padTop + chartH * (1 - pct);
            const val = minVal + valRange * pct;
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="rgba(197, 160, 89, 0.12)"
                  strokeDasharray="3 3"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="font-mono text-[9.5px] fill-slate-400 font-medium"
                >
                  {Math.round(val / 1000)}k€
                </text>
              </g>
            );
          })}

          {/* Linea Obiettivo Target Indipendenza (Dotted Gold, tracciata solo se entro scala) */}
          {targetY !== null && (
            <g>
              <line
                x1={padLeft}
                y1={targetY}
                x2={width - padRight}
                y2={targetY}
                stroke="#E8C56A"
                strokeWidth="1.2"
                strokeDasharray="5 3"
                opacity="0.8"
              />
              <text
                x={width - padRight}
                y={targetY - 4}
                textAnchor="end"
                className="font-mono text-[9.5px] fill-[#E8C56A] font-bold"
              >
                🎯 Target {Math.round(targetNetWorth! / 1000)}k€
              </text>
            </g>
          )}

          {/* Linea verticale crosshair al punto hover */}
          {hoverIndex !== null && active && (
            <g>
              <line
                x1={active.x}
                y1={padTop}
                x2={active.x}
                y2={padTop + chartH}
                stroke="#C5A059"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.6"
              />
            </g>
          )}

          {/* 1. Corridoio di Confidenza Monte Carlo (Banda p10 - p90 continua) */}
          <path d={corridorPath} fill={`url(#${chartId}-mc-corridor)`} />

          {/* Limiti tratteggiati Monte Carlo p90 (Bull) e p10 (Bear) lisci */}
          <path
            d={p90LinePath}
            fill="none"
            stroke="#10b981"
            strokeWidth="0.9"
            strokeDasharray="2 3"
            opacity="0.6"
          />
          <path
            d={p10LinePath}
            fill="none"
            stroke="#ef4444"
            strokeWidth="0.9"
            strokeDasharray="2 3"
            opacity="0.6"
          />

          {/* 2. Area Gradiente Aureo Mediana */}
          <path d={areaPath} fill={`url(#${chartId}-gold-grad)`} />

          {/* 3. Linea Base Capitale Versato + PAC (Tratteggiata Grigia) */}
          <path
            d={investedLinePath}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.2"
            strokeDasharray="4 4"
            opacity="0.75"
          />

          {/* 4. Curva Mediana Crescita Composta Oro (Spline Bezier Continua) */}
          <path
            d={linePath}
            fill="none"
            stroke="#C5A059"
            strokeWidth="2.5"
            filter={`url(#${chartId}-glow)`}
          />

          {/* 5. Punti Interattivi su Step */}
          {points.map((p, idx) => {
            const isHovered = hoverIndex === idx;
            return (
              <g
                key={idx}
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(idx)}
              >
                <circle cx={p.x} cy={p.y} r="12" fill="transparent" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? "5" : "3"}
                  fill={isHovered ? "#F3D88C" : "#0d0f14"}
                  stroke="#C5A059"
                  strokeWidth={isHovered ? "2.5" : "1.5"}
                />
              </g>
            );
          })}

          {/* 6. Etichette Adattive dell'Asse X (Mesi per 1A, Semestri per 3A, Anni per 5-20A) */}
          {points.map((p, idx) => {
            // Regola di diradamento intelligente per evitare sovrapposizioni
            let showLabel = false;
            if (trajectory.length <= 8) {
              showLabel = true;
            } else if (trajectory.length <= 14) {
              showLabel = idx === 0 || idx % 2 === 0 || idx === points.length - 1;
            } else {
              showLabel = idx === 0 || idx % 3 === 0 || idx === points.length - 1;
            }

            if (!showLabel) return null;

            return (
              <text
                key={idx}
                x={p.x}
                y={padTop + chartH + 15}
                textAnchor="middle"
                className="font-mono text-[9.5px] fill-slate-400 font-medium"
              >
                {p.point.stepLabel}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Legenda Compatta Monte Carlo & Indicatori Chiave */}
      <div className="flex items-center justify-between pt-1 px-1 font-mono text-[9.5px] text-slate-300 border-t border-border/40 mt-0.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#C5A059]" />
            <span className="text-slate-300">Mediana P50</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-3 rounded-sm bg-[#E8C56A]/25 border border-[#E8C56A]/40" />
            <span className="text-slate-300">Monte Carlo (10°-90°)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-0.5 w-3 border-b border-dashed border-[#94a3b8]" />
            <span className="text-slate-300">Capitale + PAC</span>
          </div>
        </div>

        {active && (
          <div className="text-right text-[9.5px] text-[#E8C56A] font-semibold">
            Bear: {active.point.p10NetWorth.toLocaleString("it-IT")} € | Bull: {active.point.p90NetWorth.toLocaleString("it-IT")} €
          </div>
        )}
      </div>
    </div>
  );
};
