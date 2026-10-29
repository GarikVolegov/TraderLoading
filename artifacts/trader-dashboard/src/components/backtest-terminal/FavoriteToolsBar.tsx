import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, GripVertical, Minimize2, PencilRuler } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";
import { DRAWING_TOOLS, type DrawingToolId } from "./toolRailModel";
import type { ReplayEngine } from "./useReplayEngine";
import "./chart-workspace.css";

export function FavoriteToolsBar({ engine, activeTool, onToolChange }: {
  engine: ReplayEngine; activeTool: DrawingToolId; onToolChange: (tool: DrawingToolId) => void;
}) {
  const { preferences, update } = engine.chartPreferences;
  const ref = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState(preferences.toolbarPosition);
  const [selected, setSelected] = useState<string | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; startX: number; startY: number; tool?: string; moved: boolean } | null>(null);
  const visibleTools = engine.settings.visibleTools;
  const tools = preferences.favoriteTools.flatMap(id => {
    const tool = DRAWING_TOOLS.find(tool => tool.id === id && tool.id !== "cursor" && visibleTools[tool.id] !== false);
    return tool ? [tool] : [];
  });
  const bound = (x: number, y: number) => {
    const bar = ref.current;
    const parentW = bar?.parentElement?.clientWidth ?? 500;
    const parentH = bar?.parentElement?.clientHeight ?? 400;
    let targetX = x;
    let targetY = y;
    // Ancoraggio nobile in basso a sinistra se alle coordinate di default per non coprire le candele
    if ((x <= 120 && y <= 120) || (x === 16 && y === 64)) {
      targetX = 55;
      targetY = Math.max(60, parentH - 75);
    }
    return {
      x: Math.max(0, Math.min(targetX, Math.max(0, parentW - (bar?.offsetWidth ?? 0)))),
      y: Math.max(0, Math.min(targetY, Math.max(0, parentH - (bar?.offsetHeight ?? 0)))),
    };
  };
  useEffect(() => setPosition(bound(preferences.toolbarPosition.x, preferences.toolbarPosition.y)), [preferences.toolbarPosition.x, preferences.toolbarPosition.y]);
  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setPosition(previous => bound(previous.x, previous.y)));
    observer.observe(parent);
    return () => observer.disconnect();
  }, [tools.length]);
  const reorder = (id: string, target: string) => update(previous => {
    const targetIndex = previous.favoriteTools.indexOf(target);
    const favoriteTools = previous.favoriteTools.filter(tool => tool !== id);
    favoriteTools.splice(Math.max(0, targetIndex), 0, id);
    return { ...previous, favoriteTools };
  });
  if (engine.settings.showFavoriteToolbar === false || !tools.length) return null;

  if (collapsed) {
    return (
      <div
        ref={ref}
        className="btm-favorite-bar btm-favorite-bar-collapsed"
        style={{ left: position.x, top: position.y }}
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation();
          setCollapsed(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") setCollapsed(false);
        }}
        title="Espandi barra strumenti rapidi"
        aria-label="Espandi barra strumenti rapidi"
      >
        <PencilRuler size={15} style={{ color: "#E8C56A" }} />
      </div>
    );
  }

  return <div ref={ref} className="btm-favorite-bar" style={{ left: position.x, top: position.y }} role="toolbar" aria-label={uiText("backtest_terminal.favorite_toolbar")} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
    onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSelected(null);
    }}
    onPointerMove={event => {
      event.stopPropagation();
      const current = drag.current;
      if (!current || current.id !== event.pointerId) return;
      if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > 8) current.moved = true;
      if (!current.moved) return;
      if (current.tool) {
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-favorite-tool]")?.dataset.favoriteTool;
        if (target && target !== current.tool) reorder(current.tool, target);
      } else setPosition(bound(current.startX + event.clientX - current.x, current.startY + event.clientY - current.y));
    }}
    onPointerUp={event => {
      event.stopPropagation();
      const current = drag.current;
      if (!current || current.id !== event.pointerId) return;
      drag.current = null;
      if (!current.tool) update(previous => ({ ...previous, toolbarPosition: position }));
      else if (!current.moved) onToolChange(activeTool === current.tool ? "cursor" : current.tool as DrawingToolId);
    }} onPointerCancel={() => { drag.current = null; setPosition(bound(preferences.toolbarPosition.x, preferences.toolbarPosition.y)); }}>
    <button type="button" className="btm-favorite-grip" aria-label="Sposta barra preferiti: trascina o usa i tasti freccia" title="Sposta barra preferiti" onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: position.x, startY: position.y, moved: false }; }} onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const next = bound(position.x + (event.key === "ArrowLeft" ? -10 : event.key === "ArrowRight" ? 10 : 0), position.y + (event.key === "ArrowUp" ? -10 : event.key === "ArrowDown" ? 10 : 0));
      setPosition(next); update(previous => ({ ...previous, toolbarPosition: next }));
    }}><GripVertical size={18} /></button>
    <button
      type="button"
      className="btm-favorite-minimize"
      aria-label="Minimizza barra preferiti"
      title="Minimizza barra strumenti preferiti"
      onClick={(e) => {
        e.stopPropagation();
        setCollapsed(true);
      }}
    >
      <Minimize2 size={13} />
    </button>
    <div className="btm-favorite-items">
      {tools.map((tool) => (
        <button
          key={tool.id}
          data-favorite-tool={tool.id}
          type="button"
          className="btm-favorite-tool"
          data-active={activeTool === tool.id}
          aria-pressed={activeTool === tool.id}
          aria-label={uiText(tool.labelKey)}
          title={`${uiText(tool.labelKey)}`}
          onFocus={(event) => {
            if (event.currentTarget.matches(":focus-visible")) setSelected(tool.id);
          }}
          onClick={(event) => {
            event.stopPropagation();
            onToolChange(activeTool === tool.id ? "cursor" : (tool.id as DrawingToolId));
          }}
          onKeyDown={(event) => {
            if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            setSelected(tool.id);
            const index = preferences.favoriteTools.indexOf(tool.id);
            const other = index + (event.key === "ArrowLeft" ? -1 : 1);
            if (other < 0 || other >= preferences.favoriteTools.length) return;
            update((previous) => {
              const favoriteTools = [...previous.favoriteTools];
              [favoriteTools[index], favoriteTools[other]] = [favoriteTools[other], favoriteTools[index]];
              return { ...previous, favoriteTools };
            });
          }}
        >
          <tool.Icon size={24} strokeWidth={1.55} />
        </button>
      ))}
    </div>
    {selected && <div className="btm-favorite-order">{([-1, 1] as const).map(direction => <button type="button" key={direction} aria-label={direction < 0 ? "Sposta preferito a sinistra" : "Sposta preferito a destra"} disabled={preferences.favoriteTools.indexOf(selected) + direction < 0 || preferences.favoriteTools.indexOf(selected) + direction >= preferences.favoriteTools.length} onClick={() => update(previous => { const favoriteTools = [...previous.favoriteTools]; const index = favoriteTools.indexOf(selected); const other = index + direction; if (other >= 0 && other < favoriteTools.length) [favoriteTools[index], favoriteTools[other]] = [favoriteTools[other], favoriteTools[index]]; return { ...previous, favoriteTools }; })}>{direction < 0 ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}</button>)}</div>}
  </div>;
}
