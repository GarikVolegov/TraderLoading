import { useState, useMemo, useEffect } from "react";
import {
  Activity,
  BarChart2,
  Camera,
  CandlestickChart,
  Check,
  ChevronDown,
  Eye,
  LineChart,
  Loader2,
  Maximize2,
  Minimize2,
  PanelLeftOpen,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import type { FeedStatus } from "@/lib/chart/tradingViewRealtimeFeed";

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
  showVolume: boolean;
  onToggleVolume: () => void;
  showEma: boolean;
  onToggleEma: () => void;
  showAutoFvg: boolean;
  onToggleAutoFvg: () => void;
  onTakeScreenshot?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  // Cockpit Integrations
  leftCollapsed?: boolean;
  onToggleLeft?: () => void;
  biasScore?: number | null;
  onOpenContext?: () => void;
  macroText?: string;
  macroStatus?: "pre" | "clear" | "post" | "normal";
  onOpenNews?: () => void;
  onOpenFavorites?: () => void;
  // IA Visiva Sentinel
  onScanAi?: () => void;
  isAiScanning?: boolean;
  hasAiSetup?: boolean;
  showAiOverlay?: boolean;
  onToggleAiOverlay?: () => void;
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
const DEFAULT_FAV_INDICATORS = ["sessions", "volume"];

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
  showVolume,
  onToggleVolume,
  showEma,
  onToggleEma,
  showAutoFvg,
  onToggleAutoFvg,
  onTakeScreenshot,
  isFullscreen = false,
  onToggleFullscreen,
  leftCollapsed = false,
  onToggleLeft,
  biasScore,
  onOpenContext,
  macroText,
  macroStatus = "normal",
  onOpenNews,
  onOpenFavorites,
  onScanAi,
  isAiScanning = false,
  hasAiSetup = false,
}: LimenChartHeaderProps) {
  const [symbolPickerOpen, setSymbolPickerOpen] = useState(false);
  const [symbolSearchQuery, setSymbolSearchQuery] = useState("");
  const [tfPickerOpen, setTfPickerOpen] = useState(false);
  const [chartTypeOpen, setChartTypeOpen] = useState(false);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);

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
              <div className="absolute left-0 top-full mt-1.5 w-72 bg-[#0E0F14] border border-[#26262E] rounded-lg shadow-2xl z-50 overflow-hidden font-mono text-xs">
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
          {favTimeframes.map((tfValue) => {
            const isActive = isTfActive(tfValue);
            const tfObj = ALL_TIMEFRAMES.find((t) => t.value === tfValue);
            const label = tfObj?.short ?? tfValue;
            return (
              <button
                key={tfValue}
                type="button"
                className={`px-1.5 py-0.5 text-[11px] font-mono font-semibold rounded transition-colors cursor-pointer ${
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
            <button
              type="button"
              className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-all cursor-pointer ${
                showSessions
                  ? "bg-[#C5A059]/20 text-[#C5A059] border-[#C5A059]/50 font-bold"
                  : "text-zinc-400 hover:text-white border-[#26262E] bg-[#0B0C10]"
              }`}
              onClick={onToggleSessions}
              title="Attiva/disattiva Killzones Sessioni (Asia, Londra, NY)"
            >
              Sessioni
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
        </div>

        {/* 1.6 Menu Indicatori Completo (fx) con Stelline ★ */}
        <div className="relative">
          <button
            type="button"
            className={`px-2 py-1 text-xs font-mono rounded border flex items-center gap-1.5 transition-colors cursor-pointer ${
              indicatorsOpen || showSessions || showEma || showAutoFvg || showVolume
                ? "bg-[#161822] text-white border-[#C5A059]/40"
                : "text-zinc-400 hover:text-white border-[#26262E] bg-[#0B0C10]"
            }`}
            onClick={() => {
              setIndicatorsOpen(!indicatorsOpen);
              setSymbolPickerOpen(false);
              setTfPickerOpen(false);
              setChartTypeOpen(false);
            }}
            title="Menu Indicatori · Gestisci preferiti (★)"
          >
            <span className="font-bold text-[#C5A059] text-[11px]">fx</span>
            <span className="hidden sm:inline">Indicatori</span>
            <ChevronDown size={11} className="opacity-75" />
          </button>

          {indicatorsOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIndicatorsOpen(false)}
              />
              <div className="absolute left-0 top-full mt-1.5 w-64 bg-[#0E0F14] border border-[#26262E] rounded-lg shadow-2xl py-1.5 z-50 font-mono text-xs">
                <div className="px-3 py-1 text-[10px] font-bold text-[#C5A059]/80 uppercase tracking-wider border-b border-[#1F222E] mb-1">
                  Indicatori Sovrapposti (★ = Barra)
                </div>

                {/* Sessioni */}
                <div className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#161822] text-zinc-200 cursor-pointer">
                  <div
                    className="flex-1 flex items-center gap-2"
                    onClick={onToggleSessions}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>Sessioni (Asia, LDN, NY)</span>
                    {showSessions && <Check size={14} className="text-[#C5A059] ml-auto" />}
                  </div>
                  <button
                    type="button"
                    className={`p-1 ml-2 rounded transition-colors ${
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
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 2. Pillole di Stato, Sentinella IA, Bias e Controlli Rapidi (Destra) ── */}
      <div className="flex items-center gap-1.5 ml-auto shrink-0">
        {/* IA Visiva Sentinel Button */}
        {onScanAi && (
          <button
            type="button"
            className={`px-2 py-1 text-xs font-mono rounded border flex items-center gap-1.5 transition-all cursor-pointer ${
              hasAiSetup
                ? "bg-[#C5A059]/20 text-[#C5A059] border-[#C5A059]/40 font-bold shadow-sm"
                : "text-zinc-300 hover:text-[#C5A059] border-[#26262E] bg-[#0B0C10] hover:bg-[#161822]"
            }`}
            onClick={onScanAi}
            disabled={isAiScanning}
            title="Analisi Visiva IA: scansione pattern, checklist e setup di esecuzione"
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
              </>
            )}
          </button>
        )}

        {/* Bias Contesto (Pillola compatta ad alto contrasto) */}
        {onOpenContext && (
          <button
            type="button"
            className={`px-2.5 py-0.5 text-[11px] font-mono rounded border transition-all cursor-pointer whitespace-nowrap ${
              biasScore == null
                ? "bg-[#0E0F14] text-zinc-400 border-[#26262E]"
                : biasScore > 15
                ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/40"
                : biasScore < -15
                ? "bg-rose-950/60 text-rose-400 border-rose-500/40"
                : "bg-[#0E0F14] text-zinc-300 border-[#26262E]"
            }`}
            onClick={onOpenContext}
            title="Dettaglio Pesi Prezzo/Macro/Sentiment/COT"
          >
            <span className="hidden lg:inline text-zinc-400">Bias: </span>
            <strong className="font-semibold">
              {biasScore == null ? "—" : `${biasScore > 0 ? "+" : ""}${biasScore}`}
            </strong>
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

        {/* Preferiti Popover */}
        {onOpenFavorites && (
          <button
            type="button"
            className="p-1 text-zinc-400 hover:text-[#C5A059] rounded border border-[#26262E] bg-[#0B0C10] hover:bg-[#161822] transition-colors cursor-pointer"
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
            className="p-1 text-zinc-400 hover:text-white rounded border border-[#26262E] bg-[#0B0C10] hover:bg-[#161822] transition-colors cursor-pointer"
            onClick={onTakeScreenshot}
            title="Cattura screenshot PNG"
          >
            <Camera size={13} />
          </button>
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
            title={isFullscreen ? "Disattiva Schermo Intero" : "Schermo Intero"}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        )}
      </div>
    </div>
  );
}
