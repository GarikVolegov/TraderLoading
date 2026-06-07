import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileText, ArrowRight, Loader2, AlertCircle, ArrowUp, ArrowDown, RefreshCw, X } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, ReferenceLine, Tooltip, CartesianGrid, XAxis } from "recharts";
import { useBackground } from "@/contexts/BackgroundContext";
import { apiFetch } from "@/lib/apiFetch";
import { deriveEffectiveFilterItems } from "@/lib/toolPairFilters";

interface CotReport {
  market: string;
  currency: string;
  date: string;
  nonCommLong: number;
  nonCommShort: number;
  commLong: number;
  commShort: number;
  retailLong: number;
  retailShort: number;
  nonCommNet: number;
  commNet: number;
  retailNet: number;
  history: { date: string; nonCommNet: number; commNet: number }[];
}

export function CotWidget() {
  const { selectedCurrencies } = useBackground();
  const [selected, setSelected] = useState<CotReport | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["widget", "cot"],
    queryFn: () => apiFetch<{ reports: CotReport[]; cached?: boolean; fallback?: boolean; fetchedAt?: string; nextUpdate?: string }>("/api/tools/cot"),
    staleTime: 60 * 60_000,
    refetchInterval: 60 * 60_000,
  });

  const cotFilter = useMemo(
    () =>
      deriveEffectiveFilterItems({
        requestedItems: selectedCurrencies,
        supportedItems: data?.reports?.map((report) => report.currency) ?? [],
        defaultItems: data?.reports?.map((report) => report.currency) ?? [],
      }),
    [data?.reports, selectedCurrencies],
  );

  const filteredReports = useMemo(() => {
    if (!data?.reports) return [];
    const userCurrSet = new Set(cotFilter.items);
    return data.reports.filter((r) => userCurrSet.has(r.currency));
  }, [cotFilter.items, data?.reports]);

  return (
    <Card className="relative overflow-hidden bg-card/60 backdrop-blur-sm border-border/30 flex flex-col">
      <CardHeader className="pb-3 px-4 pt-4 border-b border-border/30">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileText className="w-4 h-4 text-primary" />
          COT Report
          {data?.fallback && (
            <span className="text-[9px] text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded-full">Esempio</span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-1 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
            </button>
            <Link href="/tools">
              <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors">
                Dettaglio <ArrowRight className="w-3 h-3" />
              </button>
            </Link>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 space-y-3 flex-1">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        )}
        {isError && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Dati non disponibili
          </div>
        )}

        {data?.reports && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {cotFilter.items.map((currency) => (
                <span key={currency} className="px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold bg-primary/10 text-primary border border-primary/25">
                  {currency}
                </span>
              ))}
              {cotFilter.hasUserSelection && cotFilter.unsupportedItems.length > 0 && (
                <span className="text-[9px] text-muted-foreground">
                  {cotFilter.supportedCount}/{cotFilter.requestedCount} valute supportate
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {filteredReports.map((r) => {
                const trend =
                  r.history.length >= 2
                    ? r.nonCommNet - (r.history[r.history.length - 2]?.nonCommNet ?? r.nonCommNet)
                    : 0;
                const isSelected = selected?.currency === r.currency;
                return (
                  <button
                    key={r.currency}
                    onClick={() => setSelected(isSelected ? null : r)}
                    className={`p-2 rounded-xl border text-center transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-secondary/30 hover:border-primary/30"
                    }`}
                  >
                    <p className="text-xs font-bold font-mono">{r.currency}</p>
                    <p className={`text-[10px] font-semibold mt-0.5 ${r.nonCommNet >= 0 ? "text-primary" : "text-destructive"}`}>
                      {r.nonCommNet >= 0 ? "+" : ""}
                      {(r.nonCommNet / 1000).toFixed(0)}k
                    </p>
                    {trend !== 0 && (
                      <p className={`text-[9px] flex items-center justify-center gap-0.5 mt-0.5 ${trend > 0 ? "text-primary/70" : "text-destructive/70"}`}>
                        {trend > 0 ? <ArrowUp className="w-2 h-2" /> : <ArrowDown className="w-2 h-2" />}
                        {Math.abs(trend / 1000).toFixed(0)}k
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            <AnimatePresence>
              {selected && (
                <motion.div
                  key={selected.currency}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 rounded-xl border border-border bg-secondary/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-sm">{selected.currency}</span>
                        <span className="text-[10px] text-muted-foreground">Report: {selected.date}</span>
                      </div>
                      <button
                        onClick={() => setSelected(null)}
                        className="p-0.5 rounded hover:bg-secondary/80 text-muted-foreground"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      {[
                        { label: "Non-Comm", net: selected.nonCommNet, color: selected.nonCommNet >= 0 ? "text-primary" : "text-destructive" },
                        { label: "Comm.", net: selected.commNet, color: selected.commNet >= 0 ? "text-primary" : "text-destructive" },
                        { label: "Retail", net: selected.retailNet, color: selected.retailNet >= 0 ? "text-primary" : "text-destructive" },
                      ].map((item) => (
                        <div key={item.label} className="p-1.5 rounded-lg bg-secondary/40 border border-border">
                          <p className="text-[9px] text-muted-foreground">{item.label}</p>
                          <p className={`text-xs font-bold font-mono ${item.color}`}>
                            {item.net >= 0 ? "+" : ""}
                            {(item.net / 1000).toFixed(0)}k
                          </p>
                        </div>
                      ))}
                    </div>

                    {selected.history.length > 1 && (
                      <div className="h-24">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={selected.history} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                            <defs>
                              <linearGradient id={`cotWidGrad-${selected.currency}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={selected.nonCommNet >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={selected.nonCommNet >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 8, fill: "#666" }} interval={Math.floor(selected.history.length / 3)} />
                            <Tooltip
                              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "10px" }}
                              formatter={(v: number) => [`${(v / 1000).toFixed(0)}k`, "Non-Comm Net"]}
                            />
                            <ReferenceLine y={0} stroke="#555" strokeDasharray="3 2" />
                            <Area
                              type="monotone"
                              dataKey="nonCommNet"
                              stroke={selected.nonCommNet >= 0 ? "#22c55e" : "#ef4444"}
                              strokeWidth={1.5}
                              fill={`url(#cotWidGrad-${selected.currency})`}
                              dot={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {data.fetchedAt && (
              <p className="text-[9px] text-center text-muted-foreground">
                CFTC · {new Date(data.fetchedAt).toLocaleDateString("it-IT")} · aggiornato ogni venerdì
              </p>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
