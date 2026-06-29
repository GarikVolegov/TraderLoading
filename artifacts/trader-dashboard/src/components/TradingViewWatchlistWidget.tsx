import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, RefreshCw, Settings } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent } from "./ui/card";
import { WidgetHeader } from "./ui/WidgetHeader";
import { useBackground } from "@/contexts/BackgroundContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { getPairLabel } from "@workspace/pair-catalog";
import { uiText } from "@/contexts/LanguageContext";
import {
  TRADING_VIEW_MINI_SYMBOL_SCRIPT,
  buildTradingViewDeepLink,
  buildTradingViewMiniSymbolConfig,
  mapCatalogPairToTradingViewSymbol,
} from "./tradingViewWatchlist";

const PAIR_PREFERENCES_PATH = "/settings?section=pairs";

function TradingViewMiniSymbolEmbed({
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
    widgetTarget.className = "tradingview-widget-container__widget h-[116px]";
    container.appendChild(widgetTarget);

    const script = document.createElement("script");
    script.src = TRADING_VIEW_MINI_SYMBOL_SCRIPT;
    script.async = true;
    script.type = "text/javascript";
    script.onerror = onError;
    script.text = JSON.stringify(buildTradingViewMiniSymbolConfig(symbol));
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [configKey, onError, symbol]);

  return <div ref={containerRef} className="tradingview-widget-container h-[116px] w-full overflow-hidden" />;
}

export function TradingViewWatchlistWidget() {
  const { selectedPairs, settingsLoaded } = useBackground();
  const isMobile = useIsMobile();
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const handleEmbedError = useCallback(() => setLoadError(true), []);

  const retry = () => {
    setLoadError(false);
    setReloadKey((value) => value + 1);
  };

  return (
    <Card className="relative overflow-hidden">
      <WidgetHeader
        icon={<Activity className="h-3.5 w-3.5" />}
        iconTone="accent"
        title={uiText("auto.ui.b97144823c")}
        subtitle={uiText("tradingview.watchlist.subtitle")}
        action={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-primary">
              <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
              {uiText("tradingview.watchlist.live")}
            </span>
            <Link
              href={PAIR_PREFERENCES_PATH}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/40 bg-background/35 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              title={uiText("tradingview.watchlist.manage")}
              aria-label={uiText("tradingview.watchlist.manage")}
            >
              <Settings className="h-3.5 w-3.5" />
            </Link>
          </div>
        }
        className="border-b border-border/40"
      />

      <CardContent className="space-y-2 p-2">
        {!settingsLoaded ? (
          <div className="min-h-[116px] animate-pulse rounded-lg border border-border/35 bg-background/25" />
        ) : selectedPairs.length === 0 ? (
          <div className="flex min-h-[116px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/50 bg-secondary/15 p-3 text-center">
            <p className="text-sm font-bold">{uiText("tradingview.watchlist.empty_title")}</p>
            <p className="max-w-[240px] text-xs text-muted-foreground">
              {uiText("tradingview.watchlist.empty_desc")}
            </p>
            <Link
              href={PAIR_PREFERENCES_PATH}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {uiText("tradingview.watchlist.choose_pairs")}
            </Link>
          </div>
        ) : (
          <div className="space-y-1.5 overflow-x-hidden">
            {selectedPairs.map((pair) => {
              const tvSymbol = mapCatalogPairToTradingViewSymbol(pair);
              const label = getPairLabel(pair);
              return (
                <div
                  key={pair}
                  className="relative overflow-hidden rounded-md border border-border/35 bg-background/25"
                >
                  <TradingViewMiniSymbolEmbed symbol={tvSymbol} reloadKey={reloadKey} onError={handleEmbedError} />
                  <a
                    href={buildTradingViewDeepLink(tvSymbol)}
                    target={isMobile ? "_self" : "_blank"}
                    rel="noopener noreferrer"
                    className="absolute inset-0 z-10 block touch-manipulation rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                    aria-label={uiText("tradingview.watchlist.open_aria", { symbol: label })}
                    title={uiText("tradingview.watchlist.open_aria", { symbol: label })}
                  />
                </div>
              );
            })}
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
      </CardContent>
    </Card>
  );
}
