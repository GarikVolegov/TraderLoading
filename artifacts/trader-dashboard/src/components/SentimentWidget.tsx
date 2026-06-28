import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Gauge } from "@/components/ui/Gauge";
import { WidgetHeader } from "@/components/ui/WidgetHeader";
import { Activity, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useBackground } from "@/contexts/BackgroundContext";
import { apiFetch } from "@/lib/apiFetch";
import { deriveEffectiveFilterItems } from "@/lib/toolPairFilters";
import { uiText } from "@/contexts/LanguageContext";

interface SentimentSymbol {
  name: string;
  longPercentage: number;
  shortPercentage: number;
  longPositions: number;
  shortPositions: number;
}

export function SentimentWidget() {
  const { selectedPairs: userPairs } = useBackground();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["widget", "sentiment"],
    queryFn: () => apiFetch<{ symbols: SentimentSymbol[]; live?: boolean; fallback?: boolean; hasCredentials?: boolean }>("/api/tools/sentiment"),
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });

  const sentimentFilter = useMemo(
    () =>
      deriveEffectiveFilterItems({
        requestedItems: userPairs,
        supportedItems: data?.symbols?.map((symbol) => symbol.name) ?? [],
        defaultItems: data?.symbols?.slice(0, 6).map((symbol) => symbol.name) ?? [],
      }),
    [data?.symbols, userPairs],
  );

  const sortedSymbols = useMemo(() => {
    if (!data?.symbols) return [];
    const selectedSet = new Set(sentimentFilter.items);
    return data.symbols.filter((symbol) => selectedSet.has(symbol.name)).slice(0, 6);
  }, [data?.symbols, sentimentFilter.items]);

  const avgLong = sortedSymbols.length
    ? sortedSymbols.reduce((s, sym) => s + sym.longPercentage, 0) / sortedSymbols.length
    : 50;

  const avgBias = avgLong >= 55 ? "Long" : avgLong <= 45 ? "Short" : "Neutro";
  const avgBiasClass =
    avgBias === "Long"
      ? "text-success"
      : avgBias === "Short"
        ? "text-destructive"
        : "text-warning";

  return (
    <Card className="relative overflow-hidden flex flex-col bg-card/60 backdrop-blur-sm border-border/30">
      <WidgetHeader
        icon={<Activity className="h-4 w-4" />}
        iconTone="warning"
        title={uiText("auto.ui.52bfe34c30")}
        action={
          <div className="flex items-center gap-1.5">
            {data?.live && (
              <span className="inline-flex items-center gap-1 text-[9px] text-success">
                <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                LIVE
              </span>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        }
      />

      <CardContent className="p-4 space-y-3 flex-1">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        )}
        {isError && (
          <div className="flex items-center gap-2 text-xs text-destructive py-4">
            <AlertCircle className="w-4 h-4 shrink-0" /> Dati non disponibili
          </div>
        )}

        {data?.symbols && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="flex flex-col items-center gap-1">
              <Gauge value={avgLong} width={150} />
              <span className={`text-xs font-semibold font-mono ${avgBiasClass}`}>
                {avgBias}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {sentimentFilter.items.map((pair) => (
                <span key={pair} className="px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold bg-primary/10 text-primary border border-primary/25">
                  {pair}
                </span>
              ))}
              {sentimentFilter.hasUserSelection && sentimentFilter.unsupportedItems.length > 0 && (
                <span className="text-[9px] text-muted-foreground">
                  {sentimentFilter.supportedCount}/{sentimentFilter.requestedCount} supportati
                </span>
              )}
            </div>

            <div className="space-y-2">
              {sortedSymbols.map((sym) => {
                const bias = sym.longPercentage >= 55 ? "Long" : sym.shortPercentage >= 55 ? "Short" : "Neutro";

                return (
                  <div key={sym.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold">{sym.name}</span>
                        <span className={`text-[9px] font-semibold px-1 py-0.5 rounded-md ${
                          bias === "Long"  ? "bg-primary/10 text-primary" :
                          bias === "Short" ? "bg-destructive/10 text-destructive" :
                                            "bg-secondary text-muted-foreground"
                        }`}>{bias}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[9px] font-mono font-bold">
                        <span className="text-primary">▲ {sym.longPercentage.toFixed(0)}%</span>
                        <span className="text-destructive">▼ {sym.shortPercentage.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-destructive/20 overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${sym.longPercentage}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {!data.hasCredentials && (
              <p className="text-[9px] text-warning/70 text-center">
                Dati dimostrativi · configura MYFXBOOK_EMAIL/PASSWORD
              </p>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
