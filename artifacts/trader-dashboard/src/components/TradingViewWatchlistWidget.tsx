import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Plus, RefreshCw, Settings, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { WidgetHeader } from "./ui/WidgetHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { uiText } from "@/contexts/LanguageContext";

export interface TradingViewWatchlistSettings {
  symbols: string[];
}

export interface NormalizedTradingViewWatchlistSettings extends TradingViewWatchlistSettings {
  invalidSymbols: string[];
}

export interface TradingViewSingleTickerConfig {
  colorTheme: "dark";
  isTransparent: boolean;
  locale: string;
  symbol: string;
  width: string;
}

export interface TradingViewSymbolSuggestion {
  symbol: string;
  provider: string;
  label: string;
}

export const TRADING_VIEW_WATCHLIST_STORAGE_KEY = "tl_tradingview_watchlist_symbols_v1";
export const DEFAULT_TRADING_VIEW_WATCHLIST_SYMBOLS = ["FX:EURUSD", "OANDA:XAUUSD", "FX:GBPUSD"];

const TRADING_VIEW_SINGLE_TICKER_SCRIPT =
  "https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js";
const TRADING_VIEW_CHART_URL = "https://www.tradingview.com/chart/";

const SYMBOL_PATTERN = /^[A-Z0-9_./-]+:[A-Z0-9_./-]+$/;

const TRADING_VIEW_SYMBOL_SUGGESTIONS: TradingViewSymbolSuggestion[] = [
  { symbol: "FX:EURUSD", provider: "FX", label: "EUR/USD" },
  { symbol: "OANDA:EURUSD", provider: "OANDA", label: "EUR/USD" },
  { symbol: "FOREXCOM:EURUSD", provider: "FOREXCOM", label: "EUR/USD" },
  { symbol: "CAPITALCOM:EURUSD", provider: "CAPITALCOM", label: "EUR/USD" },
  { symbol: "FX:GBPUSD", provider: "FX", label: "GBP/USD" },
  { symbol: "OANDA:GBPUSD", provider: "OANDA", label: "GBP/USD" },
  { symbol: "FOREXCOM:GBPUSD", provider: "FOREXCOM", label: "GBP/USD" },
  { symbol: "CAPITALCOM:GBPUSD", provider: "CAPITALCOM", label: "GBP/USD" },
  { symbol: "FX:USDJPY", provider: "FX", label: "USD/JPY" },
  { symbol: "OANDA:USDJPY", provider: "OANDA", label: "USD/JPY" },
  { symbol: "FOREXCOM:USDJPY", provider: "FOREXCOM", label: "USD/JPY" },
  { symbol: "OANDA:XAUUSD", provider: "OANDA", label: "Gold Spot / USD" },
  { symbol: "FXOPEN:XAUUSD", provider: "FXOPEN", label: "Gold Spot / USD" },
  { symbol: "FOREXCOM:XAUUSD", provider: "FOREXCOM", label: "Gold Spot / USD" },
  { symbol: "TVC:GOLD", provider: "TVC", label: "Gold" },
  { symbol: "TVC:USOIL", provider: "TVC", label: "US Oil" },
  { symbol: "CAPITALCOM:US100", provider: "CAPITALCOM", label: "US 100" },
  { symbol: "NASDAQ:NDX", provider: "NASDAQ", label: "Nasdaq 100" },
  { symbol: "NASDAQ:AAPL", provider: "NASDAQ", label: "Apple" },
  { symbol: "NASDAQ:TSLA", provider: "NASDAQ", label: "Tesla" },
  { symbol: "COINBASE:BTCUSD", provider: "COINBASE", label: "Bitcoin / USD" },
  { symbol: "BINANCE:BTCUSDT", provider: "BINANCE", label: "Bitcoin / USDT" },
];

const TRADING_VIEW_FOREX_PROVIDERS = [
  "FX",
  "OANDA",
  "FOREXCOM",
  "CAPITALCOM",
  "PEPPERSTONE",
  "ICMARKETS",
  "SAXO",
  "FXOPEN",
  "EIGHTCAP",
  "BLACKBULL",
  "FPMARKETS",
  "VANTAGE",
  "TICKMILL",
  "ACTIVTRADES",
  "CITYINDEX",
  "FUSIONMARKETS",
  "SKILLING",
  "WHSELFINVEST",
  "TRADENATION",
];

const TRADING_VIEW_METALS_PROVIDERS = [
  "OANDA",
  "FXOPEN",
  "FOREXCOM",
  "CAPITALCOM",
  "PEPPERSTONE",
  "ICMARKETS",
  "SAXO",
  "EIGHTCAP",
  "BLACKBULL",
  "FPMARKETS",
  "VANTAGE",
  "TICKMILL",
  "ACTIVTRADES",
  "CITYINDEX",
];

