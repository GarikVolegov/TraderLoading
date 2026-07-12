import { useState, useMemo, useEffect, useRef } from "react";
import { getPairLabel } from "@workspace/pair-catalog";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import {
  Plus, Trash2, ArrowLeft, TrendingUp, TrendingDown,
  BarChart3, FlaskConical, ChevronRight, Play,
} from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { QueryErrorState } from "@/components/QueryErrorState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
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
import ChartReplay from "@/components/ChartReplay";
import {
  createReplaySavedTradeIdsStorageKey,
  parseReplaySavedTradeIds,
  serializeReplaySavedTradeIds,
} from "@/components/chartReplayPersistence";
import { useBackground } from "@/contexts/BackgroundContext";
import { ProUpgradeGate } from "@/components/ProUpgradeGate";
import { calculateBacktestStats } from "@/lib/backtestStats";
import { uiText } from "@/contexts/LanguageContext";
import { calculateManualBacktestTradeResult } from "@/lib/backtestTradeResult";

const ALL_BT_PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "NZD/USD", "USD/CAD",
  "EUR/GBP", "EUR/JPY", "GBP/JPY", "AUD/JPY", "XAU/USD", "US30", "NAS100", "SPX500",
  "BTC/USD", "ETH/USD",
];

const TIMEFRAMES = ["M5", "M15", "M30", "H1", "H4", "D1", "W1"];

function NewSessionForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { selectedPairs: userPairs } = useBackground();
  const createMutation = useCreateBacktestSession();
  const [name, setName] = useState("");
  const pairOptions = useMemo(() => {
    if (userPairs.length === 0) return ALL_BT_PAIRS;
    const supportedSet = new Set(ALL_BT_PAIRS);
    const userLabels = userPairs.map((p) => getPairLabel(p)).filter((l) => supportedSet.has(l));
    const userSet = new Set(userLabels);
    const advanced = ALL_BT_PAIRS.filter((p) => !userSet.has(p));
    return userLabels.length > 0 ? [...userLabels, ...advanced] : ALL_BT_PAIRS;
  }, [userPairs]);
  const [pair, setPair] = useState(pairOptions[0] || "EUR/USD");
  const defaultAppliedRef = useRef(false);

  useEffect(() => {
    if (userPairs.length > 0 && !defaultAppliedRef.current) {
      defaultAppliedRef.current = true;
      if (pairOptions.length > 0) setPair(pairOptions[0]);
    } else if (pairOptions.length > 0 && !pairOptions.includes(pair)) {
      setPair(pairOptions[0]);
    }
  }, [pairOptions, pair, userPairs]);

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
        <h3 className="text-lg font-bold">{uiText("auto.ui.3d5ce24cbb")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">{uiText("backtest.session_name")}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Strategia Breakout Londra" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">{uiText("backtest.strategy")}</label>
            <Input value={strategy} onChange={(e) => setStrategy(e.target.value)} placeholder="es. Breakout + FVG" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">{uiText("auto.ui.569cf0cb1d")}</label>
            <select
              value={pair}
              onChange={(e) => setPair(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm"
            >
              {pairOptions.map((p, i) => {
                const userLabelCount = userPairs.length;
                if (userLabelCount > 0 && i === userLabelCount) {
                  return [
                    <option key="__sep" disabled>{uiText("auto.ui.aba10da8de")}</option>,
                    <option key={p} value={p}>{p}</option>
                  ];
                }
                return <option key={p} value={p}>{p}</option>;
              })}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">{uiText("auto.ui.85decb73d1")}</label>
            <div className="flex flex-wrap gap-1.5">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                    timeframe === tf
                      ? "bg-primary/20 text-primary border border-primary/40"
                      : "bg-secondary/40 text-muted-foreground border border-border/50"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose}>{uiText("auto.ui.6c3de5381b")}</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || createMutation.isPending}>
            <Plus className="w-4 h-4 mr-2" />
            Crea Sessione
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SessionDetail({ session, onBack }: { session: BacktestSession; onBack: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: trades, isLoading } = useGetBacktestTrades(session.id);
  const createTrade = useCreateBacktestTrade();
  const deleteTrade = useDeleteBacktestTrade();
  const [mode, setMode] = useState<"chart" | "manual">("chart");
  const [pendingChartTrades, setPendingChartTrades] = useState<Array<{
    id: number;
    direction: "buy" | "sell";
    entryPrice: number;
    exitPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    result?: "win" | "loss" | "breakeven";
    pips?: number;
  }>>([]);

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
    () => calculateManualBacktestTradeResult(entryPrice, exitPrice, direction, session.pair),
    [entryPrice, exitPrice, direction, session.pair],
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

  const handleSaveChartTrades = async (chartTrades: Array<{
    id: number;
    direction: "buy" | "sell";
    entryPrice: number;
    exitPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    result?: "win" | "loss" | "breakeven";
    pips?: number;
  }>) => {
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
    if (!confirm(uiText("auto.ui.4ac4839dab"))) return;
    await deleteTrade.mutateAsync({ id });
    qc.invalidateQueries({ queryKey: getGetBacktestTradesQueryKey(session.id) });
  };

  const stats = useMemo(() => calculateBacktestStats(trades), [trades]);

  return (
    <div className="space-y-4 min-w-0 overflow-hidden">
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
        <button
          onClick={() => setMode("chart")}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            mode === "chart" ? "bg-primary/20 text-primary" : "text-muted-foreground"
          }`}
        >
          <Play className="w-4 h-4" />
          Replay Grafico
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            mode === "manual" ? "bg-primary/20 text-primary" : "text-muted-foreground"
          }`}
        >
          <Plus className="w-4 h-4" />
          Manuale
        </button>
      </div>

      {mode === "chart" ? (
        <div className="space-y-3">
          <ChartReplay
            symbol={session.pair}
            interval={session.timeframe}
            persistenceKey={`backtest-session-${session.id}`}
            onTradesChange={(chartTrades) => {
              const completed = chartTrades.filter((t) => t.exitPrice != null && !savedTradeIds.has(t.id));
              setPendingChartTrades(completed);
            }}
          />
          {pendingChartTrades.length > 0 && (
            <Button
              onClick={() => handleSaveChartTrades(pendingChartTrades)}
              disabled={createTrade.isPending}
              className="w-full"
            >
              Salva {pendingChartTrades.length} trade nel database
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setDirection("buy")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                    direction === "buy" ? "bg-green-500/20 text-green-400 border border-green-500/40" : "bg-secondary/40 text-muted-foreground border border-border/50"
                  }`}
                >
                  BUY
                </button>
                <button
                  onClick={() => setDirection("sell")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                    direction === "sell" ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-secondary/40 text-muted-foreground border border-border/50"
                  }`}
                >
                  SELL
                </button>
              </div>
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 gap-3">
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
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{uiText("auto.ui.f80408f58a")}</label>
                  <Input type="number" step="0.01" value={lotSize} onChange={(e) => setLotSize(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{uiText("auto.ui.e5e429bcc9")}</label>
                  <Input type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} />
                </div>
              </div>
              <Input placeholder="Note (opzionale)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              {entryPrice && exitPrice && (
                <div className={`text-center py-2 rounded-lg text-sm font-bold ${
                  computedResult.result === "win" ? "bg-green-500/10 text-green-400"
                    : computedResult.result === "loss" ? "bg-red-500/10 text-red-400"
                    : "bg-yellow-500/10 text-yellow-400"
                }`}>
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
            <StatBox label="Trade" value={stats.total} color="text-foreground" icon={<BarChart3 className="w-4 h-4" />} />
            <StatBox label="Win Rate" value={`${stats.winRate}%`} color={stats.winRate >= 50 ? "text-green-400" : "text-red-400"} icon={<TrendingUp className="w-4 h-4" />} />
            <StatBox label="Pips Totali" value={stats.totalPips} color={parseFloat(stats.totalPips) >= 0 ? "text-green-400" : "text-red-400"} icon={<BarChart3 className="w-4 h-4" />} />
            {stats.avgRR && <StatBox label="R:R Medio" value={stats.avgRR} color={parseFloat(stats.avgRR) >= 1 ? "text-green-400" : "text-orange-400"} icon={<TrendingUp className="w-4 h-4" />} />}
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
          <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{uiText("auto.ui.9ab0b1b974")}</h4>
          <AnimatePresence>
            {trades.map((trade, idx) => (
              <motion.div
                key={trade.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: idx * 0.03 }}
                className="rounded-xl border border-border/50 bg-card/40 p-3 flex flex-col min-[420px]:flex-row min-[420px]:items-center gap-3 group hover:border-primary/30 transition-colors"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  trade.direction === "buy" ? "bg-green-500/15" : "bg-red-500/15"
                }`}>
                  {trade.direction === "buy"
                    ? <TrendingUp className="w-4 h-4 text-green-400" />
                    : <TrendingDown className="w-4 h-4 text-red-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{trade.entryPrice} → {trade.exitPrice}</span>
                    {trade.stopLoss && <span className="text-red-400/60">SL {trade.stopLoss}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-sm font-bold ${
                      trade.result === "win" ? "text-green-400" : trade.result === "loss" ? "text-red-400" : "text-yellow-400"
                    }`}>
                      {trade.result === "win" ? "+" : ""}{trade.pips ?? "0"} pips
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">
                      {format(parseISO(trade.tradeDate), "d MMM", { locale: it })}
                    </span>
                    {trade.notes && <span className="text-[10px] text-muted-foreground/50 truncate">{trade.notes}</span>}
                  </div>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                  trade.result === "win" ? "bg-green-500/15 text-green-400"
                    : trade.result === "loss" ? "bg-red-500/15 text-red-400"
                    : "bg-yellow-500/15 text-yellow-400"
                }`}>
                  {trade.result}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 h-7 w-7 p-0 text-destructive hover:bg-destructive/10 shrink-0 self-end min-[420px]:self-center"
                  onClick={() => handleDeleteTrade(trade.id)}
                >
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

function StatBox({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 p-3 sm:p-4 lg:p-5 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</span>
      </div>
      <p className={`text-xl sm:text-2xl font-mono font-bold ${color}`}>{value}</p>
    </div>
  );
}

function formatSignedPips(totalPips: string): string {
  const numericPips = parseFloat(totalPips);
  if (!Number.isFinite(numericPips)) return "0.0";
  return `${numericPips > 0 ? "+" : ""}${totalPips}`;
}

function SessionMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/30 bg-secondary/20 px-2 py-2 text-center">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      <p className={`mt-0.5 font-mono text-sm font-bold tabular-nums truncate ${color}`}>{value}</p>
    </div>
  );
}

export default function Backtest() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: sessions, isLoading, isError, refetch } = useGetBacktestSessions();
  const deleteMutation = useDeleteBacktestSession();
  const [showNew, setShowNew] = useState(false);
  const [activeSession, setActiveSession] = useState<BacktestSession | null>(null);

  const handleDelete = async (id: number) => {
    if (!confirm(uiText("auto.ui.7006c72ada"))) return;
    await deleteMutation.mutateAsync({ id });
    qc.invalidateQueries({ queryKey: getGetBacktestSessionsQueryKey() });
    toast({ description: "Sessione eliminata." });
  };

  if (activeSession) {
    return (
      <PageLayout>
        <ProUpgradeGate feature="backtest" fillViewport>
          <SessionDetail session={activeSession} onBack={() => setActiveSession(null)} />
        </ProUpgradeGate>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <ProUpgradeGate feature="backtest" fillViewport>
      <PageHeader
        title={uiText("auto.ui.c6e3b65510")}
        subtitle={uiText("auto.ui.a5c0238dec")}
        action={
          <Button onClick={() => setShowNew(!showNew)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuova Sessione
          </Button>
        }
      />

      <AnimatePresence>
        {showNew && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <NewSessionForm onClose={() => setShowNew(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      ) : isError ? (
        <QueryErrorState onRetry={() => void refetch()} />
      ) : !sessions || sessions.length === 0 ? (
        <Card className="border-dashed border-white/10">
          <CardContent className="px-4 py-12 sm:p-16 text-center">
            <FlaskConical className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold mb-2">{uiText("backtest.empty_title")}</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Crea una sessione per iniziare a fare replay su grafici reali e testare le tue strategie.
            </p>
            <Button onClick={() => setShowNew(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Prima Sessione
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {sessions.map((session, idx) => {
              const stats = session.stats;
              const totalPips = parseFloat(stats.totalPips);
              const winRateColor = stats.total === 0
                ? "text-muted-foreground"
                : stats.winRate >= 50 ? "text-green-400" : "text-red-400";
              const avgRRColor = stats.avgRR == null
                ? "text-muted-foreground"
                : parseFloat(stats.avgRR) >= 1 ? "text-green-400" : "text-orange-400";
              const profitColor = totalPips > 0
                ? "text-green-400"
                : totalPips < 0 ? "text-red-400" : "text-muted-foreground";

              return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => setActiveSession(session)}
                className="bg-card/60 backdrop-blur-sm border border-border/30 rounded-2xl p-4 sm:p-5 cursor-pointer group hover:border-primary/50 transition-colors relative"
              >
                <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                    <h3 className="text-base font-bold group-hover:text-primary transition-colors">{session.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {session.pair} · {session.timeframe}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 h-7 w-7 p-0 text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={(e) => { e.stopPropagation(); handleDelete(session.id); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {session.strategy && (
                  <p className="text-xs text-muted-foreground/70 mb-3 truncate">
                    Strategia: {session.strategy}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <SessionMetric label="Win Rate" value={`${stats.winRate}%`} color={winRateColor} />
                  <SessionMetric label="R:R" value={stats.avgRR ?? "--"} color={avgRRColor} />
                  <SessionMetric label="Profitto" value={formatSignedPips(stats.totalPips)} color={profitColor} />
                </div>
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/30">
                  <span className="text-[10px] text-muted-foreground/50">
                    {format(parseISO(session.createdAt), "d MMM yyyy", { locale: it })}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
      </ProUpgradeGate>
    </PageLayout>
  );
}
