// ─── Drawings overlay ────────────────────────────────────────────────────────
// SVG layer for the mockup's drawing tools: trend line, horizontal line,
// rectangle, Fibonacci retracement, ruler (pips/%/bars), long/short position
// boxes and text notes. Data-anchored (time/price via the chart projector),
// with OHLC magnet snapping. Event model: while a tool is active the svg
// captures the pointer (draft flow); in cursor mode the svg is transparent to
// events and each shape carries its own hit-area for select/drag, so chart
// pan/zoom keeps working between drawings.
import { useCallback, useEffect, useRef, useState } from "react";
import { uiText } from "@/contexts/LanguageContext";
import { getPipMultiplier } from "@/lib/pipMultiplier";
import type { DrawingPoint, ReplayDrawing } from "@/lib/replay/types";
import { formatPrice } from "./format";
import type { ChartProjector } from "./PositionOverlay";
import type { DrawingToolId } from "./toolRailModel";
import type { ReplayEngine } from "./useReplayEngine";

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS = [
  "hsl(0 84% 60%)",
  "hsl(38 92% 55%)",
  "hsl(142 71% 45%)",
  "hsl(217 91% 60%)",
  "hsl(142 71% 45%)",
  "hsl(38 92% 55%)",
  "hsl(0 84% 60%)",
];
const MAGNET_TOLERANCE_PX = 8;

type TwoPointKind = "trend" | "rect" | "fib" | "ruler";
type Draft = { kind: TwoPointKind; a: DrawingPoint; b: DrawingPoint } | null;