const COMMON_FOREX_PAIRS = new Set([
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "USDCHF",
  "AUDUSD",
  "USDCAD",
  "NZDUSD",
  "EURGBP",
  "EURJPY",
  "GBPJPY",
  "AUDJPY",
  "XAUUSD",
  "XAGUSD",
]);

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function normalizeTradingViewSymbol(raw: string): string | null {
  const symbol = raw.trim().toUpperCase();
  return SYMBOL_PATTERN.test(symbol) ? symbol : null;
}

function pairLabel(pair: string): string {
  if (pair === "XAUUSD") return "Gold Spot / USD";
  if (pair === "XAGUSD") return "Silver Spot / USD";
  if (pair.length === 6) return `${pair.slice(0, 3)}/${pair.slice(3)}`;
  return pair;
}

function inferPairFromSearch(normalized: string): string | null {
  const compact = normalized.replace(/[^A-Z0-9]/g, "");
  for (const pair of COMMON_FOREX_PAIRS) {
    if (compact.includes(pair)) return pair;
  }
  const directPair = compact.match(/[A-Z]{6}/)?.[0];
  return directPair ?? null;
}

function generatedBrokerSuggestions(normalized: string): TradingViewSymbolSuggestion[] {
  const pair = inferPairFromSearch(normalized);
  if (!pair) return [];
  const providerFilter = normalized
    .split(/[^A-Z0-9]+/)
    .find((token) => token && !pair.includes(token) && token !== pair);
  const providers = pair.startsWith("XA") ? TRADING_VIEW_METALS_PROVIDERS : TRADING_VIEW_FOREX_PROVIDERS;
  return providers
    .filter((provider) => !providerFilter || provider.includes(providerFilter))
    .map((provider) => ({
      symbol: `${provider}:${pair}`,
      provider,
      label: pairLabel(pair),
    }));
}

export function suggestTradingViewSymbols(query: string, limit = 18): TradingViewSymbolSuggestion[] {
  const normalized = query.trim().toUpperCase().replace(/[^A-Z0-9:./_\-\s]/g, "");
  if (!normalized) return [];
  const staticMatches = TRADING_VIEW_SYMBOL_SUGGESTIONS.filter((item) => {
    const compactSymbol = item.symbol.replace(":", "");
    const compactLabel = item.label.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    return (
      item.symbol.includes(normalized) ||
      compactSymbol.includes(normalized) ||
      compactLabel.includes(normalized) ||
      item.provider.includes(normalized)
    );
  });
  const generated = generatedBrokerSuggestions(normalized);
  const deduped = unique([...staticMatches, ...generated].map((item) => item.symbol));
  const bySymbol = new Map([...staticMatches, ...generated].map((item) => [item.symbol, item]));
  return deduped.map((symbol) => bySymbol.get(symbol)).filter((item): item is TradingViewSymbolSuggestion => Boolean(item)).slice(0, limit);
}

export function normalizeTradingViewWatchlistSettings(raw: unknown): NormalizedTradingViewWatchlistSettings {
  if (!raw || typeof raw !== "object") {
    return { symbols: DEFAULT_TRADING_VIEW_WATCHLIST_SYMBOLS, invalidSymbols: [] };
  }

  const value = raw as Partial<TradingViewWatchlistSettings>;
  const rawSymbols = Array.isArray(value.symbols) ? value.symbols : [];
  const symbols: string[] = [];
  const invalidSymbols: string[] = [];

  for (const entry of rawSymbols) {
    if (typeof entry !== "string") continue;
    const normalized = normalizeTradingViewSymbol(entry);
    if (normalized) symbols.push(normalized);
    else if (entry.trim()) invalidSymbols.push(entry.trim());
  }

  return {
    symbols: unique(symbols),
    invalidSymbols: unique(invalidSymbols),
  };
}

export function buildTradingViewSingleTickerConfig(symbol: string): TradingViewSingleTickerConfig {
  return {
    colorTheme: "dark",
    isTransparent: true,
    locale: "it",
    symbol,
    width: "100%",
  };
}

export function buildTradingViewChartUrl(symbol: string): string {
  const url = new URL(TRADING_VIEW_CHART_URL);
  url.searchParams.set("symbol", symbol);
  return url.toString();
}

