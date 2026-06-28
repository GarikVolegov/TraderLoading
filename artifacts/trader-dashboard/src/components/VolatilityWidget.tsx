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

interface VolatilityResult {
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

const ALL_VOL_PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD", "EURGBP", "EURJPY", "GBPJPY", "XAUUSD", "XAGUSD"];

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

export function VolatilityWidget() {
  const { selectedPairs: userPairs } = useBackground();

  const volatilityFilter = useMemo(
    () =>
      deriveEffectiveFilterItems({
        requestedItems: userPairs,
        supportedItems: ALL_VOL_PAIRS,
        defaultItems: ALL_VOL_PAIRS,
      }),
    [userPairs],
  );

  const displayPairs = volatilityFilter.items.slice(0, MAX_TILES);

  const results = useQueries({
    queries: displayPairs.map((pair) => ({
      queryKey: ["widget", "volatility", pair],
      queryFn: () => apiFetch<VolatilityResult>(`/api/tools/volatility?pair=${pair}`),
      staleTime: 15 * 60_000,
      refetchInterval: 15 * 60_000,
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
            {volatilityFilter.supportedCount}/{volatilityFilter.requestedCount}
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
            const pct = data ? adrPercentUsed(data.todayPips, data.y1) : 0;
            const level = adrLevel(pct);
            return (
              <div
                key={pair}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border/40 bg-secondary/35 px-2 py-3"
              >
                {q?.isError ? (
                  <div className="flex h-18.5 w-18.5 items-center justify-center text-muted-foreground">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                ) : (
                  <ProgressRing value={pct} size={74} stroke={7} tone={level.tone}>
                    <span className="font-mono text-base font-bold tabular-nums text-foreground">
                      {q?.isLoading ? "--" : pct}
                    </span>
                    <span className="text-[8px] text-muted-foreground">%</span>
                  </ProgressRing>
                )}
                <span className="font-mono text-xs font-bold text-foreground">{pair}</span>
                <span className={`text-[9px] font-bold uppercase tracking-[0.04em] ${TONE_TEXT_CLASS[level.tone]}`}>
                  {uiText(LEVEL_LABEL_KEY[level.key])}
                </span>
              </div>
            );
          })}
        </motion.div>
      </CardContent>
    </Card>
  );
}
