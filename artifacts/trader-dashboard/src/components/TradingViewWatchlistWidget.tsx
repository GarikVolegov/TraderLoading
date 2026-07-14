import { useMemo, useEffect, useRef } from "react";
import { Activity, RefreshCw, Settings } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Sparkline } from "./ui/Sparkline";
import { WidgetHeader } from "./ui/WidgetHeader";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import { useBackground } from "@/contexts/BackgroundContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { getPairLabel } from "@workspace/pair-catalog";
import { uiText } from "@/contexts/LanguageContext";
import {
  buildTradingViewDeepLink,
  formatWatchlistPrice,
  mapCatalogPairToTradingViewSymbol,
  resolveWatchlistPairs,
  watchlistFreshness,
  type WatchlistItem,
  type WatchlistResponse,
} from "./tradingViewWatchlist";

const PAIR_PREFERENCES_PATH = "/settings?section=pairs";
// Reduce poll interval to near-realtime for the watchlist (graceful fallback
// when a dedicated WS is not available). Keep a slightly faster warming poll
// for initial null-price states.
const WATCHLIST_POLL_MS = 5_000; // 5s
/** While the server cache is still warming (null prices) poll faster to pick it up. */
const WATCHLIST_WARMING_POLL_MS = 1_000; // 1s

function WatchlistRow({
  pair,
  item,
  loading,
  target,
}: {
  pair: string;
  item: WatchlistItem | undefined;
  loading: boolean;
  target: "_self" | "_blank";
}) {
  const label = getPairLabel(pair);
  const changePct = item?.changePct ?? null;
  const tone =
    changePct === null || changePct === 0 ? "primary" : changePct > 0 ? "success" : "destructive";
  const hasData = item != null && item.price !== null;
  const pending = loading || (item != null && item.supported && item.price === null);

  return (
    <a
      href={buildTradingViewDeepLink(mapCatalogPairToTradingViewSymbol(pair))}
      target={target}
      rel="noopener noreferrer"
      aria-label={uiText("tradingview.watchlist.open_aria", { symbol: label })}
      title={uiText("tradingview.watchlist.open_aria", { symbol: label })}
      className="flex touch-manipulation items-center gap-3 rounded-md border border-border/35 bg-background/25 px-3 py-2 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
    >
      <div className="w-[76px] shrink-0">
        <div className="text-sm font-bold tracking-tight text-foreground">{label}</div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {uiText("tradingview.watchlist.daily")}
        </div>
      </div>

      {hasData && item.spark.length >= 2 ? (
        <Sparkline data={item.spark} tone={tone} width={96} height={28} className="h-7 min-w-0 flex-1" />
      ) : pending ? (
        <Skeleton className="h-7 min-w-0 flex-1 rounded-sm" />
      ) : (
        <div className="min-w-0 flex-1" />
      )}

      <div className="shrink-0 text-right">
        {hasData ? (
          <>
            <div className="text-sm font-semibold tabular-nums text-foreground">
              {formatWatchlistPrice(pair, item.price as number)}
            </div>
            <div
              className={cn(
                "text-[11px] font-semibold tabular-nums",
                changePct !== null && changePct > 0 && "text-success",
                changePct !== null && changePct < 0 && "text-destructive",
                (changePct === null || changePct === 0) && "text-muted-foreground",
              )}
            >
              {changePct === null ? "—" : `${changePct > 0 ? "+" : ""}${changePct.toFixed(2)}%`}
            </div>
          </>
        ) : pending ? (
          <div className="flex flex-col items-end gap-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-10" />
          </div>
        ) : (
          <div className="text-sm font-semibold text-muted-foreground">{"—"}</div>
        )}
      </div>
    </a>
  );
}

export function TradingViewWatchlistWidget() {
  const { selectedPairs } = useBackground();
  const isMobile = useIsMobile();

  // Favorites when set, otherwise a default set — same fallback as the rest of the
  // dashboard (deriveEffectiveFilterItems), so the watchlist is never empty.
  const pairs = useMemo(() => resolveWatchlistPairs(selectedPairs), [selectedPairs]);
  const pairsKey = pairs.join(",");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tools-watchlist", pairsKey],
    queryFn: () => apiFetch<WatchlistResponse>(`/api/tools/watchlist?pairs=${pairsKey}`),
    refetchInterval: (query) => {
      const items = query.state.data?.items;
      return items?.some((item) => item.supported && item.price === null)
        ? WATCHLIST_WARMING_POLL_MS
        : WATCHLIST_POLL_MS;
    },
    // Consider data stale shortly before the next refresh so UI shows up-to-date
    // loading states when needed.
    staleTime: Math.max(0, WATCHLIST_POLL_MS - 1_000),
  });

  const itemByPair = useMemo(
    () => new Map((data?.items ?? []).map((item) => [item.pair, item])),
    [data],
  );

  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // connect websocket and subscribe to pairs
    try {
      const url = (import.meta.env.VITE_API_BASE ? new URL(import.meta.env.VITE_API_BASE) : new URL(window.location.origin));
      url.pathname = "/api/tools/watchlist/ws";
      const ws = new WebSocket(url.toString().replace(/^http/, "ws"));
      wsRef.current = ws;
      ws.addEventListener("open", () => {
        ws.send(JSON.stringify({ type: "subscribe", pairs }));
      });
      ws.addEventListener("message", (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg && msg.type === "update" && typeof msg.pair === "string") {
            // update react-query cache for the current pairsKey
            queryClient.setQueryData(["tools-watchlist", pairsKey], (old: any) => {
              const items = (old?.items ?? []).slice();
              const idx = items.findIndex((it: any) => it.pair === msg.pair);
              if (idx >= 0) {
                items[idx] = msg.item;
              } else {
                items.push(msg.item);
              }
              return { items };
            });
          }
        } catch {
          // ignore
        }
      });
      return () => {
        try { ws.close(); } catch {}
        wsRef.current = null;
      };
    } catch {
      return;
    }
  }, [pairsKey, pairs.join(",")]);

  // Only claim "Live" when the newest D1 bar is actually recent; otherwise the feed
  // is delayed (e.g. Dukascopy lags ~1 day) and a pulsing badge would be dishonest.
  const freshness = useMemo(() => watchlistFreshness(data?.items ?? [], Date.now()), [data]);
  const lastUpdated = freshness.latestBarMs !== null ? new Date(freshness.latestBarMs).toLocaleString() : undefined;

  return (
    <Card className="relative overflow-hidden">
      <WidgetHeader
        icon={<Activity className="h-3.5 w-3.5" />}
        iconTone="accent"
        title={uiText("auto.ui.b97144823c")}
        subtitle={uiText("tradingview.watchlist.subtitle")}
        action={
          <div className="flex items-center gap-2">
            {freshness.isLive ? (
              <span
                title={lastUpdated}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-primary"
              >
                <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
                {uiText("tradingview.watchlist.live")}
              </span>
            ) : (
              <span
                title={lastUpdated}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
              >
                <span className="h-[5px] w-[5px] rounded-full bg-muted-foreground/60" />
                {uiText("tradingview.watchlist.delayed")}
              </span>
            )}
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
        <div className="space-y-1.5 overflow-x-hidden">
          {pairs.map((pair) => (
            <WatchlistRow
              key={pair}
              pair={pair}
              item={itemByPair.get(pair)}
              loading={isLoading}
              target={isMobile ? "_self" : "_blank"}
            />
          ))}
        </div>

        {isError && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <span>{uiText("tradingview.watchlist.error")}</span>
            <button
              type="button"
              onClick={() => refetch()}
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
