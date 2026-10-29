// ─── Drawings overlay ────────────────────────────────────────────────────────
// Interactive SVG layer for all TradingView-style drawing tools:
// arrowUp, path, arrowDown, shortPosition, longPosition, rect, arrow, text,
// frvp (Fixed Range Volume Profile), highlighter, trend, ray, hray, hline,
// vline, fib, ruler.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Trash2,
  X,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  List,
  Undo2,
  Redo2,
  ArrowRightFromLine,
  Minus,
  Settings2,
  HelpCircle,
  GripVertical,
  Zap,
  Bell,
  Clock,
} from "lucide-react";
import { uiText, useLanguage } from "@/contexts/LanguageContext";
import { getPipMultiplier } from "@/lib/pipMultiplier";
import { computeLots, pipValuePerLot, riskAmountFor } from "@/lib/replay/lotSizing";
import { analyzeInstitutionalLiquidity } from "@/lib/chart/liquidityEngine";
import { analyzeWyckoffStructure } from "@/lib/chart/wyckoffEngine";
import type { DrawingPoint, ReplayDrawing } from "@/lib/replay/types";
import {
  computeAnchoredVwap,
  computeFixedRangeVolumeProfile,
  DEFAULT_FIB_LEVELS,
  DrawingHistory,
  isDrawingVisibleOnInterval,
  moveDrawing,
  resizeDrawing,
  type DrawingHandle,
} from "@/lib/replay/drawingWorkspace";
import { DrawingPropertiesModal, TOOL_TITLES } from "./DrawingPropertiesModal";
import "./drawings-workspace.css";
import { formatPrice } from "./format";
import type { ChartProjector } from "./PositionOverlay";
import type { DrawingToolId } from "./toolRailModel";
import type { ReplayEngine } from "./useReplayEngine";

const DRAWING_COPY: Record<string, string> = {
  "Drawing workspace": "Strumenti da disegno",
  "Undo drawing change": "Annulla modifica disegno",
  "Redo drawing change": "Ripristina modifica disegno",
  "Drawing objects": "Elenco disegni",
  "No drawings": "Nessun disegno",
  "Show drawing": "Mostra disegno",
  "Hide drawing": "Nascondi disegno",
  "Unlock drawing": "Sblocca disegno",
  "Lock drawing": "Blocca disegno",
  "Delete drawing": "Elimina disegno",
  "Duplicate drawing": "Duplica disegno",
  "Drawing properties": "Proprietà del disegno",
  "First anchor": "Primo punto",
  "Second anchor": "Secondo punto",
  "Resize corner": "Ridimensiona angolo",
  "Resize duration": "Ridimensiona durata",
  "Move horizontal line": "Sposta linea orizzontale",
  "Move vertical line": "Sposta linea verticale",
  "Move text": "Sposta testo",
  "Move marker": "Sposta segnale",
  "Path vertex": "Vertice percorso",
  "Entry": "Ingresso",
  "Stop loss": "Stop loss",
  "Take profit": "Take profit",
  "Line style": "Stile linea",
  "Solid": "Continuo",
  "Dashed": "Tratteggiato",
  "Dotted": "Punteggiato",
  "Custom drawing color": "Colore personalizzato del disegno",
  "Fill": "Riempimento",
  "Fill opacity": "Opacità riempimento",
  "Drawing text": "Testo del disegno",
  "Text size": "Dimensione testo",
  "Midline 50%": "Linea 50%",
  "Extend right": "Estendi a destra",
  "Click start and end, or drag · Esc to cancel": "Seleziona inizio e fine, oppure trascina · Esc per annullare",
  "Click points to build path · Double-click or Enter to finish · Esc to cancel":
    "Clicca i punti del percorso · Doppio clic o Invio per terminare · Esc per annullare",
  "Drag on chart to highlight · Esc to cancel": "Trascina sul grafico per evidenziare · Esc per annullare",
  "trend": "Linea di tendenza",
  "ray": "Semiretta",
  "infoline": "Infolinea",
  "hray": "Semiretta orizzontale",
  "arrow": "Freccia",
  "arrowUp": "Freccia su",
  "arrowDown": "Freccia giù",
  "path": "Percorso",
  "highlighter": "Evidenziatore",
  "frvp": "Profilo Volume (FRVP)",
  "avwap": "VWAP Ancorato",
  "parallelChannel": "Canale parallelo",
  "hline": "Linea orizzontale",
  "vline": "Linea verticale",
  "rect": "Rettangolo",
  "fib": "Fibonacci",
  "ruler": "Righello",
  "priceRange": "Range prezzo",
  "dateRange": "Range data",
  "position": "Posizione",
  "text": "Testo",
  "callout": "Nota ancorata",
};

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const MAGNET_TOLERANCE_PX = 8;
const QUICK_PALETTE = ["#26a69a", "#ef5350", "#3b82f6", "#f59e0b", "#8b5cf6", "#ffffff", "#b7a875", "#ec4899"];

type TwoPointKind =
  | "trend"
  | "ray"
  | "infoline"
  | "parallelChannel"
  | "arrow"
  | "rect"
  | "fib"
  | "ruler"
  | "priceRange"
  | "dateRange"
  | "frvp";
type Draft = { kind: TwoPointKind; a: DrawingPoint; b: DrawingPoint } | null;

