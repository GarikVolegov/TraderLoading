// ─── AUREUS PROTOCOL: TradingView Pro Master-Detail Chart Settings Dialog ─────
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickChart,
  Sliders,
  Palette,
  ListFilter,
  Clock,
  Crosshair,
  TrendingUp,
  PenTool,
  Plus,
  Search,
  Star,
  Trash2,
  X,
  ChevronDown,
  RotateCcw,
  Check,
  HelpCircle,
  Bookmark,
  Layers,
  Compass,
  Cloud,
  Download,
  Upload,
  Settings2,
} from "lucide-react";
import { useAuth } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
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
import { DEFAULT_AUREUS_TEMPLATES, pickChartSettings } from "../../../../../contracts/backtestChart";
import {
  SymbolSettingsTab,
  ScalesSettingsTab,
  CanvasSettingsTab,
  LegendSettingsTab,
  TradingSettingsTab,
  SessionPreferencesEditor,
  LiquidityPreferencesEditor,
  WyckoffPreferencesEditor,
  PRESET_PATCHES,
} from "./ChartAppearanceSettings";
import { AureusColorSwatch, ColorControl } from "./ColorControl";
import {
  CloudTemplateManagerModal,
  exportAllTemplatesAsJson,
  exportSingleTemplateAsJson,
  parseAndValidateTemplateFile,
} from "./CloudTemplateManager";
import "./chart-workspace.css";
import { DRAWING_TOOLS, type DrawingToolId } from "./toolRailModel";
import type { ReplayEngine } from "./useReplayEngine";

export type SettingsTabId =
  | "symbol"
  | "scales"
  | "canvas"
  | "legend"
  | "sessions"
  | "liquidity"
  | "wyckoff"
  | "trading"
  | "indicators"
  | "tools";

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
          aria-label={`${uiText("backtest_terminal.ind_remove")} ${config.name ?? uiText(meta.labelKey)}`}
          onClick={onRemove}
        >
          <Trash2 size={14} />
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
        <ColorControl
          label={uiText("backtest_terminal.color")}
          value={config.color}
          onChange={(color) => onChange({ ...config, color })}
          favorites={favoriteColors}
          onFavoritesChange={onFavoriteColorsChange}
        />
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

const CATEGORY_ITEMS: { id: SettingsTabId; label: string; icon: typeof CandlestickChart }[] = [
  { id: "symbol", label: "Simbolo", icon: CandlestickChart },
  { id: "scales", label: "Scale e linee", icon: Sliders },
  { id: "canvas", label: "Canvas", icon: Palette },
  { id: "legend", label: "Legenda", icon: ListFilter },
  { id: "sessions", label: "Sessioni & Killzone", icon: Clock },
  { id: "liquidity", label: "Liquidità (BSL/SSL)", icon: Layers },
  { id: "wyckoff", label: "Wyckoff Strutturale", icon: Compass },
  { id: "trading", label: "Trading & Ordini", icon: Crosshair },
  { id: "indicators", label: "Altri Indicatori", icon: TrendingUp },
  { id: "tools", label: "Strumenti", icon: PenTool },
];

