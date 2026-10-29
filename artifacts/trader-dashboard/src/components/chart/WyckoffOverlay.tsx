import { useEffect, useMemo, useState } from "react";
import type { ChartProjector } from "../backtest-terminal/PositionOverlay";
import {
  analyzeWyckoffStructure,
  type WyckoffCandle,
  type WyckoffEvent,
} from "@/lib/chart/wyckoffEngine";
import { formatPrice } from "@/lib/pipMultiplier";
import {
  loadIndicatorPreferences,
  INDICATOR_PREFERENCES_EVENT,
  type WyckoffIndicatorPreferences,
} from "@/lib/chart/chartIndicatorPreferences";

export interface WyckoffOverlayProps {
  candles: WyckoffCandle[];
  projector: ChartProjector;
  symbol: string;
  revision: number;
}

export function WyckoffOverlay({
  candles,
  projector,
  symbol,
  revision,
}: WyckoffOverlayProps) {
  void revision;

  const [prefs, setPrefs] = useState<WyckoffIndicatorPreferences>(
    () => loadIndicatorPreferences().wyckoff,
  );
  const [hoveredEvtId, setHoveredEvtId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setPrefs(loadIndicatorPreferences().wyckoff);
    window.addEventListener(INDICATOR_PREFERENCES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(INDICATOR_PREFERENCES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const analysis = useMemo(() => analyzeWyckoffStructure(candles), [candles]);

  if (!candles.length || projector.width <= 0 || projector.height <= 0 || !analysis.tradingRange) {
    return null;
  }

  const { tradingRange, events } = analysis;
  const rightEdge = Math.max(80, projector.width - 56);

  // Calcolo coordinate Trading Range
  const yCreek = projector.yForPrice(tradingRange.creekPrice);
  const yIce = projector.yForPrice(tradingRange.icePrice);

  const rawStartX = projector.xForTime(tradingRange.startTime);
  const startX =
    rawStartX != null
      ? Math.max(12, Math.min(rightEdge - 140, rawStartX))
      : Math.max(12, rightEdge - 280);

  const hasValidBox =
    yCreek != null &&
    yIce != null &&
    yCreek >= 8 &&
    yIce <= projector.height - 10 &&
    yIce > yCreek;

  const creekLabel = `CREEK · ${formatPrice(tradingRange.creekPrice, symbol)}`;
  const iceLabel = `ICE · ${formatPrice(tradingRange.icePrice, symbol)}`;

  const creekPillWidth = Math.max(76, creekLabel.length * 5.2 + 10);
  const icePillWidth = Math.max(68, iceLabel.length * 5.2 + 10);

  const visibleEvents = useMemo(() => {
    if (!prefs.showEvents) return [];
    if (prefs.onlyKeyEvents) {
      return events.filter(
        (e) => e.type === "SPRING" || e.type === "UTAD" || e.type === "SOW_10" || e.type === "SOS",
      );
    }
    return events;
  }, [events, prefs.showEvents, prefs.onlyKeyEvents]);

  return (
    <svg
      className="limen-wyckoff-overlay pointer-events-none absolute inset-0 z-10"
      width={projector.width}
      height={projector.height}
      data-testid="wyckoff-overlay"
    >
      {/* ── 1. BOX TRADING RANGE (CREEK & ICE) ── */}
      {prefs.showTradingRange && hasValidBox && (
        <g className="limen-wyckoff-trading-range">
          {/* Sfondo Riquadro Trading Range */}
          <rect
            x={startX}
            y={yCreek}
            width={Math.max(20, rightEdge - startX)}
            height={Math.max(10, yIce - yCreek)}
            fill="#C5A059"
            fillOpacity={0.03}
            stroke="#C5A059"
            strokeOpacity={0.16}
            strokeDasharray="4 4"
            rx={2}
          />

          {/* Linea Creek (Resistenza TR) */}
          <line
            x1={startX}
            y1={yCreek}
            x2={rightEdge}
            y2={yCreek}
            stroke="#E8C56A"
            strokeWidth={1.1}
            strokeDasharray="4 3"
            opacity={0.8}
          />
          <g transform={`translate(${Math.max(12, rightEdge - creekPillWidth - 2)}, ${yCreek - 7})`}>
            <rect
              width={creekPillWidth}
              height={13}
              rx={2}
              fill="#07080b"
              fillOpacity={0.92}
              stroke="#E8C56A"
              strokeWidth={0.8}
            />
            <text
              x={creekPillWidth / 2}
              y={6.8}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={7.2}
              fontWeight={800}
              fill="#E8C56A"
              fontFamily="var(--btm-mono)"
            >
              {creekLabel}
            </text>
          </g>

          {/* Linea Ice (Supporto TR) */}
          <line
            x1={startX}
            y1={yIce}
            x2={rightEdge}
            y2={yIce}
            stroke="#94a3b8"
            strokeWidth={1.1}
            strokeDasharray="4 3"
            opacity={0.8}
          />
          <g transform={`translate(${Math.max(12, rightEdge - icePillWidth - 2)}, ${yIce - 7})`}>
            <rect
              width={icePillWidth}
              height={13}
              rx={2}
              fill="#07080b"
              fillOpacity={0.92}
              stroke="#94a3b8"
              strokeWidth={0.8}
            />
            <text
              x={icePillWidth / 2}
              y={6.8}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={7.2}
              fontWeight={800}
              fill="#94a3b8"
              fontFamily="var(--btm-mono)"
            >
              {iceLabel}
            </text>
          </g>
        </g>
      )}

      {/* ── 2. EVENTI WYCKOFF CHIRURGICI SULLE CANDELE ── */}
      {visibleEvents.map((evt) => {
        const xCoord = projector.xForTime(evt.time);
        const yCoord = projector.yForPrice(evt.price);
        if (xCoord == null || yCoord == null || xCoord < 20 || xCoord > rightEdge - 20) return null;

        const isBullish = evt.side === "bullish";
        const isSpring = evt.type === "SPRING";
        const isUtad = evt.type === "UTAD";
        const isSow = evt.type === "SOW_10";
        const isSos = evt.type === "SOS";

        const color = isSpring
          ? "#10b981"
          : isUtad
          ? "#ef4444"
          : isSos
          ? "#34d399"
          : isSow
          ? "#f87171"
          : isBullish
          ? "#E8C56A"
          : "#cbd5e1";

        const badgeY = isBullish
          ? Math.min(projector.height - 20, yCoord + 5)
          : Math.max(6, yCoord - 18);

        const pillWidth = Math.max(34, evt.label.length * 5.6 + 8);

        const isHovered = hoveredEvtId === evt.id;

        return (
          <g
            key={evt.id}
            className="limen-wyckoff-event-marker"
            style={{ pointerEvents: "auto", cursor: "pointer" }}
            onMouseEnter={() => setHoveredEvtId(evt.id)}
            onMouseLeave={() => setHoveredEvtId(null)}
          >
            {/* Punto discreto di contatto sulla wick */}
            <circle
              cx={xCoord}
              cy={yCoord}
              r={isHovered ? 3.2 : 2.2}
              fill={color}
              stroke="#07080b"
              strokeWidth={0.8}
            />

            {/* Micro Badge Evento Wyckoff Chirurgico */}
            <g transform={`translate(${xCoord - pillWidth / 2}, ${badgeY})`}>
              <rect
                width={pillWidth}
                height={13}
                rx={2.5}
                fill="#07080b"
                fillOpacity={isHovered ? 0.98 : 0.92}
                stroke={color}
                strokeWidth={isHovered ? 1.3 : isSpring || isUtad || isSow || isSos ? 1 : 0.7}
              />
              <text
                x={pillWidth / 2}
                y={6.8}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={7.2}
                fontWeight={800}
                fill={color}
                fontFamily="var(--btm-mono)"
              >
                {evt.label}
              </text>
            </g>

            {/* Micro Tooltip Descrittivo al passaggio del mouse */}
            {isHovered && evt.description && (
              <g
                transform={`translate(${Math.max(12, Math.min(projector.width - 240, xCoord - 110))}, ${
                  isBullish ? Math.min(projector.height - 38, badgeY + 16) : Math.max(8, badgeY - 20)
                })`}
              >
                <rect
                  width={220}
                  height={16}
                  rx={3}
                  fill="#07080b"
                  fillOpacity={0.96}
                  stroke={color}
                  strokeWidth={0.8}
                />
                <text
                  x={110}
                  y={8.5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={7}
                  fontWeight={700}
                  fill="#e2e8f0"
                  fontFamily="var(--btm-mono)"
                >
                  {evt.description.length > 52 ? `${evt.description.slice(0, 50)}...` : evt.description}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* ── 3. BADGE STATO WYCKOFF (SOLO SE ESPLICITAMENTE ABILITATO) ── */}
      {prefs.showRegimeCornerBadge && (
        <g transform={`translate(${Math.max(12, rightEdge - 140)}, 10)`}>
          <rect
            width={136}
            height={16}
            rx={2}
            fill="#07080b"
            fillOpacity={0.92}
            stroke="#C5A059"
            strokeOpacity={0.3}
            strokeWidth={0.8}
          />
          <text
            x={68}
            y={8}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={7.5}
            fontWeight={800}
            fill="#E8C56A"
            fontFamily="var(--btm-mono)"
          >
            WYCKOFF: {tradingRange.structureType}
          </text>
        </g>
      )}
    </svg>
  );
}
