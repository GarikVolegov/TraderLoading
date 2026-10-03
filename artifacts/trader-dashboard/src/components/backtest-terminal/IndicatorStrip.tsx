// ─── Indicator strip ─────────────────────────────────────────────────────────
// Chips row under the header: one chip per configured indicator (click
// toggles on/off), plus the add/settings entry point.
import { Plus, SlidersHorizontal } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";
import { indicatorLabel } from "@/lib/replay/indicatorCatalog";
import type { ReplayEngine } from "./useReplayEngine";

export function IndicatorStrip({ engine, onOpenSettings }: { engine: ReplayEngine; onOpenSettings: () => void }) {
  const { indicators, setIndicators } = engine;

  const toggle = (id: string) => {
    setIndicators(indicators.map((config) => (config.id === id ? { ...config, on: !config.on } : config)));
  };

  return (
    <div className="btm-indstrip" aria-label={uiText("backtest_terminal.indicators")}>
      <button type="button" className="btm-indchip" onClick={onOpenSettings} data-on="false">
        <SlidersHorizontal size={11} />
        {uiText("backtest_terminal.indicators")}
      </button>
      {indicators.map((config) => (
        <button
          key={config.id}
          type="button"
          className="btm-indchip"
          data-on={config.on}
          onClick={() => toggle(config.id)}
          title={uiText(config.on ? "backtest_terminal.ind_disable" : "backtest_terminal.ind_enable")}
        >
          <span className="btm-inddot" style={{ background: config.color }} />
          {indicatorLabel(config)}
        </button>
      ))}
      <button
        type="button"
        className="btm-iconbtn"
        style={{ width: 24, height: 24 }}
        onClick={onOpenSettings}
        title={uiText("backtest_terminal.ind_add")}
        aria-label={uiText("backtest_terminal.ind_add")}
      >
        <Plus size={13} />
      </button>
    </div>
  );
}
