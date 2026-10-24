import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  HelpCircle,
  Layers,
  Lock,
  Magnet,
  RotateCcw,
  Search,
  Settings2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";
import { DEFAULT_FAVORITE_TOOLS } from "../../../../../contracts/backtestChart";
import {
  DRAWING_TOOLS,
  DRAWING_TOOL_CATEGORIES,
  type DrawingToolCategoryId,
  type DrawingToolId,
  type DrawingToolMeta,
} from "./toolRailModel";
import { TOOL_KNOWLEDGE_CATALOG } from "./toolKnowledgeCatalog";
import "./chart-workspace.css";
import type { ReplayEngine } from "./useReplayEngine";

const GROUPS: DrawingToolId[][] = [
  ["cursor"],
  ["trend", "ray", "infoline", "hray", "hline", "vline", "parallelChannel", "arrow", "path"],
  ["rect", "highlighter", "text", "callout", "arrowUp", "arrowDown"],
  ["longPosition", "shortPosition", "fib", "frvp", "avwap", "ruler", "priceRange", "dateRange"],
];

const DEFAULT_CATEGORY_TOOLS: Record<DrawingToolCategoryId, DrawingToolId> = {
  lines: "trend",
  fib_channels: "fib",
  shapes_annotations: "rect",
  forecasting: "longPosition",
  volume_based: "frvp",
  measurers: "ruler",
};

