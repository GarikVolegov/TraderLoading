import { Magnet, Settings2, Trash2 } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";
import { DRAWING_TOOLS, type DrawingToolId } from "./toolRailModel";
import type { ReplayEngine } from "./useReplayEngine";

const GROUPS: DrawingToolId[][] = [
  ["cursor"], ["trend", "hline", "fib"], ["rect", "text", "ruler"],
  ["longPosition", "shortPosition"],
];

export function ToolRail({ engine, activeTool, onToolChange, onOpenSettings }: {
  engine: ReplayEngine;
  activeTool: DrawingToolId;
  onToolChange: (tool: DrawingToolId) => void;
  onOpenSettings: () => void;
}) {
  return (
    <aside className="btm-rail" aria-label={uiText("backtest_terminal.tools")}>
      {GROUPS.map((ids, index) => {
        const tools = DRAWING_TOOLS.filter((tool) => ids.includes(tool.id) && engine.settings.visibleTools[tool.id] !== false);
        if (tools.length === 0) return null;
        return (
          <div className="btm-toolgroup" key={index}>
            {tools.map((tool) => (
              <button key={tool.id} type="button" className="btm-iconbtn btm-toolbtn"
                data-active={activeTool === tool.id} aria-pressed={activeTool === tool.id}
                onClick={() => onToolChange(activeTool === tool.id ? "cursor" : tool.id)}
                title={uiText(tool.labelKey)} aria-label={uiText(tool.labelKey)}>
                <tool.Icon size={19} strokeWidth={1.6} />
                <span className="btm-tooltooltip" aria-hidden="true">{uiText(tool.labelKey)}</span>
              </button>
            ))}
          </div>
        );
      })}
      <div className="btm-toolgroup">
        <button type="button" className="btm-iconbtn btm-toolbtn" data-active={engine.settings.magnet}
          aria-pressed={engine.settings.magnet}
          onClick={() => engine.setSettings({ ...engine.settings, magnet: !engine.settings.magnet })}
          title={uiText("backtest_terminal.magnet")} aria-label={uiText("backtest_terminal.magnet")}>
          <Magnet size={18} strokeWidth={1.6} />
          <span className="btm-tooltooltip" aria-hidden="true">{uiText("backtest_terminal.magnet")}</span>
        </button>
        <button type="button" className="btm-iconbtn btm-toolbtn" onClick={onOpenSettings}
          title={uiText("backtest_terminal.tools_tab")} aria-label={uiText("backtest_terminal.tools_tab")}>
          <Settings2 size={18} strokeWidth={1.6} />
          <span className="btm-tooltooltip" aria-hidden="true">{uiText("backtest_terminal.tools_tab")}</span>
        </button>
      </div>
      <div className="btm-rail-bottom">
        <details className="btm-rail-menu">
          <summary className="btm-iconbtn" title={uiText("backtest_terminal.clear_drawings")} aria-label={uiText("backtest_terminal.clear_drawings")}>
            <Trash2 size={18} strokeWidth={1.6} />
          </summary>
          <div className="btm-rail-menucontent">
            <button type="button" disabled={engine.drawings.length === 0} onClick={(event) => {
              engine.setDrawings([]);
              onToolChange("cursor");
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}>{uiText("backtest_terminal.clear_drawings")} <span>{engine.drawings.length}</span></button>
          </div>
        </details>
      </div>
    </aside>
  );
}
