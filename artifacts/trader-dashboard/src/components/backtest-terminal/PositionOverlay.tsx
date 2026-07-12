// ─── Position overlay ────────────────────────────────────────────────────────
// SVG layer over the chart: risk/reward zones of the open position with
// draggable entry/SL/TP handles (mockup behavior), plus dashed entry→exit
// connectors for closed trades. Coordinates come from the chart projector and
// re-render on pan/zoom via the `revision` counter.
import { useRef } from "react";
import { formatPrice } from "./format";
import type { ReplayEngine } from "./useReplayEngine";

export interface ChartProjector {
  xForTime: (time: number) => number | null;
  yForPrice: (price: number) => number | null;
  priceForY: (y: number) => number | null;
  /** Bar open-time (unix seconds) under the x coordinate, null off-data. */
  timeForX: (x: number) => number | null;
  width: number;
  height: number;
}

const GREEN = "hsl(142 71% 45%)";
const RED = "hsl(0 84% 60%)";
const BLUE = "hsl(217 91% 60%)";
const AMBER = "hsl(38 92% 50%)";

type DragTarget = "sl" | "tp" | "entry";

export function PositionOverlay({
  engine,
  projector,
  revision,
}: {
  engine: ReplayEngine;
  projector: ChartProjector;
  revision: number;
}) {
  void revision; // consumed to re-render on pan/zoom/resize
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragTarget | null>(null);

  const { position, trades, symbol, revealed } = engine;
  const { width, height } = projector;
  if (width <= 0 || height <= 0) return null;

  const lastTime = revealed.length > 0 ? revealed[revealed.length - 1].time : null;

  const onHandleDown = (target: DragTarget) => (event: React.PointerEvent<SVGRectElement>) => {
    event.preventDefault();
    dragRef.current = target;
    const svg = svgRef.current;
    if (!svg) return;
    svg.setPointerCapture(event.pointerId);
    const onMove = (moveEvent: PointerEvent) => {
      const active = dragRef.current;
      if (!active) return;
      const rect = svg.getBoundingClientRect();
      const price = projector.priceForY(moveEvent.clientY - rect.top);
      if (price == null || !Number.isFinite(price) || price <= 0) return;
      engine.updatePositionLevels(
        active === "sl" ? { stopLoss: price } : active === "tp" ? { takeProfit: price } : { entryPrice: price },
      );
    };
    const onUp = () => {
      dragRef.current = null;
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerup", onUp);
    };
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
  };

  const handle = (y: number, color: string, target: DragTarget) => (
    <g key={target}>
      <rect
        className="btm-handle"
        x={width - 74}
        y={y - 7}
        width={16}
        height={14}
        rx={3}
        fill={color}
        onPointerDown={onHandleDown(target)}
      />
      <line x1={width - 70} y1={y - 2.5} x2={width - 70} y2={y + 2.5} stroke="hsl(222 47% 6%)" strokeWidth={1.2} />
      <line x1={width - 66} y1={y - 2.5} x2={width - 66} y2={y + 2.5} stroke="hsl(222 47% 6%)" strokeWidth={1.2} />
    </g>
  );

  // Closed-trade connectors (entry → exit, dashed, colored by result).
  const connectors = trades.map((trade) => {
    if (lastTime == null || trade.entryTime > lastTime) return null;
    const x1 = projector.xForTime(trade.entryTime);
    const x2 = projector.xForTime(Math.min(trade.exitTime, lastTime));
    const y1 = projector.yForPrice(trade.entryPrice);
    const y2 = projector.yForPrice(trade.exitPrice);
    if (x1 == null || x2 == null || y1 == null || y2 == null) return null;
    const color = trade.result === "win" ? GREEN : trade.result === "loss" ? RED : AMBER;
    return (
      <line
        key={trade.id}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={1.2}
        strokeDasharray="3 3"
        opacity={0.55}
      />
    );
  });

  let positionLayer: React.ReactNode = null;
  if (position) {
    const yEntry = projector.yForPrice(position.entryPrice);
    const yStop = projector.yForPrice(position.stopLoss);
    const yTarget = projector.yForPrice(position.takeProfit);
    const xStart = Math.max(0, projector.xForTime(position.entryTime) ?? 0);
    if (yEntry != null && yStop != null && yTarget != null) {
      const boxWidth = Math.max(0, width - 58 - xStart);
      const rewardTop = Math.min(yEntry, yTarget);
      const rewardHeight = Math.abs(yTarget - yEntry);
      const riskTop = Math.min(yEntry, yStop);
      const riskHeight = Math.abs(yStop - yEntry);
      const rrLabel =
        position.slPips > 0 ? (position.tpPips / position.slPips).toFixed(2) : "—";
      positionLayer = (
        <g>
          <rect x={xStart} y={rewardTop} width={boxWidth} height={rewardHeight} fill="hsl(142 71% 45% / 0.12)" />
          <rect x={xStart} y={riskTop} width={boxWidth} height={riskHeight} fill="hsl(0 84% 60% / 0.12)" />
          <line x1={xStart} y1={yTarget} x2={xStart + boxWidth} y2={yTarget} stroke={GREEN} strokeWidth={1.2} strokeDasharray="5 3" />
          <line x1={xStart} y1={yStop} x2={xStart + boxWidth} y2={yStop} stroke={RED} strokeWidth={1.2} strokeDasharray="5 3" />
          <line x1={xStart} y1={yEntry} x2={xStart + boxWidth} y2={yEntry} stroke={BLUE} strokeWidth={1.4} />
          <text x={xStart + 6} y={yEntry - 5} fontSize={9.5} fontWeight={700} fill={BLUE} fontFamily="var(--btm-mono)">
            {`${position.direction === "buy" ? "LONG" : "SHORT"} ${position.lots.toFixed(2)} · R:R ${rrLabel}`}
          </text>
          <text
            x={xStart + 6}
            y={(position.direction === "buy" ? yTarget : yStop) + 11}
            fontSize={9.5}
            fontWeight={700}
            fill={position.direction === "buy" ? GREEN : RED}
            fontFamily="var(--btm-mono)"
          >
            {position.direction === "buy"
              ? `TP ${formatPrice(position.takeProfit, symbol)}`
              : `SL ${formatPrice(position.stopLoss, symbol)}`}
          </text>
          <text
            x={xStart + 6}
            y={(position.direction === "buy" ? yStop : yTarget) - 5}
            fontSize={9.5}
            fontWeight={700}
            fill={position.direction === "buy" ? RED : GREEN}
            fontFamily="var(--btm-mono)"
          >
            {position.direction === "buy"
              ? `SL ${formatPrice(position.stopLoss, symbol)}`
              : `TP ${formatPrice(position.takeProfit, symbol)}`}
          </text>
          {handle(yTarget, GREEN, "tp")}
          {handle(yStop, RED, "sl")}
          {handle(yEntry, BLUE, "entry")}
        </g>
      );
    }
  }

  return (
    <svg ref={svgRef} className="btm-posoverlay" width={width} height={height} aria-hidden="true">
      {connectors}
      {positionLayer}
    </svg>
  );
}
