import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, BarChart, Bar, Cell, ReferenceLine, Legend,
} from "recharts";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  TrendingUp, TrendingDown, Activity, BarChart2, BarChart3, FileText, Newspaper, FlaskConical,
  RefreshCw, ChevronDown, AlertCircle, Loader2, Filter,
  ArrowUp, ArrowDown, Minus, Plus, Trash2, ArrowLeft, Play,
} from "lucide-react";
import { LotCalculatorWidget } from "@/components/LotCalculatorWidget";
import ChartReplay from "@/components/ChartReplay";
import {
  createReplaySavedTradeIdsStorageKey,
  parseReplaySavedTradeIds,
  serializeReplaySavedTradeIds,
} from "@/components/chartReplayPersistence";
import { API_BASE as API, apiFetch } from "@/lib/apiFetch";
import { calculateBacktestStats } from "@/lib/backtestStats";
import { calculateManualBacktestTradeResult } from "@/lib/backtestTradeResult";
import { useToast } from "@/hooks/use-toast";
import { useBackground } from "@/contexts/BackgroundContext";
import { getPairLabel } from "@workspace/pair-catalog";
import { deriveEffectiveFilterItems, type EffectiveFilterItems } from "@/lib/toolPairFilters";
import {
  useGetBacktestSessions,
  useCreateBacktestSession,
  useDeleteBacktestSession,
  getGetBacktestSessionsQueryKey,
  useGetBacktestTrades,
  useCreateBacktestTrade,
  useDeleteBacktestTrade,
  getGetBacktestTradesQueryKey,
  type BacktestSession,
} from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { useLanguage, useDateLocale } from "@/contexts/LanguageContext";

const TOOL_TAB_IDS = ["montecarlo", "sentiment", "volatility", "cot", "backtest", "lot"] as const;
type ToolTabId = (typeof TOOL_TAB_IDS)[number];

function getInitialToolTab(): ToolTabId {
  const requested = new URLSearchParams(window.location.search).get("tab");
  return TOOL_TAB_IDS.includes(requested as ToolTabId) ? (requested as ToolTabId) : "montecarlo";
}

// ─── API fetch helpers ─────────────────────────────────────────────────────────
// ─── Types ─────────────────────────────────────────────────────────────────────
interface MonteCarloResult {
  simulations: number[][];
  stats: {
    median: number;
    percentile10: number;
    percentile90: number;
    ruinProbability: string;
    avgReturnPercent: string;
    initialBalance: number;
  };
}

interface SentimentSymbol {
  name: string;
  longPercentage: number;
  shortPercentage: number;
  longPositions: number;
  shortPositions: number;
  longVolume: number;
  shortVolume: number;
}

interface VolatilityResult {
  pair: string;
  currentPrice: number;
  todayPips: number;
  w1: number;
  m1: number;
  m3: number;
  m6: number;
  y1: number;
  w1Pct: number | null;
  m1Pct: number | null;
  m3Pct: number | null;
  m6Pct: number | null;
  y1Pct: number | null;
  label: string;
  peakDay: string;
  pipUnit: string;
  last30: Array<{ day: number; date: string; weekday: string; pips: number }>;
  dataPoints: Array<{ day: number; value: number }>;
  daily5: number;
  daily21: number;
  daily63: number;
  dailyAll: number;
}

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

interface MacroArticle {
  title: string;
  summary: string;
  impact: "alto" | "medio" | "basso";
  currency: string;
  direction: "bullish" | "bearish" | "neutrale";
  source?: string;
  sources?: string[];
  citationUrls?: string[];
  verified?: boolean;
  category?: string;
  timestamp?: string;
  imageUrl?: string | null;
}

interface MacroNewsResult {
  articles: MacroArticle[];
  sentiment: string;
  summary: string;
  citationUrls?: string[];
}

// ─── Error Card ────────────────────────────────────────────────────────────────
function ErrorCard({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
      <AlertCircle className="w-5 h-5 flex-shrink-0" />
      {message}
    </div>
  );
}

function LoadingCard() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm">{t("tools.loading")}</p>
    </div>
  );
}

