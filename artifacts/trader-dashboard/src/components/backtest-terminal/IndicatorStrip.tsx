// ─── Indicator strip ─────────────────────────────────────────────────────────
// Chips row under the header: one chip per configured indicator (click
// toggles on/off), plus the add/settings entry point.
import { Eye, EyeOff, Plus, SlidersHorizontal, X } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";
import { indicatorLabel } from "@/lib/replay/indicatorCatalog";
import type { ReplayEngine } from "./useReplayEngine";

export function IndicatorStrip({ engine, onOpenSettings }: { engine: ReplayEngine; onOpenSettings: (indicatorId?: string) => void }) {
  const { indicators, setIndicators } = engine;

  const toggle = (id: string) => {
    setIndicators(indicators.map((config) => (config.id === id ? { ...config, on: !config.on } : config)));
  };

  return (
    <div className="btm-indstrip" aria-label={uiText("backtest_terminal.indicators")}>
      <button type="button" className="btm-indicator-trigger" onClick={() => onOpenSettings()}>
        <SlidersHorizontal size={15} />
        {uiText("backtest_terminal.indicators")}
      </button>
      {indicators.map((config) => (
        <div
          key={config.id}
          className="btm-indicator-item"
          data-on={config.on}
        >
          <button type="button" className="btm-indicator-name" onClick={() => onOpenSettings(config.id)}
            title={uiText("backtest_terminal.ind_edit")}>
            <span className="btm-inddot" style={{ background: config.color }} />
            {indicatorLabel(config)}
          </button>
          <button type="button" className="btm-indicator-action" onClick={() => toggle(config.id)}
            aria-label={`${indicatorLabel(config)}: ${uiText(config.on ? "backtest_terminal.ind_disable" : "backtest_terminal.ind_enable")}`}
            title={uiText(config.on ? "backtest_terminal.ind_disable" : "backtest_terminal.ind_enable")}>
            {config.on ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button type="button" className="btm-indicator-action" onClick={() => setIndicators(indicators.filter((item) => item.id !== config.id))}
            aria-label={`${uiText("backtest_terminal.ind_remove")}: ${indicatorLabel(config)}`} title={uiText("backtest_terminal.ind_remove")}>
            <X size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btm-iconbtn"
        onClick={() => onOpenSettings()}
        title={uiText("backtest_terminal.ind_add")}
        aria-label={uiText("backtest_terminal.ind_add")}
      >
        <Plus size={13} />
      </button>
    </div>
  );
}