export const tradingViewWatchlistStorage = {
  load(storage: Storage | null = typeof window === "undefined" ? null : window.localStorage) {
    if (!storage) return { symbols: DEFAULT_TRADING_VIEW_WATCHLIST_SYMBOLS, invalidSymbols: [] };
    try {
      const raw = storage.getItem(TRADING_VIEW_WATCHLIST_STORAGE_KEY);
      if (!raw) return { symbols: DEFAULT_TRADING_VIEW_WATCHLIST_SYMBOLS, invalidSymbols: [] };
      return normalizeTradingViewWatchlistSettings(JSON.parse(raw));
    } catch {
      return { symbols: DEFAULT_TRADING_VIEW_WATCHLIST_SYMBOLS, invalidSymbols: [] };
    }
  },

  save(
    settings: TradingViewWatchlistSettings,
    storage: Storage | null = typeof window === "undefined" ? null : window.localStorage,
  ) {
    if (!storage) return normalizeTradingViewWatchlistSettings(settings);
    const normalized = normalizeTradingViewWatchlistSettings(settings);
    storage.setItem(TRADING_VIEW_WATCHLIST_STORAGE_KEY, JSON.stringify({ symbols: normalized.symbols }));
    return normalized;
  },
};

function TradingViewSingleTickerEmbed({
  symbol,
  reloadKey,
  onError,
}: {
  symbol: string;
  reloadKey: number;
  onError: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const configKey = useMemo(() => `${symbol}::${reloadKey}`, [symbol, reloadKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";
    const widgetTarget = document.createElement("div");
    widgetTarget.className = "tradingview-widget-container__widget h-[96px]";
    container.appendChild(widgetTarget);

    const script = document.createElement("script");
    script.src = TRADING_VIEW_SINGLE_TICKER_SCRIPT;
    script.async = true;
    script.type = "text/javascript";
    script.onerror = onError;
    script.text = JSON.stringify(buildTradingViewSingleTickerConfig(symbol));
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [configKey, onError, symbol]);

  return <div ref={containerRef} className="tradingview-widget-container h-[96px] w-full overflow-hidden" />;
}

function SymbolEditorDialog({
  open,
  symbols,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  symbols: string[];
  onOpenChange: (open: boolean) => void;
  onSave: (symbols: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[]>(symbols);
  const [newSymbol, setNewSymbol] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(symbols);
      setNewSymbol("");
    }
  }, [open, symbols]);

  const normalizedDraft = normalizeTradingViewWatchlistSettings({ symbols: draft });
  const normalizedNew = newSymbol.trim() ? normalizeTradingViewSymbol(newSymbol) : null;
  const suggestions = suggestTradingViewSymbols(newSymbol);
  const hasInvalidDraft = normalizedDraft.invalidSymbols.length > 0;
  const existingSymbols = draft.map((item) => item.toUpperCase());
  const canAdd = normalizedNew != null && !existingSymbols.includes(normalizedNew);

  const addNormalizedSymbol = (symbol: string) => {
    if (existingSymbols.includes(symbol)) return;
    setDraft((prev) => [...prev, symbol]);
    setNewSymbol("");
  };

  const addSymbol = () => {
    if (canAdd && normalizedNew) {
      addNormalizedSymbol(normalizedNew);
      return;
    }

    const firstAvailable = suggestions.find((item) => !existingSymbols.includes(item.symbol));
    if (firstAvailable) addNormalizedSymbol(firstAvailable.symbol);
  };

  const save = () => {
    onSave(normalizedDraft.symbols);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(720px,calc(100dvh-2rem))] w-[min(calc(100vw-1rem),40rem)] max-w-xl flex-col gap-0 overflow-hidden border-border/60 bg-card/95 p-0 backdrop-blur-xl">
        <DialogHeader className="border-b border-border/40 px-5 pb-3 pt-5">
          <DialogTitle>{uiText("auto.ui.33357d724e")}</DialogTitle>
          <DialogDescription>{uiText("tradingview.watchlist.edit_desc")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex gap-2">
            <Input
              value={newSymbol}
              onChange={(event) => setNewSymbol(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSymbol();
                }
              }}
              placeholder={uiText("auto.ui.bb7e165845")}
              aria-label={uiText("auto.ui.5c0c15ed61")}
            />
            <Button
              type="button"
              size="icon"
              onClick={addSymbol}
              disabled={!canAdd && suggestions.every((item) => existingSymbols.includes(item.symbol))}
              title={uiText("auto.ui.27fec2ac00")}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {newSymbol.trim() && !normalizedNew && suggestions.length === 0 && (
            <p className="text-xs font-medium text-destructive">{uiText("tradingview.watchlist.invalid_symbol")}</p>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-2 rounded-lg border border-border/45 bg-background/30 p-2">
              <p className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {uiText("tradingview.watchlist.suggestions")}
              </p>
              <div className="grid max-h-[280px] gap-1.5 overflow-y-auto pr-1">
                {suggestions.map((suggestion) => {
                  const alreadyAdded = existingSymbols.includes(suggestion.symbol);
                  return (
                    <button
                      key={suggestion.symbol}
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => addNormalizedSymbol(suggestion.symbol)}
                      className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-border/35 bg-card/45 px-3 py-2 text-left transition-colors hover:border-primary/45 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-xs font-bold">{suggestion.symbol}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">{suggestion.label}</span>
                      </span>
                      <span className="shrink-0 rounded-full border border-border/40 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {suggestion.provider}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="max-h-[190px] space-y-2 overflow-y-auto pr-1">
            {draft.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">
                {uiText("tradingview.watchlist.empty_draft")}
              </div>
            ) : (
              draft.map((symbol, index) => {
                const isValid = Boolean(normalizeTradingViewSymbol(symbol));
                return (
                  <div
                    key={`${symbol}-${index}`}
                    className={`flex items-center gap-2 rounded-lg border px-2 py-2 ${
                      isValid ? "border-border/45 bg-secondary/20" : "border-destructive/40 bg-destructive/10"
                    }`}
                  >
                    <Input
                      value={symbol}
                      onChange={(event) => {
                        const value = event.target.value.toUpperCase();
                        setDraft((prev) => prev.map((item, itemIndex) => (itemIndex === index ? value : item)));
                      }}
                      aria-label={uiText("tradingview.watchlist.symbol_aria", { index: index + 1 })}
                      className="min-h-9 text-xs"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 shrink-0"
                      onClick={() => setDraft((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                      title={uiText("auto.ui.4c42460cb8")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          {hasInvalidDraft && (
            <p className="text-xs text-destructive">{uiText("tradingview.watchlist.invalid_draft")}</p>
          )}
        </div>

        <DialogFooter className="border-t border-border/40 bg-background/20 px-5 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{uiText("common.cancel")}</Button>
          <Button type="button" onClick={save}>{uiText("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TradingViewWatchlistWidget() {
  const [settings, setSettings] = useState(() => tradingViewWatchlistStorage.load());
  const [editorOpen, setEditorOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const symbols = settings.symbols;
  const handleEmbedError = useCallback(() => setLoadError(true), []);

  const saveSymbols = (nextSymbols: string[]) => {
    const next = tradingViewWatchlistStorage.save({ symbols: nextSymbols });
    setSettings(next);
    setLoadError(false);
    setReloadKey((value) => value + 1);
  };

  const retry = () => {
    setLoadError(false);
    setReloadKey((value) => value + 1);
  };

  return (
    <Card className="relative overflow-hidden border-border/30 bg-card/60">
      <WidgetHeader
        icon={<Activity className="h-3.5 w-3.5" />}
        iconTone="accent"
        title={uiText("auto.ui.b97144823c")}
        subtitle={uiText("auto.ui.1867f40365")}
        action={
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/40 bg-background/35 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            title={uiText("auto.ui.33357d724e")}
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        }
        className="border-b border-border/40"
      />

      <CardContent className="space-y-2 p-2">
        {symbols.length === 0 ? (
          <div className="flex min-h-[116px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/50 bg-secondary/15 p-3 text-center">
            <p className="text-sm font-bold">{uiText("auto.ui.c739bbc172")}</p>
            <p className="max-w-[240px] text-xs text-muted-foreground">{uiText("tradingview.watchlist.empty_desc")}</p>
            <Button type="button" size="sm" onClick={() => setEditorOpen(true)}>{uiText("auto.ui.33357d724e")}</Button>
          </div>
        ) : (
          <div className="max-h-[220px] space-y-1.5 overflow-y-auto overflow-x-hidden pr-1">
            {symbols.map((symbol) => (
              <div key={symbol} className="relative overflow-hidden rounded-md border border-border/35 bg-background/25">
                <TradingViewSingleTickerEmbed symbol={symbol} reloadKey={reloadKey} onError={handleEmbedError} />
                <a
                  href={buildTradingViewChartUrl(symbol)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 z-10 block touch-manipulation rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  aria-label={`Apri ${symbol} su TradingView`}
                  title={`Apri ${symbol} su TradingView`}
                />
              </div>
            ))}
          </div>
        )}

        {loadError && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <span>{uiText("auto.ui.eda58f52bd")}</span>
            <button
              type="button"
              onClick={retry}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-destructive/30 hover:bg-destructive/10"
              title={uiText("auto.ui.f360775cb8")}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {settings.invalidSymbols.length > 0 && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {uiText("tradingview.watchlist.invalid_symbols_label", { symbols: settings.invalidSymbols.join(", ") })}
          </div>
        )}
      </CardContent>

      <SymbolEditorDialog
        open={editorOpen}
        symbols={symbols}
        onOpenChange={setEditorOpen}
        onSave={saveSymbols}
      />
    </Card>
  );
}
