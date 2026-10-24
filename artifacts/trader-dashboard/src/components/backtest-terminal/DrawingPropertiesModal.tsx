import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, HelpCircle, Plus, RotateCcw, Trash2, X } from "lucide-react";
import type {
  DrawingStyle,
  DrawingTimeframeRange,
  DrawingVisibilityConfig,
  FibLevelConfig,
  ReplayCandle,
  ReplayDrawing,
} from "@/lib/replay/types";
import {
  DEFAULT_DRAWING_VISIBILITY,
  DEFAULT_FIB_LEVELS,
  deleteDrawingToolTemplate,
  loadDrawingToolTemplates,
  saveDrawingToolTemplate,
  type DrawingToolSavedTemplate,
} from "@/lib/replay/drawingWorkspace";
import { priceDecimals } from "./format";
import type { DrawingToolId } from "./toolRailModel";

export interface DrawingPropertiesModalProps {
  drawing: ReplayDrawing;
  symbol: string;
  candles: ReplayCandle[];
  intervalSeconds: number;
  onApply: (updated: ReplayDrawing) => void;
  onClose: () => void;
  onOpenKnowledge?: (toolId: DrawingToolId) => void;
}

type ModalTab = "input" | "style" | "coordinates" | "visibility";

export const TOOL_TITLES: Record<ReplayDrawing["kind"], string> = {
  frvp: "FRVP",
  infoline: "Infolinea",
  trend: "Linea di tendenza",
  ray: "Semiretta",
  hray: "Semiretta orizzontale",
  hline: "Linea orizzontale",
  vline: "Linea verticale",
  parallelChannel: "Canale parallelo",
  fib: "Ritracciamento di Fibonacci",
  avwap: "VWAP Ancorato",
  rect: "Rettangolo",
  highlighter: "Evidenziatore",
  path: "Percorso",
  arrow: "Freccia",
  arrowUp: "Freccia su",
  arrowDown: "Freccia giù",
  text: "Testo",
  callout: "Nota ancorata",
  position: "Posizione Long / Short",
  ruler: "Range data e prezzo",
  priceRange: "Range prezzo",
  dateRange: "Range data",
};

