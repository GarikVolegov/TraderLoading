import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { WidgetHeader } from "@/components/ui/WidgetHeader";
import { FileText, Loader2, AlertCircle, RefreshCw, X } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, ReferenceLine, Tooltip, CartesianGrid, XAxis } from "recharts";
import { useBackground } from "@/contexts/BackgroundContext";
import { apiFetch } from "@/lib/apiFetch";
import { deriveEffectiveFilterItems } from "@/lib/toolPairFilters";
import { uiText } from "@/contexts/LanguageContext";
import { cotBarWidth } from "./CotWidget.helpers";

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
    <Card className="relative overflow-hidden bg-card/88 backdrop-blur-sm border-border/60 flex flex-col">
      <WidgetHeader
        icon={<FileText className="h-4 w-4" />}
        iconTone="primary"
        title={uiText("cot.report_title")}
        action={
          <>
            {data?.fallback && (
              <span className="text-[9px] text-warning bg-warning/10 border border-warning/20 px-1.5 py-0.5 rounded-full">{uiText("auto.ui.aaded9e59f")}</span>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-1 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
            </button>
          </>
        }
      />

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

            <div className="flex justify-between px-9.5 text-[9px] font-bold uppercase tracking-[0.08em]">
              <span className="text-destructive">{"◂ "}{uiText("cot.legend.short")}</span>
              <span className="text-success">{uiText("cot.legend.long")}{" ▸"}</span>
            </div>

            <div className="flex flex-col gap-2">
              {(() => {
                const maxAbs = Math.max(1, ...filteredReports.map((r) => Math.abs(r.nonCommNet)));
                return filteredReports.map((r) => {
                  const long = r.nonCommNet >= 0;
                  const isSelected = selected?.currency === r.currency;
                  const width = cotBarWidth(r.nonCommNet, maxAbs) / 2;
                  return (
                    <button
                      key={r.currency}
                      onClick={() => setSelected(isSelected ? null : r)}
                      className={`flex items-center gap-2 rounded-md px-1 py-1 transition-colors ${
                        isSelected ? "bg-primary/10" : "hover:bg-secondary/40"
                      }`}
                    >
                      <span className="w-8 text-left font-mono text-xs font-bold text-foreground">{r.currency}</span>
                      <span className="relative h-4.5 flex-1 overflow-hidden rounded-[5px] bg-secondary/50">
                        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
                        <span
                          className={`absolute top-0.5 bottom-0.5 rounded ${long ? "left-1/2 bg-success" : "right-1/2 bg-destructive"}`}
                          style={{ width: `${width}%` }}
                        />
                      </span>
                      <span className={`w-10 text-right font-mono text-xs font-bold ${long ? "text-success" : "text-destructive"}`}>
                        {long ? "+" : ""}
                        {(r.nonCommNet / 1000).toFixed(0)}k
                      </span>
                    </button>
                  );
                });
              })()}
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
                  <div className="p-3 rounded-xl border border-border/60 bg-secondary/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-sm">{selected.currency}</span>
                        <span className="text-[10px] text-muted-foreground">Report: {selected.date}</span>
                      </div>
                      <button
                        onClick={() => setSelected(null)}
                        aria-label={uiText("common.close")}
                        title={uiText("common.close")}
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
                        <div key={item.label} className="p-1.5 rounded-lg bg-secondary/55 border border-border/60">
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
                                <stop offset="5%" stopColor={selected.nonCommNet >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={selected.nonCommNet >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.45} vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} interval={Math.floor(selected.history.length / 3)} />
                            <Tooltip
                              contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--popover-foreground))", fontSize: "10px", boxShadow: "0 14px 36px rgba(0,0,0,0.5)" }}
                              labelStyle={{ color: "hsl(var(--popover-foreground))", fontWeight: 700 }}
                              itemStyle={{ color: "hsl(var(--popover-foreground))", fontWeight: 700 }}
                              formatter={(v: number) => [`${(v / 1000).toFixed(0)}k`, "Non-Comm Net"]}
                            />
                            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 2" strokeOpacity={0.65} />
                            <Area
                              type="monotone"
                              dataKey="nonCommNet"
                              stroke={selected.nonCommNet >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"}
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
                Aggiornato {new Date(data.fetchedAt).toLocaleDateString("it-IT")} · ogni venerdì
              </p>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