function ReadOnlyToolFilterPanel({
  open,
  title,
  items,
  summary,
  note,
}: {
  open: boolean;
  title: string;
  items: string[];
  summary?: string;
  note?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="p-3 rounded-xl border border-border bg-secondary/20 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
              {summary && <span className="text-[11px] text-muted-foreground">{summary}</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {items.map((item) => (
                <span key={item} className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold border bg-primary/10 text-primary border-primary/30">
                  {item}
                </span>
              ))}
            </div>
            {note && <p className="text-[11px] text-muted-foreground leading-relaxed">{note}</p>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function formatFilterSummary(filter: EffectiveFilterItems): string {
  if (!filter.hasUserSelection) return "Default";
  return `${filter.supportedCount}/${filter.requestedCount} supportati`;
}

function formatFilterNote(filter: EffectiveFilterItems, itemName: string): string | undefined {
  if (!filter.hasUserSelection) return `Nessun pair selezionato: uso il default ${itemName}.`;
  if (filter.isFallback) return `Nessuno dei tuoi ${itemName} e' supportato da questo strumento: uso il default disponibile.`;
  if (filter.unsupportedItems.length > 0) return `Non supportati qui: ${filter.unsupportedItems.join(", ")}.`;
  return undefined;
}

// ─── 1. MONTE CARLO ───────────────────────────────────────────────────────────
function MonteCarloTool() {
  const [params, setParams] = useState({
    winrate: 55,
    avgR: 1.5,
    lossR: 1,
    numTrades: 100,
    riskPercent: 1,
    initialBalance: 10000,
    simCount: 50,
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<MonteCarloResult>(`${API}/tools/montecarlo`, {
        method: "POST",
        body: JSON.stringify(params),
      }),
  });

  const chartData = mutation.data?.simulations
    ? Array.from({ length: params.numTrades + 1 }, (_, i) => {
        const point: Record<string, number | null> = { trade: i };
        (mutation.data!.simulations).forEach((sim, si) => {
          point[`sim${si}`] = sim[i] ?? null;
        });
        return point;
      })
    : [];

  const colors = ["#22c55e33", "#3b82f633", "#f59e0b33", "#ef444433", "#8b5cf633"];
  const simKeys = mutation.data?.simulations?.map((_, i) => `sim${i}`) ?? [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: "winrate", label: "Win Rate %", min: 10, max: 90, step: 1 },
          { key: "avgR", label: "Avg R (win)", min: 0.5, max: 10, step: 0.1 },
          { key: "lossR", label: "Loss R", min: 0.5, max: 5, step: 0.1 },
          { key: "numTrades", label: "N° Trade", min: 10, max: 500, step: 10 },
          { key: "riskPercent", label: "Risk %", min: 0.1, max: 10, step: 0.1 },
          { key: "initialBalance", label: "Balance €", min: 1000, max: 1000000, step: 1000 },
          { key: "simCount", label: "Simulazioni", min: 10, max: 200, step: 10 },
        ].map((field) => (
          <div key={field.key} className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">{field.label}</label>
            <Input
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              value={params[field.key as keyof typeof params]}
              onChange={(e) =>
                setParams((p) => ({ ...p, [field.key]: parseFloat(e.target.value) || 0 }))
              }
              className="h-8 text-sm font-mono"
            />
          </div>
        ))}
      </div>

      <Button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="w-full sm:w-auto"
      >
        {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TrendingUp className="w-4 h-4 mr-2" />}
        Esegui Simulazione
      </Button>

      {mutation.isError && <ErrorCard message={(mutation.error as Error).message} />}

      {mutation.data && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Mediana", value: `€${mutation.data.stats.median.toLocaleString("it-IT")}`, color: "text-primary" },
              { label: "10° Percentile", value: `€${mutation.data.stats.percentile10.toLocaleString("it-IT")}`, color: "text-destructive" },
              { label: "90° Percentile", value: `€${mutation.data.stats.percentile90.toLocaleString("it-IT")}`, color: "text-green-400" },
              { label: "Prob. Rovina", value: `${mutation.data.stats.ruinProbability}%`, color: mutation.data.stats.ruinProbability === "0.0" ? "text-primary" : "text-destructive" },
              { label: "Rend. Medio", value: `${mutation.data.stats.avgReturnPercent}%`, color: parseFloat(mutation.data.stats.avgReturnPercent) >= 0 ? "text-primary" : "text-destructive" },
            ].map((stat) => (
              <div key={stat.label} className="p-3 rounded-xl bg-secondary/40 border border-border text-center">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className={`text-base font-bold font-mono mt-0.5 ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="h-64 lg:h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="trade" tick={{ fontSize: 10, fill: "#888" }} label={{ value: "Trade", position: "insideBottomRight", offset: -5, fontSize: 10, fill: "#888" }} />
                <YAxis tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
                  formatter={(v) => [`€${Number(v).toLocaleString("it-IT")}`, ""]}
                  labelFormatter={(l) => `Trade #${l}`}
                />
                <ReferenceLine y={params.initialBalance} stroke="#666" strokeDasharray="4 2" />
                {simKeys.map((key, i) => (
                  <Line key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} dot={false} strokeWidth={1} connectNulls={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {mutation.data.simulations.length} curve di equity simulate — Linea tratteggiata = bilancio iniziale
          </p>
        </motion.div>
      )}
    </div>
  );
}

// ─── Emotional Wave Component ─────────────────────────────────────────────────
function EmotionalWave({ score }: { score: number }) {
  const zones = [
    { label: "Panico", min: 0, max: 30, color: "#ef4444" },
    { label: "Paura", min: 30, max: 45, color: "#f97316" },
    { label: "Neutrale", min: 45, max: 55, color: "#eab308" },
    { label: "Ottimismo", min: 55, max: 70, color: "#84cc16" },
    { label: "Euforia", min: 70, max: 100, color: "#22c55e" },
  ];

  const current = zones.find((z) => score >= z.min && score < z.max) ?? zones[2];
  const markerX = `${Math.min(Math.max(score, 2), 98)}%`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
        <span>😱 Panico</span>
        <span className="font-semibold" style={{ color: current.color }}>
          {current.label} ({score.toFixed(0)}% long)
        </span>
        <span>😄 Euforia</span>
      </div>
      <div className="relative h-10 rounded-xl overflow-hidden">
        <svg width="100%" height="100%" className="absolute inset-0">
          <defs>
            <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="30%" stopColor="#f97316" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="70%" stopColor="#84cc16" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#waveGrad)" opacity={0.25} rx="12" />
          <path
            d="M0,30 C50,10 100,30 150,15 S250,5 300,20 S400,35 500,20 S600,10 700,25 S800,30 900,15 S1000,25 1100,20 S1200,10 1280,25 L1280,40 L0,40 Z"
            fill="url(#waveGrad)"
            opacity={0.4}
          />
        </svg>
        <div
          className="absolute top-1 bottom-1 w-0.5 rounded-full shadow-lg"
          style={{ left: markerX, backgroundColor: current.color, boxShadow: `0 0 8px ${current.color}` }}
        />
        <div
          className="absolute -top-1 w-4 h-4 rounded-full border-2 border-background shadow-lg flex items-center justify-center"
          style={{ left: `calc(${markerX} - 8px)`, backgroundColor: current.color }}
        />
      </div>
      <div className="flex justify-between">
        {zones.map((z) => (
          <div
            key={z.label}
            className={`text-[10px] font-medium px-1 rounded ${score >= z.min && score < z.max ? "opacity-100" : "opacity-30"}`}
            style={{ color: z.color }}
          >
            {z.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 2. SENTIMENT ─────────────────────────────────────────────────────────────
function SentimentTool() {
  const { selectedPairs: userPairs } = useBackground();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["tools", "sentiment"],
    queryFn: () => apiFetch<{
      symbols: SentimentSymbol[];
      live?: boolean;
      cached?: boolean;
      fallback?: boolean;
      hasCredentials?: boolean;
      error?: string;
    }>(`${API}/tools/sentiment`),
    staleTime: 3 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  const allPairs = data?.symbols?.map((s) => s.name) ?? [];
  const [filterOpen, setFilterOpen] = useState(false);

  const sentimentFilter = useMemo(
    () =>
      deriveEffectiveFilterItems({
        requestedItems: userPairs,
        supportedItems: allPairs,
        defaultItems: allPairs,
      }),
    [allPairs, userPairs],
  );

  const visibleSymbols = useMemo(() => {
    if (!data?.symbols) return [];
    const selectedSet = new Set(sentimentFilter.items);
    return data.symbols.filter((symbol) => selectedSet.has(symbol.name));
  }, [data?.symbols, sentimentFilter.items]);

  const avgLong = visibleSymbols.length
    ? visibleSymbols.reduce((s, sym) => s + sym.longPercentage, 0) / visibleSymbols.length
    : 50;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            Community Sentiment
            {data?.live && (
              <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full font-medium">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                LIVE
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground">Myfxbook Community Outlook</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => setFilterOpen((v) => !v)}
            className={`gap-1.5 transition-colors ${filterOpen ? "bg-primary/10 text-primary border-primary/30" : ""}`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtri {sentimentFilter.items.length > 0 && `(${sentimentFilter.items.length})`}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Credential hint */}
      {data && !data.hasCredentials && (
        <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-2.5 rounded-xl">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            Dati dimostrativi — configura <span className="font-mono font-bold">MYFXBOOK_EMAIL</span> e{" "}
            <span className="font-mono font-bold">MYFXBOOK_PASSWORD</span> nelle variabili d'ambiente per dati reali.
          </span>
        </div>
      )}

      {data?.fallback && data.hasCredentials && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-2 rounded-xl">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          Connessione Myfxbook non riuscita — mostrati dati dimostrativi
        </div>
      )}

      {/* Filtro pair richiudibile */}
      <AnimatePresence>
        {filterOpen && sentimentFilter.items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 rounded-xl border border-border bg-secondary/20 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filtri dai tuoi pair</p>
                <div className="flex gap-2">
                  <span className="text-[11px] text-muted-foreground">{formatFilterSummary(sentimentFilter)}</span>
                  <span className="text-muted-foreground text-[11px]">·</span>
                  <span className="text-[11px] text-muted-foreground">read-only</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {sentimentFilter.items.map((name) => (
                  <span key={name} className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold border bg-primary/15 text-primary border-primary/40">
                    {name}
                  </span>
                ))}
              </div>
              {formatFilterNote(sentimentFilter, "pair") && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">{formatFilterNote(sentimentFilter, "pair")}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading && <LoadingCard />}
      {isError && <ErrorCard message={(error as Error).message} />}

      {data?.symbols && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Emotional wave */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground font-medium">Onda delle emozioni</p>
              <span className="text-xs text-muted-foreground">{visibleSymbols.length} pair selezionati</span>
            </div>
            <EmotionalWave score={avgLong} />
          </Card>

          {/* Pair list */}
          <div className="space-y-2">
            {visibleSymbols.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">Nessun pair selezionato nel filtro</p>
            ) : (
              visibleSymbols.map((sym) => {
                const bias = sym.longPercentage >= 60 ? "Long" : sym.shortPercentage >= 60 ? "Short" : "Neutro";
                const biasColor = bias === "Long" ? "text-primary" : bias === "Short" ? "text-destructive" : "text-muted-foreground";
                return (
                  <motion.div
                    key={sym.name}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-3 rounded-xl border border-border bg-secondary/20 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-bold">{sym.name}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          bias === "Long" ? "bg-primary/10 border-primary/30 text-primary"
                            : bias === "Short" ? "bg-destructive/10 border-destructive/30 text-destructive"
                            : "bg-secondary border-border text-muted-foreground"
                        }`}>{bias}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-primary font-semibold">▲ {sym.longPercentage.toFixed(1)}%</span>
                        <span className="text-destructive font-semibold">▼ {sym.shortPercentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-destructive/30 overflow-hidden relative">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${sym.longPercentage}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{sym.longPositions.toLocaleString()} long pos.</span>
                      <span>{sym.shortPositions.toLocaleString()} short pos.</span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {data.live && (
            <p className="text-[10px] text-center text-muted-foreground">
              Aggiornato automaticamente ogni 5 minuti · Fonte: Myfxbook Community
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ─── 3. VOLATILITY (stile Mataf) ──────────────────────────────────────────────
const ALL_VOL_PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD", "EURGBP", "EURJPY", "GBPJPY", "XAUUSD", "XAGUSD"];

function VolatilityTool() {
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
  const volPairs = volatilityFilter.items;
  const [selectedPair, setSelectedPair] = useState(volPairs[0] || "EURUSD");
  const [open, setOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const defaultAppliedRef = useRef(false);

  useEffect(() => {
    if (userPairs.length > 0 && !defaultAppliedRef.current) {
      defaultAppliedRef.current = true;
      if (volPairs.length > 0) setSelectedPair(volPairs[0]);
    } else if (volPairs.length > 0 && !volPairs.includes(selectedPair)) {
      setSelectedPair(volPairs[0]);
    }
  }, [volPairs, selectedPair, userPairs]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["tools", "volatility", selectedPair],
    queryFn: () => apiFetch<VolatilityResult>(`${API}/tools/volatility?pair=${selectedPair}`),
    staleTime: 15 * 60_000,
    refetchInterval: 15 * 60_000,
  });

  const periods = data ? [
    { short: "1W", value: data.w1, vs: data.y1, pct: data.w1Pct },
    { short: "1M", value: data.m1, vs: data.y1, pct: data.m1Pct },
    { short: "3M", value: data.m3, vs: data.y1, pct: data.m3Pct },
    { short: "6M", value: data.m6, vs: data.y1, pct: data.m6Pct },
    { short: "1Y", value: data.y1, vs: data.y1, pct: data.y1Pct },
  ] : [];

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-[160px]">
          <button
            onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-secondary/50 hover:bg-secondary text-sm font-mono font-bold"
          >
            {selectedPair}
            <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute top-full mt-1 left-0 z-20 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-40"
              >
                {volPairs.map((p) => (
                  <button key={p} onClick={() => { setSelectedPair(p); setOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm font-mono hover:bg-secondary transition-colors ${p === selectedPair ? "text-primary bg-primary/10" : ""}`}
                  >{p}</button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {data && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
            data.label.includes("Alta") ? "bg-destructive/10 border-destructive/30 text-destructive" :
            data.label.includes("Bassa") ? "bg-blue-400/10 border-blue-400/30 text-blue-400" :
            "bg-primary/10 border-primary/30 text-primary"
          }`}>
            <Activity className="w-3.5 h-3.5" />
            {data.label}
          </div>
        )}

        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="ml-auto">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilterOpen((v) => !v)}
          className={`gap-1.5 ${filterOpen ? "bg-primary/10 text-primary border-primary/30" : ""}`}
        >
          <Filter className="w-3.5 h-3.5" />
          Filtri
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
        </Button>
      </div>

      <ReadOnlyToolFilterPanel
        open={filterOpen}
        title="Pair disponibili"
        items={volatilityFilter.items}
        summary={formatFilterSummary(volatilityFilter)}
        note={formatFilterNote(volatilityFilter, "pair")}
      />

      {isLoading && <LoadingCard />}
      {isError && <ErrorCard message={(error as Error).message} />}

      {data && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Today + price */}
          <div className="flex gap-3">
            <div className="flex-1 p-3 rounded-xl bg-primary/5 border border-primary/20 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Oggi</p>
              <p className="text-xl font-bold font-mono text-primary">{data.todayPips}</p>
              <p className="text-[10px] text-muted-foreground">{data.pipUnit}</p>
            </div>
            <div className="flex-1 p-3 rounded-xl bg-secondary/40 border border-border text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Prezzo</p>
              <p className="text-xl font-bold font-mono">{data.currentPrice?.toFixed(selectedPair.includes("JPY") ? 3 : 5)}</p>
              <p className="text-[10px] text-muted-foreground">corrente</p>
            </div>
            <div className="flex-1 p-3 rounded-xl bg-secondary/40 border border-border text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Peak</p>
              <p className="text-xl font-bold font-mono">{data.peakDay}</p>
              <p className="text-[10px] text-muted-foreground">giorno più volatile</p>
            </div>
          </div>

          {/* Periods table — stile Mataf + variazione % prezzo */}
          <div className="rounded-xl border border-border overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-5 bg-secondary/60 border-b border-border">
              {periods.map((p) => (
                <div key={p.short} className="py-2 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{p.short}</div>
              ))}
            </div>
            {/* Pip row */}
            <div className="grid grid-cols-5 border-b border-border/50">
              {periods.map((p) => {
                const ratio = p.vs > 0 ? p.value / p.vs : 1;
                const pipColor = ratio > 1.25 ? "text-destructive" : ratio < 0.75 ? "text-blue-400" : "text-primary";
                const volPct = p.short !== "1Y" ? Math.abs((ratio - 1) * 100) : null;
                const volUp = ratio > 1;
                return (
                  <div key={p.short} className="py-2.5 flex flex-col items-center border-r border-border last:border-r-0">
                    <span className={`text-sm font-bold font-mono ${pipColor}`}>{p.value}</span>
                    <span className="text-[9px] text-muted-foreground">{data.pipUnit}</span>
                    {volPct != null && (
                      <span className={`text-[9px] mt-0.5 flex items-center gap-0.5 ${volUp ? "text-destructive/60" : "text-blue-400/60"}`}>
                        {volUp ? <ArrowUp className="w-2 h-2" /> : <ArrowDown className="w-2 h-2" />}
                        {volPct.toFixed(0)}% vol
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Price % row */}
            <div className="grid grid-cols-5 bg-secondary/20">
              {periods.map((p) => {
                const pct = p.pct;
                const isPos = pct != null && pct >= 0;
                return (
                  <div key={`pct-${p.short}`} className="py-2 flex flex-col items-center border-r border-border last:border-r-0">
                    <span className="text-[9px] text-muted-foreground/60 mb-0.5">variazione</span>
                    {pct != null ? (
                      <span className={`text-[10px] font-semibold font-mono flex items-center gap-0.5 ${isPos ? "text-primary" : "text-destructive"}`}>
                        {isPos ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                        {Math.abs(pct).toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/40">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bar chart ultimi 30 giorni */}
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-2">Range giornaliero — ultimi 30 giorni</p>
            <div className="h-48 lg:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.last30} barSize={7} margin={{ top: 4, right: 0, left: -20, bottom: 18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="weekday"
                    tick={{ fontSize: 9, fill: "#777" }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={32}
                  />
                  <YAxis tick={{ fontSize: 9, fill: "#666" }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
                    formatter={(v: number, _name: string, props: { payload?: { pips: number; date: string; weekday: string } }) => [
                      `${v} ${data.pipUnit}`,
                      `${props.payload?.weekday} ${props.payload?.date}`,
                    ]}
                    labelFormatter={() => ""}
                  />
                  <ReferenceLine y={data.y1} stroke="#888" strokeDasharray="4 2" label={{ value: `media ${data.y1}`, position: "insideTopRight", fontSize: 9, fill: "#666" }} />
                  <Bar dataKey="pips" radius={[3, 3, 0, 0]}>
                    {data.last30.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.pips > data.y1 * 1.25 ? "#ef4444" : entry.pips < data.y1 * 0.75 ? "#60a5fa" : "#22c55e"}
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <p className="text-[10px] text-center text-muted-foreground">
            Metodologia Mataf · Range H-L giornaliero in pips · Fonte: Yahoo Finance
          </p>
        </motion.div>
      )}
    </div>
  );
}

// ─── 4. COT REPORT (dati reali CFTC, aggiornato ogni venerdì) ────────────────
function CotTool() {
  const { selectedCurrencies } = useBackground();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["tools", "cot"],
    queryFn: () => apiFetch<{
      reports: CotReport[];
      cached?: boolean;
      fallback?: boolean;
      fetchedAt?: string;
      nextUpdate?: string;
    }>(`${API}/tools/cot`),
    staleTime: 60 * 60_000,
    refetchInterval: 60 * 60_000,
  });

  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState<CotReport | null>(null);
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">COT Report — Futures Finanziari</h3>
          <p className="text-xs text-muted-foreground">
            Fonte: CFTC.gov • {data?.fetchedAt ? `Aggiornato: ${new Date(data.fetchedAt).toLocaleDateString("it-IT")}` : "Aggiornato ogni venerdì"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterOpen((v) => !v)}
            className={`gap-1.5 ${filterOpen ? "bg-primary/10 text-primary border-primary/30" : ""}`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtri
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
          </Button>
        </div>
      </div>

      <ReadOnlyToolFilterPanel
        open={filterOpen}
        title="Valute dai tuoi pair"
        items={cotFilter.items}
        summary={formatFilterSummary(cotFilter)}
        note={formatFilterNote(cotFilter, "valute")}
      />

      {/* Prossimo aggiornamento */}
      {data?.nextUpdate && (
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
          data.fallback
            ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
            : "text-primary/80 bg-primary/5 border-primary/15"
        }`}>
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {data.fallback
            ? "CFTC non raggiungibile — dati di esempio · "
            : "Dati CFTC ufficiali · "}
          Prossimo aggiornamento: <span className="font-medium">{data.nextUpdate}</span>
        </div>
      )}

      {isLoading && <LoadingCard />}
      {isError && <ErrorCard message={(error as Error).message} />}

      {data?.reports && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {/* Currency grid */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {filteredReports.map((r) => {
              const trend = r.history.length >= 2
                ? r.nonCommNet - r.history[r.history.length - 2]?.nonCommNet
                : 0;
              return (
                <button
                  key={r.currency}
                  onClick={() => setSelected(selected?.currency === r.currency ? null : r)}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    selected?.currency === r.currency
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-secondary/30 hover:border-primary/30"
                  }`}
                >
                  <p className="text-sm font-bold font-mono">{r.currency}</p>
                  <p className={`text-[10px] font-semibold mt-0.5 ${r.nonCommNet >= 0 ? "text-primary" : "text-destructive"}`}>
                    {r.nonCommNet >= 0 ? "+" : ""}{(r.nonCommNet / 1000).toFixed(0)}k
                  </p>
                  {trend !== 0 && (
                    <p className={`text-[9px] flex items-center justify-center gap-0.5 mt-0.5 ${trend > 0 ? "text-primary/70" : "text-destructive/70"}`}>
                      {trend > 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                      {Math.abs(trend / 1000).toFixed(0)}k
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Detail panel */}
          {selected && (
            <motion.div
              key={selected.currency}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-2xl border border-border bg-secondary/20 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold font-mono text-lg">{selected.currency}</h4>
                <span className="text-xs text-muted-foreground">Report: {selected.date}</span>
              </div>

              {/* Storico 12 settimane — Net Non-Commerciali */}
              {selected.history.length > 1 && (
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium mb-1.5">
                    Posizioni nette Non-Commerciali — ultime {selected.history.length} settimane
                  </p>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={selected.history} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id={`cotGradPos-${selected.currency}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id={`cotGradNeg-${selected.currency}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.3} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 8, fill: "#666" }}
                          tickFormatter={(d) => d.slice(5)}
                          interval="preserveStartEnd"
                        />
                        <YAxis tick={{ fontSize: 8, fill: "#666" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
                          formatter={(v: number) => [`${(v / 1000).toFixed(1)}k contratti`, "Net Non-Comm."]}
                          labelFormatter={(l) => `Settimana: ${l}`}
                        />
                        <ReferenceLine y={0} stroke="#555" strokeDasharray="3 2" />
                        <Area
                          type="monotone"
                          dataKey="nonCommNet"
                          stroke={selected.nonCommNet >= 0 ? "#22c55e" : "#ef4444"}
                          strokeWidth={1.5}
                          fill={selected.nonCommNet >= 0 ? `url(#cotGradPos-${selected.currency})` : `url(#cotGradNeg-${selected.currency})`}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Bar confronto 3 categorie */}
              <div className="h-40">
                <p className="text-[10px] text-muted-foreground font-medium mb-1.5">Posizioni nette — settimana corrente</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Non-Comm.", net: selected.nonCommNet },
                      { name: "Commercial", net: selected.commNet },
                      { name: "Retail",     net: selected.retailNet },
                    ]}
                    margin={{ top: 4, right: 5, bottom: 5, left: 10 }}
                    barSize={36}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#888" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
                      formatter={(v: number) => [`${(v / 1000).toFixed(1)}k contratti`, "Posizioni nette"]}
                    />
                    <ReferenceLine y={0} stroke="#555" />
                    <Bar dataKey="net" radius={[4, 4, 0, 0]}>
                      {[selected.nonCommNet, selected.commNet, selected.retailNet].map((net, i) => (
                        <Cell key={i} fill={net >= 0 ? "#22c55e" : "#ef4444"} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Non-Comm.", net: selected.nonCommNet, long: selected.nonCommLong, short: selected.nonCommShort, desc: "Hedge fund / Speculatori" },
                  { label: "Commerciali", net: selected.commNet, long: selected.commLong, short: selected.commShort, desc: "Banche / Hedger" },
                  { label: "Non-Report.", net: selected.retailNet, long: selected.retailLong, short: selected.retailShort, desc: "Piccoli trader" },
                ].map((g) => (
                  <div key={g.label} className="p-2 rounded-xl bg-secondary/40 border border-border">
                    <p className="text-[10px] text-muted-foreground font-medium">{g.label}</p>
                    <p className={`text-sm font-bold font-mono ${g.net >= 0 ? "text-primary" : "text-destructive"}`}>
                      {g.net >= 0 ? "+" : ""}{(g.net / 1000).toFixed(1)}k
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      L:{(g.long / 1000).toFixed(0)}k · S:{(g.short / 1000).toFixed(0)}k
                    </p>
                    <p className="text-[9px] text-muted-foreground/60 mt-0.5">{g.desc}</p>
                  </div>
                ))}
              </div>

              {/* Interpretazione */}
              <div className="p-3 rounded-xl bg-secondary/30 border border-border">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Interpretazione: </span>
                  {selected.nonCommNet > 0
                    ? `Gli hedge fund sono NET LONG su ${selected.currency} (+${(selected.nonCommNet / 1000).toFixed(0)}k contratti). Segnale potenzialmente rialzista.`
                    : `Gli hedge fund sono NET SHORT su ${selected.currency} (${(selected.nonCommNet / 1000).toFixed(0)}k contratti). Segnale potenzialmente ribassista.`}
                  {Math.abs(selected.commNet) > Math.abs(selected.nonCommNet) * 0.8
                    ? ` I commerciali si posizionano in direzione opposta — possibile extremo di mercato.`
                    : ""}
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ─── 5. MACRO NEWS ────────────────────────────────────────────────────────────
const IMPACT_STYLES: Record<string, string> = {
  alto: "bg-destructive/20 text-destructive border-destructive/40",
  medio: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  basso: "bg-secondary text-muted-foreground border-border",
};

const DIRECTION_ICONS = {
  bullish: <ArrowUp className="w-3.5 h-3.5 text-primary" />,
  bearish: <ArrowDown className="w-3.5 h-3.5 text-destructive" />,
  neutrale: <Minus className="w-3.5 h-3.5 text-muted-foreground" />,
};

const CURRENCIES = ["Tutte", "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "XAU"];

const SENTIMENT_STYLES: Record<string, string> = {
  "risk-on": "text-primary bg-primary/10 border-primary/30",
  "risk-off": "text-destructive bg-destructive/10 border-destructive/30",
  "neutrale": "text-muted-foreground bg-secondary/50 border-border",
};

function MacroNewsTool() {
  const [currency, setCurrency] = useState("Tutte");
  const { selectedPairs } = useBackground();

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<MacroNewsResult>(`${API}/tools/macro-news`, {
        method: "POST",
        body: JSON.stringify({
          currency: currency === "Tutte" ? "tutte le principali valute" : currency,
          pairs: selectedPairs.join(","),
        }),
      }),
  });

  const articles = mutation.data?.articles ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Agente Notizie Macro</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Briefing AI sulle notizie macroeconomiche rilevanti per il trading</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {CURRENCIES.map((c) => (
          <button
            key={c}
            onClick={() => setCurrency(c)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-all ${
              currency === c ? "border-primary bg-primary/15 text-primary" : "border-border bg-secondary/40 text-muted-foreground hover:border-primary/30"
            }`}
          >
            {c}
          </button>
        ))}
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="gap-2 ml-auto">
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Newspaper className="w-4 h-4" />}
          {mutation.isPending ? "Analisi in corso..." : "Genera briefing"}
        </Button>
      </div>

      {mutation.isError && <ErrorCard message={(mutation.error as Error).message} />}

      {mutation.isPending && (
        <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
          <div className="relative">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <Newspaper className="w-4 h-4 text-primary absolute top-3 left-3" />
          </div>
          <p className="text-sm">L&apos;agente sta analizzando i mercati...</p>
          <p className="text-xs text-muted-foreground/60">Questo può richiedere 10-20 secondi</p>
        </div>
      )}

      {mutation.data && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${SENTIMENT_STYLES[mutation.data.sentiment] ?? SENTIMENT_STYLES["neutrale"]}`}>
              <Activity className="w-3.5 h-3.5" />
              {mutation.data.sentiment.toUpperCase()}
            </div>
            <p className="text-xs text-muted-foreground">{articles.length} articoli generati</p>
          </div>

          {mutation.data.summary && (
            <div className="p-3 rounded-xl border border-border bg-secondary/30 text-sm text-muted-foreground italic">
              "{mutation.data.summary}"
            </div>
          )}

          <div className="space-y-3">
            {articles.map((article, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl border border-border bg-card/60 overflow-hidden"
              >
                {article.imageUrl && (
                  <div className="w-full h-32 overflow-hidden">
                    <img
                      src={article.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = "none"; }}
                    />
                  </div>
                )}
                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-sm font-semibold leading-tight flex-1">{article.title}</h4>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="font-mono text-xs font-bold text-muted-foreground">{article.currency}</span>
                      {DIRECTION_ICONS[article.direction as keyof typeof DIRECTION_ICONS] ?? DIRECTION_ICONS.neutrale}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{article.summary}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${IMPACT_STYLES[article.impact] ?? IMPACT_STYLES.basso}`}>
                      {article.impact.toUpperCase()}
                    </span>
                    <span className={`text-[10px] font-medium ${
                      article.direction === "bullish" ? "text-primary" : article.direction === "bearish" ? "text-destructive" : "text-muted-foreground"
                    }`}>
                      {article.direction}
                    </span>
                    {article.source && (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium border border-blue-500/20 bg-blue-500/5 text-blue-400">
                        {article.source}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Generato con AI • Non costituisce consulenza finanziaria
          </p>
        </motion.div>
      )}

      {!mutation.data && !mutation.isPending && !mutation.isError && (
        <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground">
          <Newspaper className="w-12 h-12 opacity-20" />
          <p className="text-sm">Clicca "Genera briefing" per ottenere le ultime notizie macro</p>
        </div>
      )}
    </div>
  );
}

// ─── 6. BACKTEST ──────────────────────────────────────────────────────────────
const PAIRS_BACKTEST = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "NZD/USD", "USD/CAD",
  "EUR/GBP", "EUR/JPY", "GBP/JPY", "AUD/JPY", "XAU/USD", "US30", "NAS100", "SPX500",
  "BTC/USD", "ETH/USD",
];
const TIMEFRAMES_BACKTEST = ["M15", "M30", "H1", "H4", "D1", "W1"];

function NewSessionForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { selectedPairs: userPairs } = useBackground();
  const createMutation = useCreateBacktestSession();
  const [name, setName] = useState("");
  const backtestPairOptions = useMemo(() => {
    if (userPairs.length === 0) return PAIRS_BACKTEST;
    const supportedSet = new Set(PAIRS_BACKTEST);
    const userLabels = userPairs.map((p) => getPairLabel(p)).filter((l) => supportedSet.has(l));
    const userSet = new Set(userLabels);
    const advanced = PAIRS_BACKTEST.filter((p) => !userSet.has(p));
    return userLabels.length > 0 ? [...userLabels, ...advanced] : PAIRS_BACKTEST;
  }, [userPairs]);
  const [pair, setPair] = useState(backtestPairOptions[0] || "EUR/USD");
  const btDefaultAppliedRef = useRef(false);

  useEffect(() => {
    if (userPairs.length > 0 && !btDefaultAppliedRef.current) {
      btDefaultAppliedRef.current = true;
      if (backtestPairOptions.length > 0) setPair(backtestPairOptions[0]);
    } else if (backtestPairOptions.length > 0 && !backtestPairOptions.includes(pair)) {
      setPair(backtestPairOptions[0]);
    }
  }, [backtestPairOptions, pair, userPairs]);

  const [timeframe, setTimeframe] = useState("H1");
  const [strategy, setStrategy] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) return;
    try {
      await createMutation.mutateAsync({
        data: { name: name.trim(), pair, timeframe, strategy: strategy.trim() || undefined },
      });
      qc.invalidateQueries({ queryKey: getGetBacktestSessionsQueryKey() });
      toast({ description: "Sessione creata." });
      onClose();
    } catch {
      toast({ description: "Errore.", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-4">
        <h3 className="text-lg font-bold">Nuova Sessione Backtest</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Nome Sessione</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Strategia Breakout Londra" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Strategia</label>
            <Input value={strategy} onChange={(e) => setStrategy(e.target.value)} placeholder="es. Breakout + FVG" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Coppia</label>
            <select value={pair} onChange={(e) => setPair(e.target.value)} className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm">
              {backtestPairOptions.map((p, i) => {
                const userLabelCount = userPairs.length;
                if (userLabelCount > 0 && i === userLabelCount) {
                  return [
                    <option key="__sep" disabled>── Avanzati ──</option>,
                    <option key={p} value={p}>{p}</option>
                  ];
                }
                return <option key={p} value={p}>{p}</option>;
              })}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Timeframe</label>
            <div className="flex flex-wrap gap-1.5">
              {TIMEFRAMES_BACKTEST.map((tf) => (
                <button key={tf} onClick={() => setTimeframe(tf)} className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${timeframe === tf ? "bg-primary/20 text-primary border border-primary/40" : "bg-secondary/40 text-muted-foreground border border-border/50"}`}>
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || createMutation.isPending}>
            <Plus className="w-4 h-4 mr-2" />
            Crea Sessione
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BacktestSessionDetail({ session, onBack }: { session: BacktestSession; onBack: () => void }) {
  const dateLocale = useDateLocale();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: trades, isLoading } = useGetBacktestTrades(session.id);
  const createTrade = useCreateBacktestTrade();
  const deleteTrade = useDeleteBacktestTrade();
  const [mode, setMode] = useState<"chart" | "manual">("chart");
  const [pendingChartTrades, setPendingChartTrades] = useState<Array<{ id: number; direction: "buy" | "sell"; entryPrice: number; exitPrice?: number; stopLoss?: number; takeProfit?: number; result?: "win" | "loss" | "breakeven"; pips?: number }>>([]);

  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [lotSize, setLotSize] = useState("0.01");
  const [tradeDate, setTradeDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setDirection("buy"); setEntryPrice(""); setExitPrice("");
    setStopLoss(""); setTakeProfit(""); setLotSize("0.01");
    setTradeDate(format(new Date(), "yyyy-MM-dd")); setNotes("");
  };

  const computedResult = useMemo(
    () => calculateManualBacktestTradeResult(entryPrice, exitPrice, direction),
    [entryPrice, exitPrice, direction],
  );

  const handleAddTrade = async () => {
    if (!entryPrice || !exitPrice) return;
    try {
      await createTrade.mutateAsync({
        id: session.id,
        data: {
          direction, entryPrice, exitPrice,
          stopLoss: stopLoss || undefined, takeProfit: takeProfit || undefined,
          lotSize, result: computedResult.result, pips: computedResult.pips,
          notes: notes.trim() || undefined, tradeDate,
        },
      });
      qc.invalidateQueries({ queryKey: getGetBacktestTradesQueryKey(session.id) });
      toast({ description: "Trade aggiunto." });
      resetForm();
    } catch {
      toast({ description: "Errore.", variant: "destructive" });
    }
  };

  const savedTradeIdsStorageKey = createReplaySavedTradeIdsStorageKey(`backtest-session-${session.id}`);
  const [savedTradeIds, setSavedTradeIds] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    return parseReplaySavedTradeIds(window.localStorage.getItem(savedTradeIdsStorageKey));
  });

  const handleSaveChartTrades = async (chartTrades: Array<{ id: number; direction: "buy" | "sell"; entryPrice: number; exitPrice?: number; stopLoss?: number; takeProfit?: number; result?: "win" | "loss" | "breakeven"; pips?: number }>) => {
    const unsaved = chartTrades.filter((t) => !savedTradeIds.has(t.id) && t.exitPrice && t.result != null);
    if (unsaved.length === 0) {
      toast({ description: "Nessun nuovo trade da salvare." });
      return;
    }
    let saved = 0;
    const newIds = new Set(savedTradeIds);
    for (const t of unsaved) {
      try {
        await createTrade.mutateAsync({
          id: session.id,
          data: {
            direction: t.direction,
            entryPrice: t.entryPrice.toFixed(5),
            exitPrice: t.exitPrice!.toFixed(5),
            stopLoss: t.stopLoss?.toFixed(5),
            takeProfit: t.takeProfit?.toFixed(5),
            lotSize: "0.01",
            result: t.result!,
            pips: (t.pips ?? 0).toFixed(1),
            tradeDate: format(new Date(), "yyyy-MM-dd"),
          },
        });
        newIds.add(t.id);
        saved++;
      } catch {
        /* skip failed */
      }
    }
    setSavedTradeIds(newIds);
    window.localStorage.setItem(savedTradeIdsStorageKey, serializeReplaySavedTradeIds(newIds));
    setPendingChartTrades([]);
    qc.invalidateQueries({ queryKey: getGetBacktestTradesQueryKey(session.id) });
    toast({ description: `${saved} trade salvati.` });
  };

  const handleDeleteTrade = async (id: number) => {
    if (!confirm("Eliminare questo trade?")) return;
    await deleteTrade.mutateAsync({ id });
    qc.invalidateQueries({ queryKey: getGetBacktestTradesQueryKey(session.id) });
  };

  const stats = useMemo(() => calculateBacktestStats(trades), [trades]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold truncate">{session.name}</h3>
          <p className="text-xs text-muted-foreground">
            {session.pair} · {session.timeframe}
            {session.strategy && ` · ${session.strategy}`}
          </p>
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-secondary/30 border border-border/30">
        <button onClick={() => setMode("chart")} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === "chart" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}>
          <Play className="w-4 h-4" />
          Replay Grafico
        </button>
        <button onClick={() => setMode("manual")} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === "manual" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}>
          <Plus className="w-4 h-4" />
          Manuale
        </button>
      </div>

      {mode === "chart" ? (
        <div className="space-y-3">
          <ChartReplay symbol={session.pair} interval={session.timeframe} persistenceKey={`backtest-session-${session.id}`} onTradesChange={(chartTrades) => {
            const completed = chartTrades.filter((t) => t.exitPrice != null && !savedTradeIds.has(t.id));
            setPendingChartTrades(completed);
          }} />
          {pendingChartTrades.length > 0 && (
            <Button onClick={() => handleSaveChartTrades(pendingChartTrades)} disabled={createTrade.isPending} className="w-full">
              Salva {pendingChartTrades.length} trade nel database
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex gap-2 mb-2">
                <button onClick={() => setDirection("buy")} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${direction === "buy" ? "bg-green-500/20 text-green-400 border border-green-500/40" : "bg-secondary/40 text-muted-foreground border border-border/50"}`}>
                  BUY
                </button>
                <button onClick={() => setDirection("sell")} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${direction === "sell" ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-secondary/40 text-muted-foreground border border-border/50"}`}>
                  SELL
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Entry</label>
                  <Input type="number" step="any" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="1.08500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Exit</label>
                  <Input type="number" step="any" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} placeholder="1.09000" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Stop Loss</label>
                  <Input type="number" step="any" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="1.08200" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Take Profit</label>
                  <Input type="number" step="any" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} placeholder="1.09200" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Lotti</label>
                  <Input type="number" step="0.01" value={lotSize} onChange={(e) => setLotSize(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Data</label>
                  <Input type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} />
                </div>
              </div>
              <Input placeholder="Note (opzionale)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              {entryPrice && exitPrice && (
                <div className={`text-center py-2 rounded-lg text-sm font-bold ${computedResult.result === "win" ? "bg-green-500/10 text-green-400" : computedResult.result === "loss" ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                  {computedResult.result.toUpperCase()} · {computedResult.pips} pips
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <Button onClick={handleAddTrade} disabled={!entryPrice || !exitPrice || createTrade.isPending}>
                  Aggiungi Trade
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {stats && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <BacktestStatBox label="Trade" value={stats.total} color="text-foreground" icon={<BarChart3 className="w-4 h-4" />} />
            <BacktestStatBox label="Win Rate" value={`${stats.winRate}%`} color={stats.winRate >= 50 ? "text-green-400" : "text-red-400"} icon={<TrendingUp className="w-4 h-4" />} />
            <BacktestStatBox label="Pips Totali" value={stats.totalPips} color={parseFloat(stats.totalPips) >= 0 ? "text-green-400" : "text-red-400"} icon={<BarChart3 className="w-4 h-4" />} />
            {stats.avgRR && <BacktestStatBox label="R:R Medio" value={stats.avgRR} color={parseFloat(stats.avgRR) >= 1 ? "text-green-400" : "text-orange-400"} icon={<TrendingUp className="w-4 h-4" />} />}
          </div>
          <div className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 p-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <div className="h-3 rounded-full bg-secondary/40 overflow-hidden flex">
                  {stats.wins > 0 && <div className="h-full bg-green-500" style={{ width: `${(stats.wins / stats.total) * 100}%` }} />}
                  {stats.breakevens > 0 && <div className="h-full bg-yellow-500" style={{ width: `${(stats.breakevens / stats.total) * 100}%` }} />}
                  {stats.losses > 0 && <div className="h-full bg-red-500" style={{ width: `${(stats.losses / stats.total) * 100}%` }} />}
                </div>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{stats.wins}W / {stats.losses}L / {stats.breakevens}BE</span>
            </div>
          </div>
        </div>
      )}

      {trades && trades.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Trade Salvati</h4>
          <AnimatePresence>
            {trades.map((trade, idx) => (
              <motion.div key={trade.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ delay: idx * 0.03 }} className="rounded-xl border border-border/50 bg-card/40 p-3 flex items-center gap-3 group hover:border-primary/30 transition-colors">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${trade.direction === "buy" ? "bg-green-500/15" : "bg-red-500/15"}`}>
                  {trade.direction === "buy" ? <TrendingUp className="w-4 h-4 text-green-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{trade.entryPrice} → {trade.exitPrice}</span>
                    {trade.stopLoss && <span className="text-red-400/60">SL {trade.stopLoss}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-sm font-bold ${trade.result === "win" ? "text-green-400" : trade.result === "loss" ? "text-red-400" : "text-yellow-400"}`}>
                      {trade.result === "win" ? "+" : ""}{trade.pips ?? "0"} pips
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">
                      {format(parseISO(trade.tradeDate), "d MMM", { locale: dateLocale })}
                    </span>
                    {trade.notes && <span className="text-[10px] text-muted-foreground/50 truncate">{trade.notes}</span>}
                  </div>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${trade.result === "win" ? "bg-green-500/15 text-green-400" : trade.result === "loss" ? "bg-red-500/15 text-red-400" : "bg-yellow-500/15 text-yellow-400"}`}>
                  {trade.result}
                </div>
                <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => handleDeleteTrade(trade.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      )}
    </div>
  );
}

function BacktestStatBox({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 p-3 sm:p-4 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</span>
      </div>
      <p className={`text-xl sm:text-2xl font-mono font-bold ${color}`}>{value}</p>
    </div>
  );
}

function BacktestTool() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: sessions, isLoading } = useGetBacktestSessions();
  const deleteMutation = useDeleteBacktestSession();
  const [showNew, setShowNew] = useState(false);
  const [activeSession, setActiveSession] = useState<BacktestSession | null>(null);

  const handleDelete = async (id: number) => {
    if (!confirm("Eliminare questa sessione e tutti i trade?")) return;
    await deleteMutation.mutateAsync({ id });
    qc.invalidateQueries({ queryKey: getGetBacktestSessionsQueryKey() });
    toast({ description: "Sessione eliminata." });
  };

  if (activeSession) {
    return <BacktestSessionDetail session={activeSession} onBack={() => setActiveSession(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Backtest</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Replay su grafici reali. Testa le tue strategie come su FX Replay.</p>
        </div>
        <Button onClick={() => setShowNew(!showNew)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Nuova Sessione
        </Button>
      </div>

      <AnimatePresence>
        {showNew && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <NewSessionForm onClose={() => setShowNew(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <Card className="border-dashed border-white/10">
          <CardContent className="p-12 text-center">
            <FlaskConical className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <h3 className="text-lg font-bold mb-2">Nessuna sessione di backtest</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Crea una sessione per iniziare a fare replay su grafici reali e testare le tue strategie.
            </p>
            <Button size="sm" onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Crea Sessione
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AnimatePresence>
            {sessions.map((session, idx) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => setActiveSession(session)}
                className="bg-card/60 backdrop-blur-sm border border-border/30 rounded-2xl p-4 cursor-pointer group hover:border-primary/50 transition-colors relative"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{session.name}</p>
                    <p className="text-xs text-muted-foreground">{session.pair} · {session.timeframe}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(session.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {session.strategy && (
                  <p className="text-[10px] text-muted-foreground/60">📊 {session.strategy}</p>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function Tools() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<ToolTabId>(getInitialToolTab);
  const TABS = [
    { id: "montecarlo", label: t("tools.tab.montecarlo"), icon: TrendingUp },
    { id: "sentiment", label: t("tools.tab.sentiment"), icon: Activity },
    { id: "volatility", label: t("tools.tab.volatility"), icon: BarChart2 },
    { id: "cot", label: t("tools.tab.cot"), icon: FileText },
    { id: "backtest", label: t("tools.tab.backtest"), icon: FlaskConical },
    { id: "lot", label: "Dimensionamento", icon: BarChart2 },
  ] satisfies Array<{ id: ToolTabId; label: string; icon: React.ElementType }>;

  const handleTabChange = (value: string) => {
    const next = TOOL_TAB_IDS.includes(value as ToolTabId) ? (value as ToolTabId) : "montecarlo";
    setActiveTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };

  return (
    <PageLayout>
      <PageHeader title={t("tools.title")} subtitle={t("tools.subtitle")} />

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          <TabsList className="flex md:flex-col w-full md:w-1/4 h-auto gap-1 bg-card/50 backdrop-blur-md p-1.5 rounded-xl border border-border md:self-start overflow-x-auto">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm flex-1 md:w-full"
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <Card className="md:w-3/4">
            <CardContent className="p-4 sm:p-6">
              <TabsContent value="montecarlo" className="m-0">
                <MonteCarloTool />
              </TabsContent>
              <TabsContent value="sentiment" className="m-0">
                <SentimentTool />
              </TabsContent>
              <TabsContent value="volatility" className="m-0">
                <VolatilityTool />
              </TabsContent>
              <TabsContent value="cot" className="m-0">
                <CotTool />
              </TabsContent>
              <TabsContent value="backtest" className="m-0">
                <BacktestTool />
              </TabsContent>
              <TabsContent value="lot" className="m-0">
                <div className="p-4">
                  <LotCalculatorWidget />
                </div>
              </TabsContent>
            </CardContent>
          </Card>
        </div>
      </Tabs>
      </motion.section>
    </PageLayout>
  );
}