export function TerminalSettingsDialog({
  engine,
  initialTab = "chart",
  initialIndicatorId,
  onClose,
  onOpenKnowledge,
}: {
  engine: ReplayEngine;
  initialTab?: "chart" | "sessions" | "liquidity" | "wyckoff" | "indicators" | "tools" | "templates" | SettingsTabId;
  initialIndicatorId?: string;
  onClose: () => void;
  onOpenKnowledge?: (tool: DrawingToolId) => void;
}) {
  // Mapping di compatibilità per initialTab
  const mapInitialTab = (t: string): SettingsTabId => {
    if (t === "chart" || t === "templates") return "symbol";
    if (t === "sessions") return "sessions";
    if (t === "liquidity") return "liquidity";
    if (t === "wyckoff") return "wyckoff";
    if (t === "indicators") return "indicators";
    if (t === "tools") return "tools";
    if (CATEGORY_ITEMS.some((c) => c.id === t)) return t as SettingsTabId;
    return "symbol";
  };

  const [activeTab, setActiveTab] = useState<SettingsTabId>(() => mapInitialTab(initialTab));
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [cloudModalOpen, setCloudModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(initialIndicatorId ?? engine.indicators[0]?.id);
  const dialogRef = useRef<HTMLDivElement>(null);
  const templateMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { isSignedIn } = useAuth();

  // Snapshot iniziale per rollback su Annulla o Esc
  const initialSnapshot = useRef({
    settings: { ...engine.settings },
    indicators: engine.indicators.map((i) => ({ ...i })),
  });

  const handleRollback = () => {
    engine.setSettings(initialSnapshot.current.settings);
    engine.setIndicators(initialSnapshot.current.indicators);
    onClose();
  };

  const handleCommit = () => {
    // Le modifiche sono già applicate reattivamente all'engine
    onClose();
  };

  useEscapeToClose(handleRollback);

  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>("input, button")?.focus();
    const containFocus = (event: FocusEvent) => {
      if (dialog && !dialog.contains(event.target as Node)) {
        dialog.querySelector<HTMLElement>("input, button")?.focus();
      }
    };
    document.addEventListener("focusin", containFocus);
    return () => {
      document.removeEventListener("focusin", containFocus);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  // Click outside per chiudere il menu modelli
  useEffect(() => {
    if (!templateMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target as Node)) {
        setTemplateMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [templateMenuOpen]);

  const { indicators, setIndicators, settings, setSettings, chartPreferences } = engine;
  const rawTemplates = chartPreferences.preferences.templates;
  const templates = rawTemplates && rawTemplates.length > 0 ? rawTemplates : DEFAULT_AUREUS_TEMPLATES;

  const updateTemplates = (next: typeof templates) => {
    chartPreferences.update((previous) => ({ ...previous, templates: next }));
  };

  const applyBrandPreset = (presetKey: keyof typeof PRESET_PATCHES) => {
    setSettings((prev) => ({ ...prev, ...PRESET_PATCHES[presetKey] }));
    setTemplateMenuOpen(false);
  };

  const handleSaveTemplateSubmit = () => {
    if (!newTemplateName.trim()) return;
    const newTpl = {
      id: crypto.randomUUID(),
      name: newTemplateName.trim(),
      settings: pickChartSettings(engine.settings),
      indicators: engine.indicators.map((c) => ({ ...c })),
    };
    updateTemplates([...templates, newTpl]);
    setNewTemplateName("");
    setIsSavingTemplate(false);
    setTemplateMenuOpen(false);
    toast({
      title: "Modello Salvato",
      description: `"${newTpl.name}" è ora sincronizzato col tuo Account AUREUS.`,
    });
  };

  const handleDropdownFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await parseAndValidateTemplateFile(file);
    if (!res.success || !res.templates) {
      toast({
        title: "Errore Importazione",
        description: res.error || "File non valido.",
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const availableSlots = 50 - templates.length;
    if (availableSlots <= 0) {
      toast({
        title: "Limite Raggiunto",
        description: "Hai già raggiunto il limite di 50 modelli salvati.",
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const toAdd = res.templates.slice(0, availableSlots).map((t) => ({ ...t, id: crypto.randomUUID() }));
    updateTemplates([...templates, ...toAdd]);
    toast({
      title: "Importazione Riuscita",
      description: `${toAdd.length} modello/i importati con successo e sincronizzati col Cloud AUREUS.`,
    });
    setTemplateMenuOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const idCounterRef = useState(() => ({ value: Date.now() }))[0];
  const selected = indicators.find((config) => config.id === selectedId) ?? indicators[0];
  const matchingTypes = ADDABLE_TYPES.filter((type) =>
    `${type} ${uiText(INDICATOR_META[type].labelKey)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );

  const addIndicator = (type: IndicatorType) => {
    idCounterRef.value += 1;
    const indicator = createIndicator(type, `ind-${idCounterRef.value}`);
    setIndicators([...indicators, indicator]);
    setSelectedId(indicator.id);
  };

  return (
    <div className="btm-modal-backdrop" onClick={handleRollback} role="presentation">
      <div
        ref={dialogRef}
        className="btm-dialog-v2"
        role="dialog"
        aria-modal="true"
        aria-label="Impostazioni Grafico AUREUS"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const focusable = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
            ),
          );
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        {/* ── Testata del Dialogo ───────────────────────────────────────── */}
        <div className="btm-dialog-v2-header">
          <div className="btm-dialog-v2-title">
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#C5A059",
                boxShadow: "0 0 8px #C5A059",
                display: "inline-block",
              }}
            />
            <span>Impostazioni Grafico</span>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: "#C5A059",
                border: "1px solid rgba(197, 160, 89, 0.35)",
                padding: "2px 6px",
                borderRadius: 4,
                textTransform: "uppercase",
                fontFamily: "var(--font-mono)",
              }}
            >
              AUREUS PROTOCOL
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, color: "var(--btm-mut)", fontFamily: "var(--font-mono)" }}>
              {{
                loading: "Caricamento…",
                saved: "Sincronizzato",
                saving: "Salvataggio…",
                offline: "Offline",
                pending: "In attesa",
                error: "Sincronizzazione fallita",
                conflict: "Conflitto remoto",
                local: "Salvato localmente",
              }[chartPreferences.status]}
            </span>

            <button
              type="button"
              className="btm-iconbtn"
              onClick={handleRollback}
              aria-label={uiText("backtest_terminal.close")}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Corpo: Layout a Due Colonne (Sidebar Sinistra + Pannello Destro) */}
        <div className="btm-dialog-v2-body">
          {/* Sidebar Categorie */}
          <nav className="btm-dialog-v2-sidebar" aria-label="Categorie impostazioni">
            {CATEGORY_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className="btm-dialog-v2-navbtn"
                data-active={activeTab === id}
                onClick={() => setActiveTab(id)}
              >
                <Icon size={15} style={{ color: activeTab === id ? "#C5A059" : "currentColor", flexShrink: 0 }} />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {/* Pannello Contenuti Principale */}
          <main className="btm-dialog-v2-main">
            {activeTab === "symbol" && <SymbolSettingsTab engine={engine} />}

            {activeTab === "scales" && <ScalesSettingsTab engine={engine} />}

            {activeTab === "canvas" && <CanvasSettingsTab engine={engine} />}

            {activeTab === "legend" && <LegendSettingsTab engine={engine} />}

            {activeTab === "sessions" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <SessionPreferencesEditor engine={engine} />
              </div>
            )}

            {activeTab === "liquidity" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <LiquidityPreferencesEditor />
              </div>
            )}

            {activeTab === "wyckoff" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <WyckoffPreferencesEditor />
              </div>
            )}

            {activeTab === "trading" && <TradingSettingsTab engine={engine} />}

            {activeTab === "indicators" && (
              <div className="btm-indicator-workspace">
                <aside className="btm-indicator-catalog">
                  <label className="btm-indicator-search">
                    <Search size={15} />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={uiText("backtest_terminal.ind_search")}
                      aria-label={uiText("backtest_terminal.ind_search")}
                    />
                  </label>
                  <div className="btm-catalog-caption">{uiText("backtest_terminal.ind_library")}</div>
                  {matchingTypes.map((type) => (
                    <button key={type} type="button" className="btm-catalog-item" onClick={() => addIndicator(type)}>
                      <span>
                        <strong>{uiText(INDICATOR_META[type].labelKey)}</strong>
                        <small>{uiText(`backtest_terminal.pane_${INDICATOR_META[type].pane}`)}</small>
                      </span>
                      <Plus size={14} />
                    </button>
                  ))}
                  {matchingTypes.length === 0 && (
                    <p className="btm-muted btm-catalog-empty">{uiText("backtest_terminal.ind_no_results")}</p>
                  )}
                </aside>

                <div className="btm-indicator-editor">
                  <div className="btm-catalog-caption">
                    {uiText("backtest_terminal.ind_on_chart")} <span>{indicators.length}</span>
                  </div>
                  <div className="btm-active-indicators">
                    {indicators.map((config) => (
                      <button
                        key={config.id}
                        type="button"
                        className="btm-active-indicator"
                        data-active={selected?.id === config.id}
                        aria-pressed={selected?.id === config.id}
                        onClick={() => setSelectedId(config.id)}
                      >
                        <span className="btm-inddot" style={{ background: config.color }} />
                        {indicatorLabel(config)}
                        {!config.on && <span className="btm-muted">{uiText("backtest_terminal.ind_off")}</span>}
                      </button>
                    ))}
                  </div>
                  {selected ? (
                    <IndicatorCard
                      key={selected.id}
                      favoriteColors={engine.chartPreferences.preferences.favoriteColors}
                      onFavoriteColorsChange={(favoriteColors) =>
                        engine.chartPreferences.update((previous) => ({ ...previous, favoriteColors }))
                      }
                      config={selected}
                      onChange={(next) =>
                        setIndicators(indicators.map((item) => (item.id === next.id ? next : item)))
                      }
                      onRemove={() => setIndicators(indicators.filter((item) => item.id !== selected.id))}
                    />
                  ) : (
                    <div className="btm-indicator-empty">
                      <Plus size={26} />
                      <p>{uiText("backtest_terminal.ind_empty")}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "tools" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="btm-section-head" style={{ marginBottom: 4 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700 }}>Disegni e Strumenti Grafici</h3>
                  <button
                    type="button"
                    className="btm-text-button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        toolColor: DEFAULT_TERMINAL_SETTINGS.toolColor,
                        toolWidth: DEFAULT_TERMINAL_SETTINGS.toolWidth,
                        magnet: DEFAULT_TERMINAL_SETTINGS.magnet,
                        visibleTools: {},
                      })
                    }
                  >
                    Ripristina sezione
                  </button>
                </div>

                <div className="btm-v2-row">
                  <span className="btm-v2-label">{uiText("backtest_terminal.tool_color")}</span>
                  <AureusColorSwatch
                    label={uiText("backtest_terminal.tool_color")}
                    value={settings.toolColor}
                    onChange={(toolColor) => setSettings({ ...settings, toolColor })}
                    favorites={engine.chartPreferences.preferences.favoriteColors}
                    onFavoritesChange={(favoriteColors) =>
                      engine.chartPreferences.update((previous) => ({ ...previous, favoriteColors }))
                    }
                  />
                </div>

                <div className="btm-v2-row">
                  <span className="btm-v2-label">{uiText("backtest_terminal.tool_width", { width: settings.toolWidth })}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="range"
                      min={1}
                      max={8}
                      step={1}
                      value={settings.toolWidth}
                      onChange={(event) =>
                        setSettings({ ...settings, toolWidth: Number.parseInt(event.target.value, 10) })
                      }
                      style={{ width: 110 }}
                    />
                    <span className="font-mono text-xs text-[#E8C56A] min-w-[36px] text-right">{settings.toolWidth} px</span>
                  </div>
                </div>

                <div className="btm-v2-row">
                  <label className="btm-v2-label">
                    <input
                      type="checkbox"
                      checked={settings.magnet}
                      onChange={() => setSettings({ ...settings, magnet: !settings.magnet })}
                    />
                    {uiText("backtest_terminal.magnet")} (Snap magnetico ai prezzi OHLC)
                  </label>
                  <span className="text-[11px] text-zinc-400 font-mono">Aggancio rapido</span>
                </div>

                <div className="btm-v2-row">
                  <label className="btm-v2-label">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.stayInDrawingMode)}
                      onChange={() => setSettings({ ...settings, stayInDrawingMode: !settings.stayInDrawingMode })}
                    />
                    {uiText("backtest_terminal.stay_in_drawing_mode")}
                  </label>
                  <span className="text-[11px] text-zinc-400 font-mono">Disegno continuo</span>
                </div>

                <div className="btm-v2-row">
                  <label className="btm-v2-label">
                    <input
                      type="checkbox"
                      checked={settings.showFavoriteToolbar !== false}
                      onChange={() =>
                        setSettings({ ...settings, showFavoriteToolbar: !settings.showFavoriteToolbar })
                      }
                    />
                    {uiText("backtest_terminal.show_favorite_toolbar")}
                  </label>
                  <span className="text-[11px] text-zinc-400 font-mono">Barra mobile</span>
                </div>

                <div className="btm-v2-section-head">Visibilità Strumenti sulla Guida Laterale</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: 8,
                    maxHeight: 180,
                    overflowY: "auto",
                    paddingRight: 4,
                  }}
                >
                  {DRAWING_TOOLS.map((tool) => {
                    const visible = settings.visibleTools?.[tool.id] !== false;
                    return (
                      <div
                        key={tool.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "4px 8px",
                          borderRadius: 4,
                          background: "rgba(255,255,255,0.02)",
                          border: "1px solid rgba(255,255,255,0.04)",
                        }}
                      >
                        <label className="btm-checkbox-label" style={{ fontSize: 11, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={visible}
                            onChange={(event) =>
                              setSettings({
                                ...settings,
                                visibleTools: { ...settings.visibleTools, [tool.id]: event.target.checked },
                              })
                            }
                          />
                          <span>{uiText(tool.labelKey)}</span>
                        </label>
                        {onOpenKnowledge && (
                          <button
                            type="button"
                            className="btm-iconbtn"
                            style={{ width: 20, height: 20 }}
                            title="Guida operativa"
                            onClick={() => onOpenKnowledge(tool.id)}
                          >
                            <HelpCircle size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </main>
        </div>

        {/* ── Footer TradingView Style: Modelli a Sinistra | Annulla / Ok a Destra */}
        <div className="btm-dialog-v2-footer">
          {/* Menu a discesa "Modello" */}
          <div ref={templateMenuRef} style={{ position: "relative" }}>
            <button
              type="button"
              className="btm-toggle"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                color: "#E8C56A",
                border: "1px solid rgba(197, 160, 89, 0.4)",
                background: "rgba(197, 160, 89, 0.08)",
              }}
              onClick={() => setTemplateMenuOpen(!templateMenuOpen)}
            >
              <Bookmark size={13} style={{ color: "#C5A059" }} />
              <span>Modello</span>
              <ChevronDown size={13} />
            </button>

            {templateMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  left: 0,
                  zIndex: 130,
                  width: 310,
                  maxHeight: 400,
                  overflowY: "auto",
                  background: "#0e1017",
                  border: "1px solid rgba(197, 160, 89, 0.35)",
                  borderRadius: 8,
                  boxShadow: "0 16px 44px rgba(0, 0, 0, 0.9)",
                  padding: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {/* Banner Cloud AUREUS */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 8px 6px",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                    marginBottom: 2,
                    fontSize: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#10b981", fontWeight: 600 }}>
                    <Cloud size={12} />
                    <span>{isSignedIn ? "Cloud AUREUS Attivo" : "Archiviazione Locale"}</span>
                  </div>
                  <button
                    type="button"
                    className="btm-text-button"
                    style={{ fontSize: 9.5, color: "#C5A059" }}
                    onClick={() => {
                      setTemplateMenuOpen(false);
                      setCloudModalOpen(true);
                    }}
                  >
                    Gestisci tutto &gt;
                  </button>
                </div>

                {/* Salva come nuovo modello */}
                {isSavingTemplate ? (
                  <div style={{ padding: 6, borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 4 }}>
                    <div style={{ fontSize: 10.5, color: "#C5A059", fontWeight: 700, marginBottom: 4 }}>
                      NUOVO MODELLO
                    </div>
                    <input
                      type="text"
                      className="btm-input"
                      autoFocus
                      maxLength={60}
                      placeholder="Nome modello..."
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      style={{ width: "100%", fontSize: 11, marginBottom: 6 }}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                      <button
                        type="button"
                        className="btm-toggle"
                        style={{ fontSize: 10.5, padding: "2px 8px" }}
                        onClick={() => setIsSavingTemplate(false)}
                      >
                        Annulla
                      </button>
                      <button
                        type="button"
                        className="btm-toggle"
                        data-on="true"
                        style={{ fontSize: 10.5, padding: "2px 8px" }}
                        disabled={!newTemplateName.trim()}
                        onClick={handleSaveTemplateSubmit}
                      >
                        Salva
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btm-toggle"
                    style={{
                      textAlign: "left",
                      justifyContent: "flex-start",
                      fontSize: 11.5,
                      padding: "6px 10px",
                      background: "rgba(197, 160, 89, 0.12)",
                      color: "#E8C56A",
                      border: "1px solid rgba(197, 160, 89, 0.3)",
                    }}
                    onClick={() => setIsSavingTemplate(true)}
                  >
                    + Salva come nuovo modello...
                  </button>
                )}

                {/* Pulsanti Importa ed Esporta JSON */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  <button
                    type="button"
                    className="btm-toggle"
                    style={{ fontSize: 10.5, padding: "4px 8px", display: "flex", alignItems: "center", gap: 4 }}
                    onClick={() => fileInputRef.current?.click()}
                    title="Importa modelli da file JSON"
                  >
                    <Upload size={11} style={{ color: "#C5A059" }} />
                    <span>Importa JSON</span>
                  </button>

                  <button
                    type="button"
                    className="btm-toggle"
                    style={{ fontSize: 10.5, padding: "4px 8px", display: "flex", alignItems: "center", gap: 4 }}
                    disabled={templates.length === 0}
                    onClick={() => {
                      exportAllTemplatesAsJson(templates);
                      setTemplateMenuOpen(false);
                      toast({
                        title: "Modelli Esportati",
                        description: `Scaricato file backup con ${templates.length} modelli.`,
                      });
                    }}
                    title="Esporta backup JSON di tutti i modelli"
                  >
                    <Download size={11} style={{ color: "#10b981" }} />
                    <span>Esporta Tutti</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="btm-toggle"
                  style={{
                    textAlign: "left",
                    justifyContent: "flex-start",
                    fontSize: 11,
                    padding: "5px 10px",
                  }}
                  onClick={() => {
                    setSettings({ ...DEFAULT_TERMINAL_SETTINGS });
                    setTemplateMenuOpen(false);
                  }}
                >
                  <RotateCcw size={12} style={{ marginRight: 6 }} />
                  Ripristina predefiniti AUREUS
                </button>

                {/* Sezione Preset Brand */}
                <div
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: "#C5A059",
                    padding: "6px 8px 2px",
                    textTransform: "uppercase",
                    fontFamily: "var(--font-mono)",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    marginTop: 4,
                  }}
                >
                  Canoni AUREUS Ufficiali
                </div>

                {(
                  [
                    ["product", "Canone AUREUS Oro"],
                    ["tvDark", "Ossidiana Sovrana"],
                    ["midnight", "Notte Zaffiro"],
                    ["monochrome", "ICT Monocromatico"],
                    ["tvLight", "Chiaro"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className="btm-toggle"
                    style={{
                      textAlign: "left",
                      justifyContent: "flex-start",
                      fontSize: 11,
                      padding: "5px 10px",
                    }}
                    onClick={() => applyBrandPreset(key)}
                  >
                    {label}
                  </button>
                ))}

                {/* Modelli Salvati dall'Utente */}
                {templates.length > 0 && (
                  <>
                    <div
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        color: "#94a3b8",
                        padding: "6px 8px 2px",
                        textTransform: "uppercase",
                        fontFamily: "var(--font-mono)",
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                        marginTop: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>I Tuoi Modelli ({templates.length})</span>
                      <span style={{ fontSize: 9, color: "#10b981" }}>☁️ Cloud Sync</span>
                    </div>
                    {templates.map((tpl) => (
                      <div
                        key={tpl.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "4px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          background: "rgba(255,255,255,0.015)",
                          gap: 6,
                        }}
                      >
                        <button
                          type="button"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#e2e8f0",
                            cursor: "pointer",
                            textAlign: "left",
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                          onClick={() => {
                            engine.setIndicators(tpl.indicators.map((c) => ({ ...c })));
                            engine.setSettings({ ...engine.settings, ...pickChartSettings(tpl.settings) });
                            setTemplateMenuOpen(false);
                            toast({
                              title: "Modello Applicato",
                              description: `Attivato "${tpl.name}".`,
                            });
                          }}
                          title={`Applica ${tpl.name}`}
                        >
                          <Cloud size={11} style={{ color: "#10b981", flexShrink: 0 }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{tpl.name}</span>
                        </button>

                        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                          <button
                            type="button"
                            className="btm-iconbtn"
                            style={{ width: 20, height: 20 }}
                            title="Esporta singolo JSON"
                            onClick={(e) => {
                              e.stopPropagation();
                              exportSingleTemplateAsJson(tpl);
                            }}
                          >
                            <Download size={11} />
                          </button>
                          <button
                            type="button"
                            className="btm-trash"
                            style={{ padding: 2 }}
                            title="Elimina modello"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateTemplates(templates.filter((t) => t.id !== tpl.id));
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            style={{ display: "none" }}
            onChange={handleDropdownFileImport}
          />

          {/* Bottoni Annulla e Ok */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              className="btm-toggle"
              style={{ padding: "6px 18px", fontSize: 12, fontWeight: 500 }}
              onClick={handleRollback}
            >
              Annulla
            </button>
            <button
              type="button"
              className="btm-toggle"
              data-on="true"
              style={{
                padding: "6px 22px",
                fontSize: 12,
                fontWeight: 700,
                background: "#C5A059",
                color: "#08090d",
                border: "1px solid #C5A059",
              }}
              onClick={handleCommit}
            >
              Ok
            </button>
          </div>
        </div>
      </div>

      {/* ── Modale Gestione Completa Modelli Cloud & Backup ─────────────────── */}
      <CloudTemplateManagerModal
        isOpen={cloudModalOpen}
        onClose={() => setCloudModalOpen(false)}
        engine={engine}
      />
    </div>
  );
}
