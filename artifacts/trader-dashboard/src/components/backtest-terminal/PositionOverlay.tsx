// ─── Position overlay ────────────────────────────────────────────────────────
// SVG layer over the chart: risk/reward zones of all open positions with
// interactive on-chart action pills (BE, 50%, 25%, Close X), draggable entry/SL/TP
// handles with live risk & lot size recalculation tooltips, pending order lines
// with direct cancellation, plus dashed entry→exit connectors for closed trades.
import { useRef, useState } from "react";
import { formatPrice } from "./format";
import { getPipMultiplier } from "@/lib/pipMultiplier";
import { positionPips, projectedLevelPnl, unrealizedProfit } from "@/lib/replay/tradeEngine";
import type { OpenPosition, PendingOrder } from "@/lib/replay/types";
import type { ReplayEngine } from "./useReplayEngine";

export interface ChartProjector {
  xForTime: (time: number) => number | null;
  yForPrice: (price: number) => number | null;
  priceForY: (y: number) => number | null;
  /** Bar open-time (unix seconds) under the x coordinate, null off-data. */
  timeForX: (x: number) => number | null;
  width: number;
  height: number;
  paneWidth?: number;
  paneHeight?: number;
}

const GREEN = "hsl(142 71% 45%)";
const RED = "hsl(0 84% 60%)";
const BLUE = "hsl(217 91% 60%)";
const AMBER = "hsl(38 92% 50%)";

type DragTarget = "sl" | "tp" | "entry";