function makeId(): string {
  return `drw-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function findCandleByTime(
  candles: readonly { time: number; open: number; high: number; low: number; close: number }[],
  time: number,
) {
  let low = 0;
  let high = candles.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const c = candles[mid];
    if (c.time === time) return c;
    if (c.time < time) low = mid + 1;
    else high = mid - 1;
  }
  return null;
}

export const DrawingsOverlay = memo(function DrawingsOverlay({
  engine,
  projector,
  revision,
  activeTool,
  onToolDone,
  onOpenKnowledge,
  onAddAlert,
  externalContextMenu,
  onClearExternalContextMenu,
  onSeekToTime,
}: {
  engine: ReplayEngine;
  projector: ChartProjector;
  revision: number;
  activeTool: DrawingToolId;
  onToolDone: () => void;
  onOpenKnowledge?: (tool: DrawingToolId) => void;
  onAddAlert?: (price: number) => void;
  externalContextMenu?: { x: number; y: number; price: number; time?: number } | null;
  onClearExternalContextMenu?: () => void;
  onSeekToTime?: (time: number) => void;
}) {
  const { language } = useLanguage();
  const copy = (english: string) => (language === "it" ? DRAWING_COPY[english] ?? english : english);
  void revision; // consumed to re-render on pan/zoom/resize
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<Draft>(null);
  const [pathDraft, setPathDraft] = useState<DrawingPoint[] | null>(null);
  const [highlighterDraft, setHighlighterDraft] = useState<DrawingPoint[] | null>(null);
  const [hoverSnap, setHoverSnap] = useState<{ point: DrawingPoint; snapped: boolean } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [propertiesDrawingId, setPropertiesDrawingId] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState<{ at: DrawingPoint; x: number; y: number; kind?: "text" | "callout" } | null>(null);

  const { drawings, setDrawings: engineSetDrawings, settings, symbol, revealed, ticket, setTicket } = engine;
  const hasPositionDrawing = useMemo(
    () => drawings.some((d) => d.kind === "position") || activeTool === "longPosition" || activeTool === "shortPosition",
    [drawings, activeTool],
  );
  const positionStructuralKey = hasPositionDrawing
    ? `${revealed.length}:${revealed[0]?.time ?? 0}:${revealed[revealed.length - 1]?.time ?? 0}`
    : "none";
  const memoizedLiqSnapshot = useMemo(
    () => (hasPositionDrawing ? analyzeInstitutionalLiquidity(revealed) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [positionStructuralKey],
  );
  const memoizedWyckoffSnap = useMemo(
    () => (hasPositionDrawing ? analyzeWyckoffStructure(revealed) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [positionStructuralKey],
  );
  const [activeDragItem, setActiveDragItem] = useState<{ id: string; drawing: ReplayDrawing } | null>(null);
  const [objectsOpen, setObjectsOpen] = useState(false);
  const [, refreshHistory] = useState(0);
  const history = useRef(new DrawingHistory());
  const currentDrawings = useRef(drawings);
  const observedDrawings = useRef(drawings);
  const gesture = useRef<{ before: ReplayDrawing[]; cleanup: () => void } | null>(null);
  const draftRef = useRef<Draft>(null);
  const pathDraftRef = useRef<DrawingPoint[] | null>(null);
  const highlighterDraftRef = useRef<DrawingPoint[] | null>(null);
  const textCancelled = useRef(false);
  const draftPointer = useRef<{ x: number; y: number; id: number } | null>(null);
  currentDrawings.current = drawings;

  const setCurrentDraft = (value: Draft) => {
    draftRef.current = value;
    setDraft(value);
  };
  const setCurrentPathDraft = (value: DrawingPoint[] | null) => {
    pathDraftRef.current = value;
    setPathDraft(value);
  };
  const setCurrentHighlighterDraft = (value: DrawingPoint[] | null) => {
    highlighterDraftRef.current = value;
    setHighlighterDraft(value);
  };

  const finishTool = useCallback(() => {
    if (!settings.stayInDrawingMode) onToolDone();
  }, [settings.stayInDrawingMode, onToolDone]);

  const setDrawings: typeof engineSetDrawings = (update) => {
    const before = currentDrawings.current;
    const after = typeof update === "function" ? update(before) : update;
    history.current.record(before, after);
    currentDrawings.current = observedDrawings.current = after;
    engineSetDrawings(after);
    refreshHistory((value) => value + 1);
  };


  const selectedDrawing = drawings.find((d) => d.id === selectedId);
  const propertiesDrawing = drawings.find((d) => d.id === propertiesDrawingId) ?? null;

  const updateDrawing = (patch: Record<string, unknown>) => {
    setDrawings((current) =>
      current.map((d) => (d.id === selectedId ? ({ ...d, ...patch } as ReplayDrawing) : d)),
    );
  };

  const duplicateDrawing = () => {
    if (!selectedDrawing) return;
    const nextId = makeId();
    const unlocked = { ...selectedDrawing, locked: false, hidden: false } as ReplayDrawing;
    const shifted = moveDrawing(unlocked, engine.intervalSeconds, 10 / getPipMultiplier(symbol));
    setDrawings([...drawings, { ...shifted, id: nextId }]);
    setSelectedId(nextId);
  };

  const deleteDrawing = () => {
    setDrawings((current) => current.filter((d) => d.id !== selectedId));
    setSelectedId(null);
  };

  const [contextMenu, setContextMenu] = useState<{
    type: "drawing" | "canvas";
    drawingId?: string;
    x: number;
    y: number;
    price?: number;
    time?: number;
  } | null>(null);

  // Sync external context menu triggered from ReplayChart container
  useEffect(() => {
    if (externalContextMenu) {
      setContextMenu({
        type: "canvas",
        x: externalContextMenu.x,
        y: externalContextMenu.y,
        price: externalContextMenu.price,
        time: externalContextMenu.time,
      });
    }
  }, [externalContextMenu]);
  const copiedDrawingRef = useRef<ReplayDrawing | null>(null);
  const contextDrawing = drawings.find((d) => d.id === contextMenu?.drawingId) ?? selectedDrawing;

  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("limen_properties_toolbar_position");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === "number" && typeof parsed.y === "number") {
            return parsed;
          }
        }
      } catch {
        // fallback
      }
    }
    return { x: Math.max(16, Math.floor((typeof window !== "undefined" ? window.innerWidth : 800) / 2 - 200)), y: 52 };
  });
  const toolbarDragRef = useRef<{ id: number; startX: number; startY: number; initX: number; initY: number } | null>(null);
  const [sealedSetupIds, setSealedSetupIds] = useState<Record<string, boolean>>({});

  const handleToolbarGripPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    toolbarDragRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initX: toolbarPos.x,
      initY: toolbarPos.y,
    };
  };

  const handleToolbarGripPointerMove = (event: React.PointerEvent) => {
    const cur = toolbarDragRef.current;
    if (!cur || cur.id !== event.pointerId) return;
    const dx = event.clientX - cur.startX;
    const dy = event.clientY - cur.startY;
    const parentW = typeof window !== "undefined" ? window.innerWidth : 1200;
    const parentH = typeof window !== "undefined" ? window.innerHeight : 800;
    const nextX = Math.max(10, Math.min(parentW - 320, cur.initX + dx));
    const nextY = Math.max(45, Math.min(parentH - 70, cur.initY + dy));
    setToolbarPos({ x: nextX, y: nextY });
  };

  const handleToolbarGripPointerUp = (event: React.PointerEvent) => {
    const cur = toolbarDragRef.current;
    if (!cur || cur.id !== event.pointerId) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}
    toolbarDragRef.current = null;
    try {
      localStorage.setItem("limen_properties_toolbar_position", JSON.stringify(toolbarPos));
    } catch {}
  };

  const handleDrawingContextMenu = (e: React.MouseEvent, id: string) => {
    if (toolActive) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(id);
    setContextMenu({
      type: "drawing",
      drawingId: id,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    if (toolActive) return;
    e.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    const relX = rect ? e.clientX - rect.left : e.clientX;
    const relY = rect ? e.clientY - rect.top : e.clientY;
    const price = projector.priceForY(relY);
    const time = projector.timeForX(relX);
    setContextMenu({
      type: "canvas",
      x: e.clientX,
      y: e.clientY,
      price: price != null && Number.isFinite(price) ? price : undefined,
      time: typeof time === "number" ? time : undefined,
    });
  };

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => {
      setContextMenu(null);
      onClearExternalContextMenu?.();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("wheel", close, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("wheel", close);
    };
  }, [contextMenu, onClearExternalContextMenu]);

  useEffect(() => {
    if (!gesture.current && observedDrawings.current !== drawings) {
      history.current.record(observedDrawings.current, drawings);
      observedDrawings.current = drawings;
      refreshHistory((value) => value + 1);
    }
  }, [drawings]);

  const restoreHistory = (redo = false) => {
    if (gesture.current) return;
    const next = redo ? history.current.redo(currentDrawings.current) : history.current.undo(currentDrawings.current);
    currentDrawings.current = observedDrawings.current = next;
    engineSetDrawings(next);
    refreshHistory((value) => value + 1);
  };

  const { width, height } = projector;
  const toolActive = activeTool !== "cursor";

  // ── coordinate helpers ─────────────────────────────────────────────────────
  const resolvePointAt = useCallback(
    (clientX: number, clientY: number): { point: DrawingPoint; snapped: boolean } | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const time = projector.timeForX(px);
      const price = projector.priceForY(py);
      if (time == null || price == null) return null;
      if (!settings.magnet || activeTool === "highlighter") return { point: { time, price }, snapped: false };
      // Magnet: snap the price to the nearest OHLC of the bar under the cursor.
      const bar = findCandleByTime(revealed, time);
      if (!bar) return { point: { time, price }, snapped: false };
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
      const snapped = bestDist <= MAGNET_TOLERANCE_PX;
      return { point: { time, price: snapped ? best : price }, snapped };
    },
    [projector, settings.magnet, revealed, activeTool],
  );

  const pointAt = useCallback(
    (clientX: number, clientY: number): DrawingPoint | null => resolvePointAt(clientX, clientY)?.point ?? null,
    [resolvePointAt],
  );

  const x = (time: number) => projector.xForTime(time);
  const y = (price: number) => projector.yForPrice(price);

  const commitPathDraft = useCallback(
    (points: DrawingPoint[]) => {
      const unique: DrawingPoint[] = [];
      for (const pt of points) {
        const prev = unique[unique.length - 1];
        if (!prev || prev.time !== pt.time || prev.price !== pt.price) unique.push(pt);
      }
      setCurrentPathDraft(null);
      draftPointer.current = null;
      if (unique.length >= 2) {
        setDrawings((current) => [
          ...current,
          { id: makeId(), kind: "path", points: unique, color: settings.toolColor, width: settings.toolWidth },
        ]);
        finishTool();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.toolColor, settings.toolWidth, finishTool],
  );

  // ── draft flow (tool active: svg captures the pointer) ─────────────────────
  const onSvgPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (engine.pickingOrderPrice) {
      event.preventDefault();
      event.stopPropagation();
      const point = pointAt(event.clientX, event.clientY);
      if (point) {
        engine.setPickedPrice?.(point.price);
        engine.setPickingOrderPrice?.(false);
      }
      return;
    }
    if (!toolActive) {
      if (selectedId) setSelectedId(null);
      return;
    }
    if (event.button !== 0 || (draftPointer.current && draftPointer.current.id !== event.pointerId)) return;
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
      finishTool();
      return;
    }
    if (activeTool === "vline") {
      setDrawings([
        ...drawings,
        { id: makeId(), kind: "vline", time: point.time, color: settings.toolColor, width: settings.toolWidth },
      ]);
      finishTool();
      return;
    }
    if (activeTool === "hray") {
      setDrawings([
        ...drawings,
        { id: makeId(), kind: "hray", at: point, color: settings.toolColor, width: settings.toolWidth },
      ]);
      finishTool();
      return;
    }
    if (activeTool === "arrowUp" || activeTool === "arrowDown") {
      const markerColor = activeTool === "arrowUp" ? (settings.candleUpColor ?? "#26a69a") : (settings.candleDownColor ?? "#ef5350");
      setDrawings([
        ...drawings,
        { id: makeId(), kind: activeTool, at: point, color: markerColor, width: settings.toolWidth },
      ]);
      finishTool();
      return;
    }
    if (activeTool === "avwap") {
      setDrawings([
        ...drawings,
        {
          id: makeId(),
          kind: "avwap",
          at: point,
          color: settings.toolColor || "#f59e0b",
          width: Math.max(2, settings.toolWidth),
          showBands: true,
          bandMultiplier: 1,
          fillOpacity: 0.1,
        },
      ]);
      finishTool();
      return;
    }
    if (activeTool === "text" || activeTool === "callout") {
      textCancelled.current = false;
      setTextDraft({ at: point, x: event.clientX - rect.left, y: event.clientY - rect.top, kind: activeTool });
      return;
    }
    if (activeTool === "longPosition" || activeTool === "shortPosition") {
      const direction = activeTool === "longPosition" ? "buy" : "sell";
      const multiplier = getPipMultiplier(symbol);
      const pip = 1 / multiplier;
      const sign = direction === "buy" ? 1 : -1;

      // Adapt to recent candle range on any symbol (Forex, Crypto, Gold, Indices)
      const revealed = engine.revealed ?? [];
      const recentBars = revealed.slice(-20);
      let avgBarRange = 0;
      if (recentBars.length > 0) {
        avgBarRange = recentBars.reduce((sum, b) => sum + Math.abs(b.high - b.low), 0) / recentBars.length;
      }
      if (!avgBarRange || avgBarRange <= 0) {
        avgBarRange = point.price * 0.003;
      }

      // Default SL distance: 1.5x average candle volatility, or ticket distance, ensuring grabbable handles
      const minDistance = avgBarRange * 1.5;
      const ticketDistance = (ticket.slPips > 0 ? ticket.slPips : 25) * pip;
      const slDist = Math.max(minDistance, ticketDistance);
      // Strict 1:3 minimum Risk/Reward ratio as requested
      const tpDist = slDist * 3;

      const slPrice = point.price - sign * slDist;
      const tpPrice = point.price + sign * tpDist;
      const newSlPips = Math.round(slDist * multiplier * 10) / 10;
      const newTpPips = Math.round(tpDist * multiplier * 10) / 10;

      // Synchronize ticket inputs so ticket reflects market-adapted 1:3 R:R
      setTicket?.({ ...ticket, slPips: newSlPips, tpPips: newTpPips });

      setDrawings([
        ...drawings,
        {
          id: makeId(),
          kind: "position",
          direction,
          entry: point,
          endTime: point.time + Math.max(1, engine.intervalSeconds) * 20,
          slPrice,
          tpPrice,
        },
      ]);
      finishTool();
      return;
    }
    if (activeTool === "path") {
      const current = pathDraftRef.current;
      if (!current) {
        setCurrentPathDraft([point, point]);
        return;
      }
      // Check if clicking near the last committed vertex (or double-click) to finish
      const committed = current.slice(0, -1);
      const lastCommitted = committed[committed.length - 1];
      const lx = x(lastCommitted.time);
      const ly = y(lastCommitted.price);
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      if (event.detail >= 2 || (lx != null && ly != null && Math.hypot(px - lx, py - ly) <= 8 && committed.length >= 2)) {
        commitPathDraft(committed);
        return;
      }
      setCurrentPathDraft([...committed, point, point]);
      return;
    }
    if (activeTool === "highlighter") {
      svg.setPointerCapture(event.pointerId);
      draftPointer.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
      setCurrentHighlighterDraft([point]);
      return;
    }
    if (draftRef.current) {
      completeDraft({ ...draftRef.current, b: point });
      return;
    }
    svg.setPointerCapture(event.pointerId);
    draftPointer.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    setCurrentDraft({ kind: activeTool as TwoPointKind, a: point, b: point });
  };

  const completeDraft = (value: NonNullable<Draft>) => {
    if (value.a.time === value.b.time && value.a.price === value.b.price) {
      setCurrentDraft(null);
      draftPointer.current = null;
      return;
    }
    const base = { id: makeId(), a: value.a, b: value.b };
    setDrawings((current) => {
      if (value.kind === "ruler") {
        return [...current, { ...base, kind: "ruler" }];
      }
      if (value.kind === "parallelChannel") {
        const defaultOffset =
          Math.abs(value.b.price - value.a.price) > 0
            ? -(value.b.price - value.a.price) * 0.55
            : value.a.price * 0.0025;
        return [
          ...current,
          {
            ...base,
            kind: "parallelChannel",
            priceOffset: defaultOffset,
            color: settings.toolColor,
            width: settings.toolWidth,
            fillOpacity: 0.12,
            showMidline: true,
          },
        ];
      }
      return [
        ...current,
        { ...base, kind: value.kind, color: settings.toolColor, width: settings.toolWidth },
      ];
    });
    setCurrentDraft(null);
    draftPointer.current = null;
    finishTool();
  };

  const onSvgPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const resolved = resolvePointAt(event.clientX, event.clientY);
    if (toolActive) setHoverSnap(resolved);
    const point = resolved?.point ?? null;
    if (!point) return;

    if (highlighterDraftRef.current && draftPointer.current?.id === event.pointerId) {
      const pts = highlighterDraftRef.current;
      const last = pts[pts.length - 1];
      const lx = x(last.time);
      const ly = y(last.price);
      const px = x(point.time);
      const py = y(point.price);
      if (lx == null || ly == null || px == null || py == null || Math.hypot(px - lx, py - ly) >= 3) {
        setCurrentHighlighterDraft([...pts, point]);
      }
      return;
    }
    if (pathDraftRef.current) {
      const pts = pathDraftRef.current;
      setCurrentPathDraft([...pts.slice(0, -1), point]);
      return;
    }
    if (!draftRef.current || (draftPointer.current && draftPointer.current.id !== event.pointerId)) return;
    setCurrentDraft({ ...draftRef.current, b: point });
  };

  const onSvgPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const start = draftPointer.current;
    if (!start || start.id !== event.pointerId) return;
    const point = pointAt(event.clientX, event.clientY);
    if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
    draftPointer.current = null;

    if (highlighterDraftRef.current) {
      const pts = point ? [...highlighterDraftRef.current, point] : highlighterDraftRef.current;
      setCurrentHighlighterDraft(null);
      if (pts.length >= 2) {
        setDrawings((current) => [
          ...current,
          {
            id: makeId(),
            kind: "highlighter",
            points: pts,
            color: settings.toolColor,
            width: Math.max(14, settings.toolWidth * 8),
            fillOpacity: 0.32,
          },
        ]);
        finishTool();
      }
      return;
    }

    if (!draftRef.current) return;
    // A click retains its anchor for a second click. A deliberate drag commits.
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 4 && point) {
      completeDraft({ ...draftRef.current, b: point });
    }
  };

  const cancelGesture = () => {
    setActiveDragItem(null);
    const active = gesture.current;
    if (active) {
      active.cleanup();
      currentDrawings.current = observedDrawings.current = active.before;
      engineSetDrawings(active.before);
      gesture.current = null;
    }
    const pointer = draftPointer.current;
    if (pointer && svgRef.current?.hasPointerCapture(pointer.id)) svgRef.current.releasePointerCapture(pointer.id);
    setCurrentDraft(null);
    setCurrentPathDraft(null);
    setCurrentHighlighterDraft(null);
    draftPointer.current = null;
  };

  useEffect(() => {
    setCurrentDraft(null);
    setCurrentPathDraft(null);
    setCurrentHighlighterDraft(null);
    setHoverSnap(null);
    draftPointer.current = null;
  }, [activeTool]);

  useEffect(() => () => { gesture.current?.cleanup(); }, []);

  // ── select, move and resize: one immutable transaction per gesture (rAF-throttled 120 FPS) ──
  const beginShapeDrag = (id: string, handle?: DrawingHandle) => (event: React.PointerEvent<SVGElement>) => {
    if (toolActive || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(id);
    const original = currentDrawings.current.find((item) => item.id === id);
    const start = pointAt(event.clientX, event.clientY);
    if (!start || !original || original.locked) return;
    const before = currentDrawings.current;
    const pointerId = event.pointerId;

    // Pre-calcola candidati snap liquidità ONCE all'inizio del drag (zero ricalcoli nel loop 120 FPS)
    const snapCandidates: number[] = [];
    if (original.kind === "position" && (handle === "tp" || handle === "sl" || handle === "entry") && revealed && revealed.length > 0) {
      const recent = revealed.slice(-48);
      snapCandidates.push(Math.max(...recent.map((b) => b.high)));
      snapCandidates.push(Math.min(...recent.map((b) => b.low)));
      try {
        const liqPools = analyzeInstitutionalLiquidity(revealed).levels.map((l) => l.price);
        snapCandidates.push(...liqPools);
      } catch {}
    }

    let moveRaf: number | null = null;
    let pendingMoveEvent: PointerEvent | null = null;
    let currentTransformed = original;

    const applyMove = () => {
      moveRaf = null;
      if (!pendingMoveEvent) return;
      const rawPoint = pointAt(pendingMoveEvent.clientX, pendingMoveEvent.clientY);
      if (!rawPoint) return;

      let point = rawPoint;
      if (snapCandidates.length > 0) {
        const targetY = projector.yForPrice(rawPoint.price);
        if (targetY != null) {
          let snappedPrice = rawPoint.price;
          let minPxDist = 9; // Tolleranza magnetica 9px
          for (const candidate of snapCandidates) {
            const candY = projector.yForPrice(candidate);
            if (candY != null && Math.abs(candY - targetY) <= minPxDist) {
              minPxDist = Math.abs(candY - targetY);
              snappedPrice = candidate;
            }
          }
          point = { ...rawPoint, price: snappedPrice };
        }
      }

      const next = handle
        ? resizeDrawing(original, handle, point)
        : moveDrawing(original, point.time - start.time, point.price - start.price);
      currentTransformed = next;
      setActiveDragItem({ id, drawing: next });
    };

    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      pendingMoveEvent = moveEvent;
      if (moveRaf == null) {
        moveRaf = requestAnimationFrame(applyMove);
      }
    };

    const cleanup = () => {
      if (moveRaf != null) {
        cancelAnimationFrame(moveRaf);
        moveRaf = null;
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("blur", onCancel);
    };

    const onUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      cleanup();
      setActiveDragItem(null);
      // Calcola punto finale e consolida in un'unica transazione atomica (salva su storage e dispatch sync)
      const rawPoint = pointAt(upEvent.clientX, upEvent.clientY);
      let point = rawPoint ?? start;
      if (rawPoint && snapCandidates.length > 0) {
        const targetY = projector.yForPrice(rawPoint.price);
        if (targetY != null) {
          let snappedPrice = rawPoint.price;
          let minPxDist = 9;
          for (const candidate of snapCandidates) {
            const candY = projector.yForPrice(candidate);
            if (candY != null && Math.abs(candY - targetY) <= minPxDist) {
              minPxDist = Math.abs(candY - targetY);
              snappedPrice = candidate;
            }
          }
          point = { ...rawPoint, price: snappedPrice };
        }
      }
      const finalNext = handle
        ? resizeDrawing(original, handle, point)
        : moveDrawing(original, point.time - start.time, point.price - start.price);
      const after = before.map((item) => (item.id === id ? finalNext : item));
      setDrawings(after);
      gesture.current = null;
    };

    const onCancel = () => {
      cleanup();
      setActiveDragItem(null);
      cancelGesture();
    };

    gesture.current = { before, cleanup };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("blur", onCancel);
  };

  // ── keyboard shortcuts (Escape, Enter for Path, Undo/Redo, Delete) ─────────
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const editing =
        target instanceof HTMLElement &&
        Boolean(target.closest("input, textarea, select, [contenteditable=true], [role=textbox]"));
      if (event.key === "Enter" && pathDraftRef.current && !editing) {
        event.preventDefault();
        event.stopPropagation();
        commitPathDraft(pathDraftRef.current.slice(0, -1));
        return;
      }
      if (
        event.key === "Escape" &&
        (draft || pathDraft || highlighterDraft || selectedId || textDraft || gesture.current || toolActive || contextMenu)
      ) {
        event.preventDefault();
        event.stopPropagation();
        if (contextMenu) setContextMenu(null);
        textCancelled.current = true;
        cancelGesture();
        onToolDone();
        setSelectedId(null);
        setTextDraft(null);
        return;
      }
      if (editing) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && selectedId) {
        event.preventDefault();
        event.stopPropagation();
        duplicateDrawing();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c" && selectedDrawing) {
        event.preventDefault();
        event.stopPropagation();
        copiedDrawingRef.current = selectedDrawing;
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v" && copiedDrawingRef.current) {
        event.preventDefault();
        event.stopPropagation();
        const nextId = makeId();
        const unlocked = { ...copiedDrawingRef.current, locked: false, hidden: false } as ReplayDrawing;
        const shifted = moveDrawing(unlocked, engine.intervalSeconds * 2, 10 / getPipMultiplier(symbol));
        setDrawings([...drawings, { ...shifted, id: nextId }]);
        setSelectedId(nextId);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === "z" || event.key.toLowerCase() === "y")) {
        event.preventDefault();
        event.stopPropagation();
        restoreHistory(event.shiftKey || event.key.toLowerCase() === "y");
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
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [draft, pathDraft, highlighterDraft, selectedId, textDraft, toolActive, onToolDone, contextMenu, drawings, symbol, engine.intervalSeconds, selectedDrawing]);

  useEffect(() => {
    if (selectedId && !drawings.some((item) => item.id === selectedId)) setSelectedId(null);
  }, [drawings, selectedId]);

  const openDrawingProperties = (id: string) => (event: React.MouseEvent<SVGElement>) => {
    if (toolActive) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(id);
    setPropertiesDrawingId(id);
  };

  // ── rendering ──────────────────────────────────────────────────────────────
  const hitLine = (id: string, x1: number, y1: number, x2: number, y2: number, keySuffix?: string | number) => (
    <line
      key={keySuffix}
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="rgba(0,0,0,0)"
      strokeWidth={14}
      pointerEvents={toolActive ? "none" : "stroke"}
      onPointerDown={beginShapeDrag(id)}
      onDoubleClick={openDrawingProperties(id)}
      onContextMenu={(e) => handleDrawingContextMenu(e, id)}
      style={{ cursor: toolActive ? undefined : "move" }}
    />
  );

  const renderShape = (item: ReplayDrawing, isDraft = false): React.ReactNode => {
    if (item.hidden && !isDraft) return null;
    if (!isDraft && !isDrawingVisibleOnInterval(item, engine.intervalSeconds)) return null;
    const selected = !isDraft && item.id === selectedId;
    const key = isDraft ? "draft" : item.id;
    const handleDot = (hx: number, hy: number, handle: DrawingHandle, label: string, customColor?: string) => {
      if (!selected || item.locked) return null;
      const cursor =
        handle === "tp" || handle === "sl"
          ? "ns-resize"
          : handle === "entry"
          ? "row-resize"
          : handle === "end"
          ? "ew-resize"
          : "crosshair";
      const strokeColor =
        customColor ??
        (handle === "tp"
          ? "#10b981"
          : handle === "sl"
          ? "#ef4444"
          : handle === "entry"
          ? "#3b82f6"
          : handle === "end"
          ? "#C5A059"
          : "#2563eb");
      return (
        <g
          key={handle}
          className="btm-drawing-handle"
          role="button"
          aria-label={copy(label)}
          pointerEvents={toolActive ? "none" : "all"}
          onPointerDown={beginShapeDrag(item.id, handle)}
          style={{ cursor }}
        >
          <title>{copy(label)}</title>
          <circle cx={hx} cy={hy} r={14} fill="transparent" style={{ cursor }} />
          <circle cx={hx} cy={hy} r={5} fill="#ffffff" stroke={strokeColor} strokeWidth={2} style={{ cursor }} />
        </g>
      );
    };
    const endpointDots = (ax: number, ay: number, bx: number, by: number) => (
      <>
        {handleDot(ax, ay, "a", "First anchor")}
        {handleDot(bx, by, "b", "Second anchor")}
        {(item.kind === "rect" || item.kind === "frvp") && (
          <>
            {handleDot(ax, by, "ab", "Resize corner")}
            {handleDot(bx, ay, "ba", "Resize corner")}
          </>
        )}
      </>
    );
    const dash =
      "style" in item && item.style === "dotted"
        ? "2 4"
        : "style" in item && item.style === "dashed"
          ? "6 3"
          : undefined;

    const maxW = projector.paneWidth ?? width;
    const maxH = projector.paneHeight ?? height;

    switch (item.kind) {
      case "hline": {
        const ly = y(item.price);
        if (ly == null) return null;
        return (
          <g key={key}>
            <line x1={0} y1={ly} x2={maxW} y2={ly} stroke={item.color} strokeWidth={item.width} strokeDasharray={dash} pointerEvents="none" />
            <text x={8} y={ly - 5} fontSize={9.5} fontWeight={700} fill={item.color} fontFamily="var(--btm-mono)" pointerEvents="none">
              {item.text ? `${item.text} · ` : ""}{formatPrice(item.price, symbol)}
            </text>
            {!isDraft && hitLine(item.id, 0, ly, maxW, ly)}
            {handleDot(maxW / 2, ly, "anchor", "Move horizontal line")}
          </g>
        );
      }
      case "hray": {
        const rx = x(item.at.time);
        const ry = y(item.at.price);
        if (rx == null || ry == null) return null;
        return (
          <g key={key}>
            <line x1={rx} y1={ry} x2={maxW} y2={ry} stroke={item.color} strokeWidth={item.width} strokeDasharray={dash} pointerEvents="none" />
            <circle cx={rx} cy={ry} r={3} fill={item.color} pointerEvents="none" />
            <text x={Math.max(rx + 6, maxW - 125)} y={ry - 5} fontSize={9.5} fontWeight={700} fill={item.color} fontFamily="var(--btm-mono)" pointerEvents="none">
              {item.text ? `${item.text} · ` : ""}{formatPrice(item.at.price, symbol)}
            </text>
            {!isDraft && hitLine(item.id, rx, ry, maxW, ry)}
            {handleDot(rx, ry, "anchor", "First anchor")}
          </g>
        );
      }
      case "vline": {
        const vx = x(item.time);
        if (vx == null) return null;
        return (
          <g key={key}>
            <line x1={vx} y1={0} x2={vx} y2={maxH} stroke={item.color} strokeWidth={item.width} strokeDasharray={dash} pointerEvents="none" />
            {!isDraft && hitLine(item.id, vx, 0, vx, maxH)}
            {handleDot(vx, maxH / 2, "anchor", "Move vertical line")}
          </g>
        );
      }
      case "arrowUp":
      case "arrowDown": {
        const mx = x(item.at.time);
        const my = y(item.at.price);
        if (mx == null || my == null) return null;
        const scale = 0.85 + (item.width ?? 2) * 0.22;
        const isUp = item.kind === "arrowUp";
        const points = isUp
          ? `${mx},${my} ${mx + 9 * scale},${my + 11 * scale} ${mx + 4 * scale},${my + 11 * scale} ${mx + 4 * scale},${my + 20 * scale} ${mx - 4 * scale},${my + 20 * scale} ${mx - 4 * scale},${my + 11 * scale} ${mx - 9 * scale},${my + 11 * scale}`
          : `${mx},${my} ${mx + 9 * scale},${my - 11 * scale} ${mx + 4 * scale},${my - 11 * scale} ${mx + 4 * scale},${my - 20 * scale} ${mx - 4 * scale},${my - 20 * scale} ${mx - 4 * scale},${my - 11 * scale} ${mx - 9 * scale},${my - 11 * scale}`;
        return (
          <g key={key}>
            <polygon
              points={points}
              fill={`color-mix(in srgb, ${item.color} 22%, transparent)`}
              stroke={item.color}
              strokeWidth={1.8}
              strokeLinejoin="round"
              pointerEvents={toolActive || isDraft ? "none" : "auto"}
              onPointerDown={beginShapeDrag(item.id)}
              style={{ cursor: toolActive ? undefined : "move" }}
            />
            {item.text && (
              <text
                x={mx}
                y={isUp ? my + 32 * scale : my - 25 * scale}
                textAnchor="middle"
                fontSize={10.5}
                fontWeight={700}
                fill={item.color}
                pointerEvents="none"
              >
                {item.text}
              </text>
            )}
            {handleDot(mx, my, "anchor", "Move marker")}
          </g>
        );
      }
      case "path": {
        const coords = item.points.map((pt, idx) => ({ px: x(pt.time), py: y(pt.price), idx })).filter((c): c is { px: number; py: number; idx: number } => c.px != null && c.py != null);
        if (coords.length < 2) return null;
        const polyPoints = coords.map((c) => `${c.px},${c.py}`).join(" ");
        const last = coords[coords.length - 1];
        const prev = coords[coords.length - 2];
        const angle = Math.atan2(last.py - prev.py, last.px - prev.px);
        const headLen = Math.max(9, item.width * 3.8);
        const leftX = last.px - headLen * Math.cos(angle - Math.PI / 6);
        const leftY = last.py - headLen * Math.sin(angle - Math.PI / 6);
        const rightX = last.px - headLen * Math.cos(angle + Math.PI / 6);
        const rightY = last.py - headLen * Math.sin(angle + Math.PI / 6);
        return (
          <g key={key}>
            <polyline
              points={polyPoints}
              fill="none"
              stroke={item.color}
              strokeWidth={item.width}
              strokeDasharray={dash}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
            <polygon points={`${last.px},${last.py} ${leftX},${leftY} ${rightX},${rightY}`} fill={item.color} pointerEvents="none" />
            {coords.slice(0, -1).map((c) => (
              <circle key={c.idx} cx={c.px} cy={c.py} r={3} fill="var(--btm-cbg, #121418)" stroke={item.color} strokeWidth={1.5} pointerEvents="none" />
            ))}
            {!isDraft &&
              coords.slice(0, -1).map((c, i) => hitLine(item.id, c.px, c.py, coords[i + 1].px, coords[i + 1].py, i))}
            {!isDraft &&
              coords.map((c) => handleDot(c.px, c.py, `p-${c.idx}`, "Path vertex"))}
          </g>
        );
      }
      case "highlighter": {
        const coords = item.points.map((pt) => ({ px: x(pt.time), py: y(pt.price) })).filter((c): c is { px: number; py: number } => c.px != null && c.py != null);
        if (coords.length < 2) return null;
        const d = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.px.toFixed(1)},${c.py.toFixed(1)}`).join(" ");
        const strokeW = Math.max(10, item.width || 18);
        return (
          <g key={key}>
            <path
              d={d}
              fill="none"
              stroke={item.color}
              strokeOpacity={item.fillOpacity ?? 0.32}
              strokeWidth={strokeW}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents={toolActive || isDraft ? "none" : "stroke"}
              onPointerDown={beginShapeDrag(item.id)}
              style={{ cursor: toolActive ? undefined : "move" }}
            />
            {selected && handleDot(coords[0].px, coords[0].py, "p-0", "First anchor")}
            {selected && handleDot(coords[coords.length - 1].px, coords[coords.length - 1].py, `p-${item.points.length - 1}`, "Second anchor")}
          </g>
        );
      }
      case "avwap": {
        const ax = x(item.at.time);
        const ay = y(item.at.price);
        const series = computeAnchoredVwap(
          revealed,
          item.at.time,
          item.source ?? "hlc3",
          item.bandMultiplier ?? 1,
        );
        const coords = series
          .map((pt) => ({
            px: x(pt.time),
            py: y(pt.vwap),
            uy: pt.upper != null ? y(pt.upper) : null,
            ly: pt.lower != null ? y(pt.lower) : null,
            vwap: pt.vwap,
          }))
          .filter((c): c is { px: number; py: number; uy: number | null; ly: number | null; vwap: number } => c.px != null && c.py != null);
        if (coords.length === 0 && (ax == null || ay == null)) return null;
        const vwapLine = coords.map((c) => `${c.px.toFixed(1)},${c.py.toFixed(1)}`).join(" ");
        const upperCoords = coords.filter((c): c is typeof c & { uy: number; ly: number } => c.uy != null && c.ly != null);
        const bandPolygon =
          (item.showBands ?? true) && upperCoords.length >= 2
            ? [
                ...upperCoords.map((c) => `${c.px.toFixed(1)},${c.uy.toFixed(1)}`),
                ...[...upperCoords].reverse().map((c) => `${c.px.toFixed(1)},${c.ly.toFixed(1)}`),
              ].join(" ")
            : null;
        const lastCoord = coords[coords.length - 1];
        const anchorX = ax ?? coords[0]?.px ?? 0;
        const anchorY = ay ?? coords[0]?.py ?? 0;
        return (
          <g key={key} onDoubleClick={openDrawingProperties(item.id)} onContextMenu={(e) => handleDrawingContextMenu(e, item.id)}>
            {bandPolygon && (
              <polygon
                points={bandPolygon}
                fill={item.color}
                fillOpacity={item.fillOpacity ?? 0.1}
                pointerEvents="none"
              />
            )}
            {(item.showBands ?? true) && upperCoords.length >= 2 && (
              <>
                <polyline
                  points={upperCoords.map((c) => `${c.px.toFixed(1)},${c.uy.toFixed(1)}`).join(" ")}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.65}
                  pointerEvents="none"
                />
                <polyline
                  points={upperCoords.map((c) => `${c.px.toFixed(1)},${c.ly.toFixed(1)}`).join(" ")}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.65}
                  pointerEvents="none"
                />
              </>
            )}
            {coords.length >= 2 && (
              <polyline
                points={vwapLine}
                fill="none"
                stroke={item.color}
                strokeWidth={item.width}
                strokeDasharray={dash}
                pointerEvents={toolActive || isDraft ? "none" : "stroke"}
                onPointerDown={beginShapeDrag(item.id)}
                style={{ cursor: toolActive ? undefined : "move" }}
              />
            )}
            <circle
              cx={anchorX}
              cy={anchorY}
              r={4.5}
              fill={item.color}
              stroke="#0f172a"
              strokeWidth={1.5}
              pointerEvents={toolActive || isDraft ? "none" : "all"}
              onPointerDown={beginShapeDrag(item.id, "anchor")}
              style={{ cursor: toolActive ? undefined : "move" }}
            />
            {lastCoord && (
              <text
                x={Math.min(width - 62, lastCoord.px + 6)}
                y={lastCoord.py - 5}
                fontSize={9.5}
                fontWeight={700}
                fill={item.color}
                fontFamily="var(--btm-mono)"
                pointerEvents="none"
              >
                AVWAP {formatPrice(lastCoord.vwap, symbol)}
              </text>
            )}
            {handleDot(anchorX, anchorY, "anchor", "First anchor")}
          </g>
        );
      }
      case "text": {
        const tx = x(item.at.time);
        const ty = y(item.at.price);
        if (tx == null || ty == null) return null;
        const fontSize = item.fontSize ?? 12;
        return (
          <g key={key} onDoubleClick={openDrawingProperties(item.id)} onContextMenu={(e) => handleDrawingContextMenu(e, item.id)}>
            <text
              x={tx + 4}
              y={ty}
              fontSize={fontSize}
              fontWeight={600}
              fill={item.color}
              pointerEvents={toolActive ? "none" : "auto"}
              onPointerDown={beginShapeDrag(item.id)}
              style={{ cursor: toolActive ? undefined : "move" }}
            >
              {item.text}
            </text>
            {handleDot(tx, ty, "anchor", "Move text")}
          </g>
        );
      }
      case "callout": {
        const ax = x(item.at.time);
        const ay = y(item.at.price);
        if (ax == null || ay == null) return null;
        const bx = item.boxAt ? (x(item.boxAt.time) ?? ax + 56) : ax + 56;
        const by = item.boxAt ? (y(item.boxAt.price) ?? ay - 38) : ay - 38;
        const fontSize = item.fontSize ?? 11;
        const boxW = Math.max(76, item.text.length * (fontSize * 0.62) + 22);
        const boxH = Math.max(26, fontSize + 14);
        return (
          <g key={key} onDoubleClick={openDrawingProperties(item.id)} onContextMenu={(e) => handleDrawingContextMenu(e, item.id)}>
            <line
              x1={ax}
              y1={ay}
              x2={bx}
              y2={by}
              stroke={item.color}
              strokeWidth={1.5}
              pointerEvents="none"
            />
            <circle cx={ax} cy={ay} r={3.5} fill={item.color} pointerEvents="none" />
            <rect
              x={bx - boxW / 2}
              y={by - boxH / 2}
              width={boxW}
              height={boxH}
              rx={6}
              fill={item.backgroundColor ?? "rgba(15, 23, 42, 0.92)"}
              stroke={item.color}
              strokeWidth={1.4}
              pointerEvents={toolActive || isDraft ? "none" : "all"}
              onPointerDown={beginShapeDrag(item.id, "box")}
              style={{ cursor: toolActive ? undefined : "move" }}
            />
            <text
              x={bx}
              y={by}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={fontSize}
              fontWeight={700}
              fill={item.color}
              pointerEvents="none"
            >
              {item.text}
            </text>
            {handleDot(ax, ay, "anchor", "First anchor")}
            {handleDot(bx, by, "box", "Move text")}
          </g>
        );
      }
      case "position": {
        const ex = x(item.entry.time);
        const ey = y(item.entry.price);
        const sy = y(item.slPrice);
        const ty = y(item.tpPrice);
        if (ex == null || ey == null || sy == null || ty == null) return null;
        const endCoord = item.endTime != null ? x(item.endTime) : null;
        const boxWidth = endCoord != null ? Math.max(50, endCoord - ex) : Math.min(280, Math.max(80, width - 58 - ex));
        const pipMult = getPipMultiplier(symbol);
        const pipVal = pipValuePerLot(symbol);
        const tpPips = Math.abs(item.tpPrice - item.entry.price) * pipMult;
        const slPips = Math.abs(item.entry.price - item.slPrice) * pipMult;
        const rrVal = slPips > 0 ? (tpPips / slPips).toFixed(2) : "—";
        const tpPct = item.entry.price > 0 ? ((Math.abs(item.tpPrice - item.entry.price) / item.entry.price) * 100).toFixed(2) : "0.00";
        const slPct = item.entry.price > 0 ? ((Math.abs(item.entry.price - item.slPrice) / item.entry.price) * 100).toFixed(2) : "0.00";

        // Parametric risk and exact lot size calculation (TradingView Pro)
        const accountBalance = item.accountSize ?? engine.account?.balance ?? 10000;
        const riskPct = item.riskPct ?? (engine.ticket?.riskMode === "percent" ? engine.ticket?.riskValue : null) ?? 1;
        const rawRisk = engine.ticket?.riskMode === "fixed" && item.riskPct == null
          ? (engine.ticket?.riskValue ?? 100)
          : (accountBalance * riskPct) / 100;
        const cashRisk = Math.max(1, rawRisk);
        const calculatedLots = computeLots({ riskAmount: cashRisk, slPips, symbol });
        const effectiveRisk = calculatedLots > 0 ? calculatedLots * slPips * pipVal : cashRisk;
        const effectiveReward = calculatedLots > 0 ? calculatedLots * tpPips * pipVal : cashRisk * (slPips > 0 ? tpPips / slPips : 1);

        const targetColor = item.targetColor ?? item.color ?? "#10b981";
        const stopColor = item.stopColor ?? "#ef4444";
        const fillAlpha = Math.round((item.fillOpacity ?? 0.16) * 100);
        const interactive = toolActive || isDraft ? "none" : "auto";
        const isLong = item.direction === "buy";

        const tpBoxHeight = Math.max(2, Math.abs(ty - ey));
        const slBoxHeight = Math.max(2, Math.abs(sy - ey));
        const minBoxY = Math.min(ey, ty);
        const slBoxY = Math.min(ey, sy);

        // Guardrail Dinamico del Custode della Soglia + Livello Target Parziale / Break-Even (50% TP1)
        const rrNumeric = slPips > 0 ? tpPips / slPips : 0;
        const isCustodeCompliant = rrNumeric >= 1.5;
        const partialPrice = item.entry.price + (item.tpPrice - item.entry.price) * 0.5;
        const py = (ey + ty) / 2;
        const partialReward = effectiveReward * 0.5;
        const partialLots = Math.max(0.01, Number((calculatedLots * 0.5).toFixed(2)));

        // Rilevamento Fase Ciclica Istituzionale e Pool di Liquidità BSL/SSL Mirato per il Dossier SIGILLA
        const liqSnapshot = memoizedLiqSnapshot ?? analyzeInstitutionalLiquidity(revealed);
        const targetCandidatePools = liqSnapshot.levels.filter((l) =>
          isLong ? l.side === "BSL" : l.side === "SSL",
        );
        let targetPoolLabel: string = isLong ? "BSL · HOD/PDH" : "SSL · LOD/PDL";
        if (targetCandidatePools.length > 0) {
          let bestPool = targetCandidatePools[0];
          let minDiff = Math.abs(bestPool.price - item.tpPrice);
          for (const pool of targetCandidatePools) {
            const diff = Math.abs(pool.price - item.tpPrice);
            if (diff < minDiff) {
              minDiff = diff;
              bestPool = pool;
            }
          }
          targetPoolLabel = bestPool.label;
        }
        const wyckoffSnap = memoizedWyckoffSnap ?? analyzeWyckoffStructure(revealed);
        const wyckoffRegime = wyckoffSnap.tradingRange?.structureType ?? "CONGESTION";
        const latestWyckoffGrab =
          wyckoffSnap.events.length > 0
            ? wyckoffSnap.events[wyckoffSnap.events.length - 1].label
            : (liqSnapshot.wyckoffGrabs.length > 0
                ? liqSnapshot.wyckoffGrabs[liqSnapshot.wyckoffGrabs.length - 1].label
                : null);

        return (
          <g key={key} onDoubleClick={openDrawingProperties(item.id)} onContextMenu={(e) => handleDrawingContextMenu(e, item.id)}>
            {/* Box Zona Profitto (Verde Smeraldo) */}
            <rect
              x={ex}
              y={minBoxY}
              width={boxWidth}
              height={tpBoxHeight}
              fill={`color-mix(in srgb, ${targetColor} ${fillAlpha}%, transparent)`}
              stroke={selected ? targetColor : "none"}
              strokeWidth={0.8}
              pointerEvents={interactive}
              onPointerDown={beginShapeDrag(item.id)}
              style={{ cursor: toolActive ? undefined : "grab" }}
            />
            {/* Box Zona Stop (Rosso Rubino) */}
            <rect
              x={ex}
              y={slBoxY}
              width={boxWidth}
              height={slBoxHeight}
              fill={`color-mix(in srgb, ${stopColor} ${fillAlpha}%, transparent)`}
              stroke={selected ? stopColor : "none"}
              strokeWidth={0.8}
              pointerEvents={interactive}
              onPointerDown={beginShapeDrag(item.id)}
              style={{ cursor: toolActive ? undefined : "grab" }}
            />

            {/* Linee Visive Livelli (Entry, TP, SL, e Break-Even / Target Parziale 50%) */}
            <line x1={ex} y1={ey} x2={ex + boxWidth} y2={ey} stroke="#3b82f6" strokeWidth={1.5} pointerEvents="none" />
            <line x1={ex} y1={ty} x2={ex + boxWidth} y2={ty} stroke={targetColor} strokeWidth={1.4} strokeDasharray="5 3" pointerEvents="none" />
            <line x1={ex} y1={sy} x2={ex + boxWidth} y2={sy} stroke={stopColor} strokeWidth={1.4} strokeDasharray="5 3" pointerEvents="none" />
            <line x1={ex} y1={py} x2={ex + boxWidth} y2={py} stroke="#C5A059" strokeWidth={1} strokeDasharray="3 3" opacity={0.8} pointerEvents="none" />

            {/* Dettagli nel Box TP (TradingView Minimalist Clean Standard) */}
            <g pointerEvents="none">
              <text
                x={ex + 6}
                y={isLong ? minBoxY + 12 : ty - 10}
                dominantBaseline="central"
                fontSize={8.5}
                fontWeight={700}
                fill={targetColor}
                fontFamily="var(--btm-mono)"
                opacity={0.9}
              >
                TP +{tpPips.toFixed(1)}p ({tpPct}%)
              </text>
            </g>

            {/* Dettagli nel Box SL (TradingView Minimalist Clean Standard) */}
            <g pointerEvents="none">
              <text
                x={ex + 6}
                y={isLong ? sy - 10 : slBoxY + 12}
                dominantBaseline="central"
                fontSize={8.5}
                fontWeight={700}
                fill={stopColor}
                fontFamily="var(--btm-mono)"
                opacity={0.9}
              >
                SL -{slPips.toFixed(1)}p ({slPct}%)
              </text>
            </g>

            {/* Badge Centrale Snello con R:R & Toolbar Operativa Espansa solo al click/selezione */}
            {(() => {
              if (!selected) {
                const pillW = 74;
                const pillH = 18;
                const pillX = ex + Math.max(4, (boxWidth - pillW) / 2);
                const pillY = ey - pillH / 2;
                return (
                  <g transform={`translate(${pillX}, ${pillY})`} pointerEvents="all">
                    <rect
                      width={pillW}
                      height={pillH}
                      rx={9}
                      fill="#07080b"
                      fillOpacity={0.88}
                      stroke={isCustodeCompliant ? "rgba(197, 160, 89, 0.45)" : "rgba(239, 68, 68, 0.55)"}
                      strokeWidth={1}
                      filter="drop-shadow(0 2px 4px rgba(0,0,0,0.75))"
                    />
                    <text
                      x={pillW / 2}
                      y={pillH / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={8}
                      fontWeight={700}
                      fill="#E8C56A"
                      fontFamily="var(--btm-mono)"
                      pointerEvents="none"
                    >
                      R:R {rrVal}
                    </text>
                  </g>
                );
              }

              const pillW = 248;
              const pillH = 22;
              const pillX = ex + Math.max(4, (boxWidth - pillW) / 2);
              const pillY = ey - pillH - 4; // Fluttua sopra la linea di ingresso per non coprire il prezzo
              return (
                <g transform={`translate(${pillX}, ${pillY})`} pointerEvents="all">
                  <rect
                    width={pillW}
                    height={pillH}
                    rx={11}
                    fill="#07080b"
                    fillOpacity={0.96}
                    stroke="rgba(197, 160, 89, 0.6)"
                    strokeWidth={1}
                    filter="drop-shadow(0 4px 12px rgba(0,0,0,0.9))"
                  />
                  <text x={8} y={11} dominantBaseline="central" fontSize={8} fontWeight={600} fill="#94a3b8" fontFamily="var(--btm-mono)" pointerEvents="none">
                    {isLong ? "LONG" : "SHORT"} <tspan fill="#E8C56A" fontWeight="bold">R:R {rrVal}</tspan>
                  </text>
                  {/* Bottone Forgia */}
                  <g
                    transform="translate(108, 2.5)"
                    style={{ cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      engine.executeDrawingOrder?.(item);
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      engine.executeDrawingOrder?.(item);
                    }}
                  >
                    <rect width={58} height={17} rx={8.5} fill={isCustodeCompliant ? "#C5A059" : "#ef4444"} />
                    <text x={29} y={8.5} textAnchor="middle" dominantBaseline="central" fontSize={7.5} fontWeight={800} fill={isCustodeCompliant ? "#07080b" : "#ffffff"} fontFamily="var(--btm-mono)" pointerEvents="none">
                      FORGIA {calculatedLots.toFixed(2)}L
                    </text>
                  </g>
                  {/* Bottone Sigilla */}
                  <g
                    transform="translate(170, 2.5)"
                    style={{ cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      try {
                        const key = "limen_libro_verita_sealed_setups_v1";
                        const existing = JSON.parse(localStorage.getItem(key) || "[]");
                        const record = {
                          id: item.id,
                          symbol,
                          direction: item.direction,
                          entryPrice: item.entry.price,
                          slPrice: item.slPrice,
                          tpPrice: item.tpPrice,
                          tp1BePrice: partialPrice,
                          lots: calculatedLots,
                          partialLots,
                          rr: rrVal,
                          cashRisk: Number(effectiveRisk.toFixed(2)),
                          expectedReward: Number(effectiveReward.toFixed(2)),
                          custodeCompliant: isCustodeCompliant,
                          cyclePhase: liqSnapshot.cycle.phase,
                          cycleTitle: liqSnapshot.cycle.title,
                          dilutionRatio: liqSnapshot.cycle.dilutionRatio,
                          targetLiquidityPool: targetPoolLabel,
                          wyckoffRegime,
                          wyckoffGrab: latestWyckoffGrab,
                          sealedAt: new Date().toISOString(),
                        };
                        localStorage.setItem(key, JSON.stringify([record, ...existing.filter((x: any) => x.id !== item.id)].slice(0, 50)));
                        window.dispatchEvent(new CustomEvent("limen:setup-sealed", { detail: record }));
                      } catch {}
                      setSealedSetupIds((prev) => ({ ...prev, [item.id]: true }));
                    }}
                  >
                    <rect
                      width={50}
                      height={17}
                      rx={8.5}
                      fill={sealedSetupIds[item.id] ? "#10b981" : "#11131c"}
                      stroke={sealedSetupIds[item.id] ? "#10b981" : "rgba(197, 160, 89, 0.4)"}
                      strokeWidth={1}
                    />
                    <text
                      x={25}
                      y={8.5}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={7.2}
                      fontWeight={800}
                      fill={sealedSetupIds[item.id] ? "#07080b" : "#E8C56A"}
                      fontFamily="var(--btm-mono)"
                      pointerEvents="none"
                    >
                      {sealedSetupIds[item.id] ? "SIGILLATO" : "SIGILLA"}
                    </text>
                  </g>
                  {/* Tasto Cancella Rapido (X) */}
                  <g
                    transform={`translate(${pillW - 19}, 2.5)`}
                    style={{ cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      engine.setDrawings((prev) => prev.filter((d) => d.id !== item.id));
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      engine.setDrawings((prev) => prev.filter((d) => d.id !== item.id));
                    }}
                  >
                    <title>Elimina setup dal grafico</title>
                    <circle cx={8.5} cy={8.5} r={8.5} fill="#ef4444" fillOpacity={0.85} />
                    <text x={8.5} y={8.5} textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight={900} fill="#ffffff" pointerEvents="none">
                      ×
                    </text>
                  </g>
                </g>
              );
            })()}

            {/* Pillole Asse Prezzi Destro (TradingView Slim Edge Tags) */}
            <g transform={`translate(${ex + boxWidth}, 0)`} pointerEvents="none">
              {/* Pillola TP */}
              <g transform={`translate(2, ${ty - 7})`}>
                <rect width={48} height={14} rx={2.5} fill={targetColor} fillOpacity={0.95} />
                <text x={24} y={7} textAnchor="middle" dominantBaseline="central" fontSize={7.8} fontWeight={700} fill="#ffffff" fontFamily="var(--btm-mono)">
                  {formatPrice(item.tpPrice, symbol)}
                </text>
              </g>
              {/* Pillola TP1 / BE 50% (Solo se selezionato e altezza sufficiente per non collidere) */}
              {selected && tpBoxHeight >= 36 && (
                <g transform={`translate(2, ${py - 7})`}>
                  <rect width={48} height={14} rx={2.5} fill="#07080b" stroke="#C5A059" strokeWidth={1} />
                  <text x={24} y={7} textAnchor="middle" dominantBaseline="central" fontSize={7.5} fontWeight={700} fill="#E8C56A" fontFamily="var(--btm-mono)">
                    BE {formatPrice(partialPrice, symbol)}
                  </text>
                </g>
              )}
              {/* Pillola SL */}
              <g transform={`translate(2, ${sy - 7})`}>
                <rect width={48} height={14} rx={2.5} fill={stopColor} fillOpacity={0.95} />
                <text x={24} y={7} textAnchor="middle" dominantBaseline="central" fontSize={7.8} fontWeight={700} fill="#ffffff" fontFamily="var(--btm-mono)">
                  {formatPrice(item.slPrice, symbol)}
                </text>
              </g>
            </g>

            {/* Hit Areas Ampie e Trascinabili per Entry, TP, SL e Durata */}
            <line
              x1={ex}
              y1={ty}
              x2={ex + boxWidth}
              y2={ty}
              stroke="transparent"
              strokeWidth={14}
              pointerEvents={interactive}
              onPointerDown={beginShapeDrag(item.id, "tp")}
              style={{ cursor: "ns-resize" }}
            />
            <line
              x1={ex}
              y1={sy}
              x2={ex + boxWidth}
              y2={sy}
              stroke="transparent"
              strokeWidth={14}
              pointerEvents={interactive}
              onPointerDown={beginShapeDrag(item.id, "sl")}
              style={{ cursor: "ns-resize" }}
            />
            <line
              x1={ex}
              y1={ey}
              x2={ex + boxWidth}
              y2={ey}
              stroke="transparent"
              strokeWidth={14}
              pointerEvents={interactive}
              onPointerDown={beginShapeDrag(item.id, "entry")}
              style={{ cursor: "row-resize" }}
            />
            <line
              x1={ex + boxWidth}
              y1={Math.min(sy, ty, ey)}
              x2={ex + boxWidth}
              y2={Math.max(sy, ty, ey)}
              stroke="transparent"
              strokeWidth={14}
              pointerEvents={interactive}
              onPointerDown={beginShapeDrag(item.id, "end")}
              style={{ cursor: "ew-resize" }}
            />

            {/* Maniglie Visive con cerchi generosi e colori dedicati (TradingView Pro) */}
            {handleDot(ex, ey, "entry", "Trascina per modificare Prezzo d'Ingresso", "#3b82f6")}
            {handleDot(ex + boxWidth / 2, sy, "sl", "Trascina per modificare Stop Loss", "#ef4444")}
            {handleDot(ex + boxWidth / 2, ty, "tp", "Trascina per modificare Take Profit", "#10b981")}
            {handleDot(ex + boxWidth, ey, "end", "Trascina per estendere la durata della posizione", "#C5A059")}
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
          const dx = bx - ax;
          const dy = by - ay;
          const dist = Math.hypot(dx, dy);
          const scale = dist > 0 ? (Math.max(width, height) * 2) / dist : 1;
          const x1 = item.extendLeft ? ax - dx * scale : ax;
          const y1 = item.extendLeft ? ay - dy * scale : ay;
          const x2 = item.extendRight ? ax + dx * scale : bx;
          const y2 = item.extendRight ? ay + dy * scale : by;
          return (
            <g key={key} onDoubleClick={openDrawingProperties(item.id)} onContextMenu={(e) => handleDrawingContextMenu(e, item.id)}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={item.color} strokeWidth={item.width} strokeDasharray={dash} pointerEvents="none" />
              {item.text && (
                <text x={(ax + bx) / 2} y={(ay + by) / 2 - 6} textAnchor="middle" fontSize={10} fontWeight={700} fill={item.color} pointerEvents="none">
                  {item.text}
                </text>
              )}
              {!isDraft && hitLine(item.id, x1, y1, x2, y2)}
              {endpointDots(ax, ay, bx, by)}
            </g>
          );
        }
        if (item.kind === "infoline") {
          const dx = bx - ax;
          const dy = by - ay;
          const dist = Math.hypot(dx, dy);
          const angleDeg = -Math.atan2(dy, dx) * (180 / Math.PI);
          const deltaPrice = item.b.price - item.a.price;
          const pct = item.a.price !== 0 ? (deltaPrice / item.a.price) * 100 : 0;
          const pips = Math.abs(deltaPrice * getPipMultiplier(symbol));
          const bars = Math.round(Math.abs(item.b.time - item.a.time) / Math.max(1, engine.intervalSeconds));
          const midX = (ax + bx) / 2;
          const midY = (ay + by) / 2;
          return (
            <g key={key} onDoubleClick={openDrawingProperties(item.id)} onContextMenu={(e) => handleDrawingContextMenu(e, item.id)}>
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke={item.color} strokeWidth={item.width} strokeDasharray={dash} pointerEvents="none" />
              {dist > 20 && (
                <g pointerEvents="none">
                  <rect
                    x={midX - 78}
                    y={midY - 34}
                    width={156}
                    height={30}
                    rx={5}
                    fill="rgba(15, 23, 42, 0.92)"
                    stroke={item.color}
                    strokeWidth={1}
                  />
                  <text x={midX} y={midY - 22} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#f8fafc" fontFamily="var(--btm-mono)">
                    {deltaPrice >= 0 ? "+" : ""}{formatPrice(deltaPrice, symbol)} ({pct >= 0 ? "+" : ""}{pct.toFixed(2)}% · {pips.toFixed(1)}p)
                  </text>
                  <text x={midX} y={midY - 10} textAnchor="middle" fontSize={8} fill="#94a3b8" fontFamily="var(--btm-mono)">
                    {bars} barre · {angleDeg.toFixed(1)}°
                  </text>
                </g>
              )}
              {!isDraft && hitLine(item.id, ax, ay, bx, by)}
              {endpointDots(ax, ay, bx, by)}
            </g>
          );
        }
        if (item.kind === "parallelChannel") {
          const offsetP = item.priceOffset || -(item.b.price - item.a.price) * 0.55 || item.a.price * 0.0025;
          const a2y = y(item.a.price + offsetP);
          const b2y = y(item.b.price + offsetP);
          if (a2y == null || b2y == null) return null;
          const mid1Y = (ay + a2y) / 2;
          const mid2Y = (by + b2y) / 2;
          const offsetHandleX = (ax + bx) / 2;
          const offsetHandleY = (a2y + b2y) / 2;
          const polygonPts = `${ax},${ay} ${bx},${by} ${bx},${b2y} ${ax},${a2y}`;
          return (
            <g key={key} onDoubleClick={openDrawingProperties(item.id)} onContextMenu={(e) => handleDrawingContextMenu(e, item.id)}>
              <polygon
                points={polygonPts}
                fill={item.color}
                fillOpacity={item.fillOpacity ?? 0.12}
                pointerEvents={toolActive || isDraft ? "none" : "all"}
                onPointerDown={beginShapeDrag(item.id)}
                style={{ cursor: toolActive ? undefined : "move" }}
              />
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke={item.color} strokeWidth={item.width} strokeDasharray={dash} pointerEvents="none" />
              <line x1={ax} y1={a2y} x2={bx} y2={b2y} stroke={item.color} strokeWidth={item.width} strokeDasharray={dash} pointerEvents="none" />
              {(item.showMidline ?? true) && (
                <line x1={ax} y1={mid1Y} x2={bx} y2={mid2Y} stroke={item.color} strokeWidth={1} strokeDasharray="4 4" opacity={0.8} pointerEvents="none" />
              )}
              {!isDraft && hitLine(item.id, ax, ay, bx, by, "l1")}
              {!isDraft && hitLine(item.id, ax, a2y, bx, b2y, "l2")}
              {endpointDots(ax, ay, bx, by)}
              {handleDot(offsetHandleX, offsetHandleY, "offset", "Resize corner")}
            </g>
          );
        }
        if (item.kind === "ray") {
          const dx = bx - ax;
          const dy = by - ay;
          const dist = Math.hypot(dx, dy);
          const scale = dist > 0 ? (Math.max(width, height) * 2) / dist : 1;
          const endX = ax + dx * scale;
          const endY = ay + dy * scale;
          return (
            <g key={key} onDoubleClick={openDrawingProperties(item.id)} onContextMenu={(e) => handleDrawingContextMenu(e, item.id)}>
              <line x1={ax} y1={ay} x2={endX} y2={endY} stroke={item.color} strokeWidth={item.width} strokeDasharray={dash} pointerEvents="none" />
              {!isDraft && hitLine(item.id, ax, ay, endX, endY)}
              {endpointDots(ax, ay, bx, by)}
            </g>
          );
        }
        if (item.kind === "arrow") {
          const dx = bx - ax;
          const dy = by - ay;
          const angle = Math.atan2(dy, dx);
          const headLen = Math.max(9, item.width * 4);
          const leftX = bx - headLen * Math.cos(angle - Math.PI / 6);
          const leftY = by - headLen * Math.sin(angle - Math.PI / 6);
          const rightX = bx - headLen * Math.cos(angle + Math.PI / 6);
          const rightY = by - headLen * Math.sin(angle + Math.PI / 6);
          return (
            <g key={key} onDoubleClick={openDrawingProperties(item.id)} onContextMenu={(e) => handleDrawingContextMenu(e, item.id)}>
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke={item.color} strokeWidth={item.width} strokeDasharray={dash} pointerEvents="none" />
              <polygon points={`${bx},${by} ${leftX},${leftY} ${rightX},${rightY}`} fill={item.color} pointerEvents="none" />
              {!isDraft && hitLine(item.id, ax, ay, bx, by)}
              {endpointDots(ax, ay, bx, by)}
            </g>
          );
        }
        if (item.kind === "rect") {
          const left = Math.min(ax, bx);
          const right = item.extendRight ? Math.max(left + 20, width - 58) : Math.max(ax, bx);
          const top = Math.min(ay, by);
          const rectW = Math.max(2, right - left);
          const rectH = Math.max(2, Math.abs(by - ay));
          const midY = top + rectH / 2;
          return (
            <g key={key} onDoubleClick={openDrawingProperties(item.id)} onContextMenu={(e) => handleDrawingContextMenu(e, item.id)}>
              <rect
                x={left}
                y={top}
                width={rectW}
                height={rectH}
                fill={`color-mix(in srgb, ${item.color} ${(item.fillOpacity ?? 0.12) * 100}%, transparent)`}
                strokeDasharray={dash}
                stroke={item.color}
                strokeWidth={item.width}
                pointerEvents={toolActive || isDraft ? "none" : "auto"}
                onPointerDown={beginShapeDrag(item.id)}
                style={{ cursor: toolActive ? undefined : "move" }}
              />
              {item.showMidline && (
                <line
                  x1={left}
                  y1={midY}
                  x2={left + rectW}
                  y2={midY}
                  stroke={item.color}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  opacity={0.85}
                  pointerEvents="none"
                />
              )}
              {endpointDots(ax, ay, bx, by)}
            </g>
          );
        }
        if (item.kind === "frvp") {
          const left = Math.min(ax, bx);
          const right = Math.max(ax + 12, Math.max(ax, bx));
          const boxW = Math.max(24, right - left);
          const profile = computeFixedRangeVolumeProfile(
            revealed,
            item.a.time,
            item.b.time,
            item.rows ?? 24,
            item.valueAreaPct ?? 0.7,
          );
          const topY = profile ? (y(profile.maxPrice) ?? Math.min(ay, by)) : Math.min(ay, by);
          const botY = profile ? (y(profile.minPrice) ?? Math.max(ay, by)) : Math.max(ay, by);
          const pocY = profile ? y(profile.pocPrice) : null;
          const vahY = profile ? y(profile.vahPrice) : null;
          const valY = profile ? y(profile.valPrice) : null;
          const lineRight = item.extendRight ? Math.max(right, width - 58) : right;
          const upCol = item.upVolumeColor ?? settings.candleUpColor ?? "#26a69a";
          const dnCol = item.downVolumeColor ?? settings.candleDownColor ?? "#ef5350";
          const vaUpCol = item.vaUpColor ?? "#3b82f6";
          const vaDnCol = item.vaDownColor ?? "#eab308";
          const widthRatio = Math.min(1, Math.max(0.1, (item.widthPct ?? 78) / 100));
          const alignRight = item.placement === "right";
          const showHistogram = item.showProfile !== false;
          const showPoc = item.showPoc !== false;
          const showVah = item.showVah !== false;
          const showVal = item.showVal !== false;
          const devCoords = (profile?.developing ?? [])
            .map((pt) => ({
              px: x(pt.time),
              pocY: y(pt.poc),
              vahY: y(pt.vah),
              valY: y(pt.val),
            }))
            .filter((d): d is { px: number; pocY: number; vahY: number; valY: number } => d.px != null && d.pocY != null && d.vahY != null && d.valY != null);

          return (
            <g key={key} onDoubleClick={openDrawingProperties(item.id)} onContextMenu={(e) => handleDrawingContextMenu(e, item.id)}>
              <rect
                x={left}
                y={Math.min(topY, botY)}
                width={boxW}
                height={Math.max(8, Math.abs(botY - topY))}
                fill={item.histogramBoxColor ?? "rgba(59, 130, 246, 0.05)"}
                stroke={selected ? item.color : "rgba(148, 163, 184, 0.25)"}
                strokeDasharray="3 3"
                strokeWidth={1}
                pointerEvents={toolActive || isDraft ? "none" : "auto"}
                onPointerDown={beginShapeDrag(item.id)}
                style={{ cursor: toolActive ? undefined : "move" }}
              />
              {profile &&
                showHistogram &&
                profile.buckets.map((bucket, idx) => {
                  const yTop = y(bucket.priceHigh);
                  const yBot = y(bucket.priceLow);
                  if (yTop == null || yBot == null) return null;
                  const rowH = Math.max(1.5, Math.abs(yBot - yTop) - 0.8);
                  const maxBarW = boxW * widthRatio;
                  const totalW = (bucket.totalVolume / profile.maxBucketVolume) * maxBarW;
                  const upW = bucket.totalVolume > 0 ? (bucket.upVolume / bucket.totalVolume) * totalW : 0;
                  const dnW = Math.max(0, totalW - upW);
                  const alpha = bucket.inValueArea ? 0.78 : 0.35;
                  const bUpColor = bucket.inValueArea ? vaUpCol : upCol;
                  const bDnColor = bucket.inValueArea ? vaDnCol : dnCol;
                  const barXUp = alignRight ? right - totalW : left;
                  const barXDn = alignRight ? right - dnW : left + upW;
                  return (
                    <g key={idx} pointerEvents="none" opacity={alpha}>
                      <rect x={barXUp} y={Math.min(yTop, yBot)} width={upW} height={rowH} fill={bUpColor} />
                      <rect x={barXDn} y={Math.min(yTop, yBot)} width={dnW} height={rowH} fill={bDnColor} />
                      {item.showValues && rowH >= 8 && (
                        <text
                          x={alignRight ? right - 4 : left + 4}
                          y={Math.min(yTop, yBot) + rowH / 2}
                          textAnchor={alignRight ? "end" : "start"}
                          dominantBaseline="central"
                          fontSize={7.5}
                          fill="#f8fafc"
                          fontFamily="var(--btm-mono)"
                        >
                          {Math.round(bucket.totalVolume)}
                        </text>
                      )}
                    </g>
                  );
                })}
              {showVah && vahY != null && (
                <line x1={left} y1={vahY} x2={lineRight} y2={vahY} stroke={item.vahColor ?? "#3b82f6"} strokeWidth={1.2} strokeDasharray="4 3" pointerEvents="none" />
              )}
              {showVal && valY != null && (
                <line x1={left} y1={valY} x2={lineRight} y2={valY} stroke={item.valColor ?? "#3b82f6"} strokeWidth={1.2} strokeDasharray="4 3" pointerEvents="none" />
              )}
              {showPoc && pocY != null && profile && (
                <>
                  <line x1={left} y1={pocY} x2={lineRight} y2={pocY} stroke={item.color || "#ef4444"} strokeWidth={Math.max(1.5, item.width)} pointerEvents="none" />
                  <text x={lineRight - 4} y={pocY - 4} textAnchor="end" fontSize={8.5} fontWeight={700} fill={item.color || "#ef4444"} fontFamily="var(--btm-mono)" pointerEvents="none">
                    POC {formatPrice(profile.pocPrice, symbol)}
                  </text>
                </>
              )}
              {item.showDevelopingPoc && devCoords.length >= 2 && (
                <polyline
                  points={devCoords.map((d) => `${d.px.toFixed(1)},${d.pocY.toFixed(1)}`).join(" ")}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={1.4}
                  pointerEvents="none"
                />
              )}
              {item.showDevelopingVa && devCoords.length >= 2 && (
                <>
                  <polyline
                    points={devCoords.map((d) => `${d.px.toFixed(1)},${d.vahY.toFixed(1)}`).join(" ")}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    pointerEvents="none"
                  />
                  <polyline
                    points={devCoords.map((d) => `${d.px.toFixed(1)},${d.valY.toFixed(1)}`).join(" ")}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    pointerEvents="none"
                  />
                </>
              )}
              {endpointDots(ax, ay, bx, by)}
            </g>
          );
        }
        if (item.kind === "fib") {
          const startX = Math.min(ax, bx);
          const endX = item.extendRight !== false ? Math.max(Math.max(ax, bx), projector.paneWidth ?? (width - 58)) : Math.max(ax + 30, Math.max(ax, bx));
          const activeLevels = (item.levels ?? DEFAULT_FIB_LEVELS).filter((l) => l.enabled);
          const pA = item.reverse ? item.b.price : item.a.price;
          const pB = item.reverse ? item.a.price : item.b.price;
          return (
            <g key={key} onDoubleClick={openDrawingProperties(item.id)} onContextMenu={(e) => handleDrawingContextMenu(e, item.id)}>
              <rect
                x={startX}
                y={Math.min(ay, by)}
                width={Math.max(16, endX - startX)}
                height={Math.max(8, Math.abs(by - ay))}
                fill={`color-mix(in srgb, ${item.color} ${Math.round((item.fillOpacity ?? 0.06) * 100)}%, transparent)`}
                pointerEvents={toolActive || isDraft ? "none" : "auto"}
                onPointerDown={beginShapeDrag(item.id)}
                style={{ cursor: toolActive ? undefined : "move" }}
              />
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke={item.color} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} pointerEvents="none" />
              {activeLevels.map((lvl) => {
                const levelPrice = pA + (pB - pA) * lvl.level;
                const levelY = y(levelPrice);
                if (levelY == null) return null;
                const lvlColor = lvl.color || item.color;
                const labelText = item.showPercents
                  ? `${(lvl.level * 100).toFixed(1)}%`
                  : lvl.level.toFixed(3);
                const priceSuffix = item.showPrices !== false ? ` (${formatPrice(levelPrice, symbol)})` : "";
                return (
                  <g key={lvl.level} pointerEvents="none">
                    <line x1={startX} y1={levelY} x2={endX} y2={levelY} stroke={lvlColor} strokeDasharray={dash} strokeWidth={item.width} opacity={0.88} />
                    <text x={startX + 4} y={levelY - 3} fontSize={8.5} fill={lvlColor} fontFamily="var(--btm-mono)">
                      {labelText}{priceSuffix}
                    </text>
                  </g>
                );
              })}
              {!isDraft && hitLine(item.id, ax, ay, bx, by)}
              {endpointDots(ax, ay, bx, by)}
            </g>
          );
        }
        if (item.kind === "priceRange") {
          const left = Math.min(ax, bx);
          const boxW = Math.max(36, Math.abs(bx - ax));
          const top = Math.min(ay, by);
          const boxH = Math.max(4, Math.abs(by - ay));
          const midX = left + boxW / 2;
          const deltaPrice = item.b.price - item.a.price;
          const pct = item.a.price !== 0 ? (deltaPrice / item.a.price) * 100 : 0;
          const pips = Math.abs(deltaPrice * getPipMultiplier(symbol));
          const col = item.color || (deltaPrice >= 0 ? "#26a69a" : "#ef5350");
          return (
            <g key={key} onDoubleClick={openDrawingProperties(item.id)} onContextMenu={(e) => handleDrawingContextMenu(e, item.id)}>
              <rect
                x={left}
                y={top}
                width={boxW}
                height={boxH}
                fill={col}
                fillOpacity={item.fillOpacity ?? 0.14}
                pointerEvents={toolActive || isDraft ? "none" : "all"}
                onPointerDown={beginShapeDrag(item.id)}
                style={{ cursor: toolActive ? undefined : "move" }}
              />
              <line x1={left} y1={ay} x2={left + boxW} y2={ay} stroke={col} strokeWidth={1.5} pointerEvents="none" />
              <line x1={left} y1={by} x2={left + boxW} y2={by} stroke={col} strokeWidth={1.5} pointerEvents="none" />
              <line x1={midX} y1={ay} x2={midX} y2={by} stroke={col} strokeWidth={1.5} pointerEvents="none" />
              <rect x={midX - 66} y={top + boxH / 2 - 11} width={132} height={22} rx={4} fill="rgba(15, 23, 42, 0.92)" stroke={col} strokeWidth={1} pointerEvents="none" />
              <text x={midX} y={top + boxH / 2} textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={700} fill="#f8fafc" fontFamily="var(--btm-mono)" pointerEvents="none">
                {deltaPrice >= 0 ? "+" : ""}{formatPrice(deltaPrice, symbol)} ({pct >= 0 ? "+" : ""}{pct.toFixed(2)}% · {pips.toFixed(1)}p)
              </text>
              {endpointDots(ax, ay, bx, by)}
            </g>
          );
        }
        if (item.kind === "dateRange") {
          const left = Math.min(ax, bx);
          const boxW = Math.max(12, Math.abs(bx - ax));
          const top = Math.min(ay, by);
          const boxH = Math.max(28, Math.abs(by - ay));
          const midY = top + boxH / 2;
          const bars = Math.round(Math.abs(item.b.time - item.a.time) / Math.max(1, engine.intervalSeconds));
          const minT = Math.min(item.a.time, item.b.time);
          const maxT = Math.max(item.a.time, item.b.time);
          const rangeVol = revealed
            .filter((b) => b.time >= minT && b.time <= maxT)
            .reduce((sum, b) => sum + (b.volume || 1), 0);
          const col = item.color || "#3b82f6";
          return (
            <g key={key} onDoubleClick={openDrawingProperties(item.id)} onContextMenu={(e) => handleDrawingContextMenu(e, item.id)}>
              <rect
                x={left}
                y={top}
                width={boxW}
                height={boxH}
                fill={col}
                fillOpacity={item.fillOpacity ?? 0.12}
                pointerEvents={toolActive || isDraft ? "none" : "all"}
                onPointerDown={beginShapeDrag(item.id)}
                style={{ cursor: toolActive ? undefined : "move" }}
              />
              <line x1={ax} y1={top} x2={ax} y2={top + boxH} stroke={col} strokeWidth={1.5} pointerEvents="none" />
              <line x1={bx} y1={top} x2={bx} y2={top + boxH} stroke={col} strokeWidth={1.5} pointerEvents="none" />
              <line x1={ax} y1={midY} x2={bx} y2={midY} stroke={col} strokeWidth={1.5} pointerEvents="none" />
              <rect x={left + boxW / 2 - 58} y={midY - 11} width={116} height={22} rx={4} fill="rgba(15, 23, 42, 0.92)" stroke={col} strokeWidth={1} pointerEvents="none" />
              <text x={left + boxW / 2} y={midY} textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={700} fill="#f8fafc" fontFamily="var(--btm-mono)" pointerEvents="none">
                {bars} barre · Vol {Math.round(rangeVol)}
              </text>
              {endpointDots(ax, ay, bx, by)}
            </g>
          );
        }
        // ruler
        const pips = Math.abs((item.b.price - item.a.price) * getPipMultiplier(symbol));
        const pct = item.a.price !== 0 ? ((item.b.price - item.a.price) / item.a.price) * 100 : 0;
        const bars = Math.round(Math.abs(item.b.time - item.a.time) / Math.max(1, engine.intervalSeconds));
        return (
          <g key={key} onDoubleClick={openDrawingProperties(item.id)} onContextMenu={(e) => handleDrawingContextMenu(e, item.id)}>
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
      : draft.kind === "parallelChannel"
        ? {
            id: "draft",
            kind: "parallelChannel",
            a: draft.a,
            b: draft.b,
            priceOffset: -(draft.b.price - draft.a.price) * 0.55 || draft.a.price * 0.0025,
            color: settings.toolColor,
            width: settings.toolWidth,
            fillOpacity: 0.12,
            showMidline: true,
          }
        : { id: "draft", kind: draft.kind, a: draft.a, b: draft.b, color: settings.toolColor, width: settings.toolWidth }
    : pathDraft && pathDraft.length >= 2
      ? { id: "draft", kind: "path", points: pathDraft, color: settings.toolColor, width: settings.toolWidth }
      : highlighterDraft && highlighterDraft.length >= 2
        ? { id: "draft", kind: "highlighter", points: highlighterDraft, color: settings.toolColor, width: Math.max(14, settings.toolWidth * 8), fillOpacity: 0.32 }
        : null;


  const snapX = hoverSnap?.snapped ? x(hoverSnap.point.time) : null;
  const snapY = hoverSnap?.snapped ? y(hoverSnap.point.price) : null;

  return (
    <>
      <div className="btm-drawing-workspace-controls" role="toolbar" aria-label={copy("Drawing workspace")}>
        <button type="button" aria-label={copy("Undo drawing change")} disabled={!history.current.canUndo} onClick={() => restoreHistory()}><Undo2 size={14} /></button>
        <button type="button" aria-label={copy("Redo drawing change")} disabled={!history.current.canRedo} onClick={() => restoreHistory(true)}><Redo2 size={14} /></button>
        <button type="button" aria-label={copy("Drawing objects")} aria-expanded={objectsOpen} onClick={() => setObjectsOpen(!objectsOpen)}><List size={14} /> {drawings.length}</button>
      </div>
      {objectsOpen && <div className="btm-drawing-objects" role="region" aria-label={copy("Drawing objects")}>
        <strong>{copy("Drawing objects")}</strong>
        {drawings.length === 0 && <p>{copy("No drawings")}</p>}
        {drawings.map((item, index) => <div key={item.id} data-selected={item.id === selectedId}>
          <button type="button" onClick={() => { setSelectedId(item.id); onToolDone(); }} title={item.id}>
            {item.kind === "text" || item.kind === "callout" ? item.text.slice(0, 22) : `${copy(item.kind)} ${index + 1}`}</button>
          <button type="button" aria-label={copy("Drawing properties")} title={copy("Drawing properties")} onClick={() => { setSelectedId(item.id); setPropertiesDrawingId(item.id); }}><Settings2 size={13} /></button>
          <button type="button" aria-label={item.hidden ? copy("Show drawing") : copy("Hide drawing")} onClick={() => setDrawings((current) => current.map((d) => d.id === item.id ? { ...d, hidden: !d.hidden } : d))}>{item.hidden ? <EyeOff size={13} /> : <Eye size={13} />}</button>
          <button type="button" aria-label={item.locked ? copy("Unlock drawing") : copy("Lock drawing")} onClick={() => setDrawings((current) => current.map((d) => d.id === item.id ? { ...d, locked: !d.locked } : d))}>{item.locked ? <Lock size={13} /> : <Unlock size={13} />}</button>
          <button type="button" aria-label={copy("Delete drawing")} onClick={() => setDrawings((current) => current.filter((d) => d.id !== item.id))}><Trash2 size={13} /></button>
        </div>)}
      </div>}
      <svg
        ref={svgRef}
        className="btm-drawoverlay"
        width={width}
        height={height}
        onPointerDown={onSvgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={onSvgPointerUp}
        onPointerCancel={cancelGesture}
        onPointerLeave={() => setHoverSnap(null)}
        onContextMenu={handleCanvasContextMenu}
        role="presentation"
        style={{
          touchAction: toolActive || selectedId || activeDragItem || engine.pickingOrderPrice ? "none" : undefined,
          pointerEvents: toolActive || selectedId || activeDragItem || engine.pickingOrderPrice ? "auto" : "none",
          cursor: toolActive || engine.pickingOrderPrice ? "crosshair" : undefined,
        }}
      >
        <defs>
          <clipPath id="btm-draw-pane-clip">
            <rect x={0} y={0} width={projector.paneWidth ?? width} height={projector.paneHeight ?? height} />
          </clipPath>
        </defs>
        <g clipPath="url(#btm-draw-pane-clip)">
          {drawings.map((item) => renderShape(activeDragItem && activeDragItem.id === item.id ? activeDragItem.drawing : item))}
          {draftShape && renderShape(draftShape, true)}
        </g>
        {toolActive && snapX != null && snapY != null && (
          <circle cx={snapX} cy={snapY} r={4.5} fill="none" stroke="#3b82f6" strokeWidth={1.6} pointerEvents="none" />
        )}
      </svg>
      {selectedDrawing && !toolActive && (
        <div
          className="btm-draw-toolbar"
          style={{ left: toolbarPos.x, top: toolbarPos.y }}
          role="toolbar"
          aria-label={copy("Drawing properties")}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="btm-draw-grip"
            title="Trascina barra proprietà (TradingView Pro)"
            aria-label="Trascina barra proprietà"
            onPointerDown={handleToolbarGripPointerDown}
            onPointerMove={handleToolbarGripPointerMove}
            onPointerUp={handleToolbarGripPointerUp}
            onPointerCancel={handleToolbarGripPointerUp}
          >
            <GripVertical size={14} />
          </button>
          {("color" in selectedDrawing || selectedDrawing.kind === "position") && (
            <div className="btm-draw-swatches">
              {[...QUICK_PALETTE, ...engine.chartPreferences.preferences.favoriteColors.filter((c) => !QUICK_PALETTE.includes(c))].slice(0, 12).map((c) => (
                <button
                  key={c}
                  type="button"
                  className="btm-draw-swatch"
                  data-active={(selectedDrawing.color ?? "#10b981") === c}
                  style={{ backgroundColor: c }}
                  onClick={() => updateDrawing(selectedDrawing.kind === "position" ? { color: c, targetColor: c } : { color: c })}
                  title={c}
                  aria-label={c}
                />
              ))}
            </div>
          )}
          {"width" in selectedDrawing && selectedDrawing.kind !== "highlighter" && (
            <div className="btm-draw-widths">
              {[1, 2, 3, 4, 6].map((w) => (
                <button
                  key={w}
                  type="button"
                  className="btm-draw-width-btn"
                  data-active={selectedDrawing.width === w}
                  onClick={() => updateDrawing({ width: w })}
                >
                  {w}px
                </button>
              ))}
            </div>
          )}
          {"width" in selectedDrawing && !["arrowUp", "arrowDown", "highlighter", "frvp"].includes(selectedDrawing.kind) && (
            <select aria-label={copy("Line style")} value={"style" in selectedDrawing ? (selectedDrawing.style ?? "solid") : "solid"}
              onChange={(event) => updateDrawing({ style: event.target.value })}>
              <option value="solid">{copy("Solid")}</option><option value="dashed">{copy("Dashed")}</option><option value="dotted">{copy("Dotted")}</option>
            </select>
          )}
          {("color" in selectedDrawing || selectedDrawing.kind === "position") && <input type="color" aria-label={copy("Custom drawing color")}
            value={/^#[0-9a-f]{6}$/i.test(selectedDrawing.color ?? "") ? (selectedDrawing.color as string) : "#3b82f6"}
            onChange={(event) => updateDrawing(selectedDrawing.kind === "position" ? { color: event.target.value, targetColor: event.target.value } : { color: event.target.value })} />}
          {(selectedDrawing.kind === "rect" || selectedDrawing.kind === "parallelChannel" || selectedDrawing.kind === "highlighter" || selectedDrawing.kind === "position") && <label>{copy("Fill")} <input type="range" min="0" max="1" step="0.05"
            aria-label={copy("Fill opacity")} value={selectedDrawing.fillOpacity ?? (selectedDrawing.kind === "highlighter" ? 0.32 : 0.12)}
            onChange={(event) => updateDrawing({ fillOpacity: Number(event.target.value) })} /></label>}
          {(selectedDrawing.kind === "rect" || selectedDrawing.kind === "parallelChannel") && (
            <button
              type="button"
              className="btm-draw-action-btn"
              aria-label={copy("Midline 50%")}
              title={copy("Midline 50%")}
              aria-pressed={Boolean(selectedDrawing.showMidline)}
              onClick={() => updateDrawing({ showMidline: !selectedDrawing.showMidline })}
            >
              <Minus size={13} />
            </button>
          )}
          {selectedDrawing.kind === "position" && (
            <button
              type="button"
              className="btm-draw-action-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "2px 9px",
                background: "rgba(197, 160, 89, 0.2)",
                border: "1px solid rgba(197, 160, 89, 0.5)",
                borderRadius: "5px",
                color: "#f3d88c",
                fontWeight: 700,
                fontSize: 10,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
              title={uiText("backtest_terminal.order_from_drawing")}
              onClick={() => engine.executeDrawingOrder?.(selectedDrawing as Parameters<NonNullable<typeof engine.executeDrawingOrder>>[0])}
            >
              <Zap size={11} className="text-[#e8c56a]" />
              <span className="whitespace-nowrap">{uiText("backtest_terminal.order_from_drawing")}</span>
            </button>
          )}
          {(selectedDrawing.kind === "rect" || selectedDrawing.kind === "fib" || selectedDrawing.kind === "frvp" || selectedDrawing.kind === "trend") && (
            <button
              type="button"
              className="btm-draw-action-btn"
              aria-label={copy("Extend right")}
              title={copy("Extend right")}
              aria-pressed={Boolean(selectedDrawing.extendRight)}
              onClick={() => updateDrawing({ extendRight: !selectedDrawing.extendRight })}
            >
              <ArrowRightFromLine size={13} />
            </button>
          )}
          {(selectedDrawing.kind === "text" || selectedDrawing.kind === "callout" || selectedDrawing.kind === "hline" || selectedDrawing.kind === "hray" || selectedDrawing.kind === "arrowUp" || selectedDrawing.kind === "arrowDown") && (
            <input
              aria-label={copy("Drawing text")}
              placeholder={copy("Drawing text")}
              value={selectedDrawing.text ?? ""}
              onChange={(event) => updateDrawing({ text: event.target.value })}
            />
          )}
          {(selectedDrawing.kind === "text" || selectedDrawing.kind === "callout") && (
            <input type="number" aria-label={copy("Text size")} min="8" max="72" value={selectedDrawing.fontSize ?? 12}
              onChange={(event) => updateDrawing({ fontSize: Math.min(72, Math.max(8, Number(event.target.value) || 12)) })} />
          )}
          <button
            type="button"
            className="btm-draw-action-btn"
            onClick={() => setPropertiesDrawingId(selectedDrawing.id)}
            title="Impostazioni avanzate (Input · Stile · Coordinate · Visibilità)"
            aria-label={copy("Drawing properties")}
          >
            <Settings2 size={13} />
          </button>
          {onOpenKnowledge && (
            <button
              type="button"
              className="btm-draw-action-btn"
              onClick={() =>
                onOpenKnowledge(
                  selectedDrawing.kind === "position"
                    ? selectedDrawing.direction === "buy"
                      ? "longPosition"
                      : "shortPosition"
                    : (selectedDrawing.kind as DrawingToolId),
                )
              }
              title="Guida e spiegazione di questo strumento"
              aria-label="Info strumento"
            >
              <HelpCircle size={13} />
            </button>
          )}
          <button type="button" className="btm-draw-action-btn" aria-label={selectedDrawing.locked ? copy("Unlock drawing") : copy("Lock drawing")}
            aria-pressed={Boolean(selectedDrawing.locked)} onClick={() => updateDrawing({ locked: !selectedDrawing.locked })}>
            {selectedDrawing.locked ? <Lock size={13} /> : <Unlock size={13} />}</button>
          <button type="button" className="btm-draw-action-btn" aria-label={selectedDrawing.hidden ? copy("Show drawing") : copy("Hide drawing")}
            onClick={() => updateDrawing({ hidden: !selectedDrawing.hidden })}>{selectedDrawing.hidden ? <EyeOff size={13} /> : <Eye size={13} />}</button>
          <button
            type="button"
            className="btm-draw-action-btn"
            onClick={duplicateDrawing}
            title={copy("Duplicate drawing")}
            aria-label={copy("Duplicate drawing")}
          >
            <Copy size={13} />
          </button>
          <button
            type="button"
            className="btm-draw-action-btn btm-draw-delete-btn"
            onClick={deleteDrawing}
            title={copy("Delete drawing")}
            aria-label={copy("Delete drawing")}
          >
            <Trash2 size={13} />
          </button>
          <button
            type="button"
            className="btm-draw-action-btn"
            onClick={() => setSelectedId(null)}
            title={uiText("common.close")}
            aria-label={uiText("common.close")}
          >
            <X size={13} />
          </button>
        </div>
      )}
      {contextMenu && (
        <div
          className="limen-context-menu"
          style={{
            position: "fixed",
            left: Math.min(contextMenu.x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 230),
            top: Math.min(contextMenu.y, (typeof window !== "undefined" ? window.innerHeight : 800) - (contextMenu.type === "drawing" ? 280 : 180)),
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {contextMenu.type === "drawing" && contextDrawing && (
            <>
              <div className="limen-cm-header">
                <span className="limen-cm-title">
                  {TOOL_TITLES[contextDrawing.kind] ?? "STRUMENTO"}
                </span>
                {contextDrawing.locked && <Lock size={11} className="text-[#C5A059]" />}
              </div>
              <div className="limen-cm-divider" />
              <button
                type="button"
                className="limen-cm-item"
                onClick={() => {
                  setPropertiesDrawingId(contextDrawing.id);
                  setContextMenu(null);
                }}
              >
                <Settings2 size={13} className="text-[#C5A059]" />
                <span>Impostazioni avanzate...</span>
                <span className="limen-cm-shortcut">2x Click</span>
              </button>
              {contextDrawing.kind === "position" && (
                <button
                  type="button"
                  className="limen-cm-item limen-cm-gold"
                  onClick={() => {
                    engine.executeDrawingOrder?.(contextDrawing as any);
                    setContextMenu(null);
                  }}
                >
                  <Zap size={13} className="text-[#E8C56A]" />
                  <span>Piazza Ordine da Posizione</span>
                </button>
              )}
              <button
                type="button"
                className="limen-cm-item"
                onClick={() => {
                  const nextId = makeId();
                  const unlocked = { ...contextDrawing, locked: false, hidden: false } as ReplayDrawing;
                  const shifted = moveDrawing(unlocked, engine.intervalSeconds, 10 / getPipMultiplier(symbol));
                  setDrawings([...drawings, { ...shifted, id: nextId }]);
                  setSelectedId(nextId);
                  setContextMenu(null);
                }}
              >
                <Copy size={13} />
                <span>Duplica strumento</span>
                <span className="limen-cm-shortcut">⌘D</span>
              </button>
              <button
                type="button"
                className="limen-cm-item"
                onClick={() => {
                  setDrawings((curr) => curr.map((d) => d.id === contextDrawing.id ? { ...d, locked: !d.locked } : d));
                  setContextMenu(null);
                }}
              >
                {contextDrawing.locked ? <Unlock size={13} /> : <Lock size={13} />}
                <span>{contextDrawing.locked ? "Sblocca modifiche" : "Blocca sul grafico"}</span>
              </button>
              <button
                type="button"
                className="limen-cm-item"
                onClick={() => {
                  setDrawings((curr) => curr.map((d) => d.id === contextDrawing.id ? { ...d, hidden: !d.hidden } : d));
                  setContextMenu(null);
                }}
              >
                {contextDrawing.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                <span>{contextDrawing.hidden ? "Mostra sul grafico" : "Nascondi temporaneamente"}</span>
              </button>
              <div className="limen-cm-divider" />
              <button
                type="button"
                className="limen-cm-item limen-cm-danger"
                onClick={() => {
                  setDrawings((curr) => curr.filter((d) => d.id !== contextDrawing.id));
                  if (selectedId === contextDrawing.id) setSelectedId(null);
                  setContextMenu(null);
                }}
              >
                <Trash2 size={13} />
                <span>Elimina strumento</span>
                <span className="limen-cm-shortcut">Canc</span>
              </button>
            </>
          )}
          {contextMenu.type === "canvas" && (
            <>
              <div className="limen-cm-header">
                <span className="limen-cm-title">AREA GRAFICO · AUREUS</span>
              </div>
              {contextMenu.price !== undefined && (
                <>
                  <div className="limen-cm-divider" />
                  <button
                    type="button"
                    className="limen-cm-item limen-cm-gold"
                    onClick={() => {
                      if (contextMenu.price !== undefined) {
                        onAddAlert?.(contextMenu.price);
                      }
                      setContextMenu(null);
                    }}
                  >
                    <Bell size={13} className="text-[#E8C56A]" />
                    <span>
                      Allerta Prezzo a{" "}
                      <span className="font-mono text-[#E8C56A] whitespace-nowrap">
                        {formatPrice(contextMenu.price, symbol)}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="limen-cm-item"
                    onClick={() => {
                      if (contextMenu.price !== undefined && setTicket) {
                        setTicket((prev: any) => ({
                          ...prev,
                          orderType: "LIMIT",
                          limitPrice: contextMenu.price,
                        }));
                      }
                      setContextMenu(null);
                    }}
                  >
                    <Zap size={13} className="text-[#C5A059]" />
                    <span>
                      Piazza Limite a{" "}
                      <span className="font-mono text-[#E8C56A] whitespace-nowrap">
                        {formatPrice(contextMenu.price, symbol)}
                      </span>
                    </span>
                  </button>
                  {contextMenu.time !== undefined && onSeekToTime && (
                    <button
                      type="button"
                      className="limen-cm-item"
                      onClick={() => {
                        if (contextMenu.time !== undefined) {
                          onSeekToTime(contextMenu.time);
                        }
                        setContextMenu(null);
                        onClearExternalContextMenu?.();
                      }}
                    >
                      <Clock size={13} className="text-[#C5A059]" />
                      <span>Salta Replay a questa Barra</span>
                    </button>
                  )}
                </>
              )}
              <div className="limen-cm-divider" />
              <button
                type="button"
                className="limen-cm-item"
                onClick={() => {
                  const anyHidden = drawings.some((x) => x.hidden);
                  setDrawings((curr) => curr.map((d) => ({ ...d, hidden: anyHidden ? false : true })));
                  setContextMenu(null);
                }}
              >
                <Eye size={13} />
                <span>{drawings.some((x) => x.hidden) ? "Mostra tutti i disegni" : "Nascondi tutti i disegni"}</span>
              </button>
              {drawings.length > 0 && (
                <button
                  type="button"
                  className="limen-cm-item limen-cm-danger"
                  onClick={() => {
                    if (window.confirm(`Rimuovere tutti i ${drawings.length} strumenti disegnati dal grafico?`)) {
                      setDrawings([]);
                      setSelectedId(null);
                    }
                    setContextMenu(null);
                  }}
                >
                  <Trash2 size={13} />
                  <span>Rimuovi tutti i disegni ({drawings.length})</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
      {propertiesDrawing && (
        <DrawingPropertiesModal
          drawing={propertiesDrawing}
          candles={revealed}
          intervalSeconds={engine.intervalSeconds}
          symbol={symbol}
          onClose={() => setPropertiesDrawingId(null)}
          onApply={(updated: ReplayDrawing) => {
            setDrawings((current) => current.map((d) => (d.id === updated.id ? updated : d)));
          }}
          onOpenKnowledge={onOpenKnowledge}
        />
      )}
      {toolActive && activeTool === "path" && (
        <div className="btm-drawing-hint">{copy("Click points to build path · Double-click or Enter to finish · Esc to cancel")}</div>
      )}
      {toolActive && activeTool === "highlighter" && (
        <div className="btm-drawing-hint">{copy("Drag on chart to highlight · Esc to cancel")}</div>
      )}
      {toolActive && !["hline", "vline", "hray", "avwap", "arrowUp", "arrowDown", "text", "callout", "longPosition", "shortPosition", "path", "highlighter"].includes(activeTool) && (
        <div className="btm-drawing-hint">{copy("Click start and end, or drag · Esc to cancel")}</div>
      )}
      {textDraft && (
        <input
          className="btm-input"
          style={{ position: "absolute", left: textDraft.x, top: textDraft.y, width: 160, zIndex: 7 }}
          autoFocus
          aria-label={uiText("backtest_terminal.tool_text")}
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (value && !textCancelled.current) {
              setDrawings([
                ...drawings,
                textDraft.kind === "callout"
                  ? {
                      id: makeId(),
                      kind: "callout",
                      at: textDraft.at,
                      text: value,
                      color: settings.toolColor || "#3b82f6",
                    }
                  : { id: makeId(), kind: "text", at: textDraft.at, text: value, color: settings.toolColor },
              ]);
            }
            setTextDraft(null);
            finishTool();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") (event.target as HTMLInputElement).blur();
            if (event.key === "Escape") {
              event.preventDefault();
              textCancelled.current = true;
              setTextDraft(null);
              onToolDone();
            }
          }}
        />
      )}
    </>
  );
});
