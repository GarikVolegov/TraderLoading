import React, { useState, useMemo } from "react";
import type { RoomParticipant } from "../../../../api-server/src/services/backtestTournaments/battleRoomTypes";

export interface LiveComparativeEquityChartProps {
  participants: RoomParticipant[];
  equityHistory: Array<{ timestamp: number; [key: string]: number }>;
  className?: string;
}

const PARTICIPANT_PALETTE = [
  { stroke: "#C5A059", glow: "rgba(197, 160, 89, 0.4)", name: "Oro Aureo" },
  { stroke: "#38BDF8", glow: "rgba(56, 189, 248, 0.4)", name: "Platino Celeste" },
  { stroke: "#10B981", glow: "rgba(16, 185, 129, 0.4)", name: "Smeraldo" },
  { stroke: "#F59E0B", glow: "rgba(245, 158, 11, 0.4)", name: "Ambra" },
];

export function LiveComparativeEquityChart({
  participants,
  equityHistory,
  className = "",
}: LiveComparativeEquityChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const chartData = useMemo(() => {
    if (equityHistory.length >= 2) return equityHistory;

    // Se la cronologia è appena avviata, genera 2 punti iniziali per tracciare la linea di partenza a zero
    const now = Date.now();
    const basePoint: { timestamp: number; [key: string]: number } = { timestamp: now - 30_000 };
    const currentPoint: { timestamp: number; [key: string]: number } = { timestamp: now };

    for (const p of participants) {
      const key = p.displayName || p.userId;
      basePoint[key] = 0;
      currentPoint[key] = p.currentProfitPct;
    }
    return [basePoint, currentPoint];
  }, [equityHistory, participants]);

  const { minVal, maxVal } = useMemo(() => {
    let min = -10.5;
    let max = 6.0;

    for (const pt of chartData) {
      for (const p of participants) {
        const key = p.displayName || p.userId;
        const val = pt[key];
        if (typeof val === "number") {
          if (val < min) min = val;
          if (val > max) max = val;
        }
      }
    }
    return {
      minVal: Math.min(-10.5, min - 1.0),
      maxVal: Math.max(6.0, max + 1.5),
    };
  }, [chartData, participants]);

  // Dimensioni virtuali coordinate SVG
  const width = 640;
  const height = 260;
  const padLeft = 48;
  const padRight = 20;
  const padTop = 24;
  const padBottom = 28;

  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const getY = (val: number) => {
    const norm = (val - minVal) / (maxVal - minVal);
    return padTop + innerH * (1 - norm);
  };

  const getX = (idx: number) => {
    if (chartData.length <= 1) return padLeft;
    return padLeft + (idx / (chartData.length - 1)) * innerW;
  };

  const zeroY = getY(0);
  const ddLimitY = getY(-10);

  // Genera percorsi SVG per ciascun contendente
  const paths = useMemo(() => {
    return participants.map((p, pIdx) => {
      const key = p.displayName || p.userId;
      const palette = PARTICIPANT_PALETTE[pIdx % PARTICIPANT_PALETTE.length];
      const pts = chartData.map((pt, idx) => ({
        x: getX(idx),
        y: getY(typeof pt[key] === "number" ? pt[key] : p.currentProfitPct),
      }));

      if (pts.length === 0) return { key, d: "", lastPt: null, color: palette.stroke };

      const d = pts.reduce((acc, pt, i) => {
        return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
      }, "");

      return {
        key,
        displayName: p.displayName,
        d,
        lastPt: pts[pts.length - 1],
        color: palette.stroke,
        glow: palette.glow,
      };
    });
  }, [chartData, participants, minVal, maxVal]);

  const hoveredPoint = hoverIndex != null && chartData[hoverIndex] ? chartData[hoverIndex] : null;

  return (
    <div
      className={`relative rounded-xl border border-[#C5A059]/25 bg-[#07080b] p-3 flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.6)] ${className}`}
    >
      {/* Intestazione Grafico & Legenda Sfidanti */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#C5A059] animate-pulse" />
          <span className="font-mono text-[11px] font-bold text-white uppercase tracking-wider">
            Curve di Capitale Comparative (Live)
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {participants.map((p, pIdx) => {
            const palette = PARTICIPANT_PALETTE[pIdx % PARTICIPANT_PALETTE.length];
            return (
              <div key={p.userId} className="flex items-center gap-1.5 font-mono text-[10px]">
                <span
                  className="w-2.5 h-1 rounded"
                  style={{ backgroundColor: palette.stroke }}
                />
                <span className="text-white/80 font-bold truncate max-w-[110px]">
                  {p.displayName}
                </span>
                <span
                  className={`font-bold whitespace-nowrap ${
                    p.currentProfitPct >= 0 ? "text-[#10b981]" : "text-[#ef4444]"
                  }`}
                >
                  {p.currentProfitPct >= 0 ? "+" : ""}
                  {p.currentProfitPct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Canvas SVG Reattivo */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * width;
            if (relX < padLeft || relX > width - padRight) {
              setHoverIndex(null);
              return;
            }
            const progress = (relX - padLeft) / innerW;
            const closestIdx = Math.round(progress * (chartData.length - 1));
            setHoverIndex(Math.max(0, Math.min(chartData.length - 1, closestIdx)));
          }}
        >
          <defs>
            <linearGradient id="eqGridGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(197, 160, 89, 0.05)" />
              <stop offset="100%" stopColor="rgba(197, 160, 89, 0.01)" />
            </linearGradient>
          </defs>

          {/* Sfondo griglia */}
          <rect
            x={padLeft}
            y={padTop}
            width={innerW}
            height={innerH}
            fill="url(#eqGridGrad)"
            stroke="rgba(255, 255, 255, 0.04)"
            strokeWidth="1"
          />

          {/* Linea Soglia Squalifica -10% Drawdown */}
          {ddLimitY >= padTop && ddLimitY <= padTop + innerH && (
            <g>
              <line
                x1={padLeft}
                y1={ddLimitY}
                x2={width - padRight}
                y2={ddLimitY}
                stroke="#EF4444"
                strokeWidth="1.2"
                strokeDasharray="4 3"
                opacity="0.85"
              />
              <text
                x={padLeft - 6}
                y={ddLimitY + 3}
                fill="#EF4444"
                fontSize="8.5"
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="end"
              >
                -10%
              </text>
              <text
                x={width - padRight - 4}
                y={ddLimitY - 4}
                fill="#EF4444"
                fontSize="7.5"
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="end"
                opacity="0.9"
              >
                SQUALIFICA DRAWDOWN
              </text>
            </g>
          )}

          {/* Linea di Pareggio 0% */}
          {zeroY >= padTop && zeroY <= padTop + innerH && (
            <g>
              <line
                x1={padLeft}
                y1={zeroY}
                x2={width - padRight}
                y2={zeroY}
                stroke="rgba(148, 163, 184, 0.25)"
                strokeWidth="1"
              />
              <text
                x={padLeft - 6}
                y={zeroY + 3}
                fill="rgba(148, 163, 184, 0.7)"
                fontSize="8.5"
                fontFamily="monospace"
                textAnchor="end"
              >
                0%
              </text>
            </g>
          )}

          {/* Tacca Valore Massimo */}
          <text
            x={padLeft - 6}
            y={padTop + 8}
            fill="rgba(148, 163, 184, 0.7)"
            fontSize="8.5"
            fontFamily="monospace"
            textAnchor="end"
          >
            +{maxVal.toFixed(0)}%
          </text>

          {/* Tracciati Equity Curve dei Duellanti */}
          {paths.map((p) => {
            if (!p.d) return null;
            return (
              <g key={p.key}>
                {/* Alone luminoso */}
                <path
                  d={p.d}
                  fill="none"
                  stroke={p.color}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.25"
                />
                {/* Linea solida primaria */}
                <path
                  d={p.d}
                  fill="none"
                  stroke={p.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Punto finale attivo */}
                {p.lastPt && (
                  <circle
                    cx={p.lastPt.x}
                    cy={p.lastPt.y}
                    r="4"
                    fill={p.color}
                    stroke="#07080b"
                    strokeWidth="1.5"
                  />
                )}
              </g>
            );
          })}

          {/* Cursore verticale interattivo */}
          {hoverIndex != null && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={padTop}
                x2={getX(hoverIndex)}
                y2={padTop + innerH}
                stroke="#C5A059"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.8"
              />
              {participants.map((p, pIdx) => {
                const key = p.displayName || p.userId;
                const palette = PARTICIPANT_PALETTE[pIdx % PARTICIPANT_PALETTE.length];
                const pt = chartData[hoverIndex];
                const val = pt ? pt[key] : p.currentProfitPct;
                const y = getY(typeof val === "number" ? val : 0);
                return (
                  <circle
                    key={key}
                    cx={getX(hoverIndex)}
                    cy={y}
                    r="4"
                    fill={palette.stroke}
                    stroke="#07080b"
                    strokeWidth="1.5"
                  />
                );
              })}
            </g>
          )}
        </svg>

        {/* Tooltip Galleggiante Interattivo */}
        {hoveredPoint && hoverIndex != null && (
          <div
            className="absolute top-2 pointer-events-none rounded border border-[#C5A059]/40 bg-[#0d0f14]/95 px-2.5 py-1.5 text-[10px] font-mono shadow-xl backdrop-blur-md"
            style={{
              left: `${Math.min(75, Math.max(15, (getX(hoverIndex) / width) * 100))}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="text-muted-foreground text-[8.5px] border-b border-white/10 pb-0.5 mb-1 whitespace-nowrap">
              {new Date(hoveredPoint.timestamp).toLocaleTimeString()}
            </div>
            {participants.map((p) => {
              const key = p.displayName || p.userId;
              const val = hoveredPoint[key];
              const numVal = typeof val === "number" ? val : p.currentProfitPct;
              return (
                <div key={key} className="flex items-center justify-between gap-3 whitespace-nowrap">
                  <span className="text-white/80 truncate max-w-[100px]">{p.displayName}:</span>
                  <span
                    className={`font-bold ${
                      numVal >= 0 ? "text-[#10b981]" : "text-[#ef4444]"
                    }`}
                  >
                    {numVal >= 0 ? "+" : ""}
                    {numVal.toFixed(2)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground pt-1.5 mt-1 border-t border-white/5">
        <span className="whitespace-nowrap">Inizio Sessione</span>
        <span className="text-[#E8C56A] font-bold whitespace-nowrap">Sincronizzazione Real-Time</span>
        <span className="whitespace-nowrap">Ora Attuale</span>
      </div>
    </div>
  );
}