interface ActiveDragState {
  positionId: string;
  target: DragTarget;
  price: number;
}

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
  const dragRef = useRef<ActiveDragState | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDragState | null>(null);

  const positions = engine.positions ?? (engine.position ? [engine.position] : []);
  const pendingOrders = engine.pendingOrders ?? (engine.pendingOrder ? [engine.pendingOrder] : []);
  const trades = engine.trades ?? [];
  const symbol = engine.symbol;
  const revealed = engine.revealed ?? [];
  const settings = engine.settings;
  const hoveredTradeId = engine.hoveredTradeId;
  const currentPrice = engine.currentPrice ?? 0;
  const ticket = engine.ticket;
  const { width, height } = projector;
  if (width <= 0 || height <= 0) return null;

  const lastTime = revealed.length > 0 ? revealed[revealed.length - 1].time : null;
  const pipMult = getPipMultiplier(symbol);

  const onHandleDown = (positionId: string, target: DragTarget, startPrice: number) => (
    event: React.PointerEvent<SVGRectElement>,
  ) => {
    event.preventDefault();
    dragRef.current = { positionId, target, price: startPrice };
    setActiveDrag({ positionId, target, price: startPrice });

    const svg = svgRef.current;
    if (!svg) return;
    svg.setPointerCapture(event.pointerId);

    const onMove = (moveEvent: PointerEvent) => {
      const active = dragRef.current;
      if (!active) return;
      const rect = svg.getBoundingClientRect();
      const price = projector.priceForY(moveEvent.clientY - rect.top);
      if (price == null || !Number.isFinite(price) || price <= 0) return;

      active.price = price;
      setActiveDrag({ ...active, price });
      engine.updatePositionLevels(
        active.target === "sl"
          ? { stopLoss: price }
          : active.target === "tp"
            ? { takeProfit: price }
            : { entryPrice: price },
        active.positionId,
      );
    };

    const onUp = () => {
      dragRef.current = null;
      setActiveDrag(null);
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerup", onUp);
      svg.removeEventListener("pointercancel", onUp);
      if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    };

    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    svg.addEventListener("pointercancel", onUp);
  };

  const renderHandle = (
    y: number,
    color: string,
    positionId: string,
    target: DragTarget,
    currentLevelPrice: number,
  ) => (
    <g key={`${positionId}-${target}`}>
      <rect
        className="btm-handle"
        x={width - 74}
        y={y - 7}
        width={16}
        height={14}
        rx={3}
        fill={color}
      />
      <rect
        x={width - 88}
        y={y - 22}
        width={44}
        height={44}
        fill="transparent"
        pointerEvents="all"
        style={{ touchAction: "none", cursor: "ns-resize" }}
        onPointerDown={onHandleDown(positionId, target, currentLevelPrice)}
      />
      <line x1={width - 70} y1={y - 2.5} x2={width - 70} y2={y + 2.5} stroke="hsl(222 47% 6%)" strokeWidth={1.2} />
      <line x1={width - 66} y1={y - 2.5} x2={width - 66} y2={y + 2.5} stroke="hsl(222 47% 6%)" strokeWidth={1.2} />
    </g>
  );

  // Closed-trade connectors (entry → exit, dashed, colored by result).
  const lineMode = settings.tradeLineMode ?? "hover_or_latest";
  const latestTradeId = trades.length > 0 ? trades[trades.length - 1].id : null;

  const connectors = trades.map((trade) => {
    if (lastTime == null || trade.entryTime > lastTime) return null;
    const isHovered = hoveredTradeId === trade.id;
    const isLatest = latestTradeId === trade.id;

    if (!settings.showTradesOnChart && !isHovered) return null;

    let shouldDrawLine = false;
    if (isHovered) {
      shouldDrawLine = true;
    } else if (lineMode === "all") {
      shouldDrawLine = true;
    } else if (lineMode === "hover_or_latest" && hoveredTradeId == null && isLatest) {
      shouldDrawLine = true;
    }

    if (!shouldDrawLine) return null;

    const x1 = projector.xForTime(trade.entryTime);
    const x2 = projector.xForTime(Math.min(trade.exitTime, lastTime));
    const y1 = projector.yForPrice(trade.entryPrice);
    const y2 = projector.yForPrice(trade.exitPrice);
    if (x1 == null || x2 == null || y1 == null || y2 == null) return null;
    const color = trade.result === "win" ? GREEN : trade.result === "loss" ? RED : AMBER;

    const strokeWidth = isHovered ? 2 : 1.2;
    const opacity = isHovered ? 0.95 : isLatest && lineMode === "hover_or_latest" ? 0.6 : 0.35;
    const dashArray = isHovered ? "4 3" : "3 3";

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const pnlSign = trade.profit >= 0 ? "+" : "";
    const rSign = trade.rMultiple != null && trade.rMultiple >= 0 ? "+" : "";
    const pnlLabel = `${pnlSign}${trade.profit.toFixed(2)} €${trade.rMultiple != null ? ` (${rSign}${trade.rMultiple.toFixed(2)}R)` : ""}`;

    return (
      <g key={trade.id} className={isHovered ? "btm-hovered-trade" : undefined}>
        {isHovered && (
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeWidth={7}
            opacity={0.22}
          />
        )}
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={dashArray}
          opacity={opacity}
        />
        <circle cx={x1} cy={y1} r={isHovered ? 3.5 : 2} fill={color} opacity={opacity} />
        <circle cx={x2} cy={y2} r={isHovered ? 3.5 : 2} fill={color} opacity={opacity} />

        {isHovered && (
          <g transform={`translate(${midX}, ${midY})`}>
            <rect
              x={-60}
              y={-11}
              width={120}
              height={22}
              rx={5}
              fill="hsl(var(--background) / 0.94)"
              stroke={color}
              strokeWidth={1.2}
            />
            <text
              x={0}
              y={0}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={10}
              fontWeight={700}
              fill={color}
              fontFamily="var(--btm-mono)"
            >
              {pnlLabel}
            </text>
          </g>
        )}
      </g>
    );
  });

  // Multiple active positions layer
  const positionsLayer = positions.map((pos: OpenPosition, index: number) => {
    const posId = pos.id ?? `pos-${index}`;
    const yEntry = projector.yForPrice(pos.entryPrice);
    const yStop = projector.yForPrice(pos.stopLoss);
    const yTarget = projector.yForPrice(pos.takeProfit);
    const xStart = Math.max(0, projector.xForTime(pos.entryTime) ?? 0);
    if (yEntry == null || yStop == null || yTarget == null) return null;

    const paneW = projector.paneWidth ?? Math.max(0, width - 58);
    const boxWidth = Math.max(0, paneW - xStart);
    const rewardTop = Math.min(yEntry, yTarget);
    const rewardHeight = Math.abs(yTarget - yEntry);
    const riskTop = Math.min(yEntry, yStop);
    const riskHeight = Math.abs(yStop - yEntry);
    const rrLabel = pos.slPips > 0 ? (pos.tpPips / pos.slPips).toFixed(2) : "—";

    const isSelected = engine.selectedPositionId === posId || positions.length === 1;
    const strokeAlpha = isSelected ? 1 : 0.65;
    const posProfit = currentPrice > 0 ? unrealizedProfit(pos, currentPrice, symbol) : 0;
    const posPips = currentPrice > 0 ? positionPips(pos, currentPrice, symbol) : 0;
    const pnlSign = posProfit >= 0 ? "+" : "";
    const pnlText = `${pnlSign}${posProfit.toFixed(2)} € (${posPips >= 0 ? "+" : ""}${posPips.toFixed(1)}p)`;
    const pnlColor = posProfit >= 0 ? GREEN : RED;

    // Draggable tooltip details
    let dragTooltip: React.ReactNode = null;
    if (activeDrag && activeDrag.positionId === posId) {
      const isSl = activeDrag.target === "sl";
      const isTp = activeDrag.target === "tp";
      if (isSl || isTp) {
        const pipsDiff = Math.abs(activeDrag.price - pos.entryPrice) * pipMult;
        const projected = projectedLevelPnl(pos, activeDrag.price, symbol);
        const yPos = projector.yForPrice(activeDrag.price) ?? (isSl ? yStop : yTarget);
        const sign = isTp ? "+" : "-";
        const tooltipText = isSl && ticket.adaptRiskOnSlMove
          ? `SL ${formatPrice(activeDrag.price, symbol)} · Lotti: ${pos.lots.toFixed(2)} (${pipsDiff.toFixed(1)}p)`
          : `${isSl ? "SL" : "TP"} ${formatPrice(activeDrag.price, symbol)} · ${sign}${Math.abs(projected.money).toFixed(2)} € (${projected.rMultiple != null ? `${sign}${Math.abs(projected.rMultiple).toFixed(2)}R` : `${pipsDiff.toFixed(1)}p`})`;

        dragTooltip = (
          <g transform={`translate(${width - 190}, ${yPos - 14})`}>
            <rect
              x={0}
              y={0}
              width={160}
              height={22}
              rx={4}
              fill="hsl(var(--background) / 0.95)"
              stroke={isSl ? RED : GREEN}
              strokeWidth={1.2}
            />
            <text
              x={80}
              y={11}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={9}
              fontWeight={700}
              fill={isSl ? RED : GREEN}
              fontFamily="var(--btm-mono)"
            >
              {tooltipText}
            </text>
          </g>
        );
      }
    }

    // Interactive Action Pills placed at the entry line
    const pillX = Math.max(xStart + 160, Math.min(width - 290, xStart + 220));

    return (
      <g key={posId} onClick={() => engine.setSelectedPositionId?.(posId)}>
        {/* Risk / Reward area fills */}
        <rect x={xStart} y={rewardTop} width={boxWidth} height={rewardHeight} fill="hsl(142 71% 45% / 0.12)" />
        <rect x={xStart} y={riskTop} width={boxWidth} height={riskHeight} fill="hsl(0 84% 60% / 0.12)" />

        {/* Lines */}
        <line x1={xStart} y1={yTarget} x2={xStart + boxWidth} y2={yTarget} stroke={GREEN} strokeWidth={1.2} strokeDasharray="5 3" opacity={strokeAlpha} />
        <line x1={xStart} y1={yStop} x2={xStart + boxWidth} y2={yStop} stroke={RED} strokeWidth={1.2} strokeDasharray="5 3" opacity={strokeAlpha} />
        <line x1={xStart} y1={yEntry} x2={xStart + boxWidth} y2={yEntry} stroke={BLUE} strokeWidth={isSelected ? 1.6 : 1.2} opacity={strokeAlpha} />

        {/* Label: Position descriptor */}
        <text x={xStart + 6} y={yEntry - 6} fontSize={9.5} fontWeight={700} fill={BLUE} fontFamily="var(--btm-mono)">
          {`${pos.direction === "buy" ? "LONG" : "SHORT"} ${pos.lots.toFixed(2)} · R:R ${rrLabel}${positions.length > 1 ? ` #${index + 1}` : ""}`}
        </text>

        {/* TP / SL text labels */}
        <text
          x={xStart + 6}
          y={(pos.direction === "buy" ? yTarget : yStop) + 11}
          fontSize={9.5}
          fontWeight={700}
          fill={pos.direction === "buy" ? GREEN : RED}
          fontFamily="var(--btm-mono)"
        >
          {pos.direction === "buy"
            ? `TP ${formatPrice(pos.takeProfit, symbol)}`
            : `SL ${formatPrice(pos.stopLoss, symbol)}`}
        </text>
        <text
          x={xStart + 6}
          y={(pos.direction === "buy" ? yStop : yTarget) - 5}
          fontSize={9.5}
          fontWeight={700}
          fill={pos.direction === "buy" ? RED : GREEN}
          fontFamily="var(--btm-mono)"
        >
          {pos.direction === "buy"
            ? `SL ${formatPrice(pos.stopLoss, symbol)}`
            : `TP ${formatPrice(pos.takeProfit, symbol)}`}
        </text>

        {/* Interactive Action Pill on the Entry Line */}
        <g transform={`translate(${pillX}, ${yEntry - 12})`}>
          {/* Background container pill */}
          <rect
            x={0}
            y={0}
            width={210}
            height={24}
            rx={5}
            fill="hsl(var(--background) / 0.94)"
            stroke="hsl(var(--border) / 0.8)"
            strokeWidth={1}
            pointerEvents="none"
          />

          {/* Live P&L badge */}
          <text
            x={8}
            y={12}
            dominantBaseline="central"
            fontSize={9.5}
            fontWeight={700}
            fill={pnlColor}
            fontFamily="var(--btm-mono)"
            pointerEvents="none"
          >
            {pnlText}
          </text>

          {/* BE button */}
          <g
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              engine.moveToBreakeven(posId);
            }}
          >
            <rect x={112} y={3} width={24} height={18} rx={3} fill="hsl(222 47% 14%)" stroke="hsl(217 33% 28%)" strokeWidth={0.8} />
            <text x={124} y={12} textAnchor="middle" dominantBaseline="central" fontSize={8.5} fontWeight={700} fill="#94a3b8" fontFamily="var(--btm-mono)">
              BE
            </text>
          </g>

          {/* 50% partial button */}
          <g
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              engine.partialClose(posId, 0.5);
            }}
          >
            <rect x={140} y={3} width={30} height={18} rx={3} fill="hsl(222 47% 14%)" stroke="hsl(217 33% 28%)" strokeWidth={0.8} />
            <text x={155} y={12} textAnchor="middle" dominantBaseline="central" fontSize={8.5} fontWeight={700} fill="#94a3b8" fontFamily="var(--btm-mono)">
              50%
            </text>
          </g>

          {/* Close entire position X button */}
          <g
            style={{ cursor: "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              engine.closePositionById(posId);
            }}
          >
            <rect x={174} y={3} width={28} height={18} rx={3} fill="hsl(0 84% 60% / 0.18)" stroke="hsl(0 84% 60% / 0.45)" strokeWidth={0.8} />
            <text x={188} y={12} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={800} fill={RED}>
              ✕
            </text>
          </g>
        </g>

        {/* Draggable handles */}
        {renderHandle(yTarget, GREEN, posId, "tp", pos.takeProfit)}
        {renderHandle(yStop, RED, posId, "sl", pos.stopLoss)}
        {renderHandle(yEntry, BLUE, posId, "entry", pos.entryPrice)}

        {/* Floating tooltip during handle drag */}
        {dragTooltip}
      </g>
    );
  });

  // Multiple pending orders layer
  const pendingOrdersLayer = pendingOrders.map((order: PendingOrder) => {
    const y = projector.yForPrice(order.price);
    if (y == null) return null;
    const color = order.direction === "buy" ? GREEN : RED;
    const distPips = currentPrice > 0 ? (Math.abs(order.price - currentPrice) * pipMult).toFixed(1) : null;

    return (
      <g key={order.id ?? `${order.placedTime}-${order.price}`}>
        <line x1={0} y1={y} x2={width - 58} y2={y} stroke={color} strokeWidth={1.2} strokeDasharray="3 3" opacity={0.85} />

        {/* Order pill on the left */}
        <g transform={`translate(10, ${y - 11})`}>
          <rect
            x={0}
            y={0}
            width={200}
            height={22}
            rx={4}
            fill="hsl(var(--background) / 0.94)"
            stroke={color}
            strokeWidth={1}
            pointerEvents="none"
          />
          <text x={8} y={11} dominantBaseline="central" fontSize={9} fontWeight={700} fill={color} fontFamily="var(--btm-mono)">
            {`${order.direction.toUpperCase()} ${order.kind.toUpperCase()} ${order.lots.toFixed(2)} @ ${formatPrice(order.price, symbol)}${distPips ? ` (${distPips}p)` : ""}`}
          </text>
          {/* Cancel button */}
          <g
            style={{ cursor: "pointer" }}
            pointerEvents="all"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              engine.cancelOrder(order.id);
            }}
            onClick={(e) => {
              e.stopPropagation();
              engine.cancelOrder(order.id);
            }}
          >
            <rect x={178} y={2} width={18} height={18} rx={3} fill="hsl(0 84% 60% / 0.18)" stroke="hsl(0 84% 60% / 0.4)" strokeWidth={0.8} />
            <text x={187} y={11} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={800} fill={RED}>
              ✕
            </text>
          </g>
        </g>
      </g>
    );
  });

  const paneW = projector.paneWidth ?? Math.max(0, width - 58);
  const paneH = projector.paneHeight ?? Math.max(0, height - 26);

  return (
    <svg ref={svgRef} className="btm-posoverlay" width={width} height={height} aria-hidden="true">
      <defs>
        <clipPath id="btm-pos-pane-clip">
          <rect x={0} y={0} width={paneW} height={paneH} />
        </clipPath>
      </defs>
      <g clipPath="url(#btm-pos-pane-clip)">
        {connectors}
        {pendingOrdersLayer}
        {positionsLayer}
      </g>
    </svg>
  );
}
