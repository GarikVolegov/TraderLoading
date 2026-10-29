import { useState, useMemo, useEffect } from "react";
import {
  Activity,
  BarChart2,
  Bell,
  Camera,
  CandlestickChart,
  Check,
  ChevronDown,
  Compass,
  Eye,
  Layers,
  LayoutGrid,
  LineChart,
  Loader2,
  Maximize2,
  Minimize2,
  PanelLeftOpen,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import type { FeedStatus } from "@/lib/chart/tradingViewRealtimeFeed";
import type { ReplayPriceAlert } from "@/lib/replay/alertModel";

export interface LimenChartHeaderProps {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  interval: string;
  onIntervalChange: (interval: string) => void;
  chartType: "candles" | "heikin" | "line";
  onChartTypeChange: (type: "candles" | "heikin" | "line") => void;
  feedStatus?: FeedStatus;
  statusMessage?: string;
  latestBarTime?: number;
  showSessions: boolean;
  onToggleSessions: () => void;
  onOpenSessionsSettings?: () => void;
  showLiquidity?: boolean;
  onToggleLiquidity?: () => void;
  onOpenLiquiditySettings?: () => void;
  showWyckoff?: boolean;
  onToggleWyckoff?: () => void;
  onOpenWyckoffSettings?: () => void;
  showVolume: boolean;
  onToggleVolume: () => void;
  showEma: boolean;
  onToggleEma: () => void;
  showAutoFvg: boolean;
  onToggleAutoFvg: () => void;
  onClearAllIndicators?: () => void;
  onSelectAllIndicators?: () => void;
  isCleanChart?: boolean;
  onTakeScreenshot?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  // Cockpit Integrations
  leftCollapsed?: boolean;
  onToggleLeft?: () => void;
  biasScore?: number | null;
  h4DirectionalBias?: "BULLISH" | "BEARISH" | "NEUTRAL" | null;
  edgeTier?: string | null;
  onOpenContext?: () => void;
  macroText?: string;
  macroStatus?: "pre" | "clear" | "post" | "normal";
  onOpenNews?: () => void;
  onOpenFavorites?: () => void;
  isAdmin?: boolean;
  // IA Visiva Sentinel
  onScanAi?: () => void;
  isAiScanning?: boolean;
  hasAiSetup?: boolean;
  showAiOverlay?: boolean;
  onToggleAiOverlay?: () => void;
  // Albero Oggetti & Layout Multi-Chart
  onOpenObjectTree?: () => void;
  objectCount?: number;
  layout?: "1x1" | "1x2" | "2x1" | "2x2";
  onLayoutChange?: (layout: "1x1" | "1x2" | "2x1" | "2x2") => void;
  // Allerte di Prezzo (TradingView Pro Style)
  alertsCount?: number;
  alerts?: ReplayPriceAlert[];
  onCreateAlertCurrent?: () => void;
  onRemoveAlert?: (id: string) => void;
  onClearAllAlerts?: () => void;
  // Segnalatore News Rosse ad Alto Impatto (TradingView Style)
  showRedNews?: boolean;
  onToggleRedNews?: () => void;
  imminentRedNews?: { title: string; country: string; time: number; countdownMin: number } | null;
  onJumpToEventTime?: (time: number) => void;
}

interface SymbolGroup {
  group: string;
  items: Array<{ id: string; label: string; sub?: string }>;
}

const ALL_SYMBOLS: SymbolGroup[] = [
  {
    group: "PRINCIPALI",
    items: [
      { id: "XAUUSD", label: "XAU/USD", sub: "Oro / Dollaro USA" },
      { id: "BTCUSD", label: "BTC/USD", sub: "Bitcoin / USD" },
      { id: "EURUSD", label: "EUR/USD", sub: "Euro / Dollaro USA" },
    ],
  },
  {
    group: "INDICI",
    items: [
      { id: "US30", label: "US30", sub: "Dow Jones 30" },
      { id: "NAS100", label: "NAS100", sub: "Nasdaq 100" },
      { id: "SPX500", label: "SPX500", sub: "S&P 500" },
    ],
  },
  {
    group: "FOREX",
    items: [
      { id: "GBPUSD", label: "GBP/USD", sub: "Sterlina / USD" },
      { id: "USDJPY", label: "USD/JPY", sub: "USD / Yen Giapponese" },
      { id: "USDCAD", label: "USD/CAD", sub: "USD / Dollaro Canadese" },
      { id: "USDCHF", label: "USD/CHF", sub: "USD / Franco Svizzero" },
    ],
  },
  {
    group: "COMMODITIES & CRYPTO",
    items: [
      { id: "ETHUSD", label: "ETH/USD", sub: "Ethereum / USD" },
      { id: "USOIL", label: "USOIL", sub: "Petrolio WTI" },
    ],
  },
];

const ALL_TIMEFRAMES = [
  { label: "1 Minuto", short: "1m", value: "1" },
  { label: "5 Minuti", short: "5m", value: "5" },
  { label: "15 Minuti", short: "15m", value: "15" },
  { label: "30 Minuti", short: "30m", value: "30" },
  { label: "1 Ora", short: "1H", value: "60" },
  { label: "4 Ore", short: "4H", value: "240" },
  { label: "1 Giorno", short: "1D", value: "D" },
  { label: "1 Settimana", short: "1W", value: "W" },
];

const DEFAULT_FAV_SYMBOLS = ["XAUUSD", "BTCUSD", "EURUSD"];
const DEFAULT_FAV_TIMEFRAMES = ["15", "60", "240", "D"];
const DEFAULT_FAV_INDICATORS = ["liquidity", "sessions", "wyckoff"];

const STORAGE_KEY_SYMBOLS = "limen_chart_fav_symbols_v1";
const STORAGE_KEY_TIMEFRAMES = "limen_chart_fav_timeframes_v1";
const STORAGE_KEY_INDICATORS = "limen_chart_fav_indicators_v1";

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function LimenChartHeader({
  symbol,
  onSymbolChange,
  interval,
  onIntervalChange,
  chartType,
  onChartTypeChange,
  feedStatus,
  statusMessage,
  showSessions,
  onToggleSessions,
  onOpenSessionsSettings,
  showLiquidity = false,
  onToggleLiquidity,
  onOpenLiquiditySettings,
  showWyckoff = false,
  onToggleWyckoff,
  onOpenWyckoffSettings,
  showVolume,
  onToggleVolume,
  showEma,
  onToggleEma,
  showAutoFvg,
  onToggleAutoFvg,
  onClearAllIndicators,
  onSelectAllIndicators,
  isCleanChart = false,
  onTakeScreenshot,
  isFullscreen = false,
  onToggleFullscreen,
  leftCollapsed = false,
  onToggleLeft,
  biasScore,
  h4DirectionalBias,
  edgeTier,
  onOpenContext,
  macroText,
  macroStatus = "normal",
  onOpenNews,
  onOpenFavorites,
  isAdmin = false,
  onScanAi,
  isAiScanning = false,
  hasAiSetup = false,
  onOpenObjectTree,
  objectCount = 0,
  layout = "1x1",
  onLayoutChange,
  alertsCount = 0,
  alerts = [],
  onCreateAlertCurrent,
  onRemoveAlert,
  onClearAllAlerts,
  showRedNews = true,
  onToggleRedNews,
  imminentRedNews,
  onJumpToEventTime,
}: LimenChartHeaderProps) {
  const [symbolPickerOpen, setSymbolPickerOpen] = useState(false);
  const [symbolSearchQuery, setSymbolSearchQuery] = useState("");
  const [tfPickerOpen, setTfPickerOpen] = useState(false);
  const [chartTypeOpen, setChartTypeOpen] = useState(false);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [alertsMenuOpen, setAlertsMenuOpen] = useState(false);

  // ── Preferiti Persistenti (Pair, Timeframe, Indicatori) ─────────────────────
  const [favSymbols, setFavSymbols] = useState<string[]>(() =>
    loadFromStorage(STORAGE_KEY_SYMBOLS, DEFAULT_FAV_SYMBOLS),
  );
  const [favTimeframes, setFavTimeframes] = useState<string[]>(() =>
    loadFromStorage(STORAGE_KEY_TIMEFRAMES, DEFAULT_FAV_TIMEFRAMES),
  );
  const [favIndicators, setFavIndicators] = useState<string[]>(() =>
    loadFromStorage(STORAGE_KEY_INDICATORS, DEFAULT_FAV_INDICATORS),
  );

  const toggleFavSymbol = (id: string) => {
    setFavSymbols((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      saveToStorage(STORAGE_KEY_SYMBOLS, next);
      return next;
    });
  };

  const toggleFavTimeframe = (val: string) => {
    setFavTimeframes((prev) => {
      const next = prev.includes(val) ? prev.filter((t) => t !== val) : [...prev, val];
      saveToStorage(STORAGE_KEY_TIMEFRAMES, next);
      return next;
    });
  };

  const toggleFavIndicator = (id: string) => {
    setFavIndicators((prev) => {
      const next = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
      saveToStorage(STORAGE_KEY_INDICATORS, next);
      return next;
    });
  };

  const rawSym = symbol.includes(":") ? symbol.split(":").pop()! : symbol;
  const cleanSym = rawSym.trim().toUpperCase().replace(/[\/\-_]/g, "");

  const currentSymbolLabel = useMemo(() => {
    for (const g of ALL_SYMBOLS) {
      const found = g.items.find((item) => item.id === cleanSym);
      if (found) return found.label;
    }
    return symbol;
  }, [cleanSym, symbol]);

  const filteredSymbolGroups = useMemo(() => {
    if (!symbolSearchQuery.trim()) return ALL_SYMBOLS;
    const q = symbolSearchQuery.trim().toLowerCase();
    return ALL_SYMBOLS.map((g) => ({
      group: g.group,
      items: g.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          item.sub?.toLowerCase().includes(q),
      ),
    })).filter((g) => g.items.length > 0);
  }, [symbolSearchQuery]);

  const isTfActive = (tfValue: string) => {
    return (
      interval === tfValue ||
      (tfValue === "60" && interval === "H1") ||
      (tfValue === "240" && interval === "H4") ||
      (tfValue === "15" && interval === "M15") ||
      (tfValue === "30" && interval === "M30") ||
      (tfValue === "5" && interval === "M5") ||
      (tfValue === "1" && interval === "M1") ||
      (tfValue === "D" && interval === "D1") ||
      (tfValue === "W" && interval === "W1")
    );
  };

  const currentTfLabel = useMemo(() => {
    const match = ALL_TIMEFRAMES.find((tf) => isTfActive(tf.value));
    return match?.short ?? interval;
  }, [interval]);

  return (
    <div className="limen-chart-header">
      {/* ── 1. Controlli Sinistra (Mercati, Timeframe, Candele, Indicatori) ── */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Mostra Protocollo se collassato */}
        {leftCollapsed && onToggleLeft && (
          <button
            type="button"
            className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono text-zinc-300 hover:text-white rounded border border-[#26262E] bg-[#0E0F14] hover:bg-[#161822] transition-colors"
            onClick={onToggleLeft}
            title="Mostra Protocollo"
          >
            <PanelLeftOpen size={13} />
            <span className="hidden md:inline">Protocollo</span>
          </button>
        )}

        {/* 1.1 Selettore Simbolo Dropdown & Ricerca con Preferiti ★ */}
        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold rounded border border-[#C5A059]/40 bg-[#C5A059]/10 text-[#C5A059] hover:bg-[#C5A059]/20 transition-all shadow-sm cursor-pointer whitespace-nowrap"
            onClick={() => {
              setSymbolPickerOpen(!symbolPickerOpen);
              setTfPickerOpen(false);
              setChartTypeOpen(false);
              setIndicatorsOpen(false);
            }}
            title="Cerca mercati o gestisci preferiti (★)"
          >
            <span>{currentSymbolLabel}</span>
            <ChevronDown size={12} className="opacity-75" />
          </button>

          {symbolPickerOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setSymbolPickerOpen(false)}
              />
              <div className="absolute left-0 top-full mt-1.5 w-72 max-w-[calc(100vw-20px)] bg-[#0E0F14] border border-[#26262E] rounded-lg shadow-2xl z-50 overflow-hidden font-mono text-xs">
                <div className="p-2 border-b border-[#1F222E] bg-[#08080A] flex items-center gap-2">
                  <Search size={14} className="text-zinc-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Cerca pair o mercato..."
                    value={symbolSearchQuery}
                    onChange={(e) => setSymbolSearchQuery(e.target.value)}
                    className="w-full bg-transparent border-0 text-white placeholder-zinc-500 text-xs outline-none"
                    autoFocus
                  />
                </div>
                <div className="max-h-64 overflow-y-auto p-1 scrollbar-thin">
                  {filteredSymbolGroups.map((g) => (
                    <div key={g.group} className="py-1">
                      <div className="px-2 py-1 text-[10px] font-bold text-[#C5A059]/80 tracking-wider">
                        {g.group}
                      </div>
                      {g.items.map((item) => {
                        const isFav = favSymbols.includes(item.id);
                        const isSelected = cleanSym === item.id;
                        return (
                          <div
                            key={item.id}
                            className={`w-full px-2 py-1.5 rounded flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-[#C5A059]/15 text-[#C5A059] font-bold"
                                : "text-zinc-300 hover:bg-[#161822] hover:text-white"
                            }`}
                            onClick={() => {
                              onSymbolChange(item.id);
                              setSymbolPickerOpen(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="font-semibold">{item.label}</span>
                              {item.sub && (
                                <span className="text-[10px] text-zinc-500">{item.sub}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {isSelected && <Check size={13} className="text-[#C5A059]" />}
                              <button
                                type="button"
                                className={`p-1 rounded transition-colors ${
                                  isFav
                                    ? "text-[#C5A059] hover:text-[#D4AF37]"
                                    : "text-zinc-600 hover:text-zinc-300"
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavSymbol(item.id);
                                }}
                                title={isFav ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
                              >
                                <Star
                                  size={13}
                                  className={isFav ? "fill-[#C5A059]" : ""}
                                />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 1.2 Pillole Pair Preferiti (Switch Rapido verso altri preferiti, escluso quello attivo) */}
        {favSymbols.filter((id) => id !== cleanSym).length > 0 && (
          <div className="hidden md:flex items-center bg-[#0B0C10] border border-[#26262E] rounded-md p-0.5 gap-0.5">
            {favSymbols
              .filter((symId) => symId !== cleanSym)
              .map((symId) => {
                let label = symId;
                for (const g of ALL_SYMBOLS) {
                  const item = g.items.find((i) => i.id === symId);
                  if (item) {
                    label = item.label;
                    break;
                  }
                }
                return (
                  <button
                    key={symId}
                    type="button"
                    className="px-2 py-0.5 text-[11px] font-mono font-medium rounded text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all cursor-pointer whitespace-nowrap"
                    onClick={() => onSymbolChange(symId)}
                    title={`Passa a ${label}`}
                  >
                    {label}
                  </button>
                );
              })}
          </div>
        )}

        {/* 1.3 Selettore Timeframe con Preferiti (★) */}
        <div className="flex items-center bg-[#0B0C10] border border-[#26262E] rounded-md p-0.5">
          {favTimeframes.map((tfValue, idx) => {
            const isActive = isTfActive(tfValue);
            const tfObj = ALL_TIMEFRAMES.find((t) => t.value === tfValue);
            const label = tfObj?.short ?? tfValue;
            return (
              <button
                key={tfValue}
                type="button"
                className={`px-1.5 py-0.5 text-[11px] font-mono font-semibold rounded transition-colors cursor-pointer whitespace-nowrap ${
                  !isActive && idx >= 2 ? "hidden sm:inline-flex" : ""
                } ${
                  isActive
                    ? "bg-[#C5A059] text-black shadow-sm font-bold"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                }`}
                onClick={() => onIntervalChange(tfValue)}
                title={`Imposta timeframe su ${label}`}
              >
                {label}
              </button>
            );
          })}

          {/* Freccia Dropdown Altri Timeframe */}
          <div className="relative">
            <button
              type="button"
              className="px-1 py-0.5 text-zinc-400 hover:text-white rounded cursor-pointer"
              onClick={() => {
                setTfPickerOpen(!tfPickerOpen);
                setSymbolPickerOpen(false);
                setChartTypeOpen(false);
                setIndicatorsOpen(false);
              }}
              title={`Tutti i timeframe (${currentTfLabel}) · Gestisci preferiti`}
            >
              <ChevronDown size={11} />
            </button>

            {tfPickerOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setTfPickerOpen(false)}
                />
                <div className="absolute left-0 top-full mt-1.5 w-44 bg-[#0E0F14] border border-[#26262E] rounded-lg shadow-2xl z-50 py-1 font-mono text-xs">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-[#C5A059]/80 tracking-wider border-b border-[#1F222E] mb-1">
                    TIMEFRAME (★ = Barra)
                  </div>
                  {ALL_TIMEFRAMES.map((tf) => {
                    const isActive = isTfActive(tf.value);
                    const isFav = favTimeframes.includes(tf.value);
                    return (
                      <div
                        key={tf.value}
                        className={`w-full px-2.5 py-1.5 flex items-center justify-between transition-colors cursor-pointer ${
                          isActive
                            ? "bg-[#C5A059]/15 text-[#C5A059] font-bold"
                            : "text-zinc-300 hover:bg-[#161822] hover:text-white"
                        }`}
                        onClick={() => {
                          onIntervalChange(tf.value);
                          setTfPickerOpen(false);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-6 font-bold">{tf.short}</span>
                          <span className="text-[11px] text-zinc-400">{tf.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isActive && <Check size={12} className="text-[#C5A059]" />}
                          <button
                            type="button"
                            className={`p-1 rounded transition-colors ${
                              isFav
                                ? "text-[#C5A059] hover:text-[#D4AF37]"
                                : "text-zinc-600 hover:text-zinc-300"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavTimeframe(tf.value);
                            }}
                            title={isFav ? "Rimuovi dalla barra" : "Fissa sulla barra"}
                          >
                            <Star
                              size={12}
                              className={isFav ? "fill-[#C5A059]" : ""}
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 1.4 Selettore Tipo Grafico Compatto (Icona Dropdown) */}
        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 text-xs font-mono rounded border border-[#26262E] bg-[#0B0C10] text-zinc-300 hover:text-white hover:border-[#C5A059]/40 transition-colors cursor-pointer"
            onClick={() => {
              setChartTypeOpen(!chartTypeOpen);
              setSymbolPickerOpen(false);
              setTfPickerOpen(false);
              setIndicatorsOpen(false);
            }}
            title={
              chartType === "candles"
                ? "Stile: Candele Giapponesi"
                : chartType === "heikin"
                ? "Stile: Heikin-Ashi"
                : "Stile: Grafico a Linea"
            }
          >
            {chartType === "line" ? (
              <LineChart size={14} className="text-[#C5A059]" />
            ) : (
              <CandlestickChart size={14} className="text-[#C5A059]" />
            )}
            <ChevronDown size={11} className="opacity-75" />
          </button>

          {chartTypeOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setChartTypeOpen(false)}
              />
              <div className="absolute left-0 top-full mt-1.5 w-44 bg-[#0E0F14] border border-[#26262E] rounded-lg shadow-2xl z-50 py-1 font-mono text-xs">
                <button
                  type="button"
                  className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer ${
                    chartType === "candles"
                      ? "bg-[#C5A059]/20 text-[#C5A059] font-bold"
                      : "text-zinc-300 hover:bg-[#161822] hover:text-white"
                  }`}
                  onClick={() => {
                    onChartTypeChange("candles");
                    setChartTypeOpen(false);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <CandlestickChart size={13} />
                    <span>Candele Giapponesi</span>
                  </span>
                  {chartType === "candles" && <Check size={12} />}
                </button>
                <button
                  type="button"
                  className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer ${
                    chartType === "heikin"
                      ? "bg-[#C5A059]/20 text-[#C5A059] font-bold"
                      : "text-zinc-300 hover:bg-[#161822] hover:text-white"
                  }`}
                  onClick={() => {
                    onChartTypeChange("heikin");
                    setChartTypeOpen(false);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <BarChart2 size={13} />
                    <span>Heikin-Ashi</span>
                  </span>
                  {chartType === "heikin" && <Check size={12} />}
                </button>
                <button
                  type="button"
                  className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer ${
                    chartType === "line"
                      ? "bg-[#C5A059]/20 text-[#C5A059] font-bold"
                      : "text-zinc-300 hover:bg-[#161822] hover:text-white"
                  }`}
                  onClick={() => {
                    onChartTypeChange("line");
                    setChartTypeOpen(false);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <LineChart size={13} />
                    <span>Grafico a Linea</span>
                  </span>
                  {chartType === "line" && <Check size={12} />}
                </button>
              </div>
            </>
          )}
        </div>

        {/* 1.5 Chip Rapidi Indicatori Preferiti (★) sulla barra */}
        <div className="hidden lg:flex items-center gap-1">
          {favIndicators.includes("sessions") && (
            <div className="inline-flex items-center rounded border overflow-hidden border-[#26262E] bg-[#0B0C10]">
              <button
                type="button"
                className={`px-2 py-0.5 text-[11px] font-mono transition-all cursor-pointer ${
                  showSessions
                    ? "bg-[#C5A059]/20 text-[#C5A059] font-bold"
                    : "text-zinc-400 hover:text-white"
                }`}
                onClick={onToggleSessions}
                title="Attiva/disattiva Sessioni (Asia, Londra, NY)"
              >
                Sessioni
              </button>
              {onOpenSessionsSettings && (
                <button
                  type="button"
                  onClick={onOpenSessionsSettings}
                  className="px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 hover:text-[#E8C56A] hover:bg-[#C5A059]/15 border-l border-[#26262E] transition-colors cursor-pointer"
                  title="Personalizza sessioni preferite e orari personali"
                  aria-label="Impostazioni sessioni e orari"
                >
                  ⚙
                </button>
              )}
            </div>
          )}

          {favIndicators.includes("liquidity") && onToggleLiquidity && (
            <button
              type="button"
              className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-all cursor-pointer ${
                showLiquidity
                  ? "bg-[#C5A059]/20 text-[#C5A059] border-[#C5A059]/50 font-bold"
                  : "text-zinc-400 hover:text-white border-[#26262E] bg-[#0B0C10]"
              }`}
              onClick={onToggleLiquidity}
              title="Attiva/disattiva Liquidità Istituzionale (BSL, SSL, PDH, PDL)"
            >
              Liquidità
            </button>
          )}

          {favIndicators.includes("wyckoff") && onToggleWyckoff && (
            <button
              type="button"
              className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-all cursor-pointer ${
                showWyckoff
                  ? "bg-[#C5A059]/20 text-[#C5A059] border-[#C5A059]/50 font-bold"
                  : "text-zinc-400 hover:text-white border-[#26262E] bg-[#0B0C10]"
              }`}
              onClick={onToggleWyckoff}
              title="Attiva/disattiva Wyckoff (Creek/Ice, Spring, UTAD, SOW 10%)"
            >
              Wyckoff
            </button>
          )}

          {favIndicators.includes("volume") && (
            <button
              type="button"
              className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-all cursor-pointer ${
                showVolume
                  ? "bg-[#C5A059]/20 text-[#C5A059] border-[#C5A059]/50 font-bold"
                  : "text-zinc-400 hover:text-white border-[#26262E] bg-[#0B0C10]"
              }`}
              onClick={onToggleVolume}
              title="Attiva/disattiva Volume Istogramma"
            >
              Volume
            </button>
          )}

          {favIndicators.includes("ema") && (
            <button
              type="button"
              className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-all cursor-pointer ${
                showEma
                  ? "bg-[#C5A059]/20 text-[#C5A059] border-[#C5A059]/50 font-bold"
                  : "text-zinc-400 hover:text-white border-[#26262E] bg-[#0B0C10]"
              }`}
              onClick={onToggleEma}
              title="Attiva/disattiva EMA Ribbon (20, 50, 200)"
            >
              EMA
            </button>
          )}

          {favIndicators.includes("fvg") && (
            <button
              type="button"
              className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-all cursor-pointer ${
                showAutoFvg
                  ? "bg-[#C5A059]/20 text-[#C5A059] border-[#C5A059]/50 font-bold"
                  : "text-zinc-400 hover:text-white border-[#26262E] bg-[#0B0C10]"
              }`}
              onClick={onToggleAutoFvg}
              title="Attiva/disattiva Auto Fair Value Gaps (SMC)"
            >
              FVG
            </button>
          )}

          {onToggleRedNews && (
            <button
              type="button"
              className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                showRedNews
                  ? "bg-rose-500/15 text-rose-300 border-rose-500/40 font-bold"
                  : "text-zinc-400 hover:text-white border-[#26262E] bg-[#0B0C10]"
              }`}
              onClick={onToggleRedNews}
              title="Attiva/disattiva Marker Notizie Rosse ad Alto Impatto sul Grafico"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${showRedNews ? "bg-rose-400 animate-pulse" : "bg-zinc-500"}`} />
              <span>News Rosse</span>
            </button>
          )}
        </div>

        {/* 1.6 Menu Indicatori Completo (fx) con Stelline ★ */}
        <div className="relative">
          {(() => {
            const isAnyIndicatorActive = Boolean(
              showSessions ||
              showLiquidity ||
              showWyckoff ||
              showEma ||
              showAutoFvg ||
              showVolume
            );
            return (
              <button
                type="button"
                className={`px-2 py-1 text-xs font-mono rounded border flex items-center gap-1.5 transition-colors cursor-pointer ${
                  indicatorsOpen || isAnyIndicatorActive
                    ? "bg-[#161822] text-white border-[#C5A059]/40"
                    : "text-zinc-400 hover:text-white border-[#26262E] bg-[#0B0C10]"
                }`}
                onClick={() => {
                  setIndicatorsOpen(!indicatorsOpen);
                  setSymbolPickerOpen(false);
                  setTfPickerOpen(false);
                  setChartTypeOpen(false);
                }}
                title={
                  !isAnyIndicatorActive
                    ? "Menu Indicatori · Grafico Pulito Attivo"
                    : "Menu Indicatori · Gestisci preferiti (★)"
                }
              >
                <span className="font-bold text-[#C5A059] text-[11px]">fx</span>
                <span className="hidden sm:inline">Indicatori</span>
                {!isAnyIndicatorActive && (
                  <span className="text-[9px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-1 py-0.2 rounded font-bold whitespace-nowrap">
                    PULITO
                  </span>
                )}
                <ChevronDown size={11} className="opacity-75" />
              </button>
            );
          })()}

          {indicatorsOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIndicatorsOpen(false)}
              />
              <div className="absolute right-0 sm:left-0 sm:right-auto top-full mt-1.5 w-72 max-w-[calc(100vw-20px)] bg-[#0E0F14] border border-[#26262E] rounded-lg shadow-2xl py-1.5 z-50 font-mono text-xs">
                <div className="px-3 py-1.5 text-[10px] font-bold text-[#C5A059]/90 uppercase tracking-wider border-b border-[#1F222E] mb-1 flex items-center justify-between">
                  <span>Indicatori (★ = Barra)</span>
                  <div className="flex items-center gap-2">
                    {onClearAllIndicators && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClearAllIndicators();
                        }}
                        className="text-[10px] text-zinc-400 hover:text-[#E8C56A] underline cursor-pointer whitespace-nowrap transition-colors"
                        title="Deseleziona tutti gli indicatori per un grafico pulito al 100%"
                      >
                        Pulisci Tutto
                      </button>
                    )}
                    {onSelectAllIndicators && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectAllIndicators();
                        }}
                        className="text-[10px] text-zinc-400 hover:text-white underline cursor-pointer whitespace-nowrap transition-colors"
                        title="Seleziona e attiva tutti gli indicatori standard"
                      >
                        Seleziona Tutto
                      </button>
                    )}
                  </div>
                </div>

                {/* 1. Liquidità Istituzionale (BSL / SSL / PDH / PDL) */}
                {onToggleLiquidity && (
                  <div className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#161822] text-zinc-200 cursor-pointer">
                    <div
                      className="flex-1 flex items-center gap-2"
                      onClick={onToggleLiquidity}
                    >
                      <Layers size={12} className="text-[#C5A059]" />
                      <span>Liquidità (BSL, SSL, PDH, PDL)</span>
                      {showLiquidity && <Check size={14} className="text-[#C5A059] ml-auto" />}
                    </div>
                    {onOpenLiquiditySettings && (
                      <button
                        type="button"
                        className="p-1 ml-1 rounded text-zinc-400 hover:text-[#E8C56A] hover:bg-white/5 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIndicatorsOpen(false);
                          onOpenLiquiditySettings();
                        }}
                        title="Personalizza livelli, densità e opzioni liquidità"
                        aria-label="Impostazioni Liquidità"
                      >
                        ⚙
                      </button>
                    )}
                    <button
                      type="button"
                      className={`p-1 ml-1 rounded transition-colors ${
                        favIndicators.includes("liquidity")
                          ? "text-[#C5A059] hover:text-[#D4AF37]"
                          : "text-zinc-600 hover:text-zinc-300"
                      }`}
                      onClick={() => toggleFavIndicator("liquidity")}
                      title="Fissa come chip sulla barra"
                    >
                      <Star
                        size={12}
                        className={favIndicators.includes("liquidity") ? "fill-[#C5A059]" : ""}
                      />
                    </button>
                  </div>
                )}

                {/* 2. Sessioni Operative */}
                <div className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#161822] text-zinc-200 cursor-pointer">
                  <div
                    className="flex-1 flex items-center gap-2"
                    onClick={onToggleSessions}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>Sessioni (Asia, LDN, NY + Opens)</span>
                    {showSessions && <Check size={14} className="text-[#C5A059] ml-auto" />}
                  </div>
                  {onOpenSessionsSettings && (
                    <button
                      type="button"
                      className="p-1 ml-1 rounded text-zinc-400 hover:text-[#E8C56A] hover:bg-white/5 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIndicatorsOpen(false);
                        onOpenSessionsSettings();
                      }}
                      title="Personalizza sessioni preferite e orari personali"
                      aria-label="Impostazioni sessioni e orari"
                    >
                      ⚙
                    </button>
                  )}
                  <button
                    type="button"
                    className={`p-1 ml-1 rounded transition-colors ${
                      favIndicators.includes("sessions")
                        ? "text-[#C5A059] hover:text-[#D4AF37]"
                        : "text-zinc-600 hover:text-zinc-300"
                    }`}
                    onClick={() => toggleFavIndicator("sessions")}
                    title="Fissa come chip sulla barra"
                  >
                    <Star
                      size={12}
                      className={favIndicators.includes("sessions") ? "fill-[#C5A059]" : ""}
                    />
                  </button>
                </div>

                {/* 3. Wyckoff Strutturale */}
                {onToggleWyckoff && (
                  <div className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#161822] text-zinc-200 cursor-pointer">
                    <div
                      className="flex-1 flex items-center gap-2"
                      onClick={onToggleWyckoff}
                    >
                      <Compass size={12} className="text-[#E8C56A]" />
                      <span>Wyckoff (Creek/Ice, Spring, UTAD, 10%)</span>
                      {showWyckoff && <Check size={14} className="text-[#C5A059] ml-auto" />}
                    </div>
                    {onOpenWyckoffSettings && (
                      <button
                        type="button"
                        className="p-1 ml-1 rounded text-zinc-400 hover:text-[#E8C56A] hover:bg-white/5 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIndicatorsOpen(false);
                          onOpenWyckoffSettings();
                        }}
                        title="Personalizza Trading Range ed eventi Wyckoff"
                        aria-label="Impostazioni Wyckoff"
                      >
                        ⚙
                      </button>
                    )}
                    <button
                      type="button"
                      className={`p-1 ml-1 rounded transition-colors ${
                        favIndicators.includes("wyckoff")
                          ? "text-[#C5A059] hover:text-[#D4AF37]"
                          : "text-zinc-600 hover:text-zinc-300"
                      }`}
                      onClick={() => toggleFavIndicator("wyckoff")}
                      title="Fissa come chip sulla barra"
                    >
                      <Star
                        size={12}
                        className={favIndicators.includes("wyckoff") ? "fill-[#C5A059]" : ""}
                      />
                    </button>
                  </div>
                )}

                {/* Volume */}
                <div className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#161822] text-zinc-200 cursor-pointer">
                  <div
                    className="flex-1 flex items-center gap-2"
                    onClick={onToggleVolume}
                  >
                    <BarChart2 size={12} className="text-zinc-400" />
                    <span>Volume Istogramma</span>
                    {showVolume && <Check size={14} className="text-[#C5A059] ml-auto" />}
                  </div>
                  <button
                    type="button"
                    className={`p-1 ml-2 rounded transition-colors ${
                      favIndicators.includes("volume")
                        ? "text-[#C5A059] hover:text-[#D4AF37]"
                        : "text-zinc-600 hover:text-zinc-300"
                    }`}
                    onClick={() => toggleFavIndicator("volume")}
                    title="Fissa come chip sulla barra"
                  >
                    <Star
                      size={12}
                      className={favIndicators.includes("volume") ? "fill-[#C5A059]" : ""}
                    />
                  </button>
                </div>

                {/* EMA Ribbon */}
                <div className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#161822] text-zinc-200 cursor-pointer">
                  <div
                    className="flex-1 flex items-center gap-2"
                    onClick={onToggleEma}
                  >
                    <Activity size={12} className="text-blue-400" />
                    <span>EMA Ribbon (20, 50, 200)</span>
                    {showEma && <Check size={14} className="text-[#C5A059] ml-auto" />}
                  </div>
                  <button
                    type="button"
                    className={`p-1 ml-2 rounded transition-colors ${
                      favIndicators.includes("ema")
                        ? "text-[#C5A059] hover:text-[#D4AF37]"
                        : "text-zinc-600 hover:text-zinc-300"
                    }`}
                    onClick={() => toggleFavIndicator("ema")}
                    title="Fissa come chip sulla barra"
                  >
                    <Star
                      size={12}
                      className={favIndicators.includes("ema") ? "fill-[#C5A059]" : ""}
                    />
                  </button>
                </div>

                {/* Auto Fair Value Gaps */}
                <div className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#161822] text-zinc-200 cursor-pointer">
                  <div
                    className="flex-1 flex items-center gap-2"
                    onClick={onToggleAutoFvg}
                  >
                    <Sparkles size={12} className="text-yellow-400" />
                    <span>Auto Fair Value Gaps (SMC)</span>
                    {showAutoFvg && <Check size={14} className="text-[#C5A059] ml-auto" />}
                  </div>
                  <button
                    type="button"
                    className={`p-1 ml-2 rounded transition-colors ${
                      favIndicators.includes("fvg")
                        ? "text-[#C5A059] hover:text-[#D4AF37]"
                        : "text-zinc-600 hover:text-zinc-300"
                    }`}
                    onClick={() => toggleFavIndicator("fvg")}
                    title="Fissa come chip sulla barra"
                  >
                    <Star
                      size={12}
                      className={favIndicators.includes("fvg") ? "fill-[#C5A059]" : ""}
                    />
                  </button>
                </div>

                {/* News Rosse ad Alto Impatto */}
                {onToggleRedNews && (
                  <div className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#161822] text-zinc-200 cursor-pointer">
                    <div
                      className="flex-1 flex items-center gap-2"
                      onClick={onToggleRedNews}
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                      <span>News Rosse (Alto Impatto)</span>
                      {showRedNews && <Check size={14} className="text-[#C5A059] ml-auto" />}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Pulsante Naked Chart / Price Action Pura (TradingView Pro / Alt+N) */}
        {onClearAllIndicators && (
          <button
            type="button"
            className={`hidden sm:flex items-center gap-1 px-2 py-1 text-xs font-mono font-bold rounded border transition-all cursor-pointer whitespace-nowrap ${
              isCleanChart
                ? "bg-[#C5A059]/15 border-[#C5A059] text-[#E8C56A] shadow-[0_0_10px_rgba(197,160,89,0.2)]"
                : "border-[#26262E] bg-[#0B0C10] text-zinc-400 hover:text-white hover:border-[#C5A059]/40"
            }`}
            onClick={() => {
              if (isCleanChart) {
                onSelectAllIndicators?.();
              } else {
                onClearAllIndicators();
              }
            }}
            title={isCleanChart ? "Ripristina indicatori sovrapposti (Alt+N)" : "Grafico Pulito / Naked Price Action (Alt+N)"}
          >
            <Compass size={13} className={isCleanChart ? "text-[#E8C56A]" : "text-zinc-400"} />
            <span className="whitespace-nowrap">{isCleanChart ? "NAKED ATTIVO" : "GRAFICO PULITO"}</span>
          </button>
        )}
      </div>

      {/* ── 2. Pillole di Stato, Sentinella IA, Bias e Controlli Rapidi (Destra) ── */}
      <div className="flex items-center gap-1.5 ml-auto shrink-0">
        {/* IA Visiva Sentinel Button (Accessibile ESCLUSIVAMENTE agli Amministratori) */}
        {isAdmin && onScanAi && (
          <button
            type="button"
            className={`px-2 py-1 text-xs font-mono rounded border flex items-center gap-1.5 transition-all cursor-pointer ${
              hasAiSetup
                ? "bg-[#C5A059]/20 text-[#C5A059] border-[#C5A059]/40 font-bold shadow-sm"
                : "text-zinc-300 hover:text-[#C5A059] border-[#26262E] bg-[#0B0C10] hover:bg-[#161822]"
            }`}
            onClick={onScanAi}
            disabled={isAiScanning}
            title="Analisi Visiva IA Sentinel (Riservato Amministratore): scansione pattern e setup"
          >
            {isAiScanning ? (
              <>
                <Loader2 size={12} className="animate-spin text-[#C5A059]" />
                <span className="hidden md:inline">IA Analisi...</span>
              </>
            ) : (
              <>
                <Eye size={12} className="text-[#C5A059]" />
                <span className="hidden md:inline">IA Sentinel</span>
                <span className="text-[8px] bg-[#C5A059]/20 text-[#E8C56A] px-1 py-0.2 rounded font-mono font-bold border border-[#C5A059]/30">ADMIN</span>
              </>
            )}
          </button>
        )}

        {/* Bias Contesto (Pillola compatta ad alto contrasto con H4 Master Bias) */}
        {onOpenContext && (
          <button
            type="button"
            className={`px-2.5 py-0.5 text-[11px] font-mono rounded border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              h4DirectionalBias === "BULLISH" || (biasScore != null && biasScore > 15)
                ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/40"
                : h4DirectionalBias === "BEARISH" || (biasScore != null && biasScore < -15)
                ? "bg-rose-950/60 text-rose-400 border-rose-500/40"
                : "bg-[#0E0F14] text-zinc-300 border-[#26262E]"
            }`}
            onClick={onOpenContext}
            title="Dettaglio Pesi Prezzo/Macro/Sentiment/COT & H4 Master Bias"
          >
            <span className="hidden lg:inline text-zinc-400">H4: </span>
            <strong className="font-semibold uppercase">
              {h4DirectionalBias ?? (biasScore == null ? "—" : `${biasScore > 0 ? "+" : ""}${biasScore}`)}
            </strong>
            {edgeTier === "TIER_A_PLUS" && (
              <span className="text-[9px] bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/40 px-1 rounded font-bold whitespace-nowrap">
                A+
              </span>
            )}
            {edgeTier === "COUNTER_TREND_WARNING" && (
              <span className="text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1 rounded font-bold whitespace-nowrap animate-pulse">
                ANTI-FADE
              </span>
            )}
          </button>
        )}

        {/* Sentinella News Rossa Imminente Stile TradingView */}
        {imminentRedNews && (
          <button
            type="button"
            className="flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-mono font-bold rounded border border-rose-500/50 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 transition-all cursor-pointer whitespace-nowrap animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.35)]"
            onClick={() => onJumpToEventTime?.(imminentRedNews.time)}
            title={`News ad Alto Impatto: ${imminentRedNews.title} (${imminentRedNews.country}). Clicca per visualizzare l'evento sul grafico.`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span>
              🔴 NEWS ROSSA {imminentRedNews.countdownMin > 0 ? `TRA ${imminentRedNews.countdownMin}M` : "ORA"}: {imminentRedNews.country}
            </span>
          </button>
        )}

        {/* Notizie Macro (Pillola compatta con dot statico elegante) */}
        {onOpenNews && macroText && (
          <button
            type="button"
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-mono rounded border border-[#26262E] bg-[#0E0F14] hover:border-[#C5A059]/40 text-zinc-300 cursor-pointer max-w-[150px] transition-colors"
            onClick={onOpenNews}
            title={`Calendario Macro: ${macroText}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                macroStatus === "pre"
                  ? "bg-rose-500"
                  : macroStatus === "post"
                  ? "bg-amber-400"
                  : "bg-emerald-500"
              }`}
            />
            <span className="truncate">{macroText}</span>
          </button>
        )}

        {/* Albero Oggetti & Livelli (Object Tree & Layers) */}
        {onOpenObjectTree && (
          <button
            type="button"
            className="p-1 text-zinc-400 hover:text-[#C5A059] rounded border border-[#26262E] bg-[#0B0C10] hover:bg-[#161822] transition-colors cursor-pointer relative"
            onClick={onOpenObjectTree}
            title="Albero degli Oggetti & Livelli Grafico (Disegni & Indicatori)"
          >
            <Layers size={13} />
            {objectCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#C5A059] text-[8px] font-bold text-black font-mono">
                {objectCount}
              </span>
            )}
          </button>
        )}

        {/* Allerte di Prezzo (TradingView Pro Style) */}
        <div className="relative">
          <button
            type="button"
            className={`p-1 rounded border transition-colors cursor-pointer relative ${
              alertsCount > 0
                ? "bg-[#C5A059]/20 text-[#C5A059] border-[#C5A059]/40 font-bold"
                : "text-zinc-400 hover:text-[#C5A059] border-[#26262E] bg-[#0B0C10] hover:bg-[#161822]"
            }`}
            onClick={() => setAlertsMenuOpen(!alertsMenuOpen)}
            title="Allerte di Prezzo · Clicca '+' sull'asse prezzi o premi Alt+A"
            aria-label="Allerte di Prezzo"
          >
            <Bell size={13} className={alertsCount > 0 ? "text-[#E8C56A]" : "text-zinc-400"} />
            {alertsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#C5A059] text-[8px] font-bold text-black font-mono">
                {alertsCount}
              </span>
            )}
          </button>

          {alertsMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setAlertsMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-[#0E0F14] border border-[#C5A059]/40 rounded-lg shadow-2xl z-50 p-2.5 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-[#26262E] pb-1.5 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Bell size={13} className="text-[#E8C56A]" />
                    <span className="font-bold text-[#E8C56A] text-[11px] tracking-wider uppercase">
                      Allerte · {symbol}
                    </span>
                  </div>
                  {alerts.length > 0 && onClearAllAlerts && (
                    <button
                      type="button"
                      onClick={() => {
                        onClearAllAlerts();
                      }}
                      className="text-[10px] text-zinc-400 hover:text-rose-400 cursor-pointer"
                      title="Cancella tutte le allerte per questo asset"
                    >
                      Svuota
                    </button>
                  )}
                </div>

                <div className="text-[10px] text-zinc-400 leading-snug mb-2 p-1.5 rounded bg-[#161822] border border-[#26262E]">
                  💡 Clicca <span className="text-[#E8C56A] font-bold">+</span> sull'asse dei prezzi a destra, premi <span className="text-[#E8C56A] font-bold">Alt+A</span> oppure usa il tasto destro sul grafico.
                </div>

                {onCreateAlertCurrent && (
                  <button
                    type="button"
                    onClick={() => {
                      onCreateAlertCurrent();
                      setAlertsMenuOpen(false);
                    }}
                    className="w-full mb-2 py-1 px-2 rounded bg-[#C5A059]/20 hover:bg-[#C5A059]/30 border border-[#C5A059]/40 text-[#E8C56A] font-bold text-[10px] uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus size={11} />
                    <span>Nuova Allerta Prezzo Live</span>
                  </button>
                )}

                <div className="max-h-48 overflow-y-auto space-y-1">
                  {alerts.length === 0 ? (
                    <div className="text-center py-3 text-zinc-500 text-[10px]">
                      Nessuna allerta attiva per {symbol}
                    </div>
                  ) : (
                    alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center justify-between px-2 py-1 rounded bg-[#161822] border border-[#26262E] text-[11px]"
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              alert.status === "active"
                                ? "bg-[#10b981]"
                                : alert.status === "triggered"
                                ? "bg-[#C5A059]"
                                : "bg-zinc-500"
                            }`}
                          />
                          <span className="font-bold text-zinc-200">
                            {alert.price.toFixed(5)}
                          </span>
                          <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-black/40 text-zinc-400">
                            {alert.status === "active" ? "Attiva" : alert.status === "triggered" ? "Scattata" : "Sospesa"}
                          </span>
                        </div>
                        {onRemoveAlert && (
                          <button
                            type="button"
                            onClick={() => onRemoveAlert(alert.id)}
                            className="text-zinc-500 hover:text-rose-400 p-0.5 transition-colors cursor-pointer"
                            title="Rimuovi allerta"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Polittico Sovrano · Multi-Chart Layout Switcher */}
        {onLayoutChange && (
          <div className="relative">
            <button
              type="button"
              className={`hidden sm:inline-flex p-1 rounded border transition-colors cursor-pointer ${
                layout !== "1x1"
                  ? "bg-[#C5A059]/20 text-[#C5A059] border-[#C5A059]/40"
                  : "text-zinc-400 hover:text-white border-[#26262E] bg-[#0B0C10] hover:bg-[#161822]"
              }`}
              onClick={() => setLayoutMenuOpen(!layoutMenuOpen)}
              title="Polittico Sovrano · Layout Multi-Grafico (1x1, 1x2, 2x2)"
            >
              <LayoutGrid size={13} />
            </button>
            {layoutMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setLayoutMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 w-44 bg-[#0E0F14] border border-[#26262E] rounded-lg shadow-2xl z-50 py-1 font-mono text-xs">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-[#C5A059]/80 uppercase tracking-wider border-b border-[#1F222E] mb-1">
                    Polittico Sovrano
                  </div>
                  {[
                    { id: "1x1", label: "Singolo (1x1)" },
                    { id: "1x2", label: "Orizzontale (1x2)" },
                    { id: "2x1", label: "Verticale (2x1)" },
                    { id: "2x2", label: "Quad (2x2)" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`w-full px-2.5 py-1.5 text-left flex items-center justify-between hover:bg-[#161822] transition-colors ${
                        layout === item.id ? "text-[#C5A059] font-bold bg-[#C5A059]/10" : "text-zinc-300"
                      }`}
                      onClick={() => {
                        onLayoutChange(item.id as "1x1" | "1x2" | "2x1" | "2x2");
                        setLayoutMenuOpen(false);
                      }}
                    >
                      <span>{item.label}</span>
                      {layout === item.id && <Check size={12} className="text-[#C5A059]" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Preferiti Popover */}
        {onOpenFavorites && (
          <button
            type="button"
            className="hidden sm:inline-flex p-1 text-zinc-400 hover:text-[#C5A059] rounded border border-[#26262E] bg-[#0B0C10] hover:bg-[#161822] transition-colors cursor-pointer"
            onClick={onOpenFavorites}
            title="Strumenti Preferiti"
          >
            <Star size={13} />
          </button>
        )}

        {/* Screenshot */}
        {onTakeScreenshot && (
          <button
            type="button"
            className="hidden sm:inline-flex p-1 text-zinc-400 hover:text-white rounded border border-[#26262E] bg-[#0B0C10] hover:bg-[#161822] transition-colors cursor-pointer"
            onClick={onTakeScreenshot}
            title="Cattura screenshot PNG"
          >
            <Camera size={13} />
          </button>
        )}

        {/* Quando in Sguardo Zenit (Fullscreen): Telemetria Sessione Discreta */}
        {isFullscreen && (
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#C5A059]/40 bg-[#C5A059]/10 font-mono text-[10px] text-[#E8C56A] shadow-sm animate-in fade-in duration-300">
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold tracking-wider uppercase whitespace-nowrap">ZENIT</span>
          </div>
        )}

        {/* Fullscreen */}
        {onToggleFullscreen && (
          <button
            type="button"
            className={`p-1 rounded border border-[#26262E] transition-colors cursor-pointer ${
              isFullscreen
                ? "bg-[#C5A059]/20 text-[#C5A059] border-[#C5A059]/40"
                : "text-zinc-400 hover:text-white bg-[#0B0C10] hover:bg-[#161822]"
            }`}
            onClick={onToggleFullscreen}
            title={isFullscreen ? "Disattiva Sguardo Zenit (Z)" : "Sguardo Zenit · Schermo Intero (Z)"}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        )}
      </div>
    </div>
  );
}