function makeId(): string {
  return `drw-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export function DrawingsOverlay({
  engine,
  projector,
  revision,
  activeTool,
  onToolDone,
}: {
  engine: ReplayEngine;
  projector: ChartProjector;
  revision: number;
  activeTool: DrawingToolId;
  onToolDone: () => void;
}) {
  void revision; // consumed to re-render on pan/zoom/resize
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<Draft>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState<{ at: DrawingPoint; x: number; y: number } | null>(null);

  const { drawings, setDrawings, settings, symbol, revealed, ticket } = engine;
  const { width, height } = projector;
  const toolActive = activeTool !== "cursor";

  // ── coordinate helpers ─────────────────────────────────────────────────────
  const pointAt = useCallback(
    (clientX: number, clientY: number): DrawingPoint | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const time = projector.timeForX(px);
      const price = projector.priceForY(py);
      if (time == null || price == null) return null;
      if (!settings.magnet) return { time, price };
      // Magnet: snap the price to the nearest OHLC of the bar under the cursor.
      const bar = revealed.find((candle) => candle.time === time) ?? null;
      if (!bar) return { time, price };
      let best = price;
      let bestDist = Infinity;
      for (const value of [bar.open, bar.high, bar.low, bar.close]) {
        const levelY = projector.yForPrice(value);
        if (levelY == null) continue;
        const dist = Math.abs(levelY - py);
        if (dist < bestDist) {
          bestDist = dist;
          best = value;
        }
      }
      return { time, price: bestDist <= MAGNET_TOLERANCE_PX ? best : price };
    },
    [projector, settings.magnet, revealed],
  );

  const x = (time: number) => projector.xForTime(time);
  const y = (price: number) => projector.yForPrice(price);

  // ── draft flow (tool active: svg captures the pointer) ─────────────────────
  const onSvgPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!toolActive) return;
    event.preventDefault();
    const svg = svgRef.current;
    const point = pointAt(event.clientX, event.clientY);
    if (!svg || !point) return;
    const rect = svg.getBoundingClientRect();

    if (activeTool === "hline") {
      setDrawings([
        ...drawings,
        { id: makeId(), kind: "hline", price: point.price, color: settings.toolColor, width: settings.toolWidth },
      ]);
      onToolDone();
      return;
    }
    if (activeTool === "text") {
      setTextDraft({ at: point, x: event.clientX - rect.left, y: event.clientY - rect.top });
      return;
    }
    if (activeTool === "longPosition" || activeTool === "shortPosition") {
      const direction = activeTool === "longPosition" ? "buy" : "sell";
      const pip = 1 / getPipMultiplier(symbol);
      const sign = direction === "buy" ? 1 : -1;
      setDrawings([
        ...drawings,
        {
          id: makeId(),
          kind: "position",
          direction,
          entry: point,
          slPrice: point.price - sign * Math.max(1, ticket.slPips) * pip,
          tpPrice: point.price + sign * Math.max(1, ticket.tpPips) * pip,
        },
      ]);
      onToolDone();
      return;
    }
    svg.setPointerCapture(event.pointerId);
    setDraft({ kind: activeTool as TwoPointKind, a: point, b: point });
  };

  const onSvgPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!draft) return;
    const point = pointAt(event.clientX, event.clientY);
    if (point) setDraft({ ...draft, b: point });
  };

  const onSvgPointerUp = () => {
    if (!draft) return;
    if (draft.a.time !== draft.b.time || draft.a.price !== draft.b.price) {
      const base = { id: makeId(), a: draft.a, b: draft.b };
      setDrawings([
        ...drawings,
        draft.kind === "ruler"
          ? { ...base, kind: "ruler" }
          : { ...base, kind: draft.kind, color: settings.toolColor, width: settings.toolWidth },
      ]);
    }
    setDraft(null);
    onToolDone();
  };

  // ── select + drag (cursor mode: per-shape hit areas) ───────────────────────
  const beginShapeDrag = (id: string) => (event: React.PointerEvent<SVGElement>) => {
    if (toolActive) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(id);
    let last = pointAt(event.clientX, event.clientY);
    if (!last) return;

    const onMove = (moveEvent: PointerEvent) => {
      const point = pointAt(moveEvent.clientX, moveEvent.clientY);
      if (!point || !last) return;
      const deltaTime = point.time - last.time;
      const deltaPrice = point.price - last.price;
      if (deltaTime === 0 && deltaPrice === 0) return;
      last = point;
      const shift = (value: DrawingPoint): DrawingPoint => ({
        time: value.time + deltaTime,
        price: value.price + deltaPrice,
      });
      setDrawings((current) =>
        current.map((item) => {
          if (item.id !== id) return item;
          switch (item.kind) {
            case "hline":
              return { ...item, price: item.price + deltaPrice };
            case "text":
              return { ...item, at: shift(item.at) };
            case "position":
              return {
                ...item,
                entry: shift(item.entry),
                slPrice: item.slPrice + deltaPrice,
                tpPrice: item.tpPrice + deltaPrice,
              };
            default:
              return { ...item, a: shift(item.a), b: shift(item.b) };
          }
        }),
      );
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // ── delete selected / cancel draft ─────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (draft || selectedId || textDraft)) {
        event.preventDefault();
        setDraft(null);
        setSelectedId(null);
        setTextDraft(null);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        const target = event.target;
        if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
        event.preventDefault();
        setDrawings((current) => current.filter((item) => item.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [draft, selectedId, textDraft, setDrawings]);

  // Deselect when the selected drawing disappears (clear-all).
  useEffect(() => {
    if (selectedId && !drawings.some((item) => item.id === selectedId)) setSelectedId(null);
  }, [drawings, selectedId]);

  // ── rendering ──────────────────────────────────────────────────────────────
  // Invisible fat stroke that makes thin lines clickable in cursor mode.
  const hitLine = (id: string, x1: number, y1: number, x2: number, y2: number) => (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="rgba(0,0,0,0)"
      strokeWidth={12}
      pointerEvents={toolActive ? "none" : "stroke"}
      onPointerDown={beginShapeDrag(id)}
    />
  );

  const renderShape = (item: ReplayDrawing, isDraft = false): React.ReactNode => {
    const selected = !isDraft && item.id === selectedId;
    const key = isDraft ? "draft" : item.id;
    const endpointDots = (ax: number, ay: number, bx: number, by: number) =>
      selected && (
        <>
          <circle cx={ax} cy={ay} r={4} fill="#fff" pointerEvents="none" />
          <circle cx={bx} cy={by} r={4} fill="#fff" pointerEvents="none" />
        </>
      );

    switch (item.kind) {
      case "hline": {
        const ly = y(item.price);
        if (ly == null) return null;
        return (
          <g key={key}>
            <line x1={0} y1={ly} x2={width} y2={ly} stroke={item.color} strokeWidth={item.width} strokeDasharray="6 3" pointerEvents="none" />
            <text x={4} y={ly - 4} fontSize={9.5} fontWeight={700} fill={item.color} fontFamily="var(--btm-mono)" pointerEvents="none">
              {formatPrice(item.price, symbol)}
            </text>
            {!isDraft && hitLine(item.id, 0, ly, width, ly)}
            {selected && <circle cx={width / 2} cy={ly} r={4} fill="#fff" pointerEvents="none" />}
          </g>
        );
      }
      case "text": {
        const tx = x(item.at.time);
        const ty = y(item.at.price);
        if (tx == null || ty == null) return null;
        return (
          <g key={key}>
            <text
              x={tx + 4}
              y={ty}
              fontSize={12}
              fontWeight={600}
              fill={item.color}
              pointerEvents={toolActive ? "none" : "auto"}
              onPointerDown={beginShapeDrag(item.id)}
              style={{ cursor: toolActive ? undefined : "move" }}
            >
              {item.text}
            </text>
            {selected && <circle cx={tx} cy={ty} r={4} fill="#fff" pointerEvents="none" />}
          </g>
        );
      }
      case "position": {
        const ex = x(item.entry.time);
        const ey = y(item.entry.price);
        const sy = y(item.slPrice);
        const ty = y(item.tpPrice);
        if (ex == null || ey == null || sy == null || ty == null) return null;
        const boxWidth = Math.max(30, width - 58 - ex);
        return (
          <g key={key} opacity={0.9}>
            <rect x={ex} y={Math.min(ey, ty)} width={boxWidth} height={Math.abs(ty - ey)} fill="hsl(142 71% 45% / 0.11)" pointerEvents="none" />
            <rect x={ex} y={Math.min(ey, sy)} width={boxWidth} height={Math.abs(sy - ey)} fill="hsl(0 84% 60% / 0.11)" pointerEvents="none" />
            <line x1={ex} y1={ey} x2={ex + boxWidth} y2={ey} stroke="hsl(217 91% 60%)" strokeWidth={1.2} pointerEvents="none" />
            <line x1={ex} y1={ty} x2={ex + boxWidth} y2={ty} stroke="hsl(142 71% 45%)" strokeWidth={1} strokeDasharray="5 3" pointerEvents="none" />
            <line x1={ex} y1={sy} x2={ex + boxWidth} y2={sy} stroke="hsl(0 84% 60%)" strokeWidth={1} strokeDasharray="5 3" pointerEvents="none" />
            <text x={ex + 5} y={ey - 4} fontSize={9} fontWeight={700} fill="hsl(217 91% 60%)" fontFamily="var(--btm-mono)" pointerEvents="none">
              {item.direction === "buy" ? "LONG" : "SHORT"}
            </text>
            {hitLine(item.id, ex, ey, ex + boxWidth, ey)}
            {selected && <circle cx={ex} cy={ey} r={4} fill="#fff" pointerEvents="none" />}
          </g>
        );
      }
      default: {
        const ax = x(item.a.time);
        const ay = y(item.a.price);
        const bx = x(item.b.time);
        const by = y(item.b.price);
        if (ax == null || ay == null || bx == null || by == null) return null;

        if (item.kind === "trend") {
          return (
            <g key={key}>
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke={item.color} strokeWidth={item.width} pointerEvents="none" />
              {!isDraft && hitLine(item.id, ax, ay, bx, by)}
              {endpointDots(ax, ay, bx, by)}
            </g>
          );
        }
        if (item.kind === "rect") {
          return (
            <g key={key}>
              <rect
                x={Math.min(ax, bx)}
                y={Math.min(ay, by)}
                width={Math.abs(bx - ax)}
                height={Math.abs(by - ay)}
                fill={`color-mix(in srgb, ${item.color} 10%, transparent)`}
                stroke={item.color}
                strokeWidth={item.width}
                pointerEvents={toolActive || isDraft ? "none" : "auto"}
                onPointerDown={beginShapeDrag(item.id)}
                style={{ cursor: toolActive ? undefined : "move" }}
              />
              {endpointDots(ax, ay, bx, by)}
            </g>
          );
        }
        if (item.kind === "fib") {
          const startX = Math.min(ax, bx);
          return (
            <g key={key}>
              {FIB_LEVELS.map((level, index) => {
                const levelPrice = item.a.price + (item.b.price - item.a.price) * level;
                const levelY = y(levelPrice);
                if (levelY == null) return null;
                return (
                  <g key={level} pointerEvents="none">
                    <line x1={startX} y1={levelY} x2={width - 58} y2={levelY} stroke={FIB_COLORS[index]} strokeWidth={1} opacity={0.8} />
                    <text x={startX + 2} y={levelY - 2} fontSize={8.5} fill={FIB_COLORS[index]} fontFamily="var(--btm-mono)">
                      {level.toFixed(3)}
                    </text>
                  </g>
                );
              })}
              {!isDraft && hitLine(item.id, ax, ay, bx, by)}
              {endpointDots(ax, ay, bx, by)}
            </g>
          );
        }
        // ruler
        const pips = Math.abs((item.b.price - item.a.price) * getPipMultiplier(symbol));
        const pct = item.a.price !== 0 ? ((item.b.price - item.a.price) / item.a.price) * 100 : 0;
        const bars = Math.round(Math.abs(item.b.time - item.a.time) / Math.max(1, engine.intervalSeconds));
        return (
          <g key={key}>
            <rect
              x={Math.min(ax, bx)}
              y={Math.min(ay, by)}
              width={Math.abs(bx - ax)}
              height={Math.abs(by - ay)}
              fill="hsl(217 91% 60% / 0.09)"
              pointerEvents={toolActive || isDraft ? "none" : "auto"}
              onPointerDown={beginShapeDrag(item.id)}
              style={{ cursor: toolActive ? undefined : "move" }}
            />
            <line x1={ax} y1={ay} x2={bx} y2={by} stroke="hsl(210 40% 98% / 0.7)" strokeWidth={1.2} strokeDasharray="4 3" pointerEvents="none" />
            <text
              x={(ax + bx) / 2}
              y={Math.min(ay, by) - 6}
              fontSize={10}
              fontWeight={700}
              fill="hsl(210 40% 98%)"
              textAnchor="middle"
              fontFamily="var(--btm-mono)"
              pointerEvents="none"
            >
              {uiText("backtest_terminal.ruler_label", {
                pips: pips.toFixed(1),
                pct: `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}`,
                bars,
              })}
            </text>
            {endpointDots(ax, ay, bx, by)}
          </g>
        );
      }
    }
  };

  const draftShape: ReplayDrawing | null = draft
    ? draft.kind === "ruler"
      ? { id: "draft", kind: "ruler", a: draft.a, b: draft.b }
      : { id: "draft", kind: draft.kind, a: draft.a, b: draft.b, color: settings.toolColor, width: settings.toolWidth }
    : null;

  return (
    <>
      <svg
        ref={svgRef}
        className="btm-drawoverlay"
        width={width}
        height={height}
        onPointerDown={onSvgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={onSvgPointerUp}
        role="presentation"
        style={{ pointerEvents: toolActive ? "auto" : "none", cursor: toolActive ? "crosshair" : undefined }}
      >
        {drawings.map((item) => renderShape(item))}
        {draftShape && renderShape(draftShape, true)}
      </svg>
      {textDraft && (
        <input
          className="btm-input"
          style={{ position: "absolute", left: textDraft.x, top: textDraft.y, width: 160, zIndex: 7 }}
          autoFocus
          aria-label={uiText("backtest_terminal.tool_text")}
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (value) {
              setDrawings([
                ...drawings,
                { id: makeId(), kind: "text", at: textDraft.at, text: value, color: settings.toolColor },
              ]);
            }
            setTextDraft(null);
            onToolDone();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") (event.target as HTMLInputElement).blur();
            if (event.key === "Escape") {
              event.preventDefault();
              setTextDraft(null);
              onToolDone();
            }
          }}
        />
      )}
    </>
  );
}
