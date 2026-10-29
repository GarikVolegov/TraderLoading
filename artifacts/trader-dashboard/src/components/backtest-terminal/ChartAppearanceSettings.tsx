import { useEffect, useState } from "react";
import { Star, RotateCcw, Clock, Bell, Sparkles, Layers, Compass } from "lucide-react";
import { uiText } from "@/contexts/LanguageContext";
import { DEFAULT_TERMINAL_SETTINGS, type TerminalSettings } from "@/lib/replay/terminalPersistence";
import {
  DEFAULT_SESSION_PREFERENCES,
  loadSessionPreferences,
  saveSessionPreferences,
  SESSION_PREFERENCES_EVENT,
  SESSION_PRESET_CONFIGS,
  type SessionPreferenceItem,
  type SessionPreferencesState,
} from "../chartSessionTime";
import {
  DEFAULT_INDICATOR_PREFERENCES,
  loadIndicatorPreferences,
  saveIndicatorPreferences,
  INDICATOR_PREFERENCES_EVENT,
  type LiquidityIndicatorPreferences,
  type WyckoffIndicatorPreferences,
} from "@/lib/chart/chartIndicatorPreferences";
import type { ReplayEngine } from "./useReplayEngine";
import { AureusColorSwatch, AureusDualColorSwatch } from "./ColorControl";

const SESSION_UI_COPY = {
  sectionAria: "Personalizzazione Sessioni e Orari",
  heading: "Riquadri Sessioni (Max–Min) & Orari Personali (CET)",
  onlyFavTitle: "Mostra sul grafico esclusivamente le sessioni contrassegnate con la stella ★",
  onlyFavBtn: "Solo Preferite (★)",
  soundAlertTitle: "Attiva/disattiva segnale acustico sinestetico e notifica al verificarsi di uno sweep di sessione",
  soundAlertBtn: "Allerta Sweep",
  resetTitle: "Ripristina orari e colori predefiniti",
  resetBtn: "Ripristina",
  presetLabel: "Preset Orari",
  toggleTitle: "Mostra/nascondi questo riquadro di sessione sul grafico",
  favRemove: "Rimuovi dalle sessioni preferite",
  favAdd: "Aggiungi alle sessioni preferite (★)",
  shortLabelTitle: "Etichetta breve mostrata sul riquadro",
  from: "Dalle",
  to: "Alle",
  color: "Colore",
  opacity: "Opacità",
  borders: "Bordo riquadro (Max–Min)",
  highLowPrices: "Prezzi MAX / MIN",
  extendHighLow: "Estendi livelli Max/Min",
  chartLabel: "Etichetta a grafico",
  brandPreset: "Preset Brand",
};

