import { useState } from "react";
import {
  Sliders,
  Check,
  RotateCcw,
  PenTool,
  BarChart2,
  Eye,
  Sparkles,
  Grid,
  Palette,
  Bookmark,
  ExternalLink,
} from "lucide-react";

export interface ChartPreferences {
  drawings: boolean;
  topToolbar: boolean;
  style: "1" | "0" | "2" | "3" | "8";
  volume: boolean;
  allowSymbolChange: boolean;
  hideGrid: boolean;
  candleTheme: "default" | "emerald" | "gold" | "cyan" | "monochrome";
  permanentStudies: string[];
  customLayoutUrl?: string;
}

export const DEFAULT_CHART_PREFS: ChartPreferences = {
  drawings: true,
  topToolbar: true,
  style: "1",
  volume: true,
  allowSymbolChange: false,
  hideGrid: false,
  candleTheme: "default",
  permanentStudies: [],
  customLayoutUrl: "",
};

const CHART_PREFS_KEY = "tl_cockpit_chart_prefs_v2";

export function loadChartPreferences(): ChartPreferences {
  try {
    const raw = localStorage.getItem(CHART_PREFS_KEY);
    if (!raw) return DEFAULT_CHART_PREFS;
    const parsed = JSON.parse(raw);
    const validThemes = ["default", "emerald", "gold", "cyan", "monochrome"];
    return {
      drawings: parsed.drawings !== false,
      topToolbar: parsed.topToolbar !== false,
      style: ["1", "0", "2", "3", "8"].includes(parsed.style) ? parsed.style : "1",
      volume: parsed.volume !== false,
      allowSymbolChange: parsed.allowSymbolChange === true,
      hideGrid: parsed.hideGrid === true,
      candleTheme: validThemes.includes(parsed.candleTheme) ? parsed.candleTheme : "default",
      permanentStudies: Array.isArray(parsed.permanentStudies) ? parsed.permanentStudies : [],
      customLayoutUrl: typeof parsed.customLayoutUrl === "string" ? parsed.customLayoutUrl : "",
    };
  } catch {
    return DEFAULT_CHART_PREFS;
  }
}

