import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  DEFAULT_TRADING_VIEW_SYMBOL,
  DEFAULT_TRADING_VIEW_TIMEFRAME,
  TRADING_VIEW_PREF_KEY,
  TRADING_VIEW_TIMEFRAMES,
  mapBrokerSymbolToTradingView,
  normalizeTradingViewPreferences,
} from "./tradingViewConfig";
import { getLocalTimeZone } from "@/lib/marketSessions";
import { uiText } from "@/contexts/LanguageContext";

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: Record<string, unknown>) => unknown;
    };
  }
}

function loadPreferences() {
  try {
    return normalizeTradingViewPreferences(JSON.parse(localStorage.getItem(TRADING_VIEW_PREF_KEY) ?? "null"));
  } catch {
    return { symbol: DEFAULT_TRADING_VIEW_SYMBOL, timeframe: DEFAULT_TRADING_VIEW_TIMEFRAME };
  }
}

export function TradingViewMonitor({ brokerSymbol }: { brokerSymbol?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [prefs, setPrefs] = useState(loadPreferences);
  const [loadError, setLoadError] = useState(false);

  const selectedSymbol = useMemo(
    () => prefs.symbol || mapBrokerSymbolToTradingView(brokerSymbol ?? "EURUSD"),
    [brokerSymbol, prefs.symbol],
  );

  useEffect(() => {
    localStorage.setItem(TRADING_VIEW_PREF_KEY, JSON.stringify(prefs));
  }, [prefs]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";
    setLoadError(false);

    const renderWidget = () => {
      if (!containerRef.current || !window.TradingView) return;
      const targetId = `tradingview-account-${Date.now()}`;
      containerRef.current.innerHTML = `<div id="${targetId}" style="height:100%;width:100%"></div>`;
      new window.TradingView.widget({
        autosize: true,
        symbol: selectedSymbol,
        interval: prefs.timeframe,
        timezone: getLocalTimeZone(),
        theme: "dark",
        style: "1",
        locale: "it",
        enable_publishing: false,
        allow_symbol_change: true,
        hide_side_toolbar: false,
        container_id: targetId,
      });
    };

    if (window.TradingView) {
      renderWidget();
      return () => {
        if (containerRef.current) containerRef.current.innerHTML = "";
      };
    }

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = renderWidget;
    script.onerror = () => setLoadError(true);
    document.body.appendChild(script);

    return () => {
      script.remove();
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [selectedSymbol, prefs.timeframe]);

  return (
    <div className="overflow-hidden rounded-xl border border-border/40 bg-card/60">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/30 px-3 py-2">
        <input
          value={prefs.symbol}
          onChange={(event) => setPrefs((prev) => ({ ...prev, symbol: event.target.value.toUpperCase() }))}
          className="h-8 min-w-[150px] flex-1 rounded-lg border border-border bg-secondary/50 px-2 font-mono text-xs"
          aria-label={uiText("auto.ui.1100dd2fca")}
        />
        <div className="flex gap-1 overflow-x-auto">
          {TRADING_VIEW_TIMEFRAMES.map((timeframe) => (
            <button
              key={timeframe}
              type="button"
              onClick={() => setPrefs((prev) => ({ ...prev, timeframe }))}
              className={`h-8 min-w-9 rounded-lg border px-2 text-[11px] font-bold ${
                prefs.timeframe === timeframe
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {timeframe}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setPrefs({
              symbol: mapBrokerSymbolToTradingView(brokerSymbol ?? "EURUSD"),
              timeframe: DEFAULT_TRADING_VIEW_TIMEFRAME,
            })
          }
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/40 text-muted-foreground hover:text-primary"
          title={uiText("auto.ui.aa07593c0a")}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="relative h-[430px] min-h-[320px]">
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive">
            TradingView non disponibile.
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
