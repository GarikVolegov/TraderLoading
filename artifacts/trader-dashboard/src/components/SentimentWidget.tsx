import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, ArrowRight, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useBackground } from "@/contexts/BackgroundContext";
import { apiFetch } from "@/lib/apiFetch";
import { deriveEffectiveFilterItems } from "@/lib/toolPairFilters";

interface SentimentSymbol {
  name: string;
  longPercentage: number;
  shortPercentage: number;
  longPositions: number;
  shortPositions: number;
}

function FearGreedArc({ score }: { score: number }) {
  const zones = [
    { label: "Panico",    min: 0,  max: 30,  color: "#ef4444" },
    { label: "Paura",     min: 30, max: 45,  color: "#f97316" },
    { label: "Neutrale",  min: 45, max: 55,  color: "#eab308" },
    { label: "Ottimismo", min: 55, max: 70,  color: "#84cc16" },
    { label: "Euforia",   min: 70, max: 100, color: "#22c55e" },
  ];
  const zone = zones.find(z => score >= z.min && score < z.max) ?? zones[2];
  const clamp = Math.min(Math.max(score, 2), 98);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground/50">😱 Panico</span>
        <span className="text-xs font-bold font-mono tabular-nums" style={{ color: zone.color }}>
          {zone.label} · {score.toFixed(0)}%
        </span>
        <span className="text-[9px] text-muted-foreground/50">😄 Euforia</span>
      </div>

      <div className="relative h-6 rounded-lg overflow-hidden">
        {/* Gradient background */}
        <div
          className="absolute inset-0 opacity-20 rounded-lg"
          style={{ background: "linear-gradient(to right, #ef4444, #f97316, #eab308, #84cc16, #22c55e)" }}
        />
        {/* Wave SVG */}
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="sg2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#ef4444" />
              <stop offset="30%"  stopColor="#f97316" />
              <stop offset="50%"  stopColor="#eab308" />
              <stop offset="70%"  stopColor="#84cc16" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          <path
            d="M0,18 C60,6 120,18 200,10 S300,4 400,13 S520,22 640,11 S780,3 1024,14 L1024,24 L0,24 Z"
            fill="url(#sg2)" opacity={0.3}
          />
        </svg>
        {/* Marker */}
        <div
          className="absolute top-0 bottom-0 flex items-center"
          style={{ left: `calc(${clamp}% - 5px)` }}
        >
          <div
            className="w-2.5 h-2.5 rounded-full border-2 border-background"
            style={{ backgroundColor: zone.color, boxShadow: `0 0 6px ${zone.color}` }}
          />
        </div>
      </div>
    </div>
  );
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

  return (
    <Card className="relative overflow-hidden flex flex-col bg-card/60 backdrop-blur-sm border-border/30">
      {/* Header */}
      <div className="widget-header">
        <div className="flex items-center gap-2.5">
          <div className="widget-icon bg-primary/10 border border-primary/20">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="widget-title">Sentiment</p>
            {data?.live && (
              <span className="inline-flex items-center gap-1 text-[9px] text-green-400">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                LIVE
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
          <Link href="/tools">
            <span className="link-pill">
              Dettaglio <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
        </div>
      </div>

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
            <FearGreedArc score={avgLong} />

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
                const bias      = sym.longPercentage >= 55 ? "Long" : sym.shortPercentage >= 55 ? "Short" : "Neutro";
                const biasColor = bias === "Long" ? "text-primary" : bias === "Short" ? "text-destructive" : "text-muted-foreground";

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
              <p className="text-[9px] text-amber-400/70 text-center">
                Dati dimostrativi · configura MYFXBOOK_EMAIL/PASSWORD
              </p>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
