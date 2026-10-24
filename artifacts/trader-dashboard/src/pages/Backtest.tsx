import { useState, useMemo, useEffect, useRef } from "react";
import { getPairLabel } from "@workspace/pair-catalog";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import {
  Plus, Trash2, TrendingUp, TrendingDown,
  BarChart3, FlaskConical, ChevronRight, Play, ArrowUpRight,
  Target, Layers, Zap, Flame, Gamepad2, RotateCcw, DollarSign,
} from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
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
  useDeleteBacktestTrade,
  getGetBacktestTradesQueryKey,
  type BacktestSession,
  type BacktestTrade,
} from "@workspace/api-client-react";
import { Link, useLocation, useSearch } from "wouter";
import { useBackground } from "@/contexts/BackgroundContext";
import { ProUpgradeGate } from "@/components/ProUpgradeGate";
import { calculateDetailedBacktestStats } from "@/lib/backtestStats";
import { uiText, useDateLocale } from "@/contexts/LanguageContext";
import { parseUtcDateTimeInput, utcDateTimeInput } from "@/components/backtest-terminal/dateTime";
import { fetchReplayCandlesMeta, type ReplayCandlesMeta } from "@/lib/replayCandlesApi";
import { useTraderProcess } from "@/hooks/useTraderProcess";
import { ReplayEquityCurve } from "@/components/backtest-terminal/ReplayEquityCurve";
import { BacktestBattlesDrawer } from "@/components/backtest-tournament/BacktestBattlesDrawer";
import { BacktestTournamentHub } from "@/components/backtest-tournament/BacktestTournamentHub";
import { DecompressionChamberModal } from "@/components/decompression/DecompressionChamberModal";
import { useLimenEntitlements } from "@/hooks/useLimenEntitlements";
import { LimenServiceLockGate } from "@/components/candidacy/LimenServiceLockGate";

const ALL_BT_PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "NZD/USD", "USD/CAD",
  "EUR/GBP", "EUR/JPY", "GBP/JPY", "AUD/JPY", "XAU/USD", "USOIL", "US30", "NAS100", "SPX500",
  "BTC/USD", "ETH/USD",
];

const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1"];

function NewSessionForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (session: BacktestSession) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { selectedPairs: userPairs } = useBackground();
  const createMutation = useCreateBacktestSession({ mutation: { meta: { suppressGlobalError: true } } });
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
  const [startDateTime, setStartDateTime] = useState("");
  const [historyMeta, setHistoryMeta] = useState<ReplayCandlesMeta | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setHistoryMeta(null);
    fetchReplayCandlesMeta(pair, { signal: controller.signal })
      .then((meta) => { if (!controller.signal.aborted) setHistoryMeta(meta); })
      .catch(() => { /* Coverage stays unavailable when metadata cannot be fetched. */ });
    return () => controller.abort();
  }, [pair]);

  const selectedStartTime = parseUtcDateTimeInput(startDateTime);
  const firstOpen = historyMeta?.warehouse?.firstTs;
  const lastOpen = historyMeta?.warehouse?.lastTs;
  const firstTime = firstOpen != null ? firstOpen + 60 : null;
  const lastTime = lastOpen != null ? lastOpen + 60 : null;
  const startOutsideHistory = selectedStartTime != null && ((firstTime != null && selectedStartTime < firstTime) || (lastTime != null && selectedStartTime > lastTime));

  const handleSubmit = async () => {
    if (!name.trim()) return;
    try {
      const session = await createMutation.mutateAsync({
        data: { name: name.trim(), pair, timeframe, strategy: strategy.trim() || undefined },
      });
      const startTime = parseUtcDateTimeInput(startDateTime);
      if (startTime != null) {
        try {
          window.localStorage.setItem(`traderloading:backtest-start:${session.id}`, String(startTime));
        } catch {
          // Go to date remains available when browser storage is unavailable.
        }
      }
      qc.invalidateQueries({ queryKey: getGetBacktestSessionsQueryKey() });
      toast({ description: uiText("auto.ui.77da81d703") });
      onCreated?.(session as BacktestSession);
      onClose();
    } catch {
      toast({ description: uiText("auto.ui.1d24d6b2b5"), variant: "destructive" });
    }
  };

  return (
    <Card className="border-primary/40 bg-card/95 shadow-lg">
      <CardContent className="p-3.5 space-y-3">
        <div className="flex items-center justify-between border-b border-border pb-1.5">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
            {uiText("auto.ui.3d5ce24cbb")}
          </h3>
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            {"Forgia Replay"}
          </span>
        </div>
        <div className="space-y-2.5">
          <div className="space-y-1">
            <label className="text-[9.5px] font-mono text-muted-foreground uppercase tracking-wider">
              {uiText("backtest.session_name")}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={uiText("auto.ui.41eceb478a")}
              className="h-8 text-xs font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9.5px] font-mono text-muted-foreground uppercase tracking-wider">
              {uiText("backtest.strategy")}
            </label>
            <Input
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              placeholder={uiText("auto.ui.a4b1c0aace")}
              className="h-8 text-xs font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[9.5px] font-mono text-muted-foreground uppercase tracking-wider">
                {uiText("auto.ui.569cf0cb1d")}
              </label>
              <select
                value={pair}
                onChange={(e) => setPair(e.target.value)}
                className="w-full h-8 px-2 rounded-md border border-border bg-background text-xs font-mono"
              >
                {pairOptions.map((p, i) => {
                  const userLabelCount = userPairs.length;
                  if (userLabelCount > 0 && i === userLabelCount) {
                    return [
                      <option key="__sep" disabled>{uiText("auto.ui.aba10da8de")}</option>,
                      <option key={p} value={p}>{p}</option>,
                    ];
                  }
                  return <option key={p} value={p}>{p}</option>;
                })}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9.5px] font-mono text-muted-foreground uppercase tracking-wider">
                {uiText("auto.ui.85decb73d1")}
              </label>
              <div className="flex flex-wrap gap-1">
                {TIMEFRAMES.slice(0, 4).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setTimeframe(tf)}
                    className={`px-1.5 py-1 text-[9px] font-mono font-bold transition-all border ${
                      timeframe === tf
                        ? "bg-primary/20 text-primary border-primary/50"
                        : "bg-background text-muted-foreground border-border"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="backtest-session-start" className="text-[9.5px] font-mono text-muted-foreground uppercase tracking-wider">
              {uiText("backtest_terminal.start_datetime")} · {uiText("backtest_terminal.timezone_utc")}
            </label>
            <Input
              id="backtest-session-start"
              type="datetime-local"
              step={60}
              value={startDateTime}
              onChange={(event) => setStartDateTime(event.target.value)}
              min={utcDateTimeInput(firstTime) || undefined}
              max={utcDateTimeInput(lastTime) || undefined}
              aria-invalid={startOutsideHistory}
              className="h-8 text-xs font-mono"
            />
            {startOutsideHistory && (
              <p className="text-[9px] text-destructive" role="alert">
                {uiText("backtest_terminal.date_outside_history")}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs font-mono">
            {uiText("auto.ui.6c3de5381b")}
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!name.trim() || createMutation.isPending || startOutsideHistory || (startDateTime !== "" && selectedStartTime == null)}
            className="h-7 text-xs font-mono"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            {uiText("auto.ui.1a33586f3b")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function formatStatCurrency(formatted: string): React.ReactNode {
  const parts = formatted.trim().split(" ");
  if (parts.length === 2) {
    return (
      <span className="whitespace-nowrap inline-flex items-baseline gap-1">
        <span>{parts[0]}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/75">{parts[1]}</span>
      </span>
    );
  }
  return <span className="whitespace-nowrap">{formatted}</span>;
}

function StatBox({
  label,
  value,
  subvalue,
  color,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  subvalue?: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="border border-[#C5A059]/20 hover:border-[#C5A059]/45 bg-[#0B0D13]/90 rounded-md p-2.5 flex flex-col justify-between transition-all duration-150 shadow-sm relative overflow-hidden group">
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span className="text-[9.5px] font-mono uppercase tracking-wider font-bold text-muted-foreground truncate">
          {label}
        </span>
        <span className={`p-1 rounded bg-background/60 border border-border/40 ${color} shrink-0`}>
          {icon}
        </span>
      </div>
      <div>
        <div className={`text-base sm:text-lg xl:text-[15px] 2xl:text-[17px] font-mono font-bold tabular-nums tracking-tight whitespace-nowrap leading-tight ${color}`}>
          {typeof value === "string" && value.includes(" ") ? formatStatCurrency(value) : value}
        </div>
        {subvalue && (
          <p className="text-[9px] sm:text-[9.5px] font-mono text-muted-foreground/80 mt-1 whitespace-nowrap overflow-hidden text-ellipsis" title={subvalue}>
            {subvalue}
          </p>
        )}
      </div>
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
    <div className="min-w-0 border border-border/60 bg-background/70 px-2 py-1.5 text-center">
      <p className="text-[8.5px] font-mono uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      <p className={`mt-0.5 font-mono text-xs font-bold tabular-nums truncate ${color}`}>{value}</p>
    </div>
  );
}

type TradeFilter = "all" | "win" | "loss" | "breakeven" | "buy" | "sell";

export default function Backtest() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const dateLocale = useDateLocale();
  const search = useSearch();
  const [, navigate] = useLocation();
  const methodVersionId = new URLSearchParams(search).get("methodVersionId");
  const urlSessionId = useMemo(() => {
    const param = new URLSearchParams(search).get("session") || new URLSearchParams(search).get("sessionId");
    return param ? parseInt(param, 10) : null;
  }, [search]);
  const processQuery = useTraderProcess();
  const activeMethod = processQuery.data?.activeMethod ?? null;
  const { entitlements } = useLimenEntitlements();

  const { data: sessions, isLoading, isError, refetch } = useGetBacktestSessions({
    query: {
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  });
  const deleteMutation = useDeleteBacktestSession();
  const [showNew, setShowNew] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(urlSessionId);
  const [tradeFilter, setTradeFilter] = useState<TradeFilter>("all");
  const [decompressionOpen, setDecompressionOpen] = useState(false);

  // Sync selectedSessionId if urlSessionId changes
  useEffect(() => {
    if (urlSessionId != null) {
      setSelectedSessionId(urlSessionId);
    }
  }, [urlSessionId]);

  // Default to URL session or the first available session when sessions load
  const activeSession = useMemo(() => {
    if (!sessions || sessions.length === 0) return null;
    const targetId = selectedSessionId ?? urlSessionId;
    if (targetId != null) {
      const found = sessions.find((s) => s.id === targetId);
      if (found) return found;
    }
    return sessions[0];
  }, [sessions, selectedSessionId, urlSessionId]);

  // Active session trades - always fresh
  const { data: trades, isLoading: tradesLoading, refetch: refetchTrades, isFetching: tradesFetching } = useGetBacktestTrades(activeSession?.id ?? 0, {
    query: {
      enabled: Boolean(activeSession?.id),
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  });
  const deleteTrade = useDeleteBacktestTrade();

  const handleDeleteTrade = async (id: number) => {
    if (!activeSession) return;
    if (!confirm(uiText("auto.ui.4ac4839dab"))) return;
    await deleteTrade.mutateAsync({ id });
    qc.invalidateQueries({ queryKey: getGetBacktestTradesQueryKey(activeSession.id) });
    qc.invalidateQueries({ queryKey: getGetBacktestSessionsQueryKey() });
  };

  const handleDelete = async (id: number) => {
    if (!confirm(uiText("auto.ui.7006c72ada"))) return;
    await deleteMutation.mutateAsync({ id });
    if (selectedSessionId === id) setSelectedSessionId(null);
    qc.invalidateQueries({ queryKey: getGetBacktestSessionsQueryKey() });
    toast({ description: uiText("auto.ui.f3f3973e11") });
  };

  const activeInitialBalance = useMemo(() => {
    if (!activeSession) return 10000;
    try {
      const raw = window.localStorage.getItem(
        `traderloading:replay-state:backtest-session-${activeSession.id}:${activeSession.pair.replace("/", "")}`,
      );
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.initialBalance === "number" && parsed.initialBalance > 0) {
          return parsed.initialBalance;
        }
      }
    } catch {
      // fallback to standard initial balance
    }
    return 10000;
  }, [activeSession]);

  const detailedStats = useMemo(
    () => calculateDetailedBacktestStats(trades, activeInitialBalance),
    [trades, activeInitialBalance],
  );

  // Filtered trades list
  const filteredTrades = useMemo(() => {
    if (!trades) return [];
    if (tradeFilter === "all") return trades;
    if (tradeFilter === "win" || tradeFilter === "loss" || tradeFilter === "breakeven") {
      return trades.filter((t) => t.result === tradeFilter);
    }
    if (tradeFilter === "buy" || tradeFilter === "sell") {
      return trades.filter((t) => t.direction === tradeFilter);
    }
    return trades;
  }, [trades, tradeFilter]);

  if (!entitlements.forgeOfThePast) {
    return (
      <PageLayout>
        <LimenServiceLockGate serviceId="forge_of_the_past" />
      </PageLayout>
    );
  }

  const showBattlesHub = new URLSearchParams(search).get("tab") === "battaglie" || new URLSearchParams(search).get("sub") === "battaglie";

  if (showBattlesHub) {
    return (
      <PageLayout quiet fullWidth className="h-[100dvh]">
        <ProUpgradeGate feature="backtest" fillViewport>
          <BacktestTournamentHub onExit={() => navigate("/backtest")} />
        </ProUpgradeGate>
      </PageLayout>
    );
  }

  return (
    <PageLayout quiet fullWidth className="h-[100dvh]">
      <ProUpgradeGate feature="backtest" fillViewport>
        <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-3 flex-1 min-h-0 h-full overflow-hidden">
            {/* ── Archivio Sessioni Replay (Colonna Sinistra) ── */}
            <aside className="border border-border/80 bg-card/60 backdrop-blur flex flex-col h-full min-h-0 overflow-hidden">
              {/* Header / Protocollo in Verifica */}
              <div className="p-3 border-b border-border/70 space-y-2 shrink-0 bg-card/90">
                {activeMethod && (
                  <div className="border border-border/70 bg-background/80 px-2.5 py-1.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-[8.5px] uppercase tracking-wider text-primary block">
                        {"Protocollo in Verifica"}
                      </span>
                      <strong className="text-[11px] font-semibold text-foreground truncate block">
                        {`${activeMethod.name} · v${activeMethod.version}`}
                      </strong>
                    </div>
                    <Link
                      href="/patrimonio"
                      className="inline-flex items-center gap-1 border border-border bg-background px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground hover:border-primary/40 hover:text-primary shrink-0"
                    >
                      <span>{`${activeMethod.rules.riskPerTrade} ${activeMethod.rules.currency}`}</span>
                      <ArrowUpRight size={10} />
                    </Link>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FlaskConical className="w-3.5 h-3.5 text-primary" />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-foreground font-bold">
                      {`Sessioni Replay (${sessions?.length ?? 0})`}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowNew(!showNew)}
                    className="h-6 px-2 font-mono text-[9.5px] uppercase tracking-wider border-[#C5A059]/40 bg-[#0C0D12] text-[#D4AF37] hover:bg-[#C5A059]/15 hover:border-[#C5A059] transition-all"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {uiText("auto.ui.60b228a51f")}
                  </Button>
                </div>
              </div>

              {/* Form nuova sessione (animato) */}
              <AnimatePresence>
                {showNew && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-2 border-b border-border/70 overflow-hidden shrink-0"
                  >
                    <NewSessionForm
                      onClose={() => setShowNew(false)}
                      onCreated={(created) => {
                        setSelectedSessionId(created.id);
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Lista Sessioni con Scorrimento Interno a tutta altezza */}
              <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-24 rounded border border-[#C5A059]/20 bg-[#141418]/60 p-3 animate-pulse" />
                    ))}
                  </div>
                ) : isError ? (
                  <QueryErrorState onRetry={() => void refetch()} />
                ) : !sessions || sessions.length === 0 ? (
                  <Card className="border-dashed border-border bg-card/40 my-4">
                    <CardContent className="p-4 text-center space-y-2.5">
                      <FlaskConical className="w-7 h-7 mx-auto text-primary/40" />
                      <h3 className="text-xs font-bold">{uiText("backtest.empty_title")}</h3>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        {uiText("auto.ui.1c5e4ae4f3")}
                      </p>
                      <Button variant="outline" size="sm" onClick={() => setShowNew(true)} className="h-7 text-xs font-mono">
                        <Plus className="w-3 h-3 mr-1" />
                        {uiText("auto.ui.20fe4cdc4d")}
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <AnimatePresence>
                    {sessions.map((session, idx) => {
                      const sessionStats = session.stats;
                      const totalPips = parseFloat(sessionStats.totalPips);
                      const isSelected = activeSession?.id === session.id;
                      const winRateColor =
                        sessionStats.total === 0
                          ? "text-muted-foreground"
                          : sessionStats.winRate >= 50
                            ? "text-emerald-400"
                            : "text-rose-400";
                      const avgRRColor =
                        sessionStats.avgRR == null
                          ? "text-muted-foreground"
                          : parseFloat(sessionStats.avgRR) >= 1
                            ? "text-emerald-400"
                            : "text-[#C5A059]";
                      const profitColor =
                        totalPips > 0
                          ? "text-emerald-400"
                          : totalPips < 0
                            ? "text-rose-400"
                            : "text-muted-foreground";

                      return (
                        <motion.div
                          key={session.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ delay: idx * 0.02 }}
                          onClick={() => {
                            setSelectedSessionId(session.id);
                            window.history.replaceState(null, "", "?session=" + session.id);
                          }}
                          className={`border p-2.5 cursor-pointer group transition-all relative ${
                            isSelected
                              ? "border-primary bg-primary/10 shadow-[inset_2px_0_0_hsl(var(--primary))]"
                              : "border-border/70 bg-card/75 hover:border-primary/45 hover:bg-card"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5 mb-1">
                            <div className="min-w-0">
                              <h3 className="text-xs font-bold truncate group-hover:text-primary transition-colors">
                                {session.name}
                              </h3>
                              <p className="font-mono text-[9.5px] text-muted-foreground mt-0.5">
                                {session.pair} · {session.timeframe}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 h-5 w-5 p-0 text-destructive hover:bg-destructive/10 shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDelete(session.id);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          {session.strategy && (
                            <p className="text-[9.5px] text-muted-foreground/75 mb-1.5 truncate">
                              {uiText("auto.ui.1af8e91d4b", { strategy: session.strategy })}
                            </p>
                          )}
                          <div className="grid grid-cols-3 gap-1 mb-1">
                            <SessionMetric label="Win Rate" value={`${sessionStats.winRate}%`} color={winRateColor} />
                            <SessionMetric label="R:R" value={sessionStats.avgRR ?? "--"} color={avgRRColor} />
                            <SessionMetric label={uiText("auto.ui.82907d818c")} value={formatSignedPips(sessionStats.totalPips)} color={profitColor} />
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-border/40">
                            <span className="font-mono text-[8.5px] text-muted-foreground/65">
                              {format(parseISO(session.createdAt), "d MMM yyyy", { locale: dateLocale })}
                            </span>
                            <span className="inline-flex items-center gap-0.5 font-mono text-[9px] uppercase text-primary">
                              <span>{isSelected ? "Attiva" : "Apri"}</span>
                              <ChevronRight className="w-3 h-3" />
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>

              {/* Tendina Le Prove del Fuoco (posizionata sotto le sessioni) */}
              <BacktestBattlesDrawer onOpenHub={() => navigate("/backtest?tab=battaglie")} />

              {/* Status footer per ancorare saldamente il pannello */}
              <div className="p-2 border-t border-border/70 bg-card/90 flex items-center justify-between text-[9px] font-mono text-muted-foreground shrink-0">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  Terminale Replay Pronto
                </span>
                <span className="text-muted-foreground/75 uppercase tracking-wider">
                  M1→W1 Warehouse
                </span>
              </div>
            </aside>

            {/* ── Area Operativa & Statistiche Avanzate (Colonna Destra - Inalterata) ── */}
            <main className="border border-border/80 bg-card/60 backdrop-blur flex flex-col h-full min-h-0 overflow-hidden p-3 gap-2.5">
              {/* Hero Session Command Bar */}
              <div className="border border-primary/40 bg-gradient-to-r from-primary/15 via-card to-card p-3 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="border border-primary/50 bg-primary/20 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-primary">
                      {activeSession ? `SESSIONE #${activeSession.id}` : "LA FORGIA"}
                    </span>
                    <strong className="text-sm sm:text-base font-bold truncate">
                      {activeSession ? activeSession.name : uiText("backtest_terminal.launch_title")}
                    </strong>
                    {activeSession?.strategy && (
                      <span className="border border-border bg-background/80 px-2 py-0.5 font-mono text-[9px] text-muted-foreground truncate">
                        {activeSession.strategy}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {activeSession
                      ? `${activeSession.pair} · ${activeSession.timeframe} — Rivivi il mercato candela per candela: ordini simulati, SL/TP e journal.`
                      : uiText("backtest_terminal.launch_subtitle")}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    onClick={() => {
                      void refetch();
                      void refetchTrades();
                      toast({ description: "Statistiche e telemetria sincronizzate" });
                    }}
                    className="font-mono text-xs uppercase tracking-wider border-border/80 hover:border-primary/50 text-muted-foreground hover:text-foreground h-9"
                    title="Ricarica telemetria e trade aggiornati"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${tradesFetching ? "animate-spin text-primary" : ""}`} />
                    <span>Aggiorna</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setDecompressionOpen(true)}
                    className="font-mono text-xs uppercase tracking-wider border-[#C5A059]/40 hover:bg-[#C5A059]/15 text-[#E8C56A] font-bold h-9"
                    title="Camera di Decompressione: stacca la mente e ricarica il focus"
                  >
                    <Gamepad2 className="w-3.5 h-3.5 mr-1.5" />
                    <span>Pausa Decompressione</span>
                  </Button>
                  {activeSession ? (
                    <Button
                      onClick={() =>
                        navigate(
                          `/backtest/${activeSession.id}/replay${
                            methodVersionId ? `?methodVersionId=${encodeURIComponent(methodVersionId)}` : ""
                          }`,
                        )
                      }
                      className="font-mono text-xs uppercase tracking-wider bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-black hover:brightness-110 shadow-md font-bold h-9"
                    >
                      <Play className="w-4 h-4 mr-1.5 fill-black" />
                      {uiText("backtest_terminal.launch_cta")}
                    </Button>
                  ) : (
                    <Button onClick={() => setShowNew(true)} className="font-mono text-xs uppercase tracking-wider h-9">
                      <Plus className="w-4 h-4 mr-1.5" />
                      {uiText("auto.ui.20fe4cdc4d")}
                    </Button>
                  )}
                </div>
              </div>

              {/* 6 KPI Cards avanzate */}
              {detailedStats ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 shrink-0">
                  <StatBox
                    label="Trade"
                    value={detailedStats.total}
                    subvalue={`${detailedStats.longStats.total} Long · ${detailedStats.shortStats.total} Short`}
                    color="text-foreground"
                    icon={<BarChart3 className="w-3.5 h-3.5" />}
                  />
                  <StatBox
                    label="Win Rate"
                    value={`${detailedStats.winRate}%`}
                    subvalue={`${detailedStats.wins}W · ${detailedStats.losses}L · ${detailedStats.breakevens}BE`}
                    color={detailedStats.winRate >= 50 ? "text-emerald-400" : "text-rose-400"}
                    icon={<TrendingUp className="w-3.5 h-3.5" />}
                  />
                  <StatBox
                    label="PNL Netto"
                    value={detailedStats.totalPnlFormatted}
                    subvalue={`ROI: ${detailedStats.roiPctFormatted} · ${formatSignedPips(detailedStats.totalPips)}p`}
                    color={detailedStats.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}
                    icon={<DollarSign className="w-3.5 h-3.5" />}
                  />
                  <StatBox
                    label={uiText("auto.ui.37d3f03245")}
                    value={detailedStats.avgRR ?? "--"}
                    subvalue={`Exp: ${detailedStats.expectancyPips} pips`}
                    color={detailedStats.avgRR && parseFloat(detailedStats.avgRR) >= 1 ? "text-emerald-400" : "text-[#C5A059]"}
                    icon={<Target className="w-3.5 h-3.5" />}
                  />
                  <StatBox
                    label="Profit Factor"
                    value={detailedStats.profitFactor ?? "--"}
                    subvalue={detailedStats.winLossRatio ? `W/L: ${detailedStats.winLossRatio}x` : "Gains/Loss"}
                    color={detailedStats.profitFactor && parseFloat(detailedStats.profitFactor) >= 1.5 ? "text-emerald-400" : "text-[#C5A059]"}
                    icon={<Zap className="w-3.5 h-3.5" />}
                  />
                  <StatBox
                    label="Top / Worst"
                    value={detailedStats.bestTradePnlFormatted}
                    subvalue={`Min: ${detailedStats.worstTradePnlFormatted}`}
                    color="text-emerald-400"
                    icon={<Flame className="w-3.5 h-3.5" />}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 shrink-0">
                  {["Trade", "Win Rate", "PNL Netto", "R:R Medio", "Profit Factor", "Top Trade"].map((label) => (
                    <div key={label} className="border border-[#C5A059]/20 bg-[#0B0D13]/90 rounded-md p-2.5 text-center">
                      <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
                      <p className="text-base font-mono font-bold text-muted-foreground mt-0.5">--</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Area Gestione Visiva: Curva Cumulativa Equity + Matrice Direzionale Long vs Short */}
              {detailedStats && (
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-2.5 shrink-0">
                  {/* Curva Equity / Pips Cumulata */}
                  <ReplayEquityCurve
                    data={detailedStats.equityCurve}
                    height={140}
                    className="h-[140px]"
                    currency={detailedStats.currency}
                    initialBalance={detailedStats.initialBalance}
                  />

                  {/* Matrice Direzionale Long vs Short & Distribuzione Esiti */}
                  <div className="border border-border/80 bg-card/85 p-3 flex flex-col justify-between h-[140px]">
                    <div>
                      <div className="flex items-center justify-between mb-1.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">
                        <span className="flex items-center gap-1 text-primary font-bold">
                          <Layers className="w-3.5 h-3.5 text-primary" />
                          Analisi Direzionale & Esiti
                        </span>
                        <span className="text-foreground font-semibold">
                          {`${detailedStats.wins}W / ${detailedStats.losses}L / ${detailedStats.breakevens}BE`}
                        </span>
                      </div>

                      {/* Barra di distribuzione colorata */}
                      <div className="h-2 bg-background border border-border overflow-hidden flex mb-2.5">
                        {detailedStats.wins > 0 && (
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${(detailedStats.wins / detailedStats.total) * 100}%` }}
                            title={`Vincite: ${detailedStats.wins} (${detailedStats.winRate}%)`}
                          />
                        )}
                        {detailedStats.breakevens > 0 && (
                          <div
                            className="h-full bg-amber-500"
                            style={{ width: `${(detailedStats.breakevens / detailedStats.total) * 100}%` }}
                            title={`Breakeven: ${detailedStats.breakevens} (${detailedStats.beRate}%)`}
                          />
                        )}
                        {detailedStats.losses > 0 && (
                          <div
                            className="h-full bg-rose-500"
                            style={{ width: `${(detailedStats.losses / detailedStats.total) * 100}%` }}
                            title={`Perdite: ${detailedStats.losses} (${detailedStats.lossRate}%)`}
                          />
                        )}
                      </div>
                    </div>

                    {/* Breakdown Long vs Short + Streak */}
                    <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
                      <div className="border border-border/60 bg-background/70 p-1.5">
                        <div className="flex items-center justify-center gap-1 text-[8.5px] uppercase text-emerald-400 font-bold">
                          <TrendingUp className="w-3 h-3" />
                          Longs ({detailedStats.longStats.total})
                        </div>
                        <p className="text-[11px] font-bold text-foreground mt-0.5 whitespace-nowrap">
                          {detailedStats.longStats.winRate}% WR
                        </p>
                        <p
                          className={`text-[8.5px] whitespace-nowrap ${detailedStats.longStats.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                          title={`${formatSignedPips(detailedStats.longStats.totalPips)} pips`}
                        >
                          {detailedStats.longStats.totalPnlFormatted}
                        </p>
                      </div>

                      <div className="border border-border/60 bg-background/70 p-1.5">
                        <div className="flex items-center justify-center gap-1 text-[8.5px] uppercase text-rose-400 font-bold">
                          <TrendingDown className="w-3 h-3" />
                          Shorts ({detailedStats.shortStats.total})
                        </div>
                        <p className="text-[11px] font-bold text-foreground mt-0.5 whitespace-nowrap">
                          {detailedStats.shortStats.winRate}% WR
                        </p>
                        <p
                          className={`text-[8.5px] whitespace-nowrap ${detailedStats.shortStats.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                          title={`${formatSignedPips(detailedStats.shortStats.totalPips)} pips`}
                        >
                          {detailedStats.shortStats.totalPnlFormatted}
                        </p>
                      </div>

                      <div className="border border-border/60 bg-background/70 p-1.5">
                        <div className="text-[8.5px] uppercase text-muted-foreground font-bold">
                          Serie / Streak
                        </div>
                        <p className="text-[11px] font-bold text-emerald-400 mt-0.5 whitespace-nowrap">
                          {detailedStats.maxConsecutiveWins}W max
                        </p>
                        <p className="text-[8.5px] text-rose-400 whitespace-nowrap">
                          {detailedStats.maxConsecutiveLosses}L max
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Registro Replay a Piena Altezza (Occupa tutto lo spazio rimanente fino in fondo) ── */}
              <div className="flex-1 min-h-0 flex flex-col border border-border/80 bg-card/85 overflow-hidden">
                {/* Header Registro con Filtri */}
                <div className="p-2.5 border-b border-border/70 flex flex-wrap items-center justify-between gap-2 shrink-0 bg-card/90">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                      {"Registro Trade Eseguiti"}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      ({filteredTrades.length} di {trades?.length ?? 0})
                    </span>
                  </div>

                  {/* Filtri pillola */}
                  <div className="flex items-center gap-1 font-mono text-[9.5px]">
                    {(
                      [
                        { id: "all", label: `Tutti (${trades?.length ?? 0})` },
                        { id: "win", label: `Vincite (${detailedStats?.wins ?? 0})` },
                        { id: "loss", label: `Perdite (${detailedStats?.losses ?? 0})` },
                        { id: "breakeven", label: `BE (${detailedStats?.breakevens ?? 0})` },
                        { id: "buy", label: `Long (${detailedStats?.longStats.total ?? 0})` },
                        { id: "sell", label: `Short (${detailedStats?.shortStats.total ?? 0})` },
                      ] as const
                    ).map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setTradeFilter(filter.id)}
                        className={`px-2 py-0.5 border transition-all ${
                          tradeFilter === filter.id
                            ? "bg-primary/20 text-primary border-primary/60 font-bold"
                            : "bg-background/60 text-muted-foreground border-border/70 hover:border-primary/30"
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Elenco Trade scrollabile */}
                <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-1.5">
                  {tradesLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-10 border border-border bg-background/50 animate-pulse" />
                      ))}
                    </div>
                  ) : !filteredTrades || filteredTrades.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <FlaskConical className="w-8 h-8 mx-auto text-primary/30" />
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        {trades && trades.length > 0
                          ? "Nessun trade corrisponde al filtro selezionato."
                          : "Nessun trade registrato in questa sessione. Avvia il Terminale Replay per testare e registrare ordini candela per candela."}
                      </p>
                      {activeSession && (!trades || trades.length === 0) && (
                        <Button
                          size="sm"
                          onClick={() =>
                            navigate(
                              `/backtest/${activeSession.id}/replay${
                                methodVersionId ? `?methodVersionId=${encodeURIComponent(methodVersionId)}` : ""
                              }`,
                            )
                          }
                          className="font-mono text-xs uppercase tracking-wider mt-2"
                        >
                          <Play className="w-3.5 h-3.5 mr-1" />
                          {uiText("backtest_terminal.launch_cta")}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <AnimatePresence>
                        {filteredTrades.map((trade: BacktestTrade, idx) => (
                          <motion.div
                            key={trade.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -12 }}
                            transition={{ delay: Math.min(idx * 0.015, 0.3) }}
                            className="border border-border/70 bg-background/80 hover:bg-background hover:border-primary/45 p-2 px-3 flex items-center justify-between gap-3 group transition-colors font-mono"
                          >
                            {/* Direzione & Icona */}
                            <div className="flex items-center gap-2.5 min-w-[90px]">
                              <div
                                className={`w-6 h-6 flex items-center justify-center shrink-0 border ${
                                  trade.direction === "buy"
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                    : "border-rose-500/30 bg-rose-500/10 text-rose-400"
                                }`}
                              >
                                {trade.direction === "buy" ? (
                                  <TrendingUp className="w-3 h-3" />
                                ) : (
                                  <TrendingDown className="w-3 h-3" />
                                )}
                              </div>
                              <span className={`text-[10px] font-bold uppercase ${
                                trade.direction === "buy" ? "text-emerald-400" : "text-rose-400"
                              }`}>
                                {trade.direction}
                              </span>
                            </div>

                            {/* Prezzi Entry -> Exit */}
                            <div className="flex-1 min-w-[140px] text-[10.5px]">
                              <span className="text-muted-foreground">{trade.entryPrice}</span>
                              <span className="text-muted-foreground/60 mx-1.5">→</span>
                              <span className="text-foreground font-semibold">{trade.exitPrice}</span>
                              {(trade.stopLoss || trade.takeProfit) && (
                                <span className="text-[9px] text-muted-foreground/60 ml-2 hidden sm:inline">
                                  {trade.stopLoss ? `SL: ${trade.stopLoss}` : ""} {trade.takeProfit ? `TP: ${trade.takeProfit}` : ""}
                                </span>
                              )}
                            </div>

                            {/* PNL & Pips Risultato */}
                            <div className="min-w-[120px] text-right">
                              {trade.netPnl != null ? (
                                <>
                                  <span
                                    className={`text-xs font-bold tabular-nums whitespace-nowrap ${
                                      parseFloat(trade.netPnl) > 0
                                        ? "text-emerald-400"
                                        : parseFloat(trade.netPnl) < 0
                                          ? "text-rose-400"
                                          : "text-amber-400"
                                    }`}
                                  >
                                    {parseFloat(trade.netPnl) >= 0 ? "+" : ""}
                                    {parseFloat(trade.netPnl).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                                    {trade.currency ?? "EUR"}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground/75 block tabular-nums whitespace-nowrap">
                                    {trade.result === "win" ? "+" : ""}{trade.pips ?? "0"} pips
                                  </span>
                                </>
                              ) : (
                                <span
                                  className={`text-xs font-bold tabular-nums whitespace-nowrap ${
                                    trade.result === "win"
                                      ? "text-emerald-400"
                                      : trade.result === "loss"
                                        ? "text-rose-400"
                                        : "text-amber-400"
                                  }`}
                                >
                                  {trade.result === "win" ? "+" : ""}{trade.pips ?? "0"} pips
                                </span>
                              )}
                            </div>

                            {/* Lotti & Data */}
                            <div className="min-w-[90px] text-right hidden sm:block text-[9.5px] text-muted-foreground/75">
                              <span>{trade.lotSize} lotti</span>
                              <span className="block text-[8.5px] text-muted-foreground/60">
                                {format(parseISO(trade.tradeDate), "d MMM yyyy", { locale: dateLocale })}
                              </span>
                            </div>

                            {/* Azioni */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 h-6 w-6 p-0 text-destructive hover:bg-destructive/10 shrink-0"
                              onClick={() => void handleDeleteTrade(trade.id)}
                              title="Elimina trade simulato"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* Footer del Registro: Riepilogo Rapido */}
                <div className="p-2 border-t border-border/70 bg-card/90 flex items-center justify-between text-[9.5px] font-mono text-muted-foreground shrink-0">
                  <span>
                    Filtro attivo: <strong className="text-foreground uppercase">{tradeFilter}</strong>
                  </span>
                  <span>
                    {filteredTrades.length} operazioni visualizzate
                  </span>
                </div>
              </div>
            </main>
          </div>
        </div>
      </ProUpgradeGate>
      <DecompressionChamberModal open={decompressionOpen} onOpenChange={setDecompressionOpen} />
    </PageLayout>
  );
}