function LineComboControl({
  color,
  onColorChange,
  style = "solid",
  onStyleChange,
  width = 1,
  onWidthChange,
}: {
  color: string;
  onColorChange: (c: string) => void;
  style?: DrawingStyle;
  onStyleChange?: (s: DrawingStyle) => void;
  width?: number;
  onWidthChange?: (w: number) => void;
}) {
  return (
    <div className="dpm-line-combo">
      <label className="dpm-color-pill" style={{ backgroundColor: color }}>
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(color) ? color : "#ef4444"}
          onChange={(e) => onColorChange(e.target.value)}
        />
      </label>
      {onStyleChange && (
        <select
          className="dpm-line-style-select"
          value={style}
          onChange={(e) => onStyleChange(e.target.value as DrawingStyle)}
          aria-label="Stile linea"
        >
          <option value="solid">───</option>
          <option value="dashed">- - -</option>
          <option value="dotted">····</option>
        </select>
      )}
      {onWidthChange && (
        <select
          className="dpm-line-width-select"
          value={width}
          onChange={(e) => onWidthChange(Number(e.target.value))}
          aria-label="Spessore linea"
        >
          {[1, 2, 3, 4].map((w) => (
            <option key={w} value={w}>
              {w}px
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function CheckerColorSwatch({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
}) {
  const hex = /^#[0-9a-f]{6}/i.test(value) ? value.slice(0, 7) : "#2962ff";
  return (
    <label className="dpm-checker-swatch" title={label}>
      <span className="dpm-checker-fill" style={{ backgroundColor: value }} />
      <input
        type="color"
        aria-label={label}
        value={hex}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function DrawingPropertiesModal({
  drawing,
  symbol,
  candles,
  intervalSeconds,
  onApply,
  onClose,
  onOpenKnowledge,
}: DrawingPropertiesModalProps) {
  const [tab, setTab] = useState<ModalTab>("style");
  const [draft, setDraft] = useState<ReplayDrawing>(() => structuredClone(drawing));
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState("");
  const [templates, setTemplates] = useState<DrawingToolSavedTemplate[]>(() =>
    loadDrawingToolTemplates(drawing.kind),
  );

  useEffect(() => {
    setDraft(structuredClone(drawing));
    setTemplates(loadDrawingToolTemplates(drawing.kind));
  }, [drawing]);

  const decimals = priceDecimals(symbol);
  const stepPrice = Number((1 / Math.pow(10, decimals)).toFixed(decimals));

  const patchDraft = (patch: Record<string, unknown>) => {
    setDraft((prev) => ({ ...prev, ...patch } as ReplayDrawing));
  };

  // Relative bar index conversion (#1 barra, #2 barra like TradingView Screenshot 3: -784, -349)
  const lastCandleIndex = Math.max(0, candles.length - 1);
  const lastCandleTime = candles[lastCandleIndex]?.time ?? Math.floor(Date.now() / 1000);
  const safeInterval = Math.max(1, intervalSeconds);

  const timeToRelBar = (time: number): number => {
    if (candles.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < candles.length; i++) {
        const d = Math.abs(candles[i].time - time);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      if (bestDist < safeInterval) {
        return bestIdx - lastCandleIndex;
      }
    }
    return Math.round((time - lastCandleTime) / safeInterval);
  };

  const relBarToTime = (relBar: number): number => {
    const targetIdx = lastCandleIndex + relBar;
    if (targetIdx >= 0 && targetIdx < candles.length) {
      return candles[targetIdx].time;
    }
    return lastCandleTime + relBar * safeInterval;
  };

  const visibility: DrawingVisibilityConfig = useMemo(
    () => draft.visibility ?? structuredClone(DEFAULT_DRAWING_VISIBILITY),
    [draft.visibility],
  );

  const updateVisibilityRange = (
    key: keyof Omit<DrawingVisibilityConfig, "ticks" | "ranges">,
    patch: Partial<DrawingTimeframeRange>,
  ) => {
    const nextVis: DrawingVisibilityConfig = {
      ...visibility,
      [key]: { ...visibility[key], ...patch },
    };
    patchDraft({ visibility: nextVis });
  };

  const handleResetDefaults = () => {
    setDraft((prev) => {
      const base: Record<string, unknown> = {
        id: prev.id,
        kind: prev.kind,
        color: prev.kind === "frvp" ? "#ef4444" : "#2962ff",
        width: 2,
        visibility: structuredClone(DEFAULT_DRAWING_VISIBILITY),
      };
      if ("a" in prev) {
        base.a = prev.a;
        base.b = prev.b;
      }
      if ("at" in prev) base.at = prev.at;
      if ("points" in prev) base.points = prev.points;
      if ("price" in prev) base.price = prev.price;
      if ("time" in prev) base.time = prev.time;
      if ("text" in prev) base.text = prev.text;
      if (prev.kind === "position") {
        base.direction = prev.direction;
        base.entry = prev.entry;
        base.slPrice = prev.slPrice;
        base.tpPrice = prev.tpPrice;
        base.endTime = prev.endTime;
      }
      return base as unknown as ReplayDrawing;
    });
    setTemplateMenuOpen(false);
  };

  const knowledgeToolId: DrawingToolId =
    draft.kind === "position"
      ? draft.direction === "buy"
        ? "longPosition"
        : "shortPosition"
      : (draft.kind as DrawingToolId);

  return (
    <div
      className="dpm-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="dpm-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Impostazioni ${TOOL_TITLES[draft.kind]}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="dpm-header">
          <div className="flex items-center gap-2">
            <h2 className="dpm-title">{TOOL_TITLES[draft.kind]}</h2>
            {onOpenKnowledge && (
              <button
                type="button"
                className="dpm-info-trigger"
                onClick={() => onOpenKnowledge(knowledgeToolId)}
                title="Apri spiegazione strumento nel Centro di supporto"
                aria-label="Spiegazione strumento"
              >
                <HelpCircle size={15} />
              </button>
            )}
          </div>
          <button
            type="button"
            className="dpm-close-btn"
            onClick={onClose}
            aria-label="Chiudi"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── 4 Tabs: Input | Stile | Coordinate | Visibilità ── */}
        <div className="dpm-tabs" role="tablist">
          {(
            [
              ["input", "Input"],
              ["style", "Stile"],
              ["coordinates", "Coordinate"],
              ["visibility", "Visibilità"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`dpm-tab ${tab === id ? "is-active" : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="dpm-body">
          {/* ═══════════════ TAB 1: INPUT ═══════════════ */}
          {tab === "input" && (
            <div className="dpm-section-stack">
              {draft.kind === "frvp" && (
                <>
                  <div className="dpm-row">
                    <span className="dpm-label">Layout righe</span>
                    <span className="dpm-static-val">Numero di righe</span>
                  </div>
                  <div className="dpm-row">
                    <label className="dpm-label" htmlFor="frvp-rows">
                      Dimensione righe
                    </label>
                    <input
                      id="frvp-rows"
                      type="number"
                      min={6}
                      max={100}
                      className="dpm-num-input"
                      value={draft.rows ?? 24}
                      onChange={(e) =>
                        patchDraft({ rows: Math.max(6, Math.min(100, Number(e.target.value) || 24)) })
                      }
                    />
                  </div>
                  <div className="dpm-row">
                    <label className="dpm-label" htmlFor="frvp-vol-mode">
                      Volume
                    </label>
                    <select
                      id="frvp-vol-mode"
                      className="dpm-select"
                      value={draft.volumeMode ?? "up_down"}
                      onChange={(e) => patchDraft({ volumeMode: e.target.value })}
                    >
                      <option value="up_down">Su / Giù</option>
                      <option value="total">Totale</option>
                      <option value="delta">Delta</option>
                    </select>
                  </div>
                  <div className="dpm-row">
                    <label className="dpm-label" htmlFor="frvp-va-pct">
                      Volume area valore (%)
                    </label>
                    <input
                      id="frvp-va-pct"
                      type="number"
                      min={10}
                      max={100}
                      className="dpm-num-input"
                      value={Math.round((draft.valueAreaPct ?? 0.7) * 100)}
                      onChange={(e) =>
                        patchDraft({
                          valueAreaPct: Math.max(0.1, Math.min(1, (Number(e.target.value) || 70) / 100)),
                        })
                      }
                    />
                  </div>
                  <label className="dpm-check-row">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.extendRight)}
                      onChange={(e) => patchDraft({ extendRight: e.target.checked })}
                    />
                    <span>Estendi linee POC / VAH / VAL a destra</span>
                  </label>
                </>
              )}

              {draft.kind === "position" && (
                <>
                  <div className="dpm-row">
                    <label className="dpm-label">Dimensione conto</label>
                    <input
                      type="number"
                      min={100}
                      step={100}
                      className="dpm-num-input"
                      value={draft.accountSize ?? 10000}
                      onChange={(e) => patchDraft({ accountSize: Math.max(100, Number(e.target.value) || 10000) })}
                    />
                  </div>
                  <div className="dpm-row">
                    <label className="dpm-label">Rischio (%)</label>
                    <input
                      type="number"
                      min={0.1}
                      max={20}
                      step={0.1}
                      className="dpm-num-input"
                      value={draft.riskPct ?? 1}
                      onChange={(e) => patchDraft({ riskPct: Math.max(0.1, Number(e.target.value) || 1) })}
                    />
                  </div>
                  <div className="dpm-row">
                    <label className="dpm-label">Prezzo d&apos;ingresso</label>
                    <input
                      type="number"
                      step={stepPrice}
                      className="dpm-num-input"
                      value={draft.entry.price}
                      onChange={(e) =>
                        patchDraft({
                          entry: { ...draft.entry, price: Number(e.target.value) || draft.entry.price },
                        })
                      }
                    />
                  </div>
                  <div className="dpm-row">
                    <label className="dpm-label">Livello profitto (TP)</label>
                    <input
                      type="number"
                      step={stepPrice}
                      className="dpm-num-input"
                      value={draft.tpPrice}
                      onChange={(e) => patchDraft({ tpPrice: Number(e.target.value) || draft.tpPrice })}
                    />
                  </div>
                  <div className="dpm-row">
                    <label className="dpm-label">Livello stop (SL)</label>
                    <input
                      type="number"
                      step={stepPrice}
                      className="dpm-num-input"
                      value={draft.slPrice}
                      onChange={(e) => patchDraft({ slPrice: Number(e.target.value) || draft.slPrice })}
                    />
                  </div>
                </>
              )}

              {draft.kind === "fib" && (
                <>
                  <div className="dpm-subtitle">Livelli di Fibonacci</div>
                  <div className="dpm-fib-grid">
                    {(draft.levels ?? DEFAULT_FIB_LEVELS).map((lvl, idx) => {
                      const currentLevels = draft.levels ?? DEFAULT_FIB_LEVELS;
                      return (
                        <div key={idx} className="dpm-fib-item">
                          <input
                            type="checkbox"
                            checked={lvl.enabled}
                            onChange={(e) => {
                              const next: FibLevelConfig[] = currentLevels.map((item, i) =>
                                i === idx ? { ...item, enabled: e.target.checked } : item,
                              );
                              patchDraft({ levels: next });
                            }}
                          />
                          <input
                            type="number"
                            step="0.001"
                            className="dpm-fib-num"
                            value={lvl.level}
                            onChange={(e) => {
                              const next: FibLevelConfig[] = currentLevels.map((item, i) =>
                                i === idx ? { ...item, level: Number(e.target.value) || 0 } : item,
                              );
                              patchDraft({ levels: next });
                            }}
                          />
                          <CheckerColorSwatch
                            label={`Colore livello ${lvl.level}`}
                            value={lvl.color ?? draft.color}
                            onChange={(c) => {
                              const next: FibLevelConfig[] = currentLevels.map((item, i) =>
                                i === idx ? { ...item, color: c } : item,
                              );
                              patchDraft({ levels: next });
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <label className="dpm-check-row">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.reverse)}
                      onChange={(e) => patchDraft({ reverse: e.target.checked })}
                    />
                    <span>Inverti direzione (0% ↔ 100%)</span>
                  </label>
                </>
              )}

              {draft.kind === "rect" && (
                <>
                  <div className="dpm-row">
                    <label className="dpm-label">Preset Zona SMC</label>
                    <select
                      className="dpm-select"
                      value={draft.zonePreset ?? "custom"}
                      onChange={(e) => {
                        const preset = e.target.value as NonNullable<typeof draft.zonePreset>;
                        const labelMap: Record<string, { text: string; color: string; showMidline: boolean }> = {
                          fvg: { text: "FVG (Fair Value Gap)", color: "#d4af37", showMidline: true },
                          ob: { text: "Orderblock (OB)", color: "#3b82f6", showMidline: true },
                          liquidity: { text: "Liquidity Pool (BSL/SSL)", color: "#10b981", showMidline: false },
                          breaker: { text: "Breaker Block", color: "#8b5cf6", showMidline: true },
                          session: { text: "Range Sessione", color: "#64748b", showMidline: true },
                        };
                        if (labelMap[preset]) {
                          patchDraft({
                            zonePreset: preset,
                            text: labelMap[preset].text,
                            color: labelMap[preset].color,
                            showMidline: labelMap[preset].showMidline,
                          });
                        } else {
                          patchDraft({ zonePreset: "custom" });
                        }
                      }}
                    >
                      <option value="custom">Personalizzato</option>
                      <option value="fvg">Fair Value Gap (FVG + 50% EQ)</option>
                      <option value="ob">Orderblock Istituzionale (OB)</option>
                      <option value="liquidity">Pool di Liquidità (BSL / SSL)</option>
                      <option value="breaker">Breaker Block</option>
                      <option value="session">Range di Sessione (Asia / London)</option>
                    </select>
                  </div>
                  <div className="dpm-row">
                    <label className="dpm-label">Testo etichetta</label>
                    <input
                      type="text"
                      className="dpm-text-input"
                      placeholder="Es. Bullish FVG H1"
                      value={draft.text ?? ""}
                      onChange={(e) => patchDraft({ text: e.target.value })}
                    />
                  </div>
                </>
              )}

              {draft.kind === "avwap" && (
                <>
                  <div className="dpm-row">
                    <label className="dpm-label">Sorgente calcolo</label>
                    <select
                      className="dpm-select"
                      value={draft.source ?? "hlc3"}
                      onChange={(e) => patchDraft({ source: e.target.value })}
                    >
                      <option value="hlc3">HLC3 ((H+L+C)/3)</option>
                      <option value="ohlc4">OHLC4 ((O+H+L+C)/4)</option>
                      <option value="hl2">HL2 ((H+L)/2)</option>
                      <option value="close">Chiusura (Close)</option>
                    </select>
                  </div>
                  <label className="dpm-check-row">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.showBands)}
                      onChange={(e) => patchDraft({ showBands: e.target.checked })}
                    />
                    <span>Mostra bande di deviazione standard (±σ)</span>
                  </label>
                  <div className="dpm-row">
                    <label className="dpm-label">Moltiplicatore bande (σ)</label>
                    <input
                      type="number"
                      step={0.25}
                      min={0.25}
                      max={5}
                      className="dpm-num-input"
                      value={draft.bandMultiplier ?? 1}
                      onChange={(e) => patchDraft({ bandMultiplier: Math.max(0.25, Number(e.target.value) || 1) })}
                    />
                  </div>
                </>
              )}

              {![
                "frvp",
                "position",
                "fib",
                "rect",
                "avwap",
              ].includes(draft.kind) && (
                <>
                  <div className="dpm-row">
                    <label className="dpm-label">Testo / Etichetta</label>
                    <input
                      type="text"
                      className="dpm-text-input"
                      placeholder="Aggiungi testo..."
                      value={"text" in draft ? (draft.text ?? "") : ""}
                      onChange={(e) => patchDraft({ text: e.target.value })}
                    />
                  </div>
                  {draft.kind === "infoline" && (
                    <>
                      <label className="dpm-check-row">
                        <input
                          type="checkbox"
                          checked={draft.showStats !== false}
                          onChange={(e) => patchDraft({ showStats: e.target.checked })}
                        />
                        <span>Mostra scheda informativa completa</span>
                      </label>
                      <label className="dpm-check-row">
                        <input
                          type="checkbox"
                          checked={draft.showPriceChange !== false}
                          onChange={(e) => patchDraft({ showPriceChange: e.target.checked })}
                        />
                        <span>Mostra variazione prezzo (pips e %)</span>
                      </label>
                      <label className="dpm-check-row">
                        <input
                          type="checkbox"
                          checked={draft.showBarsRange !== false}
                          onChange={(e) => patchDraft({ showBarsRange: e.target.checked })}
                        />
                        <span>Mostra distanza in barre e tempo</span>
                      </label>
                      <label className="dpm-check-row">
                        <input
                          type="checkbox"
                          checked={draft.showAngle !== false}
                          onChange={(e) => patchDraft({ showAngle: e.target.checked })}
                        />
                        <span>Mostra angolo della linea (°)</span>
                      </label>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* ═══════════════ TAB 2: STILE (Screenshot 4) ═══════════════ */}
          {tab === "style" && (
            <div className="dpm-section-stack">
              {draft.kind === "frvp" ? (
                <>
                  <div className="dpm-row">
                    <label className="dpm-check-row">
                      <input
                        type="checkbox"
                        checked={draft.showProfile !== false}
                        onChange={(e) => patchDraft({ showProfile: e.target.checked })}
                      />
                      <span>Profilo volume</span>
                    </label>
                  </div>

                  <div className="dpm-row dpm-indent">
                    <label className="dpm-check-row">
                      <input
                        type="checkbox"
                        checked={Boolean(draft.showValues)}
                        onChange={(e) => patchDraft({ showValues: e.target.checked })}
                      />
                      <span>Valori</span>
                    </label>
                    <CheckerColorSwatch
                      label="Colore valori"
                      value={draft.valuesColor ?? "#d1d4dc"}
                      onChange={(c) => patchDraft({ valuesColor: c })}
                    />
                  </div>

                  <div className="dpm-row dpm-indent">
                    <label className="dpm-label" htmlFor="frvp-width-pct">
                      Ampiezza (% del grafico)
                    </label>
                    <input
                      id="frvp-width-pct"
                      type="number"
                      min={10}
                      max={100}
                      className="dpm-num-input"
                      value={draft.widthPct ?? 40}
                      onChange={(e) =>
                        patchDraft({ widthPct: Math.max(10, Math.min(100, Number(e.target.value) || 40)) })
                      }
                    />
                  </div>

                  <div className="dpm-row dpm-indent">
                    <label className="dpm-label" htmlFor="frvp-placement">
                      Posizionamento
                    </label>
                    <select
                      id="frvp-placement"
                      className="dpm-select"
                      value={draft.placement ?? "left"}
                      onChange={(e) => patchDraft({ placement: e.target.value as "left" | "right" })}
                    >
                      <option value="left">Sinistra</option>
                      <option value="right">Destra</option>
                    </select>
                  </div>

                  <div className="dpm-row dpm-indent">
                    <span className="dpm-label">Volume acquisti</span>
                    <CheckerColorSwatch
                      label="Volume acquisti"
                      value={draft.upVolumeColor ?? "#26a69a"}
                      onChange={(c) => patchDraft({ upVolumeColor: c })}
                    />
                  </div>

                  <div className="dpm-row dpm-indent">
                    <span className="dpm-label">Volume vendite</span>
                    <CheckerColorSwatch
                      label="Volume vendite"
                      value={draft.downVolumeColor ?? "#ef5350"}
                      onChange={(c) => patchDraft({ downVolumeColor: c })}
                    />
                  </div>

                  <div className="dpm-row dpm-indent">
                    <span className="dpm-label">Valore area acquisto</span>
                    <CheckerColorSwatch
                      label="Valore area acquisto"
                      value={draft.vaUpColor ?? "#2962ff"}
                      onChange={(c) => patchDraft({ vaUpColor: c })}
                    />
                  </div>

                  <div className="dpm-row dpm-indent">
                    <span className="dpm-label">Valore area vendite</span>
                    <CheckerColorSwatch
                      label="Valore area vendite"
                      value={draft.vaDownColor ?? "#f59e0b"}
                      onChange={(c) => patchDraft({ vaDownColor: c })}
                    />
                  </div>

                  <div className="dpm-row">
                    <label className="dpm-check-row">
                      <input
                        type="checkbox"
                        checked={draft.showVah !== false}
                        onChange={(e) => patchDraft({ showVah: e.target.checked })}
                      />
                      <span>VAH</span>
                    </label>
                    <LineComboControl
                      color={draft.vahColor ?? "#3b82f6"}
                      onColorChange={(c) => patchDraft({ vahColor: c })}
                      style={draft.vahStyle ?? "dashed"}
                      onStyleChange={(s) => patchDraft({ vahStyle: s })}
                      width={draft.vahWidth ?? 1}
                      onWidthChange={(w) => patchDraft({ vahWidth: w })}
                    />
                  </div>

                  <div className="dpm-row">
                    <label className="dpm-check-row">
                      <input
                        type="checkbox"
                        checked={draft.showVal !== false}
                        onChange={(e) => patchDraft({ showVal: e.target.checked })}
                      />
                      <span>VAL</span>
                    </label>
                    <LineComboControl
                      color={draft.valColor ?? "#3b82f6"}
                      onColorChange={(c) => patchDraft({ valColor: c })}
                      style={draft.valStyle ?? "dashed"}
                      onStyleChange={(s) => patchDraft({ valStyle: s })}
                      width={draft.valWidth ?? 1}
                      onWidthChange={(w) => patchDraft({ valWidth: w })}
                    />
                  </div>

                  <div className="dpm-row">
                    <label className="dpm-check-row">
                      <input
                        type="checkbox"
                        checked={draft.showPoc !== false}
                        onChange={(e) => patchDraft({ showPoc: e.target.checked })}
                      />
                      <span>POC</span>
                    </label>
                    <LineComboControl
                      color={draft.pocColor ?? draft.color ?? "#ef4444"}
                      onColorChange={(c) => patchDraft({ pocColor: c, color: c })}
                      style={draft.pocStyle ?? "solid"}
                      onStyleChange={(s) => patchDraft({ pocStyle: s })}
                      width={draft.pocWidth ?? 2}
                      onWidthChange={(w) => patchDraft({ pocWidth: w, width: w })}
                    />
                  </div>

                  <div className="dpm-row">
                    <label className="dpm-check-row">
                      <input
                        type="checkbox"
                        checked={Boolean(draft.showDevelopingPoc)}
                        onChange={(e) => patchDraft({ showDevelopingPoc: e.target.checked })}
                      />
                      <span>Sviluppo del POC</span>
                    </label>
                    <LineComboControl
                      color={draft.developingPocColor ?? "#eab308"}
                      onColorChange={(c) => patchDraft({ developingPocColor: c })}
                      style={draft.developingPocStyle ?? "solid"}
                      onStyleChange={(s) => patchDraft({ developingPocStyle: s })}
                    />
                  </div>

                  <div className="dpm-row">
                    <label className="dpm-check-row">
                      <input
                        type="checkbox"
                        checked={Boolean(draft.showDevelopingVa)}
                        onChange={(e) => patchDraft({ showDevelopingVa: e.target.checked })}
                      />
                      <span>Sviluppo VA</span>
                    </label>
                    <LineComboControl
                      color={draft.developingVaColor ?? "#06b6d4"}
                      onColorChange={(c) => patchDraft({ developingVaColor: c })}
                      style={draft.developingVaStyle ?? "dashed"}
                      onStyleChange={(s) => patchDraft({ developingVaStyle: s })}
                    />
                  </div>

                  <div className="dpm-row">
                    <span className="dpm-label">Istogramma</span>
                    <CheckerColorSwatch
                      label="Sfondo box istogramma"
                      value={draft.histogramBoxColor ?? "#3b82f6"}
                      onChange={(c) => patchDraft({ histogramBoxColor: c })}
                    />
                  </div>
                </>
              ) : draft.kind === "position" ? (
                <>
                  <div className="dpm-row">
                    <span className="dpm-label">Colore Target (Profitto)</span>
                    <CheckerColorSwatch
                      label="Colore Target"
                      value={draft.targetColor ?? draft.color ?? "#10b981"}
                      onChange={(c) => patchDraft({ targetColor: c, color: c })}
                    />
                  </div>
                  <div className="dpm-row">
                    <span className="dpm-label">Colore Stop (Perdita)</span>
                    <CheckerColorSwatch
                      label="Colore Stop"
                      value={draft.stopColor ?? "#ef4444"}
                      onChange={(c) => patchDraft({ stopColor: c })}
                    />
                  </div>
                  <div className="dpm-row">
                    <span className="dpm-label">Opacità riempimento (%)</span>
                    <input
                      type="number"
                      min={5}
                      max={80}
                      className="dpm-num-input"
                      value={Math.round((draft.fillOpacity ?? 0.16) * 100)}
                      onChange={(e) =>
                        patchDraft({ fillOpacity: Math.max(0.05, Math.min(0.8, (Number(e.target.value) || 16) / 100)) })
                      }
                    />
                  </div>
                  <label className="dpm-check-row">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.compactLabels)}
                      onChange={(e) => patchDraft({ compactLabels: e.target.checked })}
                    />
                    <span>Etichette compatte</span>
                  </label>
                </>
              ) : (
                <>
                  <div className="dpm-row">
                    <span className="dpm-label">Linea / Tratto</span>
                    <LineComboControl
                      color={draft.color ?? "#2962ff"}
                      onColorChange={(c) => patchDraft({ color: c })}
                      style={"style" in draft ? (draft.style ?? "solid") : "solid"}
                      onStyleChange={(s) => patchDraft({ style: s })}
                      width={"width" in draft ? (draft.width ?? 2) : 2}
                      onWidthChange={(w) => patchDraft({ width: w })}
                    />
                  </div>

                  {("fillOpacity" in draft || draft.kind === "rect" || draft.kind === "parallelChannel" || draft.kind === "fib" || draft.kind === "highlighter") && (
                    <div className="dpm-row">
                      <span className="dpm-label">Opacità sfondo (%)</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="dpm-num-input"
                        value={Math.round((("fillOpacity" in draft ? draft.fillOpacity : undefined) ?? 0.14) * 100)}
                        onChange={(e) =>
                          patchDraft({ fillOpacity: Math.max(0, Math.min(1, (Number(e.target.value) || 0) / 100)) })
                        }
                      />
                    </div>
                  )}

                  {(draft.kind === "rect" || draft.kind === "parallelChannel") && (
                    <label className="dpm-check-row">
                      <input
                        type="checkbox"
                        checked={draft.showMidline !== false}
                        onChange={(e) => patchDraft({ showMidline: e.target.checked })}
                      />
                      <span>Linea mediana 50% (Equilibrium)</span>
                    </label>
                  )}

                  {(draft.kind === "trend" || draft.kind === "infoline" || draft.kind === "rect" || draft.kind === "fib" || draft.kind === "parallelChannel") && (
                    <>
                      <label className="dpm-check-row">
                        <input
                          type="checkbox"
                          checked={Boolean("extendLeft" in draft && draft.extendLeft)}
                          onChange={(e) => patchDraft({ extendLeft: e.target.checked })}
                        />
                        <span>Estendi a sinistra</span>
                      </label>
                      <label className="dpm-check-row">
                        <input
                          type="checkbox"
                          checked={Boolean("extendRight" in draft && draft.extendRight)}
                          onChange={(e) => patchDraft({ extendRight: e.target.checked })}
                        />
                        <span>Estendi a destra</span>
                      </label>
                    </>
                  )}

                  {draft.kind === "fib" && (
                    <>
                      <label className="dpm-check-row">
                        <input
                          type="checkbox"
                          checked={draft.showPrices !== false}
                          onChange={(e) => patchDraft({ showPrices: e.target.checked })}
                        />
                        <span>Mostra valori di prezzo sui livelli</span>
                      </label>
                      <label className="dpm-check-row">
                        <input
                          type="checkbox"
                          checked={draft.showPercents !== false}
                          onChange={(e) => patchDraft({ showPercents: e.target.checked })}
                        />
                        <span>Mostra coefficienti / percentuali</span>
                      </label>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* ═══════════════ TAB 3: COORDINATE (Screenshot 3) ═══════════════ */}
          {tab === "coordinates" && (
            <div className="dpm-section-stack">
              {"a" in draft && "b" in draft && (
                <>
                  <div className="dpm-coord-group">
                    <div className="dpm-row">
                      <label className="dpm-label" htmlFor="coord-1-bar">
                        #1 (barra)
                      </label>
                      <input
                        id="coord-1-bar"
                        type="number"
                        className="dpm-num-input"
                        value={timeToRelBar(draft.a.time)}
                        onChange={(e) => {
                          const rel = Number.parseInt(e.target.value, 10);
                          if (Number.isFinite(rel)) {
                            patchDraft({ a: { ...draft.a, time: relBarToTime(rel) } });
                          }
                        }}
                      />
                    </div>
                    {draft.kind !== "frvp" && draft.kind !== "dateRange" && (
                      <div className="dpm-row">
                        <label className="dpm-label" htmlFor="coord-1-price">
                          #1 (prezzo)
                        </label>
                        <input
                          id="coord-1-price"
                          type="number"
                          step={stepPrice}
                          className="dpm-num-input"
                          value={Number(draft.a.price.toFixed(decimals))}
                          onChange={(e) => {
                            const val = Number.parseFloat(e.target.value);
                            if (Number.isFinite(val)) {
                              patchDraft({ a: { ...draft.a, price: val } });
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="dpm-coord-group">
                    <div className="dpm-row">
                      <label className="dpm-label" htmlFor="coord-2-bar">
                        #2 (barra)
                      </label>
                      <input
                        id="coord-2-bar"
                        type="number"
                        className="dpm-num-input"
                        value={timeToRelBar(draft.b.time)}
                        onChange={(e) => {
                          const rel = Number.parseInt(e.target.value, 10);
                          if (Number.isFinite(rel)) {
                            patchDraft({ b: { ...draft.b, time: relBarToTime(rel) } });
                          }
                        }}
                      />
                    </div>
                    {draft.kind !== "frvp" && draft.kind !== "dateRange" && (
                      <div className="dpm-row">
                        <label className="dpm-label" htmlFor="coord-2-price">
                          #2 (prezzo)
                        </label>
                        <input
                          id="coord-2-price"
                          type="number"
                          step={stepPrice}
                          className="dpm-num-input"
                          value={Number(draft.b.price.toFixed(decimals))}
                          onChange={(e) => {
                            const val = Number.parseFloat(e.target.value);
                            if (Number.isFinite(val)) {
                              patchDraft({ b: { ...draft.b, price: val } });
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {"at" in draft && (
                <>
                  <div className="dpm-row">
                    <label className="dpm-label">#1 (barra)</label>
                    <input
                      type="number"
                      className="dpm-num-input"
                      value={timeToRelBar(draft.at.time)}
                      onChange={(e) => {
                        const rel = Number.parseInt(e.target.value, 10);
                        if (Number.isFinite(rel)) {
                          patchDraft({ at: { ...draft.at, time: relBarToTime(rel) } });
                        }
                      }}
                    />
                  </div>
                  <div className="dpm-row">
                    <label className="dpm-label">#1 (prezzo)</label>
                    <input
                      type="number"
                      step={stepPrice}
                      className="dpm-num-input"
                      value={Number(draft.at.price.toFixed(decimals))}
                      onChange={(e) => {
                        const val = Number.parseFloat(e.target.value);
                        if (Number.isFinite(val)) {
                          patchDraft({ at: { ...draft.at, price: val } });
                        }
                      }}
                    />
                  </div>
                </>
              )}

              {draft.kind === "hline" && (
                <div className="dpm-row">
                  <label className="dpm-label">Prezzo</label>
                  <input
                    type="number"
                    step={stepPrice}
                    className="dpm-num-input"
                    value={Number(draft.price.toFixed(decimals))}
                    onChange={(e) => {
                      const val = Number.parseFloat(e.target.value);
                      if (Number.isFinite(val)) patchDraft({ price: val });
                    }}
                  />
                </div>
              )}

              {draft.kind === "vline" && (
                <div className="dpm-row">
                  <label className="dpm-label">#1 (barra)</label>
                  <input
                    type="number"
                    className="dpm-num-input"
                    value={timeToRelBar(draft.time)}
                    onChange={(e) => {
                      const rel = Number.parseInt(e.target.value, 10);
                      if (Number.isFinite(rel)) patchDraft({ time: relBarToTime(rel) });
                    }}
                  />
                </div>
              )}

              {draft.kind === "position" && (
                <>
                  <div className="dpm-row">
                    <label className="dpm-label">#1 (barra ingresso)</label>
                    <input
                      type="number"
                      className="dpm-num-input"
                      value={timeToRelBar(draft.entry.time)}
                      onChange={(e) => {
                        const rel = Number.parseInt(e.target.value, 10);
                        if (Number.isFinite(rel)) {
                          patchDraft({ entry: { ...draft.entry, time: relBarToTime(rel) } });
                        }
                      }}
                    />
                  </div>
                  <div className="dpm-row">
                    <label className="dpm-label">Prezzo ingresso</label>
                    <input
                      type="number"
                      step={stepPrice}
                      className="dpm-num-input"
                      value={Number(draft.entry.price.toFixed(decimals))}
                      onChange={(e) => {
                        const val = Number.parseFloat(e.target.value);
                        if (Number.isFinite(val)) {
                          patchDraft({ entry: { ...draft.entry, price: val } });
                        }
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* ═══════════════ TAB 4: VISIBILITÀ (Screenshot 5) ═══════════════ */}
          {tab === "visibility" && (
            <div className="dpm-vis-list">
              <label className="dpm-check-row">
                <input
                  type="checkbox"
                  checked={visibility.ticks}
                  onChange={(e) => patchDraft({ visibility: { ...visibility, ticks: e.target.checked } })}
                />
                <span>Tick</span>
              </label>

              {(
                [
                  { key: "seconds", label: "Secondi", maxLimit: 59 },
                  { key: "minutes", label: "Minuti", maxLimit: 59 },
                  { key: "hours", label: "Ore", maxLimit: 24 },
                  { key: "days", label: "Giorni", maxLimit: 366 },
                  { key: "weeks", label: "Settimane", maxLimit: 52 },
                  { key: "months", label: "Mesi", maxLimit: 12 },
                ] as const
              ).map(({ key, label, maxLimit }) => {
                const range = visibility[key];
                const minPct = ((range.min - 1) / Math.max(1, maxLimit - 1)) * 100;
                const maxPct = ((range.max - 1) / Math.max(1, maxLimit - 1)) * 100;
                return (
                  <div key={key} className="dpm-vis-row">
                    <label className="dpm-check-row dpm-vis-label">
                      <input
                        type="checkbox"
                        checked={range.enabled}
                        onChange={(e) => updateVisibilityRange(key, { enabled: e.target.checked })}
                      />
                      <span>{label}</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={range.max}
                      disabled={!range.enabled}
                      className="dpm-vis-num"
                      value={range.min}
                      onChange={(e) =>
                        updateVisibilityRange(key, {
                          min: Math.max(1, Math.min(range.max, Number(e.target.value) || 1)),
                        })
                      }
                    />
                    <div className="dpm-dual-slider">
                      <div className="dpm-slider-track" />
                      <div
                        className="dpm-slider-fill"
                        style={{ left: `${minPct}%`, width: `${Math.max(0, maxPct - minPct)}%` }}
                      />
                      <input
                        type="range"
                        min={1}
                        max={maxLimit}
                        disabled={!range.enabled}
                        value={range.min}
                        onChange={(e) =>
                          updateVisibilityRange(key, {
                            min: Math.min(range.max, Number(e.target.value)),
                          })
                        }
                        aria-label={`${label} minimo`}
                      />
                      <input
                        type="range"
                        min={1}
                        max={maxLimit}
                        disabled={!range.enabled}
                        value={range.max}
                        onChange={(e) =>
                          updateVisibilityRange(key, {
                            max: Math.max(range.min, Number(e.target.value)),
                          })
                        }
                        aria-label={`${label} massimo`}
                      />
                    </div>
                    <input
                      type="number"
                      min={range.min}
                      max={maxLimit}
                      disabled={!range.enabled}
                      className="dpm-vis-num"
                      value={range.max}
                      onChange={(e) =>
                        updateVisibilityRange(key, {
                          max: Math.max(range.min, Math.min(maxLimit, Number(e.target.value) || maxLimit)),
                        })
                      }
                    />
                  </div>
                );
              })}

              <label className="dpm-check-row">
                <input
                  type="checkbox"
                  checked={visibility.ranges}
                  onChange={(e) => patchDraft({ visibility: { ...visibility, ranges: e.target.checked } })}
                />
                <span>Ranges</span>
              </label>
            </div>
          )}
        </div>

        {/* ── Footer: Modello ⌄ | Annulla | Ok (Screenshots 3, 4, 5) ── */}
        <div className="dpm-footer">
          <div className="relative">
            <button
              type="button"
              className="dpm-template-btn"
              onClick={() => setTemplateMenuOpen(!templateMenuOpen)}
            >
              <span>Modello</span>
              <ChevronDown size={14} />
            </button>

            {templateMenuOpen && (
              <div className="dpm-template-popover">
                {!savingTemplate ? (
                  <button
                    type="button"
                    className="dpm-tpl-item"
                    onClick={() => setSavingTemplate(true)}
                  >
                    <Plus size={13} />
                    <span>Salva modello disegno con nome...</span>
                  </button>
                ) : (
                  <div className="dpm-tpl-save-form">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Nome modello..."
                      value={templateNameInput}
                      onChange={(e) => setTemplateNameInput(e.target.value)}
                      className="dpm-tpl-input"
                    />
                    <button
                      type="button"
                      className="dpm-tpl-save-confirm"
                      onClick={() => {
                        if (templateNameInput.trim()) {
                          const next = saveDrawingToolTemplate(draft.kind, templateNameInput, draft);
                          setTemplates(next);
                          setTemplateNameInput("");
                          setSavingTemplate(false);
                        }
                      }}
                    >
                      <Check size={13} />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  className="dpm-tpl-item"
                  onClick={handleResetDefaults}
                >
                  <RotateCcw size={13} />
                  <span>Applica predefiniti</span>
                </button>

                {templates.length > 0 && (
                  <div className="dpm-tpl-divider" />
                )}

                {templates.map((tpl) => (
                  <div key={tpl.id} className="dpm-tpl-saved-row">
                    <button
                      type="button"
                      className="dpm-tpl-apply"
                      onClick={() => {
                        patchDraft({ ...tpl.props, templateName: tpl.name });
                        setTemplateMenuOpen(false);
                      }}
                    >
                      <span>{tpl.name}</span>
                    </button>
                    <button
                      type="button"
                      className="dpm-tpl-del"
                      onClick={() => setTemplates(deleteDrawingToolTemplate(tpl.id, draft.kind))}
                      aria-label={`Elimina modello ${tpl.name}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="dpm-footer-actions">
            <button
              type="button"
              className="dpm-cancel-btn"
              onClick={onClose}
            >
              Annulla
            </button>
            <button
              type="button"
              className="dpm-ok-btn"
              onClick={() => {
                onApply(draft);
                onClose();
              }}
            >
              Ok
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