export function SessionPreferencesEditor({ engine }: { engine?: ReplayEngine } = {}) {
  const [prefs, setPrefs] = useState<SessionPreferencesState>(() => loadSessionPreferences());

  useEffect(() => {
    const sync = () => setPrefs(loadSessionPreferences());
    window.addEventListener(SESSION_PREFERENCES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SESSION_PREFERENCES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const updatePrefs = (next: SessionPreferencesState) => {
    setPrefs(next);
    saveSessionPreferences(next);
  };

  const updateItem = (id: SessionPreferenceItem["id"], patch: Partial<SessionPreferenceItem>) => {
    const nextItems = prefs.items.map((it) => (it.id === id ? { ...it, ...patch } : it));
    updatePrefs({ ...prefs, items: nextItems });
  };

  const applySessionPreset = (presetKey: "standard" | "aureus" | "ict") => {
    const preset = SESSION_PRESET_CONFIGS[presetKey];
    updatePrefs({
      ...prefs,
      items: preset.items.map((it) => ({ ...it })),
    });
  };

  return (
    <section className="btm-appearance-section" aria-label={SESSION_UI_COPY.sectionAria}>
      {engine && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            background: "rgba(197, 160, 89, 0.08)",
            border: "1px solid rgba(197, 160, 89, 0.25)",
            borderRadius: 6,
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Compass size={15} style={{ color: "#C5A059" }} />
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#F4F4F6", display: "block" }}>
                Riquadri Sessioni a Grafico
              </span>
              <span style={{ fontSize: 10, color: "#94A3B8" }}>
                Asia (Tokyo) · Londra · New York (AM/PM)
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btm-toggle"
            data-on={engine.settings.showSessions}
            onClick={() =>
              engine.setSettings((s) => ({ ...s, showSessions: !s.showSessions }))
            }
            style={{ fontWeight: 600, fontSize: 11 }}
          >
            {engine.settings.showSessions ? "VISIBILI" : "NASCOSTE"}
          </button>
        </div>
      )}
      <div className="btm-section-head" style={{ flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Clock size={14} style={{ color: "#C5A059" }} />
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{SESSION_UI_COPY.heading}</h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btm-toggle"
            data-on={prefs.onlyFavorites}
            onClick={() => updatePrefs({ ...prefs, onlyFavorites: !prefs.onlyFavorites })}
            title={SESSION_UI_COPY.onlyFavTitle}
          >
            <Star
              size={11}
              style={{
                marginRight: 4,
                display: "inline",
                fill: prefs.onlyFavorites ? "#C5A059" : "transparent",
                color: prefs.onlyFavorites ? "#C5A059" : "currentColor",
              }}
            />
            {SESSION_UI_COPY.onlyFavBtn}
          </button>
          <button
            type="button"
            className="btm-toggle"
            data-on={prefs.soundAlertOnSweep !== false}
            onClick={() => updatePrefs({ ...prefs, soundAlertOnSweep: prefs.soundAlertOnSweep === false ? true : false })}
            title={SESSION_UI_COPY.soundAlertTitle}
          >
            <Bell
              size={11}
              style={{
                marginRight: 4,
                display: "inline",
                color: prefs.soundAlertOnSweep !== false ? "#10b981" : "currentColor",
              }}
            />
            {SESSION_UI_COPY.soundAlertBtn}
          </button>
          <button
            type="button"
            className="btm-toggle"
            data-on={prefs.showSweepBadges === true}
            onClick={() => updatePrefs({ ...prefs, showSweepBadges: !prefs.showSweepBadges })}
            title="Attiva/disattiva rettangoli visivi ⚡ SWEEP MAX/MIN sulle candele (Default OFF per grafico pulito)"
          >
            {"⚡ Badge Sweep"}
          </button>
          <button
            type="button"
            className="btm-text-button"
            onClick={() => updatePrefs(DEFAULT_SESSION_PREFERENCES)}
            title={SESSION_UI_COPY.resetTitle}
          >
            <RotateCcw size={11} style={{ marginRight: 3, display: "inline" }} />
            {SESSION_UI_COPY.resetBtn}
          </button>
        </div>
      </div>

      {/* Preset Rapidi Orari Sessione */}
      <div className="btm-preset-row" style={{ marginBottom: 12 }}>
        <span className="btm-field-label" style={{ fontSize: 11 }}>{SESSION_UI_COPY.presetLabel}</span>
        {(
          [
            ["standard", "Standard Istituzionale"],
            ["aureus", "Canone AUREUS (Killzones)"],
            ["ict", "ICT Killzones"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className="btm-toggle"
            onClick={() => applySessionPreset(key)}
            title={SESSION_PRESET_CONFIGS[key].description}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lista Sessioni Personalizzabili */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {prefs.items.map((item) => {
          const isHiddenByFavFilter = prefs.onlyFavorites && !item.favorite;
          return (
            <div
              key={item.id}
              style={{
                border: `1px solid ${item.enabled && !isHiddenByFavFilter ? "rgba(197, 160, 89, 0.35)" : "rgba(255,255,255,0.08)"}`,
                background: item.enabled && !isHiddenByFavFilter ? "rgba(17, 19, 28, 0.85)" : "rgba(10, 11, 15, 0.6)",
                borderRadius: 6,
                padding: "8px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                opacity: isHiddenByFavFilter ? 0.45 : 1,
              }}
            >
              {/* Riga 1: Toggle Visibilità, Stella Preferita, Etichetta e Orari */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 160 }}>
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(e) => updateItem(item.id, { enabled: e.target.checked })}
                    title={SESSION_UI_COPY.toggleTitle}
                  />
                  <button
                    type="button"
                    onClick={() => updateItem(item.id, { favorite: !item.favorite })}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 2,
                      cursor: "pointer",
                      color: item.favorite ? "#E8C56A" : "#52525b",
                    }}
                    title={item.favorite ? SESSION_UI_COPY.favRemove : SESSION_UI_COPY.favAdd}
                    aria-label={item.name}
                  >
                    <Star size={14} style={{ fill: item.favorite ? "#C5A059" : "transparent" }} />
                  </button>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: item.color,
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  <input
                    type="text"
                    className="btm-input"
                    value={item.shortLabel}
                    maxLength={16}
                    onChange={(e) => updateItem(item.id, { shortLabel: e.target.value.toUpperCase() })}
                    style={{ width: 105, fontWeight: 700, fontSize: 11, padding: "2px 6px" }}
                    title={SESSION_UI_COPY.shortLabelTitle}
                  />
                  <span style={{ fontSize: 11, color: "var(--btm-mut)" }} className="hidden sm:inline">
                    {item.name}
                  </span>
                </div>

                {/* Selettori Orario Inizio -> Fine */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontFamily: "var(--font-mono)" }}>
                    <span style={{ color: "var(--btm-mut)", fontSize: 10 }}>{SESSION_UI_COPY.from}</span>
                    <input
                      type="time"
                      className="btm-input"
                      value={item.startTime}
                      onChange={(e) => updateItem(item.id, { startTime: e.target.value || "00:00" })}
                      style={{ width: 88, padding: "2px 5px", fontSize: 11, fontFamily: "var(--font-mono)" }}
                    />
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontFamily: "var(--font-mono)" }}>
                    <span style={{ color: "var(--btm-mut)", fontSize: 10 }}>{SESSION_UI_COPY.to}</span>
                    <input
                      type="time"
                      className="btm-input"
                      value={item.endTime}
                      onChange={(e) => updateItem(item.id, { endTime: e.target.value || "00:00" })}
                      style={{ width: 88, padding: "2px 5px", fontSize: 11, fontFamily: "var(--font-mono)" }}
                    />
                  </label>
                </div>
              </div>

              {/* Riga 2: Colore, Opacità, Bordi, Prezzi Max/Min, Estensione */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: 10.5, color: "var(--btm-mut)" }}>{SESSION_UI_COPY.color}</span>
                    <AureusColorSwatch
                      label={item.shortLabel}
                      value={item.color}
                      onChange={(c) => updateItem(item.id, { color: c })}
                      align="left"
                    />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, color: "var(--btm-mut)" }}>
                    <span>{SESSION_UI_COPY.opacity}</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "#E8C56A" }} className="whitespace-nowrap">{Math.round(item.opacity * 100)}%</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(item.opacity * 100)}
                      onChange={(e) => updateItem(item.id, { opacity: Number(e.target.value) / 100 })}
                      style={{ width: 64 }}
                    />
                  </label>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <label className="btm-checkbox-label" style={{ fontSize: 10.5 }}>
                    <input
                      type="checkbox"
                      checked={item.showBorders}
                      onChange={(e) => updateItem(item.id, { showBorders: e.target.checked })}
                    />
                    {SESSION_UI_COPY.borders}
                  </label>
                  <label className="btm-checkbox-label" style={{ fontSize: 10.5 }}>
                    <input
                      type="checkbox"
                      checked={item.showHighLowLabels !== false}
                      onChange={(e) => updateItem(item.id, { showHighLowLabels: e.target.checked })}
                    />
                    {SESSION_UI_COPY.highLowPrices}
                  </label>
                  <label className="btm-checkbox-label" style={{ fontSize: 10.5 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(item.extendHighLowLines)}
                      onChange={(e) => updateItem(item.id, { extendHighLowLines: e.target.checked })}
                    />
                    {SESSION_UI_COPY.extendHighLow}
                  </label>
                  <label className="btm-checkbox-label" style={{ fontSize: 10.5 }}>
                    <input
                      type="checkbox"
                      checked={item.showLabel}
                      onChange={(e) => updateItem(item.id, { showLabel: e.target.checked })}
                    />
                    {SESSION_UI_COPY.chartLabel}
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export const PRESET_PATCHES: Record<"product" | "tvDark" | "midnight" | "monochrome" | "tvLight", Partial<TerminalSettings>> = {
  product: { chartBgType: "solid", chartBgColor1: "#08080a", chartBgColor2: "#0e1015", textColor: "#f4f4f6", axisColor: "#26262e", gridColor: "rgba(197, 160, 89, 0.04)", crosshairColor: "#c5a059", candleUpColor: "#c5a059", borderUpColor: "#c5a059", wickUpColor: "#c5a059", candleDownColor: "#e05666", borderDownColor: "#e05666", wickDownColor: "#e05666", lineColor: "#c5a059" },
  tvDark: { chartBgType: "solid", chartBgColor1: "#08080a", chartBgColor2: "#0e0f14", textColor: "#f4f4f6", axisColor: "#26262e", gridColor: "rgba(255, 255, 255, 0.03)", crosshairColor: "#71717a", candleUpColor: "#10b981", borderUpColor: "#10b981", wickUpColor: "#10b981", candleDownColor: "#f43f5e", borderDownColor: "#f43f5e", wickDownColor: "#f43f5e", lineColor: "#10b981" },
  midnight: { chartBgType: "gradient", chartBgColor1: "#0a0e17", chartBgColor2: "#111827", textColor: "#94a3b8", axisColor: "#1e293b", gridColor: "rgba(255, 255, 255, 0.03)", crosshairColor: "#60a5fa", candleUpColor: "#00d26a", borderUpColor: "#00d26a", wickUpColor: "#00d26a", candleDownColor: "#f83b52", borderDownColor: "#f83b52", wickDownColor: "#f83b52", lineColor: "#60a5fa" },
  monochrome: { chartBgType: "solid", chartBgColor1: "#0a0a0c", chartBgColor2: "#121216", textColor: "#cbd5e1", axisColor: "#27272a", gridColor: "rgba(255, 255, 255, 0.02)", crosshairColor: "#71717a", candleUpColor: "#e4e4e7", borderUpColor: "#e4e4e7", wickUpColor: "#e4e4e7", candleDownColor: "#3f3f46", borderDownColor: "#3f3f46", wickDownColor: "#3f3f46", lineColor: "#e4e4e7" },
  tvLight: { chartBgType: "solid", chartBgColor1: "#ffffff", chartBgColor2: "#f8fafc", textColor: "#0f172a", axisColor: "#e2e8f0", gridColor: "rgba(0, 0, 0, 0.05)", crosshairColor: "#94a3b8", candleUpColor: "#089981", borderUpColor: "#089981", wickUpColor: "#089981", candleDownColor: "#f23645", borderDownColor: "#f23645", wickDownColor: "#f23645", lineColor: "#089981" },
};

/* ════════════════════════════════════════════════════════════════════════════════
   1. SCHEDA: SIMBOLO (Candele, Bordi, Stoppini, Volumi, Linea)
   ════════════════════════════════════════════════════════════════════════════════ */
export function SymbolSettingsTab({ engine }: { engine: ReplayEngine }) {
  const { settings, setSettings, chartPreferences } = engine;
  const set = (key: keyof TerminalSettings, value: unknown) => setSettings({ ...settings, [key]: value });
  const favColors = chartPreferences.preferences.favoriteColors;
  const onFavColors = (fc: string[]) => chartPreferences.update((prev) => ({ ...prev, favoriteColors: fc }));

  const syncCandleColors = () => {
    const up = settings.candleUpColor ?? DEFAULT_TERMINAL_SETTINGS.candleUpColor;
    const dn = settings.candleDownColor ?? DEFAULT_TERMINAL_SETTINGS.candleDownColor;
    setSettings({
      ...settings,
      borderUpColor: up,
      wickUpColor: up,
      borderDownColor: dn,
      wickDownColor: dn,
    });
  };

  return (
    <div>
      <div className="btm-v2-section-head">Stile e Tipo di Grafico</div>
      <div className="btm-v2-row">
        <label className="btm-v2-label" htmlFor="btm-chart-type-sel">Tipo di rappresentazione</label>
        <select
          id="btm-chart-type-sel"
          className="btm-select"
          value={settings.chartType ?? "candles"}
          onChange={(e) => set("chartType", e.target.value)}
        >
          <option value="candles">Candele Giapponesi</option>
          <option value="heikin">Heikin Ashi</option>
          <option value="bars">Barre OHLC</option>
          <option value="line">Linea Continua</option>
          <option value="area">Area Sfumata</option>
        </select>
      </div>

      <div className="btm-v2-section-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Corpo, Bordi e Stoppini</span>
        <button
          type="button"
          className="btm-text-button"
          onClick={syncCandleColors}
          style={{ fontSize: 10.5, textTransform: "none" }}
        >
          <Sparkles size={11} style={{ display: "inline", marginRight: 4 }} />
          Allinea bordi e stoppini al corpo
        </button>
      </div>

      <div className="btm-v2-row">
        <span className="btm-v2-label">Corpo Candela (Rialzista / Ribassista)</span>
        <AureusDualColorSwatch
          upLabel="Corpo Rialzista"
          upValue={String(settings.candleUpColor ?? DEFAULT_TERMINAL_SETTINGS.candleUpColor)}
          onUpChange={(c) => set("candleUpColor", c)}
          downLabel="Corpo Ribassista"
          downValue={String(settings.candleDownColor ?? DEFAULT_TERMINAL_SETTINGS.candleDownColor)}
          onDownChange={(c) => set("candleDownColor", c)}
          favorites={favColors}
          onFavoritesChange={onFavColors}
        />
      </div>

      <div className="btm-v2-row">
        <label className="btm-v2-label">
          <input
            type="checkbox"
            checked={settings.candleBordersVisible !== false}
            onChange={(e) => set("candleBordersVisible", e.target.checked)}
          />
          Bordi Candela
        </label>
        <AureusDualColorSwatch
          upLabel="Bordo Rialzista"
          upValue={String(settings.borderUpColor ?? settings.candleUpColor ?? DEFAULT_TERMINAL_SETTINGS.borderUpColor)}
          onUpChange={(c) => set("borderUpColor", c)}
          downLabel="Bordo Ribassista"
          downValue={String(settings.borderDownColor ?? settings.candleDownColor ?? DEFAULT_TERMINAL_SETTINGS.borderDownColor)}
          onDownChange={(c) => set("borderDownColor", c)}
          favorites={favColors}
          onFavoritesChange={onFavColors}
        />
      </div>

      <div className="btm-v2-row">
        <label className="btm-v2-label">
          <input
            type="checkbox"
            checked={settings.candleWicksVisible !== false}
            onChange={(e) => set("candleWicksVisible", e.target.checked)}
          />
          Stoppini Candela (Ombre)
        </label>
        <AureusDualColorSwatch
          upLabel="Stoppino Rialzista"
          upValue={String(settings.wickUpColor ?? settings.candleUpColor ?? DEFAULT_TERMINAL_SETTINGS.wickUpColor)}
          onUpChange={(c) => set("wickUpColor", c)}
          downLabel="Stoppino Ribassista"
          downValue={String(settings.wickDownColor ?? settings.candleDownColor ?? DEFAULT_TERMINAL_SETTINGS.wickDownColor)}
          onDownChange={(c) => set("wickDownColor", c)}
          favorites={favColors}
          onFavoritesChange={onFavColors}
        />
      </div>

      <div className="btm-v2-section-head">Modalità Linea e Area</div>
      <div className="btm-v2-row">
        <span className="btm-v2-label">Linea Principale</span>
        <AureusColorSwatch
          label="Linea Principale"
          value={String(settings.lineColor ?? DEFAULT_TERMINAL_SETTINGS.lineColor)}
          onChange={(c) => set("lineColor", c)}
          favorites={favColors}
          onFavoritesChange={onFavColors}
        />
      </div>
      <div className="btm-v2-row">
        <span className="btm-v2-label">Gradiente Area (Superiore / Inferiore)</span>
        <AureusDualColorSwatch
          upLabel="Area Superiore"
          upValue={String(settings.areaTopColor ?? DEFAULT_TERMINAL_SETTINGS.areaTopColor)}
          onUpChange={(c) => set("areaTopColor", c)}
          downLabel="Area Inferiore"
          downValue={String(settings.areaBottomColor ?? DEFAULT_TERMINAL_SETTINGS.areaBottomColor)}
          onDownChange={(c) => set("areaBottomColor", c)}
          favorites={favColors}
          onFavoritesChange={onFavColors}
        />
      </div>

      <div className="btm-v2-section-head">Istogramma Volumi</div>
      <div className="btm-v2-row">
        <span className="btm-v2-label">Volume (Rialzista / Ribassista)</span>
        <AureusDualColorSwatch
          upLabel="Volume Rialzista"
          upValue={String(settings.volumeUpColor ?? DEFAULT_TERMINAL_SETTINGS.volumeUpColor)}
          onUpChange={(c) => set("volumeUpColor", c)}
          downLabel="Volume Ribassista"
          downValue={String(settings.volumeDownColor ?? DEFAULT_TERMINAL_SETTINGS.volumeDownColor)}
          onDownChange={(c) => set("volumeDownColor", c)}
          favorites={favColors}
          onFavoritesChange={onFavColors}
        />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════
   2. SCHEDA: SCALE E LINEE (Prezzo, Margine Destro, Countdown, Ultimo Prezzo)
   ════════════════════════════════════════════════════════════════════════════════ */
export function ScalesSettingsTab({ engine }: { engine: ReplayEngine }) {
  const { settings, setSettings, chartPreferences } = engine;
  const set = (key: keyof TerminalSettings, value: unknown) => setSettings({ ...settings, [key]: value });
  const favColors = chartPreferences.preferences.favoriteColors;
  const onFavColors = (fc: string[]) => chartPreferences.update((prev) => ({ ...prev, favoriteColors: fc }));

  return (
    <div>
      <div className="btm-v2-section-head">Asse del Prezzo e Scala</div>
      <div className="btm-v2-row">
        <span className="btm-v2-label">Modalità di scala</span>
        <select
          className="btm-select"
          value={settings.priceScaleMode ?? "normal"}
          onChange={(e) => set("priceScaleMode", e.target.value)}
        >
          <option value="normal">Normale (Aritmetica)</option>
          <option value="logarithmic">Logaritmica</option>
          <option value="percentage">Percentuale</option>
        </select>
      </div>

      <div className="btm-v2-row">
        <span className="btm-v2-label">Margine destro (offset barre)</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="range"
            min="0"
            max="50"
            step="1"
            value={settings.rightOffsetBars ?? 12}
            onChange={(e) => set("rightOffsetBars", Number(e.target.value))}
            style={{ width: 120 }}
          />
          <span className="font-mono text-xs text-[#E8C56A] whitespace-nowrap min-w-[50px] text-right">
            {settings.rightOffsetBars ?? 12} barre
          </span>
        </div>
      </div>

      <div className="btm-v2-row">
        <span className="btm-v2-label">Testi e Numeri degli Assi</span>
        <AureusColorSwatch
          label="Testi Assi"
          value={String(settings.textColor ?? DEFAULT_TERMINAL_SETTINGS.textColor)}
          onChange={(c) => set("textColor", c)}
          favorites={favColors}
          onFavoritesChange={onFavColors}
        />
      </div>

      <div className="btm-v2-row">
        <span className="btm-v2-label">Bordi e Linee degli Assi</span>
        <AureusColorSwatch
          label="Bordi Assi"
          value={String(settings.axisColor ?? DEFAULT_TERMINAL_SETTINGS.axisColor)}
          onChange={(c) => set("axisColor", c)}
          favorites={favColors}
          onFavoritesChange={onFavColors}
        />
      </div>

      <div className="btm-v2-section-head">Etichette e Linee di Prezzo</div>
      <div className="btm-v2-row">
        <label className="btm-v2-label">
          <input
            type="checkbox"
            checked={settings.showLastPriceLine !== false}
            onChange={(e) => set("showLastPriceLine", e.target.checked)}
          />
          Linea dell'Ultimo Prezzo a Mercato
        </label>
        <span className="text-[11px] text-zinc-400 font-mono">Tracciata a grafico</span>
      </div>

      <div className="btm-v2-row">
        <label className="btm-v2-label">
          <input
            type="checkbox"
            checked={Boolean(settings.showHighLowLines)}
            onChange={(e) => set("showHighLowLines", e.target.checked)}
          />
          Livelli Massimo e Minimo della Sessione
        </label>
        <span className="text-[11px] text-zinc-400 font-mono">Max / Min visibili</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════
   3. SCHEDA: CANVAS (Sfondo, Griglia, Mirino, Watermark)
   ════════════════════════════════════════════════════════════════════════════════ */
export function CanvasSettingsTab({ engine }: { engine: ReplayEngine }) {
  const { settings, setSettings, chartPreferences } = engine;
  const set = (key: keyof TerminalSettings, value: unknown) => setSettings({ ...settings, [key]: value });
  const favColors = chartPreferences.preferences.favoriteColors;
  const onFavColors = (fc: string[]) => chartPreferences.update((prev) => ({ ...prev, favoriteColors: fc }));

  return (
    <div>
      <div className="btm-v2-section-head">Sfondo del Grafico</div>
      <div className="btm-v2-row">
        <span className="btm-v2-label">Stile di riempimento</span>
        <select
          className="btm-select"
          value={settings.chartBgType ?? "solid"}
          onChange={(e) => set("chartBgType", e.target.value)}
        >
          <option value="solid">Tinta Unita (Uniforme)</option>
          <option value="gradient">Gradiente (Sfumato)</option>
        </select>
      </div>

      <div className="btm-v2-row">
        <span className="btm-v2-label">Sfondo Primario (Superiore)</span>
        <AureusColorSwatch
          label="Sfondo Primario"
          value={String(settings.chartBgColor1 ?? DEFAULT_TERMINAL_SETTINGS.chartBgColor1)}
          onChange={(c) => set("chartBgColor1", c)}
          favorites={favColors}
          onFavoritesChange={onFavColors}
        />
      </div>

      {settings.chartBgType === "gradient" && (
        <div className="btm-v2-row">
          <span className="btm-v2-label">Sfondo Secondario (Inferiore)</span>
          <AureusColorSwatch
            label="Sfondo Secondario"
            value={String(settings.chartBgColor2 ?? DEFAULT_TERMINAL_SETTINGS.chartBgColor2)}
            onChange={(c) => set("chartBgColor2", c)}
            favorites={favColors}
            onFavoritesChange={onFavColors}
          />
        </div>
      )}

      <div className="btm-v2-section-head">Linee della Griglia</div>
      <div className="btm-v2-row">
        <label className="btm-v2-label">
          <input
            type="checkbox"
            checked={settings.showVertGrid !== false}
            onChange={(e) => set("showVertGrid", e.target.checked)}
          />
          Griglia Verticale (Temporale)
        </label>
        <AureusColorSwatch
          label="Colore Griglia"
          value={String(settings.gridColor ?? DEFAULT_TERMINAL_SETTINGS.gridColor)}
          onChange={(c) => set("gridColor", c)}
          favorites={favColors}
          onFavoritesChange={onFavColors}
        />
      </div>

      <div className="btm-v2-row">
        <label className="btm-v2-label">
          <input
            type="checkbox"
            checked={settings.showHorzGrid !== false}
            onChange={(e) => set("showHorzGrid", e.target.checked)}
          />
          Griglia Orizzontale (Prezzo)
        </label>
        <select
          className="btm-select"
          value={settings.gridStyle ?? "solid"}
          onChange={(e) => set("gridStyle", e.target.value)}
        >
          <option value="solid">Continuo</option>
          <option value="dashed">Tratteggiato</option>
          <option value="dotted">Punteggiato</option>
        </select>
      </div>

      <div className="btm-v2-section-head">Mirino di Puntamento (Crosshair)</div>
      <div className="btm-v2-row">
        <span className="btm-v2-label">Stile e Tratto Mirino</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select
            className="btm-select"
            value={settings.crosshairStyle ?? "dashed"}
            onChange={(e) => set("crosshairStyle", e.target.value)}
          >
            <option value="dashed">Tratteggiato</option>
            <option value="solid">Continuo</option>
            <option value="dotted">Punteggiato</option>
          </select>
          <AureusColorSwatch
            label="Colore Mirino"
            value={String(settings.crosshairColor ?? DEFAULT_TERMINAL_SETTINGS.crosshairColor)}
            onChange={(c) => set("crosshairColor", c)}
            favorites={favColors}
            onFavoritesChange={onFavColors}
          />
        </div>
      </div>

      <div className="btm-v2-section-head">Filigrana / Watermark AUREUS</div>
      <div className="btm-v2-row">
        <label className="btm-v2-label">
          <input
            type="checkbox"
            checked={settings.showWatermark !== false}
            onChange={(e) => set("showWatermark", e.target.checked)}
          />
          Mostra Filigrana sul Fondo
        </label>
        <span className="text-[11px] text-zinc-400 font-mono">Simbolo / Brand</span>
      </div>

      {settings.showWatermark !== false && (
        <>
          <div className="btm-v2-row">
            <span className="btm-v2-label">Testo personalizzato filigrana</span>
            <input
              type="text"
              className="btm-input"
              maxLength={64}
              placeholder="Lascia vuoto per Ticker automatico"
              value={settings.watermarkText ?? ""}
              onChange={(e) => set("watermarkText", e.target.value)}
              style={{ width: 220, fontSize: 11 }}
            />
          </div>

          <div className="btm-v2-row">
            <span className="btm-v2-label">Opacità filigrana</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="range"
                min="0.01"
                max="0.4"
                step="0.01"
                value={settings.watermarkOpacity ?? 0.05}
                onChange={(e) => set("watermarkOpacity", Number(e.target.value))}
                style={{ width: 120 }}
              />
              <span className="font-mono text-xs text-[#E8C56A] whitespace-nowrap min-w-[40px] text-right">
                {Math.round((settings.watermarkOpacity ?? 0.05) * 100)}%
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════
   4. SCHEDA: LEGENDA (OHLC, Variazione, Titoli)
   ════════════════════════════════════════════════════════════════════════════════ */
export function LegendSettingsTab({ engine }: { engine: ReplayEngine }) {
  const { settings, setSettings } = engine;
  const set = (key: keyof TerminalSettings, value: unknown) => setSettings({ ...settings, [key]: value });

  return (
    <div>
      <div className="btm-v2-section-head">Intestazione e Metriche a Grafico</div>
      <div className="btm-v2-row">
        <label className="btm-v2-label">
          <input
            type="checkbox"
            checked={settings.showOhlcLegend !== false}
            onChange={(e) => set("showOhlcLegend", e.target.checked)}
          />
          Valori Barre OHLC (Apertura, Massimo, Minimo, Chiusura)
        </label>
        <span className="text-[11px] text-zinc-400 font-mono">O H L C</span>
      </div>

      <div className="btm-v2-row">
        <label className="btm-v2-label">
          <input
            type="checkbox"
            checked={settings.showBarChange !== false}
            onChange={(e) => set("showBarChange", e.target.checked)}
          />
          Variazione Percentuale Candela / Barra Corrente
        </label>
        <span className="text-[11px] text-zinc-400 font-mono">+1.24%</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════
   5. SCHEDA: TRADING & ORDINI (Esecuzioni, Connettori, Costi Reali)
   ════════════════════════════════════════════════════════════════════════════════ */
export function TradingSettingsTab({ engine }: { engine: ReplayEngine }) {
  const { settings, setSettings } = engine;
  const set = (key: keyof TerminalSettings, value: unknown) => setSettings({ ...settings, [key]: value });

  return (
    <div>
      <div className="btm-v2-section-head">Visualizzazione Operazioni a Grafico</div>
      <div className="btm-v2-row">
        <label className="btm-v2-label">
          <input
            type="checkbox"
            checked={settings.showTradesOnChart !== false}
            onChange={(e) => set("showTradesOnChart", e.target.checked)}
          />
          Mostra Esecuzioni e Operazioni Chiuse
        </label>
        <span className="text-[11px] text-zinc-400 font-mono">Marker Buy / Sell</span>
      </div>

      <div className="btm-v2-row">
        <span className="btm-v2-label">Stile connettori operazioni passate</span>
        <select
          className="btm-select"
          value={settings.tradeLineMode ?? "hover_or_latest"}
          onChange={(e) => set("tradeLineMode", e.target.value)}
        >
          <option value="hover_or_latest">Solo su passaggio mouse e ultima (Consigliato)</option>
          <option value="all">Mostra sempre tutte le linee</option>
          <option value="none">Nessuna linea di connessione</option>
        </select>
      </div>

      <div className="btm-v2-section-head">Attrito Operativo & Parametri Simulatore</div>
      <div className="btm-v2-row">
        <span className="btm-v2-label">Spread simulato all'ingresso (pips)</span>
        <input
          type="number"
          min="0"
          max="20"
          step="0.1"
          className="btm-input font-mono"
          style={{ width: 85, textAlign: "right" }}
          value={settings.spreadPips ?? 0}
          onChange={(e) => set("spreadPips", Number(e.target.value))}
        />
      </div>

      <div className="btm-v2-row">
        <span className="btm-v2-label">Commissione round-turn per lotto ($)</span>
        <input
          type="number"
          min="0"
          max="50"
          step="0.5"
          className="btm-input font-mono"
          style={{ width: 85, textAlign: "right" }}
          value={settings.commissionPerLot ?? 0}
          onChange={(e) => set("commissionPerLot", Number(e.target.value))}
        />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════
   COMPONENTE RETROCOMPATIBILE ChartAppearanceSettings
   ════════════════════════════════════════════════════════════════════════════════ */
export function ChartAppearanceSettings({ engine }: { engine: ReplayEngine }) {
  return <SymbolSettingsTab engine={engine} />;
}

/* ════════════════════════════════════════════════════════════════════════════════
   EDITOR PREFERENZE LIQUIDITÀ ISTITUZIONALE (BSL / SSL)
   ════════════════════════════════════════════════════════════════════════════════ */
export function LiquidityPreferencesEditor() {
  const [prefs, setPrefs] = useState(() => loadIndicatorPreferences());

  useEffect(() => {
    const sync = () => setPrefs(loadIndicatorPreferences());
    window.addEventListener(INDICATOR_PREFERENCES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(INDICATOR_PREFERENCES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const updateLiq = (patch: Partial<LiquidityIndicatorPreferences>) => {
    const next = {
      ...prefs,
      liquidity: {
        ...prefs.liquidity,
        ...patch,
      },
    };
    setPrefs(next);
    saveIndicatorPreferences(next);
  };

  return (
    <section className="btm-appearance-section" aria-label="Impostazioni Liquidità">
      <div className="btm-section-head" style={{ flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Layers size={14} style={{ color: "#C5A059" }} />
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Liquidità Istituzionale (BSL / SSL)</h3>
        </div>
        <button
          type="button"
          className="btm-text-button"
          onClick={() => {
            const next = { ...prefs, liquidity: { ...DEFAULT_INDICATOR_PREFERENCES.liquidity } };
            setPrefs(next);
            saveIndicatorPreferences(next);
          }}
          title="Ripristina valori predefiniti"
        >
          <RotateCcw size={11} style={{ marginRight: 3, display: "inline" }} />
          Ripristina Default
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Toggle 1: Solo Livelli Non Violati (Unswept) */}
        <div className="btm-item-config-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0B0C10", border: "1px solid #1F222E", borderRadius: 4 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>Solo Livelli Non Violati (Unswept)</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>Nasconde automaticamente i livelli già violati per mantenere il grafico pulito</div>
          </div>
          <button
            type="button"
            className="btm-toggle"
            data-on={prefs.liquidity.onlyUnswept}
            onClick={() => updateLiq({ onlyUnswept: !prefs.liquidity.onlyUnswept })}
          >
            {prefs.liquidity.onlyUnswept ? "ATTIVO" : "DISATTIVO"}
          </button>
        </div>

        {/* Toggle 2: Solo Livelli Primari (Major) */}
        <div className="btm-item-config-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0B0C10", border: "1px solid #1F222E", borderRadius: 4 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>Solo Livelli Primari (PDH, PDL, PWH, PWL)</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>Filtra esclusivamente i pool di liquidità giornalieri e settimanali maggiori</div>
          </div>
          <button
            type="button"
            className="btm-toggle"
            data-on={prefs.liquidity.onlyMajor}
            onClick={() => updateLiq({ onlyMajor: !prefs.liquidity.onlyMajor })}
          >
            {prefs.liquidity.onlyMajor ? "ATTIVO" : "DISATTIVO"}
          </button>
        </div>

        {/* Toggle 3: Mostra Prezzi sui Livelli */}
        <div className="btm-item-config-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0B0C10", border: "1px solid #1F222E", borderRadius: 4 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>Mostra Prezzo Numerico sulle Etichette</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>Include il valore esatto della quotazione accanto al codice del livello (es. PDH · 4038.50)</div>
          </div>
          <button
            type="button"
            className="btm-toggle"
            data-on={prefs.liquidity.showPrice}
            onClick={() => updateLiq({ showPrice: !prefs.liquidity.showPrice })}
          >
            {prefs.liquidity.showPrice ? "ATTIVO" : "DISATTIVO"}
          </button>
        </div>

        {/* Select: Numero Massimo Livelli Visibili */}
        <div className="btm-item-config-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0B0C10", border: "1px solid #1F222E", borderRadius: 4 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>Densità Livelli Visibili Contemporaneamente</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>Limita il numero massimo di linee più vicine al prezzo corrente</div>
          </div>
          <select
            className="btm-select"
            value={prefs.liquidity.maxLevels}
            onChange={(e) => updateLiq({ maxLevels: Number(e.target.value) || 6 })}
            style={{ width: 140, fontSize: 11 }}
          >
            <option value={4}>4 Livelli (Minimo)</option>
            <option value={6}>6 Livelli (Bilanciato)</option>
            <option value={8}>8 Livelli</option>
            <option value={14}>Tutti i Livelli</option>
          </select>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════
   EDITOR PREFERENZE WYCKOFF STRUTTURALE (CREEK / ICE & EVENTI)
   ════════════════════════════════════════════════════════════════════════════════ */
export function WyckoffPreferencesEditor() {
  const [prefs, setPrefs] = useState(() => loadIndicatorPreferences());

  useEffect(() => {
    const sync = () => setPrefs(loadIndicatorPreferences());
    window.addEventListener(INDICATOR_PREFERENCES_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(INDICATOR_PREFERENCES_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const updateWyk = (patch: Partial<WyckoffIndicatorPreferences>) => {
    const next = {
      ...prefs,
      wyckoff: {
        ...prefs.wyckoff,
        ...patch,
      },
    };
    setPrefs(next);
    saveIndicatorPreferences(next);
  };

  return (
    <section className="btm-appearance-section" aria-label="Impostazioni Wyckoff">
      <div className="btm-section-head" style={{ flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Compass size={14} style={{ color: "#C5A059" }} />
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Wyckoff Strutturale (Creek / Ice & Eventi)</h3>
        </div>
        <button
          type="button"
          className="btm-text-button"
          onClick={() => {
            const next = { ...prefs, wyckoff: { ...DEFAULT_INDICATOR_PREFERENCES.wyckoff } };
            setPrefs(next);
            saveIndicatorPreferences(next);
          }}
          title="Ripristina valori predefiniti"
        >
          <RotateCcw size={11} style={{ marginRight: 3, display: "inline" }} />
          Ripristina Default
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Toggle 1: Trading Range (Creek & Ice) */}
        <div className="btm-item-config-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0B0C10", border: "1px solid #1F222E", borderRadius: 4 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>Trading Range (Creek & Ice)</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>Disegna il canale orizzontale con linee Creek (Resistenza) e Ice (Supporto)</div>
          </div>
          <button
            type="button"
            className="btm-toggle"
            data-on={prefs.wyckoff.showTradingRange}
            onClick={() => updateWyk({ showTradingRange: !prefs.wyckoff.showTradingRange })}
          >
            {prefs.wyckoff.showTradingRange ? "ATTIVO" : "DISATTIVO"}
          </button>
        </div>

        {/* Toggle 2: Eventi sulle Candele */}
        <div className="btm-item-config-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0B0C10", border: "1px solid #1F222E", borderRadius: 4 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>Badge Eventi Sulle Candele</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>Abilita o nasconde i marker degli eventi strutturali sulle wick</div>
          </div>
          <button
            type="button"
            className="btm-toggle"
            data-on={prefs.wyckoff.showEvents}
            onClick={() => updateWyk({ showEvents: !prefs.wyckoff.showEvents })}
          >
            {prefs.wyckoff.showEvents ? "ATTIVO" : "DISATTIVO"}
          </button>
        </div>

        {/* Toggle 3: Solo Eventi Chiave (Filtro Minori SC/BC/ST) */}
        <div className="btm-item-config-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0B0C10", border: "1px solid #1F222E", borderRadius: 4 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>Solo Setup Chiave (Spring, UTAD, SOW 10%, SOS)</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>Nasconde Climax e test secondari (SC, BC, ST, LPS) per focalizzare il grafico sui soli segnali operativi</div>
          </div>
          <button
            type="button"
            className="btm-toggle"
            data-on={prefs.wyckoff.onlyKeyEvents}
            onClick={() => updateWyk({ onlyKeyEvents: !prefs.wyckoff.onlyKeyEvents })}
          >
            {prefs.wyckoff.onlyKeyEvents ? "ATTIVO" : "DISATTIVO"}
          </button>
        </div>

        {/* Toggle 4: Badge Fluttuante di Regime in Alto a Destra */}
        <div className="btm-item-config-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0B0C10", border: "1px solid #1F222E", borderRadius: 4 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>Badge Fluttuante Regime (In alto a destra sul canvas)</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>Mostra una targa angolare sul canvas (informazione già visibile nella barra di stato)</div>
          </div>
          <button
            type="button"
            className="btm-toggle"
            data-on={prefs.wyckoff.showRegimeCornerBadge}
            onClick={() => updateWyk({ showRegimeCornerBadge: !prefs.wyckoff.showRegimeCornerBadge })}
          >
            {prefs.wyckoff.showRegimeCornerBadge ? "ATTIVO" : "DISATTIVO"}
          </button>
        </div>
      </div>
    </section>
  );
}
