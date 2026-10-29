import { useEffect, useMemo, useState } from "react";
import type { ChartProjector } from "../backtest-terminal/PositionOverlay";
import {
  analyzeInstitutionalLiquidity,
  type LiquidityCandle,
  type LiquidityPoolLevel,
} from "@/lib/chart/liquidityEngine";
import { formatPrice, getPipMultiplier } from "@/lib/pipMultiplier";
import {
  loadIndicatorPreferences,
  INDICATOR_PREFERENCES_EVENT,
  type LiquidityIndicatorPreferences,
} from "@/lib/chart/chartIndicatorPreferences";

export interface LiquidityLevelsOverlayProps {
  candles: LiquidityCandle[];
  projector: ChartProjector;
  symbol: string;
  revision: number;
}

function getLevelColor(level: LiquidityPoolLevel): string {
  if (level.side === "BSL") return "#10b981"; // Smeraldo per Buy Side Liquidity (Sopra i massimi)
  if (level.side === "SSL") return "#ef4444"; // Rubino per Sell Side Liquidity (Sotto i minimi)
  return "#C5A059";
}

export function LiquidityLevelsOverlay({
  candles,
  projector,
  symbol,
  revision,
}: LiquidityLevelsOverlayProps) {
  void revision;

  const [prefs, setPrefs] = useState<LiquidityIndicatorPreferences>(
    () => loadIndicatorPreferences().liquidity,
  );
  const [hoveredLvlId, setHoveredLvlId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setPrefs(loadIndicatorPreferences().liquidity);
    window.addEventListener(INDICATOR_PREFERENCES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(INDICATOR_PREFERENCES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const analysis = useMemo(() => analyzeInstitutionalLiquidity(candles), [candles]);

  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;

  // Filtraggio intelligente e compatto dei livelli per massima pulizia del grafico
  const activeLevels = useMemo(() => {
    if (!analysis.levels.length) return [];

    let pool = analysis.levels.filter((lvl) => lvl.side === "BSL" || lvl.side === "SSL");

    if (prefs.onlyUnswept) {
      pool = pool.filter((lvl) => !lvl.swept);
    }

    if (prefs.onlyMajor) {
      pool = pool.filter((lvl) => lvl.tier === "MAJOR");
    }

    // Seleziona i livelli più rilevanti e vicini al prezzo corrente (fino al limite maxLevels)
    const sortedByProximity = [...pool].sort(
      (a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice),
    );

    const capped = sortedByProximity.slice(0, Math.max(2, prefs.maxLevels));

    // Riordina per prezzo discendente per il rendering corretto
    return capped.sort((a, b) => b.price - a.price);
  }, [analysis.levels, prefs.onlyUnswept, prefs.onlyMajor, prefs.maxLevels, currentPrice]);

  if (!candles.length || projector.width <= 0 || projector.height <= 0 || activeLevels.length === 0) {
    return null;
  }

  const rightEdge = Math.max(80, projector.width - 56);

  // Calcolo posizioni Y con prevenzione anti-collisione
  const renderedItems: Array<{
    lvl: LiquidityPoolLevel;
    yLine: number;
    yPill: number;
    startX: number;
    color: string;
    isMajor: boolean;
    labelText: string;
    pillWidth: number;
  }> = [];

  let lastPillBottom = -999;

  for (const lvl of activeLevels) {
    const yCoord = projector.yForPrice(lvl.price);
    if (yCoord == null || yCoord < 8 || yCoord > projector.height - 12) continue;

    const rawStartX = projector.xForTime(lvl.originTime);
    const startX =
      rawStartX != null
        ? Math.max(12, Math.min(rightEdge - 120, rawStartX))
        : Math.max(12, rightEdge - 240);

    const color = getLevelColor(lvl);
    const isMajor = lvl.tier === "MAJOR";

    const labelText = prefs.showPrice
      ? `${lvl.code} · ${formatPrice(lvl.price, symbol)}`
      : lvl.code;

    const pillWidth = Math.max(52, labelText.length * 5.2 + 10);

    // Anti-collisione: se la pillola colliderebbe con quella precedente, applica un offset minimo
    let yPill = yCoord - 7;
    if (yPill < lastPillBottom + 2) {
      yPill = lastPillBottom + 2;
    }
    lastPillBottom = yPill + 13;

    renderedItems.push({
      lvl,
      yLine: yCoord,
      yPill,
      startX,
      color,
      isMajor,
      labelText,
      pillWidth,
    });
  }

  return (
    <svg
      className="limen-liquidity-overlay pointer-events-none absolute inset-0 z-10"
      width={projector.width}
      height={projector.height}
      data-testid="liquidity-levels-overlay"
    >
      {/* Livelli di Liquidità Istituzionale Pura (BSL / SSL - ZERO OTE - ZERO Card Fluttuanti) */}
      {renderedItems.map(({ lvl, yLine, yPill, startX, color, isMajor, labelText, pillWidth }) => {
        const isHovered = hoveredLvlId === lvl.id;
        const dash = isMajor ? "none" : "3 3";
        const pipMult = getPipMultiplier(symbol);
        const pipsDiff = (lvl.price - currentPrice) * pipMult;
        const pipsFormatted = `${pipsDiff >= 0 ? "+" : ""}${pipsDiff.toFixed(1)}p`;
        const tooltipText = `${lvl.swept ? "PRESO" : "ATTIVO"} · ${pipsFormatted}`;
        const tooltipWidth = Math.max(76, tooltipText.length * 5.2 + 10);

        return (
          <g
            key={lvl.id}
            className="limen-liquidity-level-row"
            style={{ pointerEvents: "auto", cursor: "pointer" }}
            onMouseEnter={() => setHoveredLvlId(lvl.id)}
            onMouseLeave={() => setHoveredLvlId(null)}
          >
            {/* Linea orizzontale discreta del livello (si illumina al passaggio mouse) */}
            <line
              x1={startX}
              y1={yLine}
              x2={rightEdge}
              y2={yLine}
              stroke={color}
              strokeWidth={isHovered ? (isMajor ? 1.5 : 1.2) : (isMajor ? 1.1 : 0.9)}
              strokeDasharray={dash}
              opacity={isHovered ? 1 : (lvl.swept ? 0.35 : 0.72)}
            />

            {/* Micro-Tooltip Magnetico al passaggio del mouse */}
            {isHovered && (
              <g transform={`translate(${Math.max(12, rightEdge - pillWidth - tooltipWidth - 6)}, ${yPill})`}>
                <rect
                  width={tooltipWidth}
                  height={13}
                  rx={2}
                  fill="#07080b"
                  fillOpacity={0.96}
                  stroke={color}
                  strokeWidth={0.8}
                />
                <text
                  x={tooltipWidth / 2}
                  y={6.8}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={7.2}
                  fontWeight={800}
                  fill="#E8C56A"
                  fontFamily="var(--btm-mono)"
                >
                  {tooltipText}
                </text>
              </g>
            )}

            {/* Pillola compatta a bordo scala */}
            <g transform={`translate(${Math.max(12, rightEdge - pillWidth - 2)}, ${yPill})`}>
              <rect
                width={pillWidth}
                height={13}
                rx={2}
                fill="#07080b"
                fillOpacity={isHovered ? 0.98 : 0.92}
                stroke={color}
                strokeWidth={isHovered ? 1.1 : 0.8}
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
                {labelText}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
