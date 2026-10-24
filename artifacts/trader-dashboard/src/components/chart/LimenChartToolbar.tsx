import { useState } from "react";
import {
  Crosshair,
  TrendingUp,
  Square,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Ruler,
  Type,
  Highlighter,
  Magnet,
  Trash2,
  Undo2,
  Redo2,
  Minus,
  ArrowRightFromLine,
  Sliders,
} from "lucide-react";
import type { DrawingToolId } from "../backtest-terminal/toolRailModel";

export interface LimenChartToolbarProps {
  activeTool: DrawingToolId;
  onSelectTool: (tool: DrawingToolId) => void;
  magnetEnabled: boolean;
  onToggleMagnet: () => void;
  onClearDrawings: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  drawingCount?: number;
}

export function LimenChartToolbar({
  activeTool,
  onSelectTool,
  magnetEnabled,
  onToggleMagnet,
  onClearDrawings,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  drawingCount = 0,
}: LimenChartToolbarProps) {
  const [lineMenuOpen, setLineMenuOpen] = useState(false);
  const [posMenuOpen, setPosMenuOpen] = useState(false);

  return (
    <div className="limen-chart-toolbar" role="toolbar" aria-label="Strumenti Grafico">
      {/* 1. Puntatore / Crosshair */}
      <button
        type="button"
        className={`limen-tool-btn ${activeTool === "cursor" ? "is-active" : ""}`}
        title="Puntatore a croce (Crosshair)"
        onClick={() => onSelectTool("cursor")}
      >
        <Crosshair size={15} />
      </button>

      {/* 2. Linee (Trend, Ray, HLine, HRay) */}
      <div className="relative group">
        <button
          type="button"
          className={`limen-tool-btn ${
            ["trend", "ray", "hline", "hray"].includes(activeTool) ? "is-active" : ""
          }`}
          title="Linee Strutturali (Trendline, Semiretta, Orizzontale)"
          onClick={() => {
            if (activeTool === "trend") onSelectTool("hray");
            else if (activeTool === "hray") onSelectTool("hline");
            else onSelectTool("trend");
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setLineMenuOpen(!lineMenuOpen);
          }}
        >
          {activeTool === "hline" ? (
            <Minus size={15} />
          ) : activeTool === "hray" ? (
            <ArrowRightFromLine size={15} />
          ) : (
            <TrendingUp size={15} />
          )}
        </button>
      </div>

      {/* 3. Rettangolo SMC (FVG / Orderblock / Liquidità) */}
      <button
        type="button"
        className={`limen-tool-btn ${activeTool === "rect" ? "is-active" : ""}`}
        title="Rettangolo SMC (Fair Value Gap / Orderblock / Range Liquidità)"
        onClick={() => onSelectTool("rect")}
      >
        <Square size={15} />
      </button>

      {/* 4. Fibonacci Retracement */}
      <button
        type="button"
        className={`limen-tool-btn ${activeTool === "fib" ? "is-active" : ""}`}
        title="Ritracciamento di Fibonacci (Golden Pocket 0.618, 0.5, 0.786)"
        onClick={() => onSelectTool("fib")}
      >
        <Percent size={15} />
      </button>

      {/* 5. Tool Posizione (Long & Short con Risk:Reward) */}
      <div className="flex flex-col gap-1">
        <button
          type="button"
          className={`limen-tool-btn ${activeTool === "longPosition" ? "is-active" : ""}`}
          title="Posizione Long (Risk/Reward, Stop Loss, Target)"
          onClick={() => onSelectTool("longPosition")}
        >
          <ArrowUpRight size={15} className="text-emerald-400" />
        </button>
        <button
          type="button"
          className={`limen-tool-btn ${activeTool === "shortPosition" ? "is-active" : ""}`}
          title="Posizione Short (Risk/Reward, Stop Loss, Target)"
          onClick={() => onSelectTool("shortPosition")}
        >
          <ArrowDownRight size={15} className="text-rose-400" />
        </button>
      </div>

      {/* 6. Misuratore (Ruler) */}
      <button
        type="button"
        className={`limen-tool-btn ${activeTool === "ruler" ? "is-active" : ""}`}
        title="Misuratore Pips e Durata Barre (Ruler)"
        onClick={() => onSelectTool("ruler")}
      >
        <Ruler size={15} />
      </button>

      {/* 7. Testo Annotazione */}
      <button
        type="button"
        className={`limen-tool-btn ${activeTool === "text" ? "is-active" : ""}`}
        title="Nota Testuale sul Grafico"
        onClick={() => onSelectTool("text")}
      >
        <Type size={15} />
      </button>

      {/* 8. Evidenziatore / Brush */}
      <button
        type="button"
        className={`limen-tool-btn ${activeTool === "highlighter" ? "is-active" : ""}`}
        title="Evidenziatore / Percorso a mano libera"
        onClick={() => onSelectTool("highlighter")}
      >
        <Highlighter size={15} />
      </button>

      <div className="limen-toolbar-divider" />

      {/* 9. Magnete (Snap su H/L candele) */}
      <button
        type="button"
        className={`limen-tool-btn ${magnetEnabled ? "is-magnet-active" : ""}`}
        title={magnetEnabled ? "Magnete Attivo (Snap ai vertici OHLC)" : "Attiva Magnete"}
        onClick={onToggleMagnet}
      >
        <Magnet size={15} className={magnetEnabled ? "text-[#d4af37]" : ""} />
      </button>

      {/* 10. Undo / Redo */}
      {onUndo && (
        <button
          type="button"
          disabled={!canUndo}
          className="limen-tool-btn"
          title="Annulla disegno (Undo)"
          onClick={onUndo}
        >
          <Undo2 size={14} />
        </button>
      )}

      {/* 11. Elimina Disegni */}
      <button
        type="button"
        disabled={drawingCount === 0}
        className="limen-tool-btn hover:text-rose-400"
        title={drawingCount > 0 ? `Elimina tutti i disegni (${drawingCount})` : "Nessun disegno da eliminare"}
        onClick={() => {
          if (drawingCount > 0 && window.confirm("Eliminare tutti i disegni tracciati su questo grafico?")) {
            onClearDrawings();
          }
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
