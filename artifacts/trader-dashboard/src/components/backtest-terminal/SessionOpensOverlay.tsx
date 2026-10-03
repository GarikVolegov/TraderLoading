// ─── Session opens overlay ───────────────────────────────────────────────────
// Vertical dashed markers at the Asia / London / New York session opens
// (Europe/Rome session windows from chartSessionTime), drawn over the revealed
// intraday bars. Hidden on D1/W1 where intraday sessions are meaningless.
import { useMemo } from "react";
import type { SessionBoxId } from "../chartAnalysisTypes";
import { getSessionRangesForTime } from "../chartSessionTime";
import type { ChartProjector } from "./PositionOverlay";
import type { ReplayEngine } from "./useReplayEngine";

const SESSION_STYLE: Record<SessionBoxId, { color: string; label: string }> = {
  asia: { color: "hsl(38 92% 55% / 0.55)", label: "ASIA" },
  london: { color: "hsl(160 60% 45% / 0.6)", label: "LDN" },
  newYork: { color: "hsl(217 91% 60% / 0.6)", label: "NY" },
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

  const opens = useMemo(() => {
    if (revealed.length === 0 || intervalSeconds >= DAY_SECONDS) return [];
    const first = revealed[0].time;
    const last = revealed[revealed.length - 1].time;
    const barTimes = new Set(revealed.map((candle) => candle.time));
    const out: Array<{ time: number; session: SessionBoxId }> = [];
    for (let day = first - DAY_SECONDS; day <= last + DAY_SECONDS; day += DAY_SECONDS) {
      const ranges = getSessionRangesForTime(day);
      for (const session of Object.keys(ranges) as SessionBoxId[]) {
        const open = ranges[session].start;
        // Anchor to an actual revealed bar (markets closed → no line).
        if (open >= first && open <= last && barTimes.has(open)) {
          out.push({ time: open, session });
        }
      }
    }
    return out;
  }, [revealed, intervalSeconds]);

  if (opens.length === 0 || projector.width <= 0) return null;

  return (
    <svg className="btm-posoverlay" width={projector.width} height={projector.height} aria-hidden="true">
      {opens.map(({ time, session }) => {
        const x = projector.xForTime(time);
        if (x == null || x < 0 || x > projector.width - 58) return null;
        const style = SESSION_STYLE[session];
        return (
          <g key={`${session}-${time}`}>
            <line x1={x} y1={0} x2={x} y2={projector.height - 26} stroke={style.color} strokeWidth={1} strokeDasharray="2 4" />
            <text x={x + 3} y={12} fontSize={8.5} fontWeight={700} fill={style.color} fontFamily="var(--btm-mono)">
              {style.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
