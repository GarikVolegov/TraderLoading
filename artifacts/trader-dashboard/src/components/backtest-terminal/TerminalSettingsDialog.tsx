// ─── Terminal settings dialog ────────────────────────────────────────────────
// Mockup's gear dialog with two tabs: Indicatori (catalog + per-indicator
// cards with params, colors, placement, custom formula) and Strumenti (chart
// type, default drawing color/width, magnet, rail visibility).
import { useMemo, useState } from "react";
import { Trash2, X } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";
import { useEscapeToClose } from "./HotkeysHelp";
import { FormulaError, parseFormula } from "@/lib/replay/formulaParser";
import {
  createIndicator,
  INDICATOR_META,
  INDICATOR_SWATCHES,
  indicatorPane,
  type IndicatorConfig,
  type IndicatorMa,
  type IndicatorSource,
  type IndicatorType,
} from "@/lib/replay/indicatorCatalog";
import {
  createChartTemplateStorageKey,
  parseChartTemplates,
  serializeChartTemplates,
} from "@/lib/replay/terminalPersistence";
import type { ChartType } from "@/lib/replay/types";
import { DRAWING_TOOLS } from "./toolRailModel";
import type { ReplayEngine } from "./useReplayEngine";

const ADDABLE_TYPES: IndicatorType[] = [
  "ema",
  "sma",
  "wma",
  "bb",
  "vwap",
  "rsi",
  "macd",
  "atr",
  "stoch",
  "volume",
  "custom",
];

const SOURCES: IndicatorSource[] = ["close", "open", "high", "low", "hl2", "ohlc4"];
const MAS: IndicatorMa[] = ["ema", "sma", "wma", "none"];
const CHART_TYPES: ChartType[] = ["candles", "heikin", "line"];

function formulaErrorKey(error: FormulaError): string {
  return `backtest_terminal.formula.${error.code}`;
}

function FormulaField({
  config,
  onChange,
}: {
  config: IndicatorConfig;
  onChange: (next: IndicatorConfig) => void;
}) {
  const error = useMemo(() => {
    const formula = config.formula?.trim();
    if (!formula) return null;
    try {
      parseFormula(formula);
      return null;
    } catch (err) {
      return err instanceof FormulaError ? err : null;
    }
  }, [config.formula]);

  return (
    <div className="btm-field" style={{ width: "100%" }}>
      <span className="btm-field-label">{uiText("backtest_terminal.formula.label")}</span>
      <input
        className="btm-input"
        value={config.formula ?? ""}
        placeholder={"ema(c, 14) - sma(c, 50)"}
        onChange={(event) => onChange({ ...config, formula: event.target.value })}
        aria-label={uiText("backtest_terminal.formula.label")}
      />
      {error ? (
        <span className="btm-formula-error">{uiText(formulaErrorKey(error))}</span>
      ) : (
        <span style={{ fontSize: 10.5, color: "var(--btm-mut)" }}>{uiText("backtest_terminal.formula.hint")}</span>
      )}
    </div>
  );
}

