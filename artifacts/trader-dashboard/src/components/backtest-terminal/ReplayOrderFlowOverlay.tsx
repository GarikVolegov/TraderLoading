// ─── AUREUS PROTOCOL — Replay Order Flow Overlay ─────────────────────────────
// Motore visivo Order Flow direttamente sul grafico del Replay:
// Mostra Fixed Range / Session Volume Profile, POC, VAH, VAL e Delta Volume
// delle candele visibili con visualizzazione istituzionale.

import React, { useMemo } from "react";
import type { ChartProjector } from "./PositionOverlay";
import type { ReplayEngine } from "./useReplayEngine";
import { computeFixedRangeVolumeProfile } from "@/lib/replay/drawingWorkspace";
import { formatPrice } from "./format";

export interface ReplayOrderFlowOverlayProps {
  engine: ReplayEngine;
  projector: ChartProjector;
  revision: number;
  visible?: boolean;
}

export function ReplayOrderFlowOverlay({
  engine,
  projector,
  revision,
  visible = true,
}: ReplayOrderFlowOverlayProps) {
  if (!visible || !projector) return null;

  const { width, height } = projector;
  if (width <= 0 || height <= 0) return null;

  // Calcola il range di candele visibili
  const candles = engine.candles;
  const cursor = engine.cursor;
  if (candles.length === 0 || cursor < 0) return null;

  // Analizziamo le ultime N candele fino al cursore corrente (default 100 candele o sessione)
  const windowSize = Math.min(120, cursor + 1);
  const startIdx = Math.max(0, cursor - windowSize + 1);
  const visibleCandles = candles.slice(startIdx, cursor + 1);
  if (visibleCandles.length < 2) return null;

  const t1 = visibleCandles[0].time;
  const t2 = visibleCandles[visibleCandles.length - 1].time;

  // Calcolo Volume Profile istituzionale
  const frvp = useMemo(() => {
    return computeFixedRangeVolumeProfile(candles, t1, t2, 28, 0.7);
  }, [candles, t1, t2, revision]);

  if (!frvp || frvp.buckets.length === 0) return null;

  // Coordinate POC, VAH, VAL
  const pocY = projector.yForPrice(frvp.pocPrice);
  const vahY = projector.yForPrice(frvp.vahPrice);
  const valY = projector.yForPrice(frvp.valPrice);

  // Calcolo Delta Totale e Buy/Sell
  let totalBuyVol = 0;
  let totalSellVol = 0;
  visibleCandles.forEach((c) => {
    const vol = c.volume ?? Math.max(1, (c.high - c.low) * 1000);
    if (c.close >= c.open) totalBuyVol += vol;
    else totalSellVol += vol;
  });
  const netDelta = totalBuyVol - totalSellVol;
  const totalVol = totalBuyVol + totalSellVol;
  const buyRatioPct = totalVol > 0 ? Math.round((totalBuyVol / totalVol) * 100) : 50;

  // Profilo Volumetrico posizionato sul bordo destro del grafico
  const maxBucketVol = Math.max(...frvp.buckets.map((b) => b.totalVolume), 1);
  const profileWidth = Math.min(140, width * 0.22);
  const profileRight = width - 65; // spazio per l'asse dei prezzi

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-15 overflow-visible"
      width={width}
      height={height}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="aureus-poc-glow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#C5A059" stopOpacity="0.1" />
          <stop offset="70%" stopColor="#C5A059" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#E8C56A" stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* ── Linee di Livello Istituzionale (POC, VAH, VAL) ── */}
      {/* VAH Line */}
      {vahY != null && (
        <g opacity={0.75}>
          <line
            x1={0}
            y1={vahY}
            x2={width - 55}
            y2={vahY}
            stroke="#93c5fd"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <rect
            x={width - 110}
            y={vahY - 8}
            width={52}
            height={16}
            rx={3}
            fill="#0d0f14"
            stroke="#93c5fd"
            strokeWidth={0.8}
          />
          <text
            x={width - 84}
            y={vahY + 3.5}
            fill="#93c5fd"
            fontSize={9}
            fontFamily="monospace"
            fontWeight="bold"
            textAnchor="middle"
          >
            VAH {formatPrice(frvp.vahPrice, engine.symbol)}
          </text>
        </g>
      )}

      {/* VAL Line */}
      {valY != null && (
        <g opacity={0.75}>
          <line
            x1={0}
            y1={valY}
            x2={width - 55}
            y2={valY}
            stroke="#93c5fd"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <rect
            x={width - 110}
            y={valY - 8}
            width={52}
            height={16}
            rx={3}
            fill="#0d0f14"
            stroke="#93c5fd"
            strokeWidth={0.8}
          />
          <text
            x={width - 84}
            y={valY + 3.5}
            fill="#93c5fd"
            fontSize={9}
            fontFamily="monospace"
            fontWeight="bold"
            textAnchor="middle"
          >
            VAL {formatPrice(frvp.valPrice, engine.symbol)}
          </text>
        </g>
      )}

      {/* POC (Point of Control) — Linea Aurea Imperiale */}
      {pocY != null && (
        <g>
          <line
            x1={0}
            y1={pocY}
            x2={width - 55}
            y2={pocY}
            stroke="url(#aureus-poc-glow)"
            strokeWidth={1.5}
          />
          <rect
            x={width - 120}
            y={pocY - 9}
            width={62}
            height={18}
            rx={4}
            fill="#11131c"
            stroke="#C5A059"
            strokeWidth={1.2}
          />
          <text
            x={width - 89}
            y={pocY + 4}
            fill="#E8C56A"
            fontSize={9.5}
            fontFamily="monospace"
            fontWeight="bold"
            textAnchor="middle"
          >
            POC {formatPrice(frvp.pocPrice, engine.symbol)}
          </text>
        </g>
      )}

      {/* ── Istogramma Volume Profile Laterale (Order Flow Depth) ── */}
      <g opacity={0.85}>
        {frvp.buckets.map((b, i) => {
          const topY = projector.yForPrice(b.priceHigh);
          const bottomY = projector.yForPrice(b.priceLow);
          if (topY == null || bottomY == null) return null;

          const barY = Math.min(topY, bottomY);
          const barHeight = Math.max(1.5, Math.abs(bottomY - topY) - 0.5);

          const upWidth = (b.upVolume / maxBucketVol) * profileWidth;
          const downWidth = (b.downVolume / maxBucketVol) * profileWidth;

          const isPocBucket = b.isPoc;
          const inValueArea = b.inValueArea;

          return (
            <g key={i}>
              {/* Barra Volume Vendite (Crimson) */}
              <rect
                x={profileRight - downWidth}
                y={barY}
                width={downWidth}
                height={barHeight}
                fill={
                  isPocBucket
                    ? "rgba(239, 68, 68, 0.85)"
                    : inValueArea
                    ? "rgba(239, 68, 68, 0.45)"
                    : "rgba(239, 68, 68, 0.2)"
                }
              />
              {/* Barra Volume Acquisti (Emerald) */}
              <rect
                x={profileRight - downWidth - upWidth}
                y={barY}
                width={upWidth}
                height={barHeight}
                fill={
                  isPocBucket
                    ? "rgba(16, 185, 129, 0.85)"
                    : inValueArea
                    ? "rgba(16, 185, 129, 0.45)"
                    : "rgba(16, 185, 129, 0.2)"
                }
              />
            </g>
          );
        })}
      </g>

      {/* ── Badge Telemetria Order Flow in Sovraimpressione ── */}
      <foreignObject x={width - 240} y={12} width={180} height={52}>
        <div className="flex flex-col gap-1 p-2 rounded-lg bg-[#0d0f14]/90 border border-[#C5A059]/40 backdrop-blur-md shadow-lg font-mono text-[10px] text-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[#C5A059] font-bold uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Order Flow
            </span>
            <span
              className={`font-bold whitespace-nowrap ${
                netDelta >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              Delta {netDelta >= 0 ? "+" : ""}
              {Math.round(netDelta).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[9px] text-slate-400">
            <span>Buy {buyRatioPct}%</span>
            <div className="flex-1 h-1 rounded-full bg-rose-950 overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${buyRatioPct}%` }}
              />
            </div>
            <span>Sell {100 - buyRatioPct}%</span>
          </div>
        </div>
      </foreignObject>
    </svg>
  );
}
