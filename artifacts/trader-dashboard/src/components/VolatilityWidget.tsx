import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp, Loader2, AlertCircle,
  ChevronDown, ArrowUp, ArrowDown, RefreshCw,
} from "lucide-react";
import { BarChart, Bar, Cell, ResponsiveContainer, ReferenceLine, Tooltip } from "recharts";
import { useBackground } from "@/contexts/BackgroundContext";
import { apiFetch } from "@/lib/apiFetch";
import { deriveEffectiveFilterItems } from "@/lib/toolPairFilters";

interface VolatilityResult {
  pair: string; currentPrice: number; todayPips: number;
  w1: number; m1: number; m3: number; m6: number; y1: number;
  w1Pct: number | null; label: string; peakDay: string; pipUnit: string;
  last30: Array<{ day: number; date: string; weekday: string; pips: number }>;
}

const ALL_VOL_PAIRS = ["EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","USDCAD","NZDUSD","EURGBP","EURJPY","GBPJPY","XAUUSD","XAGUSD"];

export function VolatilityWidget() {
  const { selectedPairs: userPairs } = useBackground();
  const [open, setOpen] = useState(false);

  const volatilityFilter = useMemo(
    () =>
      deriveEffectiveFilterItems({
        requestedItems: userPairs,
        supportedItems: ALL_VOL_PAIRS,
        defaultItems: ALL_VOL_PAIRS,
      }),
    [userPairs],
  );

  const volPairs = volatilityFilter.items;

  const [selectedPair, setSelectedPair] = useState(volPairs[0] || "EURUSD");
  const defaultAppliedRef = useRef(false);

  useEffect(() => {
    if (userPairs.length > 0 && !defaultAppliedRef.current) {
      defaultAppliedRef.current = true;
      if (volPairs.length > 0) setSelectedPair(volPairs[0]);
    } else if (volPairs.length > 0 && !volPairs.includes(selectedPair)) {
      setSelectedPair(volPairs[0]);
    }
  }, [volPairs, selectedPair, userPairs]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["widget", "volatility", selectedPair],
    queryFn: () => apiFetch<VolatilityResult>(`/api/tools/volatility?pair=${selectedPair}`),
    staleTime: 15 * 60_000,
    refetchInterval: 15 * 60_000,
  });

  const periods = data
    ? [
        { short: "1W", value: data.w1 },
        { short: "1M", value: data.m1 },
        { short: "3M", value: data.m3 },
        { short: "6M", value: data.m6 },
        { short: "1Y", value: data.y1 },
      ]
    : [];

  const last10 = data?.last30.slice(-10) ?? [];

  return (
    <Card className="volatility-contrast-card relative overflow-hidden bg-card/80 backdrop-blur-sm border-border/60 flex flex-col">
      {/* Header */}
      <div className="widget-header">
        <div className="flex items-center gap-2.5">
          <div className="widget-icon bg-warning/10 border border-warning/20">
            <TrendingUp className="w-4 h-4 text-warning" />
          </div>
          <div>
            <p className="widget-title">Volatilità & ADR</p>
            {data && (
              <p className="widget-subtitle">
                <span className={`font-semibold ${
                  data.label.includes("Alta")  ? "text-red-300" :
                  data.label.includes("Bassa") ? "text-sky-300"   : "text-emerald-300"
                }`}>{data.label}</span>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 rounded-lg hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <CardContent className="p-4 space-y-3 flex-1">
        {/* Pair selector */}
        <div className="relative inline-block">
          <button
            onClick={() => setOpen(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/50 bg-secondary/40 hover:bg-secondary/70 text-xs font-mono font-bold transition-all"
          >
            {selectedPair}
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full mt-1 left-0 z-30 bg-card border border-border/50 rounded-xl shadow-2xl overflow-hidden min-w-[110px] max-h-48 overflow-y-auto"
              >
                {volPairs.map(p => (
                  <button
                    key={p}
                    onClick={() => { setSelectedPair(p); setOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-secondary/60 transition-colors ${
                      p === selectedPair ? "text-primary bg-primary/8 font-bold" : ""
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {volatilityFilter.hasUserSelection && volatilityFilter.unsupportedItems.length > 0 && (
          <p className="text-[9px] text-muted-foreground">
            {volatilityFilter.supportedCount}/{volatilityFilter.requestedCount} pair supportati
          </p>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        )}
        {isError && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" /> Dati non disponibili
          </div>
        )}

        {data && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {/* Metric cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="metric-card border-emerald-400/40 bg-emerald-500/12">
                <span className="metric-label text-emerald-200">Oggi</span>
                <span className="metric-value text-emerald-300">{data.todayPips}</span>
                <span className="metric-unit">{data.pipUnit}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Media 1Y</span>
                <span className="metric-value">{data.y1}</span>
                <span className="metric-unit">{data.pipUnit}</span>
              </div>
              <div className="metric-card">
                <span className="metric-label">Peak</span>
                <span className="metric-value">{data.peakDay?.slice(0, 3)}</span>
                <span className="metric-unit">giorno</span>
              </div>
            </div>

            {/* Period table */}
            <div className="rounded-xl border border-border/40 overflow-hidden">
              <div className="grid grid-cols-5 bg-secondary/50 border-b border-border/30">
                {periods.map(p => (
                  <div key={p.short} className="py-1.5 text-center text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                    {p.short}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-5">
                {periods.map(p => {
                  const ratio = data.y1 > 0 ? p.value / data.y1 : 1;
                  const pipColor = ratio > 1.25 ? "text-red-300" : ratio < 0.75 ? "text-sky-300" : "text-emerald-300";
                  const volPct = p.short !== "1Y" ? Math.abs((ratio - 1) * 100) : null;
                  const volUp = ratio > 1;
                  return (
                    <div key={p.short} className="py-2 flex flex-col items-center border-r border-border/20 last:border-r-0">
                      <span className={`text-xs font-bold font-mono ${pipColor}`}>{p.value}</span>
                      {volPct != null && (
                        <span className={`text-[9px] flex items-center gap-0.5 mt-0.5 font-semibold ${volUp ? "text-red-300" : "text-sky-300"}`}>
                          {volUp ? <ArrowUp className="w-2 h-2" /> : <ArrowDown className="w-2 h-2" />}
                          {volPct.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bar chart */}
            <div>
              <p className="text-[9px] text-muted-foreground mb-1.5">Ultimi 10 giorni</p>
              <div className="h-[72px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={last10} barSize={10} margin={{ top: 2, right: 0, left: -30, bottom: 0 }}>
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--popover-foreground))", fontSize: "10px", padding: "4px 8px", boxShadow: "0 14px 36px rgba(0,0,0,0.5)" }}
                      labelStyle={{ color: "hsl(var(--popover-foreground))", fontWeight: 700 }}
                      itemStyle={{ color: "hsl(var(--popover-foreground))", fontWeight: 700 }}
                      cursor={{ fill: "hsl(var(--foreground) / 0.06)" }}
                      formatter={(v: number) => [`${v} ${data.pipUnit}`, ""]}
                      labelFormatter={() => ""}
                    />
                    <ReferenceLine y={data.y1} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 2" strokeOpacity={0.65} />
                    <Bar dataKey="pips" radius={[3, 3, 0, 0]}>
                      {last10.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            entry.pips > data.y1 * 1.25 ? "#f87171" :
                            entry.pips < data.y1 * 0.75 ? "#7dd3fc" : "#34d399"
                          }
                          fillOpacity={0.95}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <p className="text-[9px] text-center text-muted-foreground">Range giornaliero H-L</p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
