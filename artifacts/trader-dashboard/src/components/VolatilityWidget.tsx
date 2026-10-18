import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { TrendingUp, AlertCircle, RefreshCw } from "lucide-react";
import { useBackground } from "@/contexts/BackgroundContext";
import { apiFetch } from "@/lib/apiFetch";
import { deriveEffectiveFilterItems } from "@/lib/toolPairFilters";
import { uiText } from "@/contexts/LanguageContext";
import { adrPercentUsed, adrLevel, type AdrLevelKey } from "./VolatilityWidget.helpers";

import { MarketDataStatus, type MarketDataMetadata } from "./MarketDataStatus";

interface VolatilityResult extends MarketDataMetadata {
  pair: string;
  currentPrice: number;
  todayPips: number;
  w1: number;
  m1: number;
  m3: number;
  m6: number;
  y1: number;
  label: string;
  peakDay: string;
  pipUnit: string;
}

const ALL_VOL_PAIRS = [
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
  "XAUUSD",
  "XAGUSD",
  "USDMXN",
  "USDZAR",
];

// Bound the number of concurrent /api/tools/volatility calls (Yahoo can throttle).
const MAX_TILES = 8;

const LEVEL_LABEL_KEY: Record<AdrLevelKey, string> = {
  exhausted: "vol.adr.exhausted",
  elevated: "vol.adr.elevated",
  room: "vol.adr.room",
};

const TONE_TEXT_CLASS: Record<"destructive" | "warning" | "success", string> = {
  destructive: "text-destructive",
  warning: "text-warning",
  success: "text-success",
};

export function VolatilityWidget({ pair }: { pair?: string } = {}) {
  const { selectedPairs: userPairs, settingsLoaded } = useBackground();

  const volatilityFilter = useMemo(
    () =>
      deriveEffectiveFilterItems({
        requestedItems: pair ? [pair] : userPairs,
        supportedItems: ALL_VOL_PAIRS,
        defaultItems: ALL_VOL_PAIRS,
      }),
    [userPairs, pair],
  );

  const displayPairs = settingsLoaded ? volatilityFilter.items.slice(0, MAX_TILES) : [];

  const results = useQueries({
    queries: displayPairs.map((pair) => ({
      queryKey: ["widget", "volatility", pair],
      queryFn: () => apiFetch<VolatilityResult>(`/api/tools/volatility?pair=${pair}`),
      staleTime: 15 * 60_000,
      refetchInterval: (query: { state: { data?: VolatilityResult } }) =>
        query.state.data ? 15 * 60_000 : 10_000,
    })),
  });

  const anyFetching = results.some((r) => r.isFetching);
  const refetchAll = () => results.forEach((r) => void r.refetch());

  return (
    <Card className="volatility-contrast-card relative overflow-hidden bg-card/80 backdrop-blur-sm border-border/60 flex flex-col">
      <div className="widget-header">
        <div className="flex items-center gap-2.5">
          <div className="widget-icon bg-warning/10 border border-warning/20">
            <TrendingUp className="w-4 h-4 text-warning" />
          </div>
          <div>
            <p className="widget-title">{uiText("auto.ui.de8919508a")}</p>
            <p className="widget-subtitle">{uiText("vol.adr.subtitle")}</p>
          </div>
        </div>
        <button
          onClick={refetchAll}
          disabled={anyFetching}
          className="p-1.5 rounded-lg hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={uiText("auto.ui.f360775cb8")}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${anyFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      <CardContent className="p-4 space-y-3 flex-1">
        {volatilityFilter.hasUserSelection && volatilityFilter.unsupportedItems.length > 0 && (
          <p className="text-[9px] text-muted-foreground tabular-nums">
            {uiText("market.unsupported", {
              symbols: volatilityFilter.unsupportedItems.join(", "),
            })}
          </p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-2.5"
        >
          {displayPairs.map((pair, i) => {
            const q = results[i];
            const data = q?.data;
            const pct =
              data && data.status !== "unavailable"
                ? adrPercentUsed(data.todayPips, data.y1)
                : null;
            const stale = data?.status === "stale" || Boolean(q?.isError && data);
            const level = pct !== null && !stale ? adrLevel(pct) : null;
            return (
              <div
                key={pair}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border/40 bg-secondary/35 px-2 py-3"
              >
                {pct === null ? (
                  <div
                    className="flex h-18.5 w-18.5 items-center justify-center text-muted-foreground"
                    role="status"
                  >
                    {q?.isLoading ? (
                      <span>{uiText("market.loading")}</span>
                    ) : (
                      <AlertCircle className="w-5 h-5" aria-label={uiText("market.unavailable")} />
                    )}
                  </div>
                ) : (
                  <ProgressRing value={pct} size={74} stroke={7} tone={level?.tone ?? "warning"}>
                    <span className="font-mono text-base font-bold tabular-nums text-foreground">
                      {pct}
                    </span>
                    <span className="text-[8px] text-muted-foreground">%</span>
                  </ProgressRing>
                )}
                <span className="font-mono text-xs font-bold text-foreground">{pair}</span>
                <span
                  className={`text-xs text-center ${level ? TONE_TEXT_CLASS[level.tone] : "text-muted-foreground"}`}
                >
                  {level
                    ? uiText(LEVEL_LABEL_KEY[level.key])
                    : uiText(
                        q?.isLoading
                          ? "market.loading"
                          : stale
                            ? "market.stale"
                            : "market.unavailable",
                      )}
                </span>
                {data && pct !== null && (
                  <details className="w-full text-xs text-muted-foreground">
                    <summary className="cursor-pointer text-center">
                      {uiText("market.source", { source: data.source ?? "—" })}
                    </summary>
                    <MarketDataStatus data={data} stale={stale} />
                  </details>
                )}
              </div>
            );
          })}
        </motion.div>
      </CardContent>
    </Card>
  );
}