export function ToolRail({
  engine,
  activeTool,
  onToolChange,
  onOpenSettings,
  onOpenKnowledge,
}: {
  engine: ReplayEngine;
  activeTool: DrawingToolId;
  onToolChange: (tool: DrawingToolId) => void;
  onOpenSettings: () => void;
  onOpenKnowledge?: (tool: DrawingToolId) => void;
}) {
  const [openFlyoutCategory, setOpenFlyoutCategory] = useState<DrawingToolCategoryId | null>(null);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [selectedCategoryTools, setSelectedCategoryTools] = useState<Record<DrawingToolCategoryId, DrawingToolId>>(
    DEFAULT_CATEGORY_TOOLS,
  );
  const flyoutRef = useRef<HTMLDivElement>(null);

  const favoriteTools = engine.chartPreferences.preferences.favoriteTools;

  // Sincronizza l'ultimo strumento usato per categoria quando l'utente cambia activeTool
  useEffect(() => {
    if (activeTool === "cursor") return;
    const cat = DRAWING_TOOL_CATEGORIES.find((c) => c.tools.includes(activeTool));
    if (cat) {
      setSelectedCategoryTools((prev) => ({
        ...prev,
        [cat.id]: activeTool,
      }));
    }
  }, [activeTool]);

  const toggleFavorite = (toolId: DrawingToolId) => {
    engine.chartPreferences.update((previous) => ({
      ...previous,
      favoriteTools: previous.favoriteTools.includes(toolId)
        ? previous.favoriteTools.filter((id) => id !== toolId)
        : [...previous.favoriteTools, toolId],
    }));
  };

  const cursorTool = DRAWING_TOOLS.find((t) => t.id === "cursor") ?? DRAWING_TOOLS[0];

  return (
    <aside
      id="replay-drawing-tools"
      className="btm-rail"
      aria-label={uiText("backtest_terminal.tools")}
    >
      {/* 1. Strumento Cursore / Mirino Principale */}
      <div className="btm-toolgroup">
        <div className="btm-rail-tool">
          <button
            type="button"
            className="btm-iconbtn btm-toolbtn"
            data-active={activeTool === "cursor"}
            aria-pressed={activeTool === "cursor"}
            onClick={() => {
              onToolChange("cursor");
              setOpenFlyoutCategory(null);
            }}
            title={uiText(cursorTool.labelKey)}
            aria-label={uiText(cursorTool.labelKey)}
          >
            <cursorTool.Icon size={19} strokeWidth={1.6} />
            <span className="btm-tooltooltip" aria-hidden="true">
              {uiText(cursorTool.labelKey)} (Esc)
            </span>
          </button>
        </div>
      </div>

      {/* 2. Le 6 Macro-Categorie Ufficiali TradingView Pro con Flyout */}
      <div className="btm-toolgroup">
        {DRAWING_TOOL_CATEGORIES.map((category) => {
          const currentToolId = selectedCategoryTools[category.id] ?? category.tools[0];
          const currentTool = DRAWING_TOOLS.find((t) => t.id === currentToolId) ?? DRAWING_TOOLS.find((t) => t.id === category.tools[0])!;
          const isCategoryActive = category.tools.includes(activeTool);
          const isFlyoutOpen = openFlyoutCategory === category.id;

          const CurrentIcon = currentTool.Icon;

          return (
            <div key={category.id} className="btm-rail-tool">
              <button
                type="button"
                className="btm-iconbtn btm-toolbtn"
                data-active={isCategoryActive}
                aria-pressed={isCategoryActive}
                onClick={() => {
                  if (activeTool === currentTool.id) {
                    // Clic su categoria già attiva -> apre flyout
                    setOpenFlyoutCategory(isFlyoutOpen ? null : category.id);
                  } else {
                    onToolChange(currentTool.id);
                  }
                }}
                title={`${category.titleIt}: ${uiText(currentTool.labelKey)}`}
                aria-label={category.titleIt}
              >
                <CurrentIcon size={19} strokeWidth={1.6} />
                <span className="btm-tooltooltip" aria-hidden="true">
                  {category.titleIt} ({uiText(currentTool.labelKey)})
                </span>
              </button>
              <button
                type="button"
                className="btm-rail-cat-arrow"
                onClick={(e) => {
                  e.stopPropagation();
                  setCategorySearchQuery("");
                  setOpenFlyoutCategory(isFlyoutOpen ? null : category.id);
                }}
                title={`Scegli strumento in ${category.titleIt}`}
                aria-label={`Espandi ${category.titleIt}`}
              >
                <ChevronRight size={9} />
              </button>

              {/* Flyout laterale per questa categoria */}
              {isFlyoutOpen && (
                <>
                  <div
                    className="btm-flyout-backdrop"
                    onClick={() => setOpenFlyoutCategory(null)}
                  />
                  <div
                    ref={flyoutRef}
                    className="btm-tool-flyout btm-category-flyout"
                    role="menu"
                    aria-label={category.titleIt}
                  >
                    <div className="btm-flyout-header">
                      <div className="btm-flyout-search">
                        <Search size={14} />
                        <input
                          type="text"
                          placeholder={`Cerca in ${category.titleIt}...`}
                          value={categorySearchQuery}
                          onChange={(e) => setCategorySearchQuery(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <button
                        type="button"
                        className="btm-flyout-close"
                        onClick={() => setOpenFlyoutCategory(null)}
                        aria-label="Chiudi menu"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="btm-flyout-body">
                      <div className="btm-flyout-category">{category.titleIt}</div>
                      {category.tools
                        .map((id) => DRAWING_TOOLS.find((t) => t.id === id))
                        .filter((t): t is DrawingToolMeta => Boolean(t))
                        .filter((t) => {
                          if (!categorySearchQuery.trim()) return true;
                          const name = uiText(t.labelKey).toLowerCase();
                          return name.includes(categorySearchQuery.trim().toLowerCase());
                        })
                        .map((tool) => {
                          const isFav = favoriteTools.includes(tool.id);
                          const isAct = activeTool === tool.id;
                          const kEntry = TOOL_KNOWLEDGE_CATALOG[tool.id];
                          const ToolIcon = tool.Icon;

                          return (
                            <div
                              key={tool.id}
                              className={`btm-flyout-row ${isAct ? "is-active" : ""}`}
                              data-active={isAct}
                            >
                              <button
                                type="button"
                                className="btm-flyout-select"
                                onClick={() => {
                                  setSelectedCategoryTools((prev) => ({
                                    ...prev,
                                    [category.id]: tool.id,
                                  }));
                                  onToolChange(tool.id);
                                  setOpenFlyoutCategory(null);
                                }}
                              >
                                <span className="btm-flyout-icon">
                                  <ToolIcon size={18} strokeWidth={1.6} />
                                </span>
                                <span className="btm-flyout-label">{uiText(tool.labelKey)}</span>
                                {tool.shortcut && (
                                  <kbd className="btm-flyout-shortcut">{tool.shortcut}</kbd>
                                )}
                              </button>

                              {/* Puntino Info (?) su hover -> apre Centro di Supporto a destra */}
                              {onOpenKnowledge && (
                                <button
                                  type="button"
                                  className="btm-flyout-info"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenKnowledge(tool.id);
                                  }}
                                  title={`Cos'è e come funziona: ${kEntry?.title ?? uiText(tool.labelKey)}`}
                                  aria-label={`Spiegazione ${uiText(tool.labelKey)}`}
                                >
                                  <HelpCircle size={13} />
                                </button>
                              )}

                              {/* Stellina Preferiti (★) */}
                              <button
                                type="button"
                                className="btm-flyout-star"
                                aria-pressed={isFav}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(tool.id);
                                }}
                                title={isFav ? "Rimuovi dai preferiti" : "Salva nella barra preferiti"}
                                aria-label={`Preferito: ${uiText(tool.labelKey)}`}
                              >
                                <Star size={13} fill={isFav ? "currentColor" : "none"} />
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* 3. Controlli Globali di Disegno (Stile TradingView) */}
      <div className="btm-toolgroup">
        <button
          type="button"
          className="btm-iconbtn btm-toolbtn"
          data-active={Boolean(engine.settings.stayInDrawingMode)}
          aria-pressed={Boolean(engine.settings.stayInDrawingMode)}
          onClick={() =>
            engine.setSettings({
              ...engine.settings,
              stayInDrawingMode: !engine.settings.stayInDrawingMode,
            })
          }
          title={uiText("backtest_terminal.stay_in_drawing")}
          aria-label={uiText("backtest_terminal.stay_in_drawing")}
        >
          <Lock size={17} strokeWidth={1.6} />
          <span className="btm-tooltooltip" aria-hidden="true">
            {uiText("backtest_terminal.stay_in_drawing")}
          </span>
        </button>
        <button
          type="button"
          className="btm-iconbtn btm-toolbtn"
          data-active={engine.settings.magnet}
          aria-pressed={engine.settings.magnet}
          onClick={() =>
            engine.setSettings({ ...engine.settings, magnet: !engine.settings.magnet })
          }
          title={uiText("backtest_terminal.magnet")}
          aria-label={uiText("backtest_terminal.magnet")}
        >
          <Magnet size={18} strokeWidth={1.6} />
          <span className="btm-tooltooltip" aria-hidden="true">
            {uiText("backtest_terminal.magnet")}
          </span>
        </button>
        <button
          type="button"
          className="btm-iconbtn btm-toolbtn"
          data-active={engine.settings.showFavoriteToolbar !== false}
          aria-pressed={engine.settings.showFavoriteToolbar !== false}
          onClick={() =>
            engine.setSettings({
              ...engine.settings,
              showFavoriteToolbar: engine.settings.showFavoriteToolbar === false,
            })
          }
          title={uiText("backtest_terminal.favorite_toolbar")}
          aria-label={uiText("backtest_terminal.favorite_toolbar")}
        >
          <Star
            size={17}
            strokeWidth={1.6}
            fill={engine.settings.showFavoriteToolbar !== false ? "currentColor" : "none"}
          />
          <span className="btm-tooltooltip" aria-hidden="true">
            {uiText("backtest_terminal.favorite_toolbar")}
          </span>
        </button>
        <button
          type="button"
          className="btm-iconbtn btm-toolbtn"
          onClick={onOpenSettings}
          title={uiText("backtest_terminal.tools_tab")}
          aria-label={uiText("backtest_terminal.tools_tab")}
        >
          <Settings2 size={18} strokeWidth={1.6} />
          <span className="btm-tooltooltip" aria-hidden="true">
            {uiText("backtest_terminal.tools_tab")}
          </span>
        </button>
      </div>

      {/* 4. Gestione Disegni & Cestino (In fondo) */}
      <div className="btm-rail-bottom">
        <details className="btm-rail-menu">
          <summary
            className="btm-iconbtn"
            title={uiText("backtest_terminal.clear_drawings")}
            aria-label={uiText("backtest_terminal.clear_drawings")}
          >
            <Trash2 size={18} strokeWidth={1.6} />
          </summary>
          <div className="btm-rail-menucontent">
            <button
              type="button"
              disabled={engine.drawings.length === 0}
              onClick={(event) => {
                engine.setDrawings([]);
                onToolChange("cursor");
                event.currentTarget.closest("details")?.removeAttribute("open");
              }}
            >
              {uiText("backtest_terminal.clear_drawings")} <span>{engine.drawings.length}</span>
            </button>
            <button
              type="button"
              onClick={(event) => {
                engine.chartPreferences.update((previous) => ({
                  ...previous,
                  favoriteTools: [...DEFAULT_FAVORITE_TOOLS],
                }));
                engine.setSettings({ ...engine.settings, showFavoriteToolbar: true });
                event.currentTarget.closest("details")?.removeAttribute("open");
              }}
            >
              <RotateCcw size={13} /> {uiText("backtest_terminal.reset_favorites")}
            </button>
          </div>
        </details>
      </div>
    </aside>
  );
}
