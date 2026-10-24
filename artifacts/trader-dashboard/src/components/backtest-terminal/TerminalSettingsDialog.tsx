// ─── Terminal settings dialog ────────────────────────────────────────────────
// Mockup's gear dialog with two tabs: Indicatori (catalog + per-indicator
// cards with params, colors, placement, custom formula) and Strumenti (chart
// type, default drawing color/width, magnet, rail visibility).
import { useEffect, useMemo, useRef, useState } from "react";
import { HelpCircle, Plus, Search, Star, Trash2, X } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";
import { useEscapeToClose } from "./HotkeysHelp";
import { FormulaError, parseFormula } from "@/lib/replay/formulaParser";
import {
  createIndicator,
  INDICATOR_META,
  INDICATOR_SWATCHES,
  indicatorLabel,
  indicatorPane,
  type IndicatorConfig,
  type IndicatorMa,
  type IndicatorSource,
  type IndicatorType,
} from "@/lib/replay/indicatorCatalog";
import { DEFAULT_TERMINAL_SETTINGS } from "@/lib/replay/terminalPersistence";
import { DEFAULT_FAVORITE_TOOLS, pickChartSettings } from "../../../../../contracts/backtestChart";
import { ChartAppearanceSettings } from "./ChartAppearanceSettings";
import { ColorControl } from "./ColorControl";
import "./chart-workspace.css";
import { DRAWING_TOOLS, type DrawingToolId } from "./toolRailModel";
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
  favoriteColors,
  onFavoriteColorsChange,
}: {
  config: IndicatorConfig;
  onChange: (next: IndicatorConfig) => void;
  onRemove: () => void;
  favoriteColors: string[];
  onFavoriteColorsChange: (colors: string[]) => void;
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

      {config.type !== "volume" && <ColorControl label={uiText("backtest_terminal.color")} value={config.color} onChange={color => onChange({ ...config, color })} favorites={favoriteColors} onFavoritesChange={onFavoriteColorsChange} />}
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
              title={`${uiText("backtest_terminal.color")} ${swatch}`}
              aria-label={`${uiText("backtest_terminal.color")} ${swatch}`}
              aria-pressed={config.color === swatch}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Saved chart templates (indicators + settings), global across sessions. */
function ChartTemplates({ engine }: { engine: ReplayEngine }) {
  const { chartPreferences } = engine;
  const templates = chartPreferences.preferences.templates;
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [rename, setRename] = useState("");
  const updateTemplates = (next: typeof templates) => chartPreferences.update(previous => ({ ...previous, templates: next }));
  return <div className="btm-template-workspace">
    <p className="btm-muted">{["Salva aspetto, indicatori e impostazioni dei disegni. Le operazioni e i costi della simulazione restano nella sessione."].map(text => text)}</p>
    <div className="btm-template-save"><input className="btm-input" value={name} maxLength={80} placeholder={uiText("backtest_terminal.template_name")} aria-label={uiText("backtest_terminal.template_name")} onChange={e => setName(e.target.value)} /><button type="button" className="btm-toggle" data-on="true" disabled={!name.trim() || templates.length >= 50} onClick={() => { updateTemplates([...templates, { id: crypto.randomUUID(), name: name.trim(), settings: pickChartSettings(engine.settings), indicators: engine.indicators.map(config => ({ ...config })) }]); setName(""); }}>{uiText("backtest_terminal.template_save")}</button></div>
    <span className="btm-muted">{[templates.length].map(count => `${count} / 50 template`)}</span>
    {templates.map(template => <div className="btm-template-row" key={template.id}>
      {editing === template.id ? <form className="btm-template-rename" onSubmit={event => { event.preventDefault(); if (!rename.trim()) return; updateTemplates(templates.map(item => item.id === template.id ? { ...item, name: rename.trim() } : item)); setEditing(null); }}><input className="btm-input" autoFocus maxLength={80} aria-label="Nuovo nome template" value={rename} onChange={e => setRename(e.target.value)} /><button className="btm-toggle" type="submit" disabled={!rename.trim()}>Salva</button><button className="btm-toggle" type="button" onClick={() => setEditing(null)}>Annulla</button></form> : <><strong>{template.name}</strong><button type="button" className="btm-toggle" onClick={() => { engine.setIndicators(template.indicators.map(config => ({ ...config }))); engine.setSettings({ ...engine.settings, ...pickChartSettings(template.settings) }); }}>{uiText("backtest_terminal.template_apply")}</button><button type="button" className="btm-toggle" onClick={() => { setEditing(template.id); setRename(template.name); }}>Rinomina</button></>}
      <button type="button" className="btm-trash" aria-label={`${uiText("backtest_terminal.template_delete")} ${template.name}`} onClick={() => updateTemplates(templates.filter(item => item.id !== template.id))}><Trash2 size={14} /></button>
    </div>)}
  </div>;
}

export function TerminalSettingsDialog({
  engine,
  initialTab = "chart",
  initialIndicatorId,
  onClose,
  onOpenKnowledge,
}: {
  engine: ReplayEngine;
  initialTab?: "chart" | "indicators" | "tools" | "templates";
  initialIndicatorId?: string;
  onClose: () => void;
  onOpenKnowledge?: (tool: DrawingToolId) => void;
}) {
  const [tab, setTab] = useState<"chart" | "indicators" | "tools" | "templates">(initialTab);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(initialIndicatorId ?? engine.indicators[0]?.id);
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>("input, button")?.focus();
    const containFocus = (event: FocusEvent) => {
      if (dialog && !dialog.contains(event.target as Node)) dialog.querySelector<HTMLElement>("input, button")?.focus();
    };
    document.addEventListener("focusin", containFocus);
    return () => {
      document.removeEventListener("focusin", containFocus);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  useEscapeToClose(onClose);
  const { indicators, setIndicators, settings, setSettings } = engine;
  const idCounterRef = useState(() => ({ value: Date.now() }))[0];
  const selected = indicators.find((config) => config.id === selectedId) ?? indicators[0];
  const matchingTypes = ADDABLE_TYPES.filter((type) => `${type} ${uiText(INDICATOR_META[type].labelKey)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  const addIndicator = (type: IndicatorType) => {
    idCounterRef.value += 1;
    const indicator = createIndicator(type, `ind-${idCounterRef.value}`);
    setIndicators([...indicators, indicator]);
    setSelectedId(indicator.id);
  };

  return (
    <div className="btm-modal-backdrop" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="btm-modal btm-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label={uiText("backtest_terminal.settings")}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]'));
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}
      >
        <div className="btm-modal-head">
          <h2 className="btm-modal-title">{uiText("backtest_terminal.settings")}</h2>
          <button type="button" className="btm-iconbtn" onClick={onClose} aria-label={uiText("backtest_terminal.close")}>
            <X size={15} />
          </button>
        </div>

        <div className="btm-tabs btm-workspace-tabs" role="tablist" aria-label={uiText("backtest_terminal.chart_settings")}>
          {([ ["chart", "Aspetto"], ["tools", "Strumenti"], ["indicators", "Indicatori"], ["templates", "Template"] ] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} data-active={tab === id} onClick={() => setTab(id)}>{label}</button>)}
        </div>
        <div className="btm-sync-status" role="status">
          {{ loading: "Caricamento preferenze…", saved: "Preferenze sincronizzate", saving: "Salvataggio…", offline: "Offline · modifiche conservate su questo dispositivo", pending: "Modifiche in attesa", error: "Sincronizzazione non riuscita · modifiche conservate", conflict: "Le preferenze sono state modificate su un altro dispositivo", local: "Preferenze salvate su questo dispositivo" }[engine.chartPreferences.status]}
          {engine.chartPreferences.status === "conflict" && <><button type="button" className="btm-toggle" onClick={() => engine.chartPreferences.resolveConflict("local")}>Mantieni le mie</button><button type="button" className="btm-toggle" onClick={() => engine.chartPreferences.resolveConflict("remote")}>Usa quelle online</button></>}
          {(engine.chartPreferences.status === "error" || engine.chartPreferences.status === "offline") && <button type="button" className="btm-toggle" onClick={() => engine.chartPreferences.retry()}>Riprova</button>}
        </div>

        <div className="btm-modal-body">
          {tab === "chart" ? (
            <ChartAppearanceSettings engine={engine} />
          ) : tab === "templates" ? (
            <ChartTemplates engine={engine} />
          ) : tab === "indicators" ? (
            <div className="btm-indicator-workspace">
              <aside className="btm-indicator-catalog">
                <label className="btm-indicator-search">
                  <Search size={16} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)}
                    placeholder={uiText("backtest_terminal.ind_search")}
                    aria-label={uiText("backtest_terminal.ind_search")} />
                </label>
                <div className="btm-catalog-caption">{uiText("backtest_terminal.ind_library")}</div>
                {matchingTypes.map((type) => (
                  <button key={type} type="button" className="btm-catalog-item" onClick={() => addIndicator(type)}>
                    <span><strong>{uiText(INDICATOR_META[type].labelKey)}</strong><small>{uiText(`backtest_terminal.pane_${INDICATOR_META[type].pane}`)}</small></span>
                    <Plus size={15} />
                  </button>
                ))}
                {matchingTypes.length === 0 && <p className="btm-muted btm-catalog-empty">{uiText("backtest_terminal.ind_no_results")}</p>}
              </aside>
              <div className="btm-indicator-editor">
                <div className="btm-catalog-caption">{uiText("backtest_terminal.ind_on_chart")} <span>{indicators.length}</span></div>
                <div className="btm-active-indicators">
                  {indicators.map((config) => <button key={config.id} type="button" className="btm-active-indicator"
                    data-active={selected?.id === config.id} aria-pressed={selected?.id === config.id}
                    onClick={() => setSelectedId(config.id)}>
                    <span className="btm-inddot" style={{ background: config.color }} />{indicatorLabel(config)}
                    {!config.on && <span className="btm-muted">{uiText("backtest_terminal.ind_off")}</span>}
                  </button>)}
                </div>
                {selected ? (
                <IndicatorCard
                  key={selected.id}
                  favoriteColors={engine.chartPreferences.preferences.favoriteColors}
                  onFavoriteColorsChange={favoriteColors => engine.chartPreferences.update(previous => ({ ...previous, favoriteColors }))}
                  config={selected}
                  onChange={(next) => setIndicators(indicators.map((item) => (item.id === next.id ? next : item)))}
                  onRemove={() => setIndicators(indicators.filter((item) => item.id !== selected.id))}
                />
                ) : <div className="btm-indicator-empty"><Plus size={28} /><p>{uiText("backtest_terminal.ind_empty")}</p></div>}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              <div className="btm-section-head"><h3>Impostazioni degli strumenti</h3><button type="button" className="btm-text-button" onClick={() => setSettings({ ...settings, toolColor: DEFAULT_TERMINAL_SETTINGS.toolColor, toolWidth: DEFAULT_TERMINAL_SETTINGS.toolWidth, magnet: DEFAULT_TERMINAL_SETTINGS.magnet, visibleTools: {} })}>Ripristina sezione</button></div>
              <ColorControl label={uiText("backtest_terminal.tool_color")} value={settings.toolColor} onChange={toolColor => setSettings({ ...settings, toolColor })} favorites={engine.chartPreferences.preferences.favoriteColors} onFavoritesChange={favoriteColors => engine.chartPreferences.update(previous => ({ ...previous, favoriteColors }))} />
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
                      title={`${uiText("backtest_terminal.tool_color")} ${swatch}`}
                      aria-label={`${uiText("backtest_terminal.tool_color")} ${swatch}`}
                      aria-pressed={settings.toolColor === swatch}
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
                    max={8}
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
                <span className="btm-field-label">{uiText("backtest_terminal.stay_in_drawing_mode")}</span>
                <button
                  type="button"
                  className="btm-toggle"
                  data-on={Boolean(settings.stayInDrawingMode)}
                  style={{ alignSelf: "flex-start" }}
                  onClick={() => setSettings({ ...settings, stayInDrawingMode: !settings.stayInDrawingMode })}
                >
                  {uiText(settings.stayInDrawingMode ? "backtest_terminal.ind_on" : "backtest_terminal.ind_off")}
                </button>
              </div>

              <div className="btm-field">
                <span className="btm-field-label">{uiText("backtest_terminal.show_favorite_toolbar")}</span>
                <button
                  type="button"
                  className="btm-toggle"
                  data-on={settings.showFavoriteToolbar !== false}
                  style={{ alignSelf: "flex-start" }}
                  onClick={() => setSettings({ ...settings, showFavoriteToolbar: settings.showFavoriteToolbar === false })}
                >
                  {uiText(settings.showFavoriteToolbar !== false ? "backtest_terminal.ind_on" : "backtest_terminal.ind_off")}
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

              <div className="btm-field">
                <span className="btm-field-label">{uiText("backtest_terminal.trades_on_chart")}</span>
                <button
                  type="button"
                  className="btm-toggle"
                  data-on={settings.showTradesOnChart !== false}
                  style={{ alignSelf: "flex-start" }}
                  onClick={() =>
                    setSettings({ ...settings, showTradesOnChart: settings.showTradesOnChart === false })
                  }
                >
                  {uiText(settings.showTradesOnChart !== false ? "backtest_terminal.ind_on" : "backtest_terminal.ind_off")}
                </button>
              </div>

              <div className="btm-field">
                <span className="btm-field-label">{uiText("backtest_terminal.trade_lines_mode")}</span>
                <div className="btm-segmented">
                  {(["hover_or_latest", "all", "none"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      data-active={(settings.tradeLineMode ?? "hover_or_latest") === mode}
                      onClick={() => setSettings({ ...settings, tradeLineMode: mode })}
                    >
                      {uiText(`backtest_terminal.trade_lines_${mode}`)}
                    </button>
                  ))}
                </div>
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



              <div className="btm-field">
                <div className="btm-section-head">
                  <span className="btm-field-label">{uiText("backtest_terminal.visible_tools")}</span>
                  <button
                    type="button"
                    className="btm-text-button"
                    onClick={() => engine.chartPreferences.update(previous => ({ ...previous, favoriteTools: [...DEFAULT_FAVORITE_TOOLS] }))}
                  >
                    {uiText("backtest_terminal.reset_favorite_tools")}
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {DRAWING_TOOLS.map((tool) => {
                    const visible = settings.visibleTools[tool.id] !== false;
                    return (
                      <span key={tool.id} className="btm-tool-preference"><button
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
                      </button>{onOpenKnowledge && <button type="button" className="btm-iconbtn" title={`Spiegazione: ${uiText(tool.labelKey)}`} aria-label={`Spiegazione: ${uiText(tool.labelKey)}`} onClick={() => onOpenKnowledge(tool.id)}><HelpCircle size={13} /></button>}{tool.id !== "cursor" && <button type="button" className="btm-iconbtn" aria-label={`Preferito: ${uiText(tool.labelKey)}`} aria-pressed={engine.chartPreferences.preferences.favoriteTools.includes(tool.id)} onClick={() => engine.chartPreferences.update(previous => ({ ...previous, favoriteTools: previous.favoriteTools.includes(tool.id) ? previous.favoriteTools.filter(id => id !== tool.id) : [...previous.favoriteTools, tool.id] }))}><Star size={14} fill={engine.chartPreferences.preferences.favoriteTools.includes(tool.id) ? "currentColor" : "none"} /></button>}</span>
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