export function saveChartPreferences(prefs: ChartPreferences) {
  try {
    localStorage.setItem(CHART_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage restriction
  }
}

export function buildTradingViewOverrides(prefs: ChartPreferences): Record<string, string | boolean | number> {
  const overrides: Record<string, string | boolean | number> = {};

  if (prefs.hideGrid) {
    overrides["paneProperties.vertGridProperties.color"] = "rgba(0, 0, 0, 0)";
    overrides["paneProperties.horzGridProperties.color"] = "rgba(0, 0, 0, 0)";
  }

  if (prefs.candleTheme === "emerald") {
    overrides["mainSeriesProperties.candleStyle.upColor"] = "#10b981";
    overrides["mainSeriesProperties.candleStyle.downColor"] = "#ef4444";
    overrides["mainSeriesProperties.candleStyle.borderUpColor"] = "#10b981";
    overrides["mainSeriesProperties.candleStyle.borderDownColor"] = "#ef4444";
    overrides["mainSeriesProperties.candleStyle.wickUpColor"] = "#10b981";
    overrides["mainSeriesProperties.candleStyle.wickDownColor"] = "#ef4444";
  } else if (prefs.candleTheme === "gold") {
    overrides["mainSeriesProperties.candleStyle.upColor"] = "#d4af37";
    overrides["mainSeriesProperties.candleStyle.downColor"] = "#64748b";
    overrides["mainSeriesProperties.candleStyle.borderUpColor"] = "#d4af37";
    overrides["mainSeriesProperties.candleStyle.borderDownColor"] = "#64748b";
    overrides["mainSeriesProperties.candleStyle.wickUpColor"] = "#d4af37";
    overrides["mainSeriesProperties.candleStyle.wickDownColor"] = "#64748b";
  } else if (prefs.candleTheme === "cyan") {
    overrides["mainSeriesProperties.candleStyle.upColor"] = "#06b6d4";
    overrides["mainSeriesProperties.candleStyle.downColor"] = "#f43f5e";
    overrides["mainSeriesProperties.candleStyle.borderUpColor"] = "#06b6d4";
    overrides["mainSeriesProperties.candleStyle.borderDownColor"] = "#f43f5e";
    overrides["mainSeriesProperties.candleStyle.wickUpColor"] = "#06b6d4";
    overrides["mainSeriesProperties.candleStyle.wickDownColor"] = "#f43f5e";
  } else if (prefs.candleTheme === "monochrome") {
    overrides["mainSeriesProperties.candleStyle.upColor"] = "#f8fafc";
    overrides["mainSeriesProperties.candleStyle.downColor"] = "#334155";
    overrides["mainSeriesProperties.candleStyle.borderUpColor"] = "#f8fafc";
    overrides["mainSeriesProperties.candleStyle.borderDownColor"] = "#334155";
    overrides["mainSeriesProperties.candleStyle.wickUpColor"] = "#f8fafc";
    overrides["mainSeriesProperties.candleStyle.wickDownColor"] = "#334155";
  }

  return overrides;
}

export function buildTradingViewChartUrl({
  symbol,
  interval,
  prefs,
}: {
  symbol: string;
  interval: string;
  prefs: ChartPreferences;
}): string {
  const url = new URL("https://s.tradingview.com/widgetembed/");
  url.searchParams.append("symbol", symbol);
  url.searchParams.append("interval", interval);
  url.searchParams.append("theme", "dark");
  url.searchParams.append("style", prefs.style);
  url.searchParams.append("timezone", "Europe/Rome");
  url.searchParams.append("locale", "it");
  url.searchParams.append("hide_top_toolbar", prefs.topToolbar ? "0" : "1");
  url.searchParams.append("hide_side_toolbar", prefs.drawings ? "0" : "1");
  url.searchParams.append("hide_volume", prefs.volume ? "0" : "1");
  url.searchParams.append("hide_legend", "0");
  url.searchParams.append("save_image", "1");
  url.searchParams.append("allow_symbol_change", prefs.allowSymbolChange ? "1" : "0");
  url.searchParams.append("backgroundColor", "#08080a");

  if (prefs.hideGrid) {
    url.searchParams.append("gridColor", "rgba(0,0,0,0)");
  }

  const overrides = buildTradingViewOverrides(prefs);
  if (Object.keys(overrides).length > 0) {
    url.searchParams.append("overrides", JSON.stringify(overrides));
  }

  if (prefs.permanentStudies && prefs.permanentStudies.length > 0) {
    url.searchParams.append("studies", JSON.stringify(prefs.permanentStudies));
  }

  return url.toString();
}

interface CockpitChartPrefsDialogProps {
  currentPrefs: ChartPreferences;
  onSavePrefs: (newPrefs: ChartPreferences) => void;
  onReloadChart: () => void;
}

export function CockpitChartPrefsDialog({
  currentPrefs,
  onSavePrefs,
  onReloadChart,
}: CockpitChartPrefsDialogProps) {
  const [prefs, setPrefs] = useState<ChartPreferences>(currentPrefs);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveChartPreferences(prefs);
    onSavePrefs(prefs);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleReset = () => {
    setPrefs(DEFAULT_CHART_PREFS);
    saveChartPreferences(DEFAULT_CHART_PREFS);
    onSavePrefs(DEFAULT_CHART_PREFS);
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 text-foreground">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-primary/20 bg-primary/5">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">
            Personalizzazione Grafico · TradingView Engine
          </span>
          <h3 className="text-sm font-semibold text-foreground mt-0.5">
            Preferenze Grafiche, Disegni & Indicatori Permanenti
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configura la barra laterale di disegno, la toolbar con indicatori, la rimozione griglia, colori candele e indicatori permanenti.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            onReloadChart();
          }}
          className="ck-mini-bridge shrink-0 self-start sm:self-center cursor-pointer flex items-center gap-1.5"
          title="Ricarica il grafico TradingView"
        >
          <RotateCcw size={13} />
          <span>Ricarica Grafico ↻</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <Check size={16} />
          <span>Preferenze grafico salvate e applicate istantaneamente!</span>
        </div>
      )}

      {/* Toggles Grid */}
      <div className="space-y-3">
        <label className="text-xs font-mono font-bold text-muted-foreground uppercase block">
          Strumenti & Barre del Grafico
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Top Toolbar (Fondamentale per preservare disegni e accedere a ⚙ e Fx) */}
          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-primary/30 bg-primary/5 hover:border-primary/50 transition-all cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.topToolbar}
              onChange={(e) => setPrefs({ ...prefs, topToolbar: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-white/20 bg-black/40 text-primary accent-primary"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sliders size={14} className="text-primary" />
                <span>Toolbar Superiore TradingView (Consigliata)</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Mostra la barra superiore con cambio timeframe nativo (che <strong>preserva tutti i disegni</strong> senza ricaricare il grafico), menu Indicatori (Fx) e Impostazioni grafiche (⚙).
              </p>
            </div>
          </label>

          {/* Drawing Toolbar */}
          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-white/10 bg-[#12131A] hover:border-white/20 transition-all cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.drawings}
              onChange={(e) => setPrefs({ ...prefs, drawings: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-white/20 bg-black/40 text-primary accent-primary"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <PenTool size={14} className="text-primary" />
                <span>Barra degli Strumenti di Disegno (Sinistra)</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Mostra la barra laterale per linee, rettangoli FVG, Fibonacci e testi. Clicca sulla stellina ⭐ accanto a uno strumento per aggiungerlo alla barra preferiti!
              </p>
            </div>
          </label>

          {/* Remove Grid */}
          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-white/10 bg-[#12131A] hover:border-white/20 transition-all cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.hideGrid}
              onChange={(e) => setPrefs({ ...prefs, hideGrid: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-white/20 bg-black/40 text-primary accent-primary"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Grid size={14} className="text-primary" />
                <span>Rimuovi Griglia di Sfondo (Grafico Pulito)</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Elimina completamente le linee verticali e orizzontali per un grafico scuro, pulito e focalizzato sui livelli chiave di liquidità.
              </p>
            </div>
          </label>

          {/* Volume Histogram */}
          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-white/10 bg-[#12131A] hover:border-white/20 transition-all cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.volume}
              onChange={(e) => setPrefs({ ...prefs, volume: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-white/20 bg-black/40 text-primary accent-primary"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <BarChart2 size={14} className="text-primary" />
                <span>Istogramma Volumi Inferiore</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Visualizza i volumi scambiati alla base del grafico per identificare assorbimenti e picchi volumetrici.
              </p>
            </div>
          </label>

          {/* Symbol Change Inside TV */}
          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-white/10 bg-[#12131A] hover:border-white/20 transition-all cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.allowSymbolChange}
              onChange={(e) => setPrefs({ ...prefs, allowSymbolChange: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-white/20 bg-black/40 text-primary accent-primary"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Eye size={14} className="text-primary" />
                <span>Cambio Simbolo Interno a TradingView</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Consente la ricerca e il cambio simbolo direttamente dal widget. (Spento di default per preservare il focus sul pair della sessione).
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Candle Color Theme */}
      <div className="space-y-1.5 pt-1">
        <label className="text-xs font-mono font-bold text-muted-foreground uppercase block flex items-center gap-1.5">
          <Palette size={13} className="text-primary" />
          <span>Personalizzazione Colori Candele</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { id: "default", label: "Standard TV", up: "#089981", down: "#f23645" },
            { id: "emerald", label: "Smeraldo & Rubino", up: "#10b981", down: "#ef4444" },
            { id: "gold", label: "Oro AUREUS & Desat", up: "#d4af37", down: "#64748b" },
            { id: "cyan", label: "Neon Ciano & Rosa", up: "#06b6d4", down: "#f43f5e" },
            { id: "monochrome", label: "Istituzionale B/N", up: "#f8fafc", down: "#334155" },
          ].map((ct) => {
            const isSelected = prefs.candleTheme === ct.id;
            return (
              <button
                key={ct.id}
                type="button"
                onClick={() => setPrefs({ ...prefs, candleTheme: ct.id as ChartPreferences["candleTheme"] })}
                className={`p-2.5 rounded-xl border text-center transition-all text-xs font-mono flex flex-col items-center gap-1.5 ${
                  isSelected
                    ? "bg-primary/20 border-primary text-primary font-bold shadow-[0_0_12px_rgba(212,175,55,0.15)]"
                    : "bg-[#12131A] border-white/5 text-muted-foreground hover:border-white/20 hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ct.up }} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ct.down }} />
                </div>
                <span className="text-[11px]">{ct.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Permanent Indicators (Saved permanently across all timeframes) */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-mono font-bold text-muted-foreground uppercase block flex items-center gap-1.5">
            <Bookmark size={13} className="text-primary" />
            <span>Indicatori Permanenti Predefiniti (Auto-caricati)</span>
          </label>
          <span className="text-[10px] font-mono text-primary font-bold px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
            {prefs.permanentStudies.length} attivi
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Seleziona gli indicatori che desideri trovare sempre fissi, permanenti e caricati automaticamente sul grafico in qualsiasi timeframe:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { id: "RSI@tv-basicstudies", name: "RSI (Relative Strength Index 14)", desc: "Oscillatore di momentum e divergenze" },
            { id: "MASimple@tv-basicstudies", name: "Media Mobile Semplice (SMA)", desc: "Trend baseline e direzione primaria" },
            { id: "MAExp@tv-basicstudies", name: "Media Mobile Esponenziale (EMA)", desc: "Reattività dinamica sul prezzo recente" },
            { id: "MACD@tv-basicstudies", name: "MACD", desc: "Convergenza/divergenza di medie mobili" },
            { id: "BB@tv-basicstudies", name: "Bande di Bollinger", desc: "Volatilità e deviazioni standard" },
            { id: "ATR@tv-basicstudies", name: "Average True Range (ATR)", desc: "Volatilità e range medio operativo" },
            { id: "Stochastic@tv-basicstudies", name: "Oscillatore Stocastico", desc: "Aree di ipercomprato / ipervenduto" },
          ].map((study) => {
            const isActive = prefs.permanentStudies.includes(study.id);
            return (
              <label
                key={study.id}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                  isActive
                    ? "bg-primary/10 border-primary/40 text-foreground"
                    : "bg-[#12131A] border-white/5 text-muted-foreground hover:border-white/15"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => {
                    const newStudies = e.target.checked
                      ? [...prefs.permanentStudies, study.id]
                      : prefs.permanentStudies.filter((id) => id !== study.id);
                    setPrefs({ ...prefs, permanentStudies: newStudies });
                  }}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-white/20 bg-black/40 text-primary accent-primary"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold block text-foreground">{study.name}</span>
                  <span className="text-[10px] text-muted-foreground block truncate">{study.desc}</span>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Chart Style Selector */}
      <div className="space-y-1.5 pt-1">
        <label className="text-xs font-mono font-bold text-muted-foreground uppercase block">
          Stile Grafico
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { id: "1", label: "Candele Giapponesi" },
            { id: "0", label: "Barre (OHLC)" },
            { id: "2", label: "Linea Continua" },
            { id: "3", label: "Area Sfumata" },
            { id: "8", label: "Heikin Ashi" },
          ].map((styleOption) => {
            const isSelected = prefs.style === styleOption.id;
            return (
              <button
                key={styleOption.id}
                type="button"
                onClick={() => setPrefs({ ...prefs, style: styleOption.id as ChartPreferences["style"] })}
                className={`p-2.5 rounded-xl border text-center transition-all text-xs font-mono ${
                  isSelected
                    ? "bg-primary/20 border-primary text-primary font-bold shadow-[0_0_12px_rgba(212,175,55,0.15)]"
                    : "bg-[#12131A] border-white/5 text-muted-foreground hover:border-white/20 hover:text-foreground"
                }`}
              >
                {styleOption.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Personal TradingView Cloud Layout Link */}
      <div className="space-y-1.5 pt-1">
        <label className="text-xs font-mono font-bold text-muted-foreground uppercase block flex items-center gap-1.5">
          <ExternalLink size={13} className="text-primary" />
          <span>Integrazione Layout Cloud TradingView Personale (Opzionale)</span>
        </label>
        <div className="p-3.5 rounded-xl border border-white/10 bg-[#12131A] space-y-2">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Se possiedi un account TradingView personale con i tuoi layout salvati sul cloud, i tuoi template e la barra dei preferiti sincronizzata su tutti i tuoi dispositivi, inserisci qui l'URL del tuo layout (es. <code>https://www.tradingview.com/chart/AbCdEfGh/</code>). Il pulsante in alto nel Cockpit aprirà direttamente la tua schermata sincronizzata:
          </p>
          <input
            type="url"
            value={prefs.customLayoutUrl ?? ""}
            onChange={(e) => setPrefs({ ...prefs, customLayoutUrl: e.target.value })}
            placeholder="https://www.tradingview.com/chart/ID_LAYOUT/"
            className="w-full h-8 rounded-lg border border-white/15 bg-black/40 px-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Info Tips: Soluzione a disegni, timeframe e preferiti */}
      <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs text-muted-foreground space-y-2 leading-relaxed">
        <div className="flex items-center gap-1.5 text-amber-400 font-semibold font-mono text-[11px]">
          <Sparkles size={14} />
          <span>Guida: Come preservare Disegni, Indicatori & Preferiti</span>
        </div>
        <ul className="list-disc pl-4 space-y-1.5 text-[11px] text-muted-foreground">
          <li>
            <strong className="text-foreground">Cambio Timeframe senza perdere disegni:</strong> Con la <em>Toolbar Superiore</em> abilitata, cambia il timeframe (1m, 5m, 15m, 1h, 4h, D) <u>direttamente sulla barra superiore interna del grafico TradingView</u>. In questo modo il grafico non viene ricaricato e tutti i tuoi tracciamenti rimangono visibili su ogni intervallo!
          </li>
          <li>
            <strong className="text-foreground">Personalizzazione manuale colori & griglia:</strong> Clicca sull'icona dell'ingranaggio (⚙) in alto a destra nel grafico, oppure fai tasto destro sul grafico ➔ <em>Impostazioni...</em> ➔ <em>Aspetto</em> per rimuovere la griglia o personalizzare candele e sfondo.
          </li>
          <li>
            <strong className="text-foreground">Strumenti preferiti (Stellina ⭐):</strong> Nella barra laterale sinistra dei disegni, passa il cursore sopra uno strumento e clicca la stellina per aggiungerlo alla barra mobile dei preferiti.
          </li>
          <li>
            <strong className="text-foreground">Salvataggio Permanente con il Trade:</strong> Per sigillare grafici e disegni nel tempo, usa il pulsante <em>REGISTRA TRADE · IL LIBRO DELLA VERITÀ</em> o scatta uno screenshot istantaneo (icona fotocamera in alto a destra).
          </li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-muted-foreground hover:text-foreground underline decoration-dotted transition-colors"
        >
          Ripristina impostazioni predefinite
        </button>

        <button
          type="submit"
          className="ck-primary px-6 cursor-pointer flex items-center gap-2"
        >
          <Check size={15} />
          <span>Salva & Applica Preferenze</span>
        </button>
      </div>
    </form>
  );
}
