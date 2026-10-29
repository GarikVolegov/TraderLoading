// ─── Session Range Boxes Overlay (Max–Min & Start–End) ───────────────────────
// Draws customizable colored price-time boxes for each trading session
// spanning horizontally from the session start to the session end (or latest bar)
// and vertically from the highest High to the lowest Low of that session.
import { useEffect, useMemo, useRef, useState } from "react";
import { getPipMultiplier } from "@/lib/pipMultiplier";
import { synestheticAlert } from "@/lib/soundFx";
import {
  getCustomSessionRangeForTime,
  hexToRgba,
  loadSessionPreferences,
  SESSION_PREFERENCES_EVENT,
  type SessionPreferenceItem,
  type SessionPreferencesState,
} from "../chartSessionTime";
import type { ChartProjector } from "./PositionOverlay";
import type { ReplayEngine } from "./useReplayEngine";

const DAY_SECONDS = 86_400;
export const SESSION_TELEMETRY_EVENT = "aureus:session-telemetry-updated";
export const SESSION_SWEEP_ALERT_EVENT = "aureus:session-sweep-alert";
export const SESSION_TELEMETRY_STORAGE_KEY = "aureus_live_session_telemetry_v1";

export interface SessionSweepAlertDetail {
  symbol: string;
  sessionLabel: string;
  side: "MAX" | "MIN";
  levelPrice: number;
  sweepTime: number;
}

export interface LiveSessionLiquidityTelemetry {
  symbol: string;
  sessionId: string;
  sessionLabel: string;
  hoursLabel: string;
  highPrice: number;
  lowPrice: number;
  midPrice: number;
  rangePips: number;
  currentPrice: number;
  sweptHigh: boolean;
  sweptLow: boolean;
  priceZone: "ABOVE_MAX" | "BELOW_MIN" | "PREMIUM" | "DISCOUNT";
  updatedAt: number;
}

function formatCompactRange(startTime: string, endTime: string): string {
  const s = startTime.endsWith(":00") ? startTime.slice(0, -3) : startTime;
  const e = endTime.endsWith(":00") ? endTime.slice(0, -3) : endTime;
  return `${s}-${e}`;
}

function formatBoxPrice(price: number): string {
  if (!Number.isFinite(price)) return "";
  if (price >= 1000) return price.toFixed(2);
  if (price >= 10) return price.toFixed(3);
  return price.toFixed(5);
}

interface SessionBoxData {
  start: number;
  end: number;
  def: SessionPreferenceItem;
  highPrice: number;
  lowPrice: number;
  rangePips: number;
  firstCandleTime: number;
  lastCandleTime: number;
  sweptHighTime: number | null;
  sweptLowTime: number | null;
}

