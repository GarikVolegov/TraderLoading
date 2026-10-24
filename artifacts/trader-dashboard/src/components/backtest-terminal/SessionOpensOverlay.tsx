// ─── Session opens overlay ───────────────────────────────────────────────────
// Shaded Killzones and boundary markers for Asia / London / New York sessions
// (Europe/Rome session windows from chartSessionTime), drawn over revealed
// intraday bars. Hidden on D1/W1 where intraday sessions are meaningless.
import { useMemo } from "react";
import type { SessionBoxId } from "../chartAnalysisTypes";
import { getSessionRangesForTime } from "../chartSessionTime";
import type { ChartProjector } from "./PositionOverlay";
import type { ReplayEngine } from "./useReplayEngine";

interface SessionConfig {
  bg: string;
  border: string;
  text: string;
  label: string;
  pillWidth: number;
}

const SESSION_STYLE: Record<SessionBoxId, SessionConfig> = {
  asia: {
    bg: "rgba(197, 160, 89, 0.08)",
    border: "rgba(197, 160, 89, 0.55)",
    text: "#C5A059",
    label: "ASIA · 00-08",
    pillWidth: 70,
  },
  london: {
    bg: "rgba(16, 185, 129, 0.08)",
    border: "rgba(16, 185, 129, 0.55)",
    text: "#10B981",
    label: "LONDRA · 08-17",
    pillWidth: 80,
  },
  newYork: {
    bg: "rgba(59, 130, 246, 0.08)",
    border: "rgba(59, 130, 246, 0.55)",
    text: "#60A5FA",
    label: "NY · 14:30-23",
    pillWidth: 78,
  },
};

const DAY_SECONDS = 86_400;

export function SessionOpensOverlay({
  engine,
  projector,
  revision,
}: {
  engine: ReplayEngine;
  projector: ChartProjector;
  revision: number;
}) {
  void revision; // re-render on pan/zoom/resize
  const { revealed, intervalSeconds } = engine;

  const sessions = useMemo(() => {
    if (revealed.length === 0 || intervalSeconds >= DAY_SECONDS || projector.width <= 0) return [];

    const tStart = projector.timeForX(0);
    const tEnd = projector.timeForX(projector.width);

    const first = revealed[0].time;
    const last = revealed[revealed.length - 1].time;
    const windowStart = tStart != null ? Math.max(tStart, first) : last - DAY_SECONDS * 5;
    const windowEnd = tEnd != null ? tEnd : last;

    // Mostra sessioni fino a 14 giorni di zoom per visualizzare la settimana operativa completa
    if (windowEnd - windowStart > DAY_SECONDS * 14) return [];

    const out: Array<{ start: number; end: number; session: SessionBoxId }> = [];
    const startDay = Math.floor((windowStart - DAY_SECONDS) / DAY_SECONDS) * DAY_SECONDS;
    const endDay = Math.floor((windowEnd + DAY_SECONDS) / DAY_SECONDS) * DAY_SECONDS;

    const minTime = first;
    const maxTime = last + intervalSeconds;

    for (let day = startDay; day <= endDay; day += DAY_SECONDS) {
      const ranges = getSessionRangesForTime(day);
      for (const session of Object.keys(ranges) as SessionBoxId[]) {
        const { start, end } = ranges[session];
        if (
          end >= windowStart &&
          start <= windowEnd &&
          end >= minTime &&
          start <= maxTime
        ) {
          out.push({ start, end, session });
        }
      }
    }
    return out;
  }, [revealed, intervalSeconds, projector]);

  if (sessions.length === 0 || projector.width <= 0) return null;

  const priceScaleGutter = 56;
  const chartAvailableWidth = projector.width - priceScaleGutter;
  const chartHeight = Math.max(0, projector.height - 24);

  return (
    <svg
      className="btm-posoverlay"
      width={projector.width}
      height={projector.height}
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      {sessions.map(({ start, end, session }) => {
        const x1Raw = projector.xForTime(start);
        const x2Raw = projector.xForTime(end);

        if (x1Raw == null && x2Raw == null) return null;

        const left = Math.max(0, x1Raw ?? 0);
        const right = Math.min(chartAvailableWidth, x2Raw ?? chartAvailableWidth);
        const width = right - left;

        if (width <= 2 || left >= chartAvailableWidth) return null;

        const style = SESSION_STYLE[session];
        const labelX = Math.min(left + 4, chartAvailableWidth - style.pillWidth - 4);

        return (
          <g key={`${session}-${start}`}>
            {/* Shaded Killzone Box */}
            <rect
              x={left}
              y={0}
              width={width}
              height={chartHeight}
              fill={style.bg}
            />

            {/* Session Open Boundary Line */}
            {x1Raw != null && x1Raw >= 0 && x1Raw <= chartAvailableWidth && (
              <line
                x1={x1Raw}
                y1={0}
                x2={x1Raw}
                y2={chartHeight}
                stroke={style.border}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            )}

            {/* Session Close Boundary Line */}
            {x2Raw != null && x2Raw >= 0 && x2Raw <= chartAvailableWidth && (
              <line
                x1={x2Raw}
                y1={0}
                x2={x2Raw}
                y2={chartHeight}
                stroke={style.border}
                strokeWidth={1}
                strokeDasharray="1 3"
                strokeOpacity={0.65}
              />
            )}

            {/* Top Label Tag */}
            {labelX >= 0 && (
              <g>
                <rect
                  x={labelX}
                  y={6}
                  width={style.pillWidth}
                  height={15}
                  rx={3}
                  fill="#08080a"
                  stroke={style.border}
                  strokeWidth={0.8}
                />
                <text
                  x={labelX + 5}
                  y={17}
                  fontSize={8.5}
                  fontWeight={700}
                  fill={style.text}
                  fontFamily="var(--font-mono, monospace)"
                >
                  {style.label}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