function IndicatorCard({
  config,
  onChange,
  onRemove,
}: {
  config: IndicatorConfig;
  onChange: (next: IndicatorConfig) => void;
  onRemove: () => void;
}) {
  const meta = INDICATOR_META[config.type];
  const pane = indicatorPane(config);

  return (
    <div className="btm-indcard">
      <div className="btm-indcard-head">
        <strong>{config.type === "custom" && config.name?.trim() ? config.name : uiText(meta.labelKey)}</strong>
        <span className="btm-panetag">
          {uiText(
            pane === "price"
              ? "backtest_terminal.pane_price"
              : pane === "sub"
                ? "backtest_terminal.pane_sub"
                : "backtest_terminal.pane_volume",
          )}
        </span>
        <button type="button" className="btm-toggle" data-on={config.on} onClick={() => onChange({ ...config, on: !config.on })}>
          {uiText(config.on ? "backtest_terminal.ind_on" : "backtest_terminal.ind_off")}
        </button>
        <button
          type="button"
          className="btm-trash"
          onClick={onRemove}
          title={uiText("backtest_terminal.ind_remove")}
          aria-label={uiText("backtest_terminal.ind_remove")}
        >
          <Trash2 size={13} />
        </button>
      </div>

      {config.type === "custom" && (
        <>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            <div className="btm-field" style={{ flex: 1, minWidth: 130 }}>
              <span className="btm-field-label">{uiText("backtest_terminal.custom_name")}</span>
              <input
                className="btm-input"
                value={config.name ?? ""}
                onChange={(event) => onChange({ ...config, name: event.target.value })}
                aria-label={uiText("backtest_terminal.custom_name")}
              />
            </div>
            <div className="btm-field">
              <span className="btm-field-label">{uiText("backtest_terminal.custom_source")}</span>
              <select
                className="btm-select"
                value={config.source ?? "close"}
                onChange={(event) => onChange({ ...config, source: event.target.value as IndicatorSource })}
              >
                {SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {uiText(`backtest_terminal.source.${source}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="btm-field">
              <span className="btm-field-label">{uiText("backtest_terminal.custom_ma")}</span>
              <select
                className="btm-select"
                value={config.ma ?? "ema"}
                onChange={(event) => onChange({ ...config, ma: event.target.value as IndicatorMa })}
              >
                {MAS.map((ma) => (
                  <option key={ma} value={ma}>
                    {ma === "none" ? uiText("backtest_terminal.ma_none") : ma.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="btm-field">
              <span className="btm-field-label">{uiText("backtest_terminal.custom_pane")}</span>
              <select
                className="btm-select"
                value={config.pane ?? "price"}
                onChange={(event) => onChange({ ...config, pane: event.target.value === "sub" ? "sub" : "price" })}
              >
                <option value="price">{uiText("backtest_terminal.pane_price")}</option>
                <option value="sub">{uiText("backtest_terminal.pane_sub")}</option>
              </select>
            </div>
          </div>
          <FormulaField config={config} onChange={onChange} />
        </>
      )}

      {meta.params.length > 0 && (
        <div className="btm-params">
          {meta.params.map((param) => (
            <div key={param.key} className="btm-field">
              <span className="btm-field-label">{uiText(param.labelKey)}</span>
              <input
                type="number"
                className="btm-input"
                min={param.min}
                max={param.max}
                step={param.step ?? 1}
                value={config[param.key] ?? param.def}
                onChange={(event) => {
                  const raw = Number.parseFloat(event.target.value);
                  const value = Number.isFinite(raw) ? Math.min(param.max, Math.max(param.min, raw)) : param.def;
                  onChange({ ...config, [param.key]: value });
                }}
                aria-label={uiText(param.labelKey)}
              />
            </div>
          ))}
        </div>
      )}

      {config.type !== "volume" && (
        <div className="btm-swatches" role="group" aria-label={uiText("backtest_terminal.color")}>
          {INDICATOR_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className="btm-swatch"
              data-active={config.color === swatch}
              style={{ background: swatch }}
              onClick={() => onChange({ ...config, color: swatch })}
              title={uiText("backtest_terminal.color")}
              aria-label={uiText("backtest_terminal.color")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Saved chart templates (indicators + settings), global across sessions. */
function ChartTemplates({ engine }: { engine: ReplayEngine }) {
  const [templates, setTemplates] = useState(() => {
    try {
      return parseChartTemplates(window.localStorage.getItem(createChartTemplateStorageKey()));
    } catch {
      return {};
    }
  });
  const [name, setName] = useState("");

  const persist = (next: ReturnType<typeof parseChartTemplates>) => {
    setTemplates(next);
    try {
      window.localStorage.setItem(createChartTemplateStorageKey(), serializeChartTemplates(next));
    } catch {
      /* storage unavailable */
    }
  };

  const saveCurrent = () => {
    const trimmed = name.trim();
    if (trimmed === "") return;
    persist({ ...templates, [trimmed]: { indicators: engine.indicators, settings: engine.settings } });
    setName("");
  };

  const names = Object.keys(templates).sort();

  return (
    <div className="btm-field">
      <span className="btm-field-label">{uiText("backtest_terminal.templates")}</span>
      {names.map((templateName) => (
        <div key={templateName} style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ flex: 1, fontSize: 12.5 }}>{templateName}</span>
          <button
            type="button"
            className="btm-toggle"
            data-on="true"
            onClick={() => {
              engine.setIndicators(templates[templateName].indicators.map((config) => ({ ...config })));
              engine.setSettings({ ...templates[templateName].settings });
            }}
          >
            {uiText("backtest_terminal.template_apply")}
          </button>
          <button
            type="button"
            className="btm-trash"
            onClick={() => {
              const next = { ...templates };
              delete next[templateName];
              persist(next);
            }}
            title={uiText("backtest_terminal.template_delete")}
            aria-label={uiText("backtest_terminal.template_delete")}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          className="btm-input"
          value={name}
          placeholder={uiText("backtest_terminal.template_name")}
          onChange={(event) => setName(event.target.value)}
          aria-label={uiText("backtest_terminal.template_name")}
        />
        <button
          type="button"
          className="btm-toggle"
          data-on="true"
          style={{ flexShrink: 0 }}
          disabled={name.trim() === ""}
          onClick={saveCurrent}
        >
          {uiText("backtest_terminal.template_save")}
        </button>
      </div>
    </div>
  );
}

export function TerminalSettingsDialog({
  engine,
  initialTab = "indicators",
  onClose,
}: {
  engine: ReplayEngine;
  initialTab?: "indicators" | "tools";
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"indicators" | "tools">(initialTab);
  useEscapeToClose(onClose);
  const { indicators, setIndicators, settings, setSettings } = engine;
  const idCounterRef = useState(() => ({ value: Date.now() }))[0];

  const addIndicator = (type: IndicatorType) => {
    idCounterRef.value += 1;
    setIndicators([...indicators, createIndicator(type, `ind-${idCounterRef.value}`)]);
  };

  return (
    <div className="btm-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="btm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={uiText("backtest_terminal.settings")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="btm-modal-head">
          <h2 className="btm-modal-title">{uiText("backtest_terminal.settings")}</h2>
          <button type="button" className="btm-iconbtn" onClick={onClose} aria-label={uiText("backtest_terminal.close")}>
            <X size={15} />
          </button>
        </div>

        <div className="btm-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "indicators"} data-active={tab === "indicators"} onClick={() => setTab("indicators")}>
            {uiText("backtest_terminal.indicators")}
          </button>
          <button type="button" role="tab" aria-selected={tab === "tools"} data-active={tab === "tools"} onClick={() => setTab("tools")}>
            {uiText("backtest_terminal.tools_tab")}
          </button>
        </div>

        <div className="btm-modal-body">
          {tab === "indicators" ? (
            <>
              <div className="btm-addgrid">
                {ADDABLE_TYPES.map((type) => (
                  <button key={type} type="button" className="btm-addbtn" onClick={() => addIndicator(type)}>
                    + {uiText(INDICATOR_META[type].labelKey)}
                  </button>
                ))}
              </div>
              {indicators.map((config) => (
                <IndicatorCard
                  key={config.id}
                  config={config}
                  onChange={(next) => setIndicators(indicators.map((item) => (item.id === next.id ? next : item)))}
                  onRemove={() => setIndicators(indicators.filter((item) => item.id !== config.id))}
                />
              ))}
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              <div className="btm-field">
                <span className="btm-field-label">{uiText("backtest_terminal.chart_type")}</span>
                <div className="btm-segmented">
                  {CHART_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      data-active={settings.chartType === type}
                      onClick={() => setSettings({ ...settings, chartType: type })}
                    >
                      {uiText(`backtest_terminal.chart_type.${type}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="btm-field">
                <span className="btm-field-label">{uiText("backtest_terminal.tool_color")}</span>
                <div className="btm-swatches">
                  {INDICATOR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      className="btm-swatch"
                      data-active={settings.toolColor === swatch}
                      style={{ background: swatch }}
                      onClick={() => setSettings({ ...settings, toolColor: swatch })}
                      title={uiText("backtest_terminal.tool_color")}
                      aria-label={uiText("backtest_terminal.tool_color")}
                    />
                  ))}
                </div>
              </div>

              <div className="btm-field">
                <span className="btm-field-label">
                  {uiText("backtest_terminal.tool_width", { width: settings.toolWidth })}
                </span>
                <div className="btm-rangefield">
                  <input
                    type="range"
                    min={1}
                    max={4}
                    step={1}
                    value={settings.toolWidth}
                    onChange={(event) => setSettings({ ...settings, toolWidth: Number.parseInt(event.target.value, 10) })}
                    aria-label={uiText("backtest_terminal.tool_width", { width: settings.toolWidth })}
                  />
                </div>
              </div>

              <div className="btm-field">
                <span className="btm-field-label">{uiText("backtest_terminal.magnet")}</span>
                <button
                  type="button"
                  className="btm-toggle"
                  data-on={settings.magnet}
                  style={{ alignSelf: "flex-start" }}
                  onClick={() => setSettings({ ...settings, magnet: !settings.magnet })}
                >
                  {uiText(settings.magnet ? "backtest_terminal.magnet_on" : "backtest_terminal.magnet_off")}
                </button>
              </div>

              <div className="btm-field">
                <span className="btm-field-label">{uiText("backtest_terminal.session_opens")}</span>
                <button
                  type="button"
                  className="btm-toggle"
                  data-on={settings.showSessions}
                  style={{ alignSelf: "flex-start" }}
                  onClick={() => setSettings({ ...settings, showSessions: !settings.showSessions })}
                >
                  {uiText(settings.showSessions ? "backtest_terminal.ind_on" : "backtest_terminal.ind_off")}
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                <div className="btm-field">
                  <span className="btm-field-label">{uiText("backtest_terminal.spread_pips")}</span>
                  <input
                    type="number"
                    className="btm-input"
                    min={0}
                    step={0.1}
                    value={settings.spreadPips}
                    onChange={(event) =>
                      setSettings({ ...settings, spreadPips: Math.max(0, Number.parseFloat(event.target.value) || 0) })
                    }
                    aria-label={uiText("backtest_terminal.spread_pips")}
                  />
                </div>
                <div className="btm-field">
                  <span className="btm-field-label">{uiText("backtest_terminal.commission_per_lot")}</span>
                  <input
                    type="number"
                    className="btm-input"
                    min={0}
                    step={0.5}
                    value={settings.commissionPerLot}
                    onChange={(event) =>
                      setSettings({ ...settings, commissionPerLot: Math.max(0, Number.parseFloat(event.target.value) || 0) })
                    }
                    aria-label={uiText("backtest_terminal.commission_per_lot")}
                  />
                </div>
              </div>

              <ChartTemplates engine={engine} />

              <div className="btm-field">
                <span className="btm-field-label">{uiText("backtest_terminal.visible_tools")}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {DRAWING_TOOLS.map((tool) => {
                    const visible = settings.visibleTools[tool.id] !== false;
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        className="btm-toggle"
                        data-on={visible}
                        onClick={() =>
                          setSettings({
                            ...settings,
                            visibleTools: { ...settings.visibleTools, [tool.id]: !visible },
                          })
                        }
                      >
                        {uiText(tool.labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