export function SessionOpensOverlay({
  engine,
  projector,
  revision,
  onOpenSettings,
}: {
  engine: ReplayEngine;
  projector: ChartProjector;
  revision: number;
  onOpenSettings?: () => void;
}) {
  void revision; // re-render on pan/zoom/resize
  const { revealed, intervalSeconds } = engine;

  const [prefs, setPrefs] = useState<SessionPreferencesState>(() => loadSessionPreferences());
  const triggeredSweepKeysRef = useRef<Set<string>>(new Set());
  const initialMountRef = useRef<boolean>(true);
  const prevSymbolRef = useRef<string>(engine.symbol || "");

  useEffect(() => {
    const sync = () => setPrefs(loadSessionPreferences());
    window.addEventListener(SESSION_PREFERENCES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SESSION_PREFERENCES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const visibleSessionDefs = useMemo(
    () => prefs.items.filter((item) => item.enabled && (!prefs.onlyFavorites || item.favorite)),
    [prefs],
  );

  // Precompute session boxes across the recent 14-day window independent of `projector`
  // so 60/120Hz pan/zoom gestures never re-scan `revealed` or trigger localStorage writes.
  const allRecentSessions = useMemo(() => {
    if (
      revealed.length === 0 ||
      intervalSeconds >= DAY_SECONDS ||
      visibleSessionDefs.length === 0
    ) {
      return [];
    }

    const first = revealed[0].time;
    const last = revealed[revealed.length - 1].time;
    const windowStart = Math.max(first, last - DAY_SECONDS * 14);
    const windowEnd = last;

    const out: SessionBoxData[] = [];
    const startDay = Math.floor((windowStart - DAY_SECONDS) / DAY_SECONDS) * DAY_SECONDS;
    const endDay = Math.floor((windowEnd + DAY_SECONDS) / DAY_SECONDS) * DAY_SECONDS;

    const minTime = first;
    const maxTime = last + intervalSeconds;
    const pipMult = getPipMultiplier(engine.symbol || "");

    for (let day = startDay; day <= endDay; day += DAY_SECONDS) {
      for (const def of visibleSessionDefs) {
        const { start, end } = getCustomSessionRangeForTime(day, def.startTime, def.endTime);
        if (
          end < windowStart ||
          start > windowEnd ||
          end < minTime ||
          start > maxTime
        ) {
          continue;
        }

        let highPrice = -Infinity;
        let lowPrice = Infinity;
        let firstCandleTime: number | null = null;
        let lastCandleTime: number | null = null;
        let lastSessionIndex = -1;

        for (let i = 0; i < revealed.length; i++) {
          const c = revealed[i];
          if (c.time < start) continue;
          if (c.time >= end) break;
          if (firstCandleTime == null) firstCandleTime = c.time;
          lastCandleTime = c.time;
          lastSessionIndex = i;
          if (c.high > highPrice) highPrice = c.high;
          if (c.low < lowPrice) lowPrice = c.low;
        }

        if (
          firstCandleTime != null &&
          lastCandleTime != null &&
          Number.isFinite(highPrice) &&
          Number.isFinite(lowPrice)
        ) {
          let sweptHighTime: number | null = null;
          let sweptLowTime: number | null = null;
          const sweepLookaheadEnd = end + 16 * 3600;

          if (lastSessionIndex >= 0) {
            for (let j = lastSessionIndex + 1; j < revealed.length; j++) {
              const afterBar = revealed[j];
              if (afterBar.time < end) continue;
              if (afterBar.time > sweepLookaheadEnd) break;
              if (sweptHighTime == null && afterBar.high > highPrice) {
                sweptHighTime = afterBar.time;
              }
              if (sweptLowTime == null && afterBar.low < lowPrice) {
                sweptLowTime = afterBar.time;
              }
              if (sweptHighTime != null && sweptLowTime != null) break;
            }
          }

          const rangePips = Math.max(0, (highPrice - lowPrice) * pipMult);

          out.push({
            start,
            end,
            def,
            highPrice,
            lowPrice,
            rangePips,
            firstCandleTime,
            lastCandleTime,
            sweptHighTime,
            sweptLowTime,
          });
        }
      }
    }
    return out;
  }, [revealed, intervalSeconds, visibleSessionDefs, engine.symbol]);

  const sessions = useMemo(() => {
    if (allRecentSessions.length === 0 || projector.width <= 0) return [];
    const tStart = projector.timeForX(0);
    const tEnd = projector.timeForX(projector.width);
    const first = revealed[0]?.time ?? 0;
    const last = revealed[revealed.length - 1]?.time ?? 0;
    const windowStart = tStart != null ? Math.max(tStart, first) : last - DAY_SECONDS * 5;
    const windowEnd = tEnd != null ? tEnd : last;
    if (windowEnd - windowStart > DAY_SECONDS * 14) return [];
    return allRecentSessions.filter((s) => s.end >= windowStart && s.start <= windowEnd);
  }, [allRecentSessions, projector, revealed]);

  const lastDispatchedTelemetrySigRef = useRef<string>("");

  // Sincronizza la telemetria dell'ultima sessione con Il Custode della Soglia (Step 3)
  useEffect(() => {
    if (typeof window === "undefined" || allRecentSessions.length === 0 || revealed.length === 0) return;
    const latestSession = allRecentSessions[allRecentSessions.length - 1];
    const currentBar = revealed[revealed.length - 1];
    const currentPrice = currentBar.close;
    const midPrice = (latestSession.highPrice + latestSession.lowPrice) / 2;

    let priceZone: LiveSessionLiquidityTelemetry["priceZone"] = "DISCOUNT";
    if (currentPrice > latestSession.highPrice) priceZone = "ABOVE_MAX";
    else if (currentPrice < latestSession.lowPrice) priceZone = "BELOW_MIN";
    else if (currentPrice >= midPrice) priceZone = "PREMIUM";

    const sweptHigh = latestSession.sweptHighTime != null || currentPrice > latestSession.highPrice;
    const sweptLow = latestSession.sweptLowTime != null || currentPrice < latestSession.lowPrice;
    const sig = `${engine.symbol || ""}:${latestSession.def.id}:${latestSession.highPrice}:${latestSession.lowPrice}:${currentPrice}:${sweptHigh}:${sweptLow}:${priceZone}`;
    if (lastDispatchedTelemetrySigRef.current === sig) return;
    lastDispatchedTelemetrySigRef.current = sig;

    const payload: LiveSessionLiquidityTelemetry = {
      symbol: engine.symbol || "",
      sessionId: latestSession.def.id,
      sessionLabel: latestSession.def.shortLabel,
      hoursLabel: `${latestSession.def.startTime}–${latestSession.def.endTime}`,
      highPrice: latestSession.highPrice,
      lowPrice: latestSession.lowPrice,
      midPrice,
      rangePips: Number(latestSession.rangePips.toFixed(1)),
      currentPrice,
      sweptHigh,
      sweptLow,
      priceZone,
      updatedAt: Date.now(),
    };

    try {
      window.localStorage.setItem(SESSION_TELEMETRY_STORAGE_KEY, JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent(SESSION_TELEMETRY_EVENT, { detail: payload }));
    } catch {
      // ignore storage errors
    }
  }, [allRecentSessions, revealed, engine.symbol]);

  // Allerta Sonora Sinestetica & Notifica Live al verificarsi di uno Sweep di Sessione
  useEffect(() => {
    if (typeof window === "undefined" || allRecentSessions.length === 0) return;

    if (prevSymbolRef.current !== (engine.symbol || "")) {
      prevSymbolRef.current = engine.symbol || "";
      triggeredSweepKeysRef.current.clear();
      initialMountRef.current = true;
    }

    const currentSym = engine.symbol || "";
    let newlySwept = false;

    for (const session of allRecentSessions) {
      if (session.sweptHighTime != null) {
        const key = `${currentSym}-${session.def.id}-${session.start}-HIGH`;
        if (!triggeredSweepKeysRef.current.has(key)) {
          triggeredSweepKeysRef.current.add(key);
          if (!initialMountRef.current) {
            newlySwept = true;
            const detail: SessionSweepAlertDetail = {
              symbol: currentSym,
              sessionLabel: session.def.shortLabel,
              side: "MAX",
              levelPrice: session.highPrice,
              sweepTime: session.sweptHighTime,
            };
            window.dispatchEvent(new CustomEvent(SESSION_SWEEP_ALERT_EVENT, { detail }));
          }
        }
      }

      if (session.sweptLowTime != null) {
        const key = `${currentSym}-${session.def.id}-${session.start}-LOW`;
        if (!triggeredSweepKeysRef.current.has(key)) {
          triggeredSweepKeysRef.current.add(key);
          if (!initialMountRef.current) {
            newlySwept = true;
            const detail: SessionSweepAlertDetail = {
              symbol: currentSym,
              sessionLabel: session.def.shortLabel,
              side: "MIN",
              levelPrice: session.lowPrice,
              sweepTime: session.sweptLowTime,
            };
            window.dispatchEvent(new CustomEvent(SESSION_SWEEP_ALERT_EVENT, { detail }));
          }
        }
      }
    }

    if (newlySwept && prefs.soundAlertOnSweep !== false) {
      synestheticAlert();
    }

    if (initialMountRef.current) {
      initialMountRef.current = false;
    }
  }, [allRecentSessions, engine.symbol, prefs.soundAlertOnSweep]);

  if (sessions.length === 0 || projector.width <= 0) return null;

  const chartAvailableWidth = projector.paneWidth ?? (projector.width - 56);
  const chartHeight = projector.paneHeight ?? Math.max(0, projector.height - 24);

  // Calcola metà larghezza candela per avvolgere con precisione la prima e l'ultima barra della sessione
  let halfBar = 3;
  if (revealed.length >= 2) {
    const xA = projector.xForTime(revealed[revealed.length - 2].time);
    const xB = projector.xForTime(revealed[revealed.length - 1].time);
    if (xA != null && xB != null && xB > xA) {
      halfBar = Math.max(2, Math.min(14, (xB - xA) * 0.45));
    }
  }

  return (
    <svg
      className="btm-posoverlay"
      width={projector.width}
      height={projector.height}
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      {sessions.map(({ start, end, def, highPrice, lowPrice, rangePips, firstCandleTime, lastCandleTime, sweptHighTime, sweptLowTime }) => {
        const xStartRaw = projector.xForTime(firstCandleTime) ?? projector.xForTime(start);
        const xEndCandleRaw = projector.xForTime(lastCandleTime);
        const xEndWindowRaw = projector.xForTime(end);

        if (xStartRaw == null && xEndCandleRaw == null && xEndWindowRaw == null) return null;

        const rawLeft = xStartRaw != null ? xStartRaw - halfBar : 0;
        const rawRight =
          xEndCandleRaw != null
            ? xEndCandleRaw + halfBar
            : (xEndWindowRaw ?? chartAvailableWidth);

        const left = Math.max(0, rawLeft);
        const right = Math.min(chartAvailableWidth, Math.max(left + 4, rawRight));
        const width = right - left;

        if (width <= 2 || left >= chartAvailableWidth) return null;

        const yHighRaw = projector.yForPrice(highPrice);
        const yLowRaw = projector.yForPrice(lowPrice);
        if (yHighRaw == null || yLowRaw == null) return null;

        const top = Math.max(2, Math.min(chartHeight - 6, Math.min(yHighRaw, yLowRaw)));
        const bottom = Math.max(top + 6, Math.min(chartHeight - 2, Math.max(yHighRaw, yLowRaw)));
        const height = bottom - top;

        const fillOpacity = Math.max(0.05, Math.min(0.5, def.opacity));
        const bg = hexToRgba(def.color, fillOpacity);
        const borderStrong = hexToRgba(def.color, 0.9);
        const borderSide = hexToRgba(def.color, 0.62);

        const pipsFormatted = `${rangePips >= 100 ? rangePips.toFixed(0) : rangePips.toFixed(1)}p`;
        const labelText = `${def.shortLabel} · ${formatCompactRange(def.startTime, def.endTime)} · ${pipsFormatted}`;
        const pillWidth = Math.max(88, Math.round(labelText.length * 5.4 + 14));
        const labelX = Math.max(2, Math.min(left, chartAvailableWidth - pillWidth - 4));
        const labelY = top >= 20 ? top - 16 : top + 3;

        const highFormatted = formatBoxPrice(highPrice);
        const lowFormatted = formatBoxPrice(lowPrice);
        const showPriceTags = def.showHighLowLabels === true && width >= 56 && height >= 18;
        const allowSweepBadges = prefs.showSweepBadges === true || def.showSweepBadges === true;
        const extendRight = Math.min(chartAvailableWidth, right + 120);

        const xSweepHighRaw = sweptHighTime != null ? projector.xForTime(sweptHighTime) : null;
        const xSweepLowRaw = sweptLowTime != null ? projector.xForTime(sweptLowTime) : null;
        const xSweepHigh =
          xSweepHighRaw != null && xSweepHighRaw > right
            ? Math.min(chartAvailableWidth - 4, xSweepHighRaw)
            : null;
        const xSweepLow =
          xSweepLowRaw != null && xSweepLowRaw > right
            ? Math.min(chartAvailableWidth - 4, xSweepLowRaw)
            : null;

        return (
          <g key={`${def.id}-${start}`}>
            {/* Riquadro Colorato Sessione (Da Inizio a Fine · Dal Massimo al Minimo) */}
            <rect
              x={left}
              y={top}
              width={width}
              height={height}
              rx={2}
              fill={bg}
            />

            {/* Bordi del Riquadro (Massimo in alto, Minimo in basso, Inizio e Fine laterali) */}
            {def.showBorders && (
              <>
                {/* Linea Massimo di Sessione (Top Edge) */}
                <line
                  x1={left}
                  y1={top}
                  x2={right}
                  y2={top}
                  stroke={borderStrong}
                  strokeWidth={1.6}
                />
                {/* Linea Minimo di Sessione (Bottom Edge) */}
                <line
                  x1={left}
                  y1={bottom}
                  x2={right}
                  y2={bottom}
                  stroke={borderStrong}
                  strokeWidth={1.6}
                />
                {/* Linea Verticale Inizio Sessione (dal Max al Min) */}
                <line
                  x1={left}
                  y1={top}
                  x2={left}
                  y2={bottom}
                  stroke={borderSide}
                  strokeWidth={1.1}
                  strokeDasharray="3 2"
                />
                {/* Linea Verticale Fine Sessione (dal Max al Min) */}
                <line
                  x1={right}
                  y1={top}
                  x2={right}
                  y2={bottom}
                  stroke={borderSide}
                  strokeWidth={1.1}
                  strokeDasharray="3 2"
                />
              </>
            )}

            {/* Proiezione Opzionale Livelli di Liquidità Max / Min a destra del riquadro */}
            {def.extendHighLowLines && extendRight > right + 8 && (
              <>
                <line
                  x1={right}
                  y1={top}
                  x2={extendRight}
                  y2={top}
                  stroke={borderStrong}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  strokeOpacity={0.75}
                />
                <line
                  x1={right}
                  y1={bottom}
                  x2={extendRight}
                  y2={bottom}
                  stroke={borderStrong}
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  strokeOpacity={0.75}
                />
              </>
            )}

            {/* Rilevamento Automatico Sweep del Massimo di Sessione (⚡ SWEEP MAX - Opzionale) */}
            {allowSweepBadges && xSweepHigh != null && (
              <>
                <line
                  x1={right}
                  y1={top}
                  x2={xSweepHigh}
                  y2={top}
                  stroke="#10b981"
                  strokeWidth={1.2}
                  strokeDasharray="3 2"
                />
                <g transform={`translate(${Math.min(xSweepHigh - 28, chartAvailableWidth - 64)}, ${Math.max(2, top - 13)})`}>
                  <rect width={60} height={12} rx={2.5} fill="#07080b" stroke="#10b981" strokeWidth={0.9} />
                  <text
                    x={30}
                    y={8.8}
                    textAnchor="middle"
                    fontSize={7.5}
                    fontWeight={800}
                    fill="#10b981"
                    fontFamily="var(--font-mono, monospace)"
                  >
                    {"⚡ SWEEP MAX"}
                  </text>
                </g>
              </>
            )}

            {/* Rilevamento Automatico Sweep del Minimo di Sessione (⚡ SWEEP MIN - Opzionale) */}
            {allowSweepBadges && xSweepLow != null && (
              <>
                <line
                  x1={right}
                  y1={bottom}
                  x2={xSweepLow}
                  y2={bottom}
                  stroke="#ef4444"
                  strokeWidth={1.2}
                  strokeDasharray="3 2"
                />
                <g transform={`translate(${Math.min(xSweepLow - 28, chartAvailableWidth - 64)}, ${Math.min(chartHeight - 14, bottom + 2)})`}>
                  <rect width={60} height={12} rx={2.5} fill="#07080b" stroke="#ef4444" strokeWidth={0.9} />
                  <text
                    x={30}
                    y={8.8}
                    textAnchor="middle"
                    fontSize={7.5}
                    fontWeight={800}
                    fill="#ef4444"
                    fontFamily="var(--font-mono, monospace)"
                  >
                    {"⚡ SWEEP MIN"}
                  </text>
                </g>
              </>
            )}

            {/* Etichette Prezzo Massimo (MAX) e Minimo (MIN) sul riquadro */}
            {showPriceTags && (
              <>
                <text
                  x={right - 4}
                  y={top + 9}
                  textAnchor="end"
                  fontSize={8}
                  fontWeight={700}
                  fill={def.color}
                  fillOpacity={0.92}
                  fontFamily="var(--font-mono, monospace)"
                >
                  {`MAX ${highFormatted}`}
                </text>
                <text
                  x={right - 4}
                  y={bottom - 3}
                  textAnchor="end"
                  fontSize={8}
                  fontWeight={700}
                  fill={def.color}
                  fillOpacity={0.92}
                  fontFamily="var(--font-mono, monospace)"
                >
                  {`MIN ${lowFormatted}`}
                </text>
              </>
            )}

            {/* Etichetta Superiore Sessione con Ampiezza in Pips (Cliccabile per personalizzare) */}
            {def.showLabel && labelX >= 0 && (
              <g
                style={{
                  pointerEvents: onOpenSettings ? "auto" : "none",
                  cursor: onOpenSettings ? "pointer" : "default",
                }}
                onClick={(e) => {
                  if (onOpenSettings) {
                    e.stopPropagation();
                    onOpenSettings();
                  }
                }}
              >
                <title>{`${def.name} (${def.startTime}–${def.endTime} CET) · Range: ${pipsFormatted} · Max: ${highFormatted} · Min: ${lowFormatted} · Clicca per personalizzare`}</title>
                <rect
                  x={labelX}
                  y={labelY}
                  width={pillWidth}
                  height={14}
                  rx={3}
                  fill="#07080b"
                  fillOpacity={0.92}
                  stroke={borderStrong}
                  strokeWidth={0.9}
                />
                <text
                  x={labelX + 5}
                  y={labelY + 10}
                  fontSize={8.5}
                  fontWeight={700}
                  fill={def.color}
                  fontFamily="var(--font-mono, monospace)"
                >
                  {labelText}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
