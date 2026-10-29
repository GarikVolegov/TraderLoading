// ─── Backtest replay terminal page ───────────────────────────────────────────
// Full-screen route (/backtest/:id/replay) rendered above the app chrome
// (z-60 > nav z-50): looks up the session, gates on Pro and mounts the
// terminal. Esc or the header back button return to /backtest. Closed trades
// are persisted to the on-contract trades endpoint, deduped per session via
// the same saved-ids mechanism as the legacy chart mode.
import { useCallback, useEffect, useMemo, useRef, useState, Component, type ErrorInfo, type ReactNode } from "react";
import { useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetBacktestTradesQueryKey,
  getGetBacktestSessionsQueryKey,
  useCreateBacktestTrade,
  useGetBacktestSessions,
} from "@workspace/api-client-react";
import { useProcessCopy } from "@/components/process/ProcessUI";
import { ProUpgradeGate } from "@/components/ProUpgradeGate";
import { LimenServiceLockGate } from "@/components/candidacy/LimenServiceLockGate";
import { useLimenEntitlements } from "@/hooks/useLimenEntitlements";
import { BacktestTerminal } from "@/components/backtest-terminal/BacktestTerminal";
import {
  createReplaySavedTradeIdsStorageKey,
  parseReplaySavedTradeIds,
} from "@/components/chartReplayPersistence";
import { uiText } from "@/contexts/LanguageContext";
import type { ClosedTrade } from "@/lib/replay/types";
import {
  createPendingTradesStorageKey,
  parsePendingTrades,
  serializePendingTrades,
} from "@/lib/replay/replayOfflineTrades";
import { addProcessEvidence, traderProcessKey } from "@/lib/traderProcessApi";
import { setCriticalSessionActive } from "@/lib/pwaAutoUpdater";

interface BacktestErrorBoundaryProps {
  children: ReactNode;
  onExit: () => void;
}

interface BacktestErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class BacktestErrorBoundary extends Component<
  BacktestErrorBoundaryProps,
  BacktestErrorBoundaryState
> {
  state: BacktestErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): BacktestErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[BacktestErrorBoundary] Anomalia Forgia:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-[#07080B] text-[#F4F4F6]"
      >
        <div className="w-14 h-14 rounded-2xl border border-[#C5A059]/40 bg-[#0E1017] flex items-center justify-center text-[#C5A059] shadow-[0_0_24px_rgba(197,160,89,0.25)] mb-4 text-2xl">
          🏛️
        </div>
        <h1 className="font-serif text-lg font-bold uppercase tracking-wider text-[#C5A059] mb-1">
          La Forgia del Passato · Anomalia Ripristinata
        </h1>
        <p className="text-xs text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
          Si è verificata un'anomalia grafica o di calcolo durante l'esecuzione del replay. I tuoi trade e parametri operativi sono preservati.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={this.handleReset}
            className="px-4 py-2 rounded-lg bg-[#C5A059] hover:bg-[#E8C56A] text-[#07080B] font-bold text-xs uppercase tracking-wider font-mono shadow-[0_2px_12px_rgba(197,160,89,0.3)] transition-all cursor-pointer whitespace-nowrap"
          >
            Ripristina Forgia
          </button>
          <button
            type="button"
            onClick={this.props.onExit}
            className="px-4 py-2 rounded-lg border border-white/10 hover:border-white/20 bg-white/5 text-slate-300 font-medium text-xs font-mono transition-colors cursor-pointer whitespace-nowrap"
          >
            Torna al Banco
          </button>
        </div>
      </div>
    );
  }
}

function TerminalWithPersistence({ session, onExit, methodVersionId, tournamentId }: {
  session: { id: number; name: string; pair: string; timeframe: string };
  onExit: () => void;
  methodVersionId?: string;
  tournamentId?: number;
}) {
  const qc = useQueryClient();
  const copy = useProcessCopy();
  // Keep failures local to the terminal and offer an explicit retry.
  const createTrade = useCreateBacktestTrade({ mutation: { meta: { suppressGlobalError: true } } });
  const sessionKey = `backtest-session-${session.id}`;
  const savedIdsKey = useMemo(() => createReplaySavedTradeIdsStorageKey(sessionKey), [sessionKey]);
  const savedIdsRef = useRef<Set<number> | null>(null);
  const syncedKey = `traderloading:backtest-save-receipts:${session.id}`;
  const pendingKey = useMemo(() => createPendingTradesStorageKey(session.id), [session.id]);
  const syncedRef = useRef<Set<string> | null>(null);
  const inflightRef = useRef(new Set<string>());
  const [saving, setSaving] = useState(0);
  const [failedTrades, setFailedTrades] = useState<Map<string, ClosedTrade>>(() => {
    if (typeof window === "undefined") return new Map();
    try {
      return parsePendingTrades(window.localStorage.getItem(pendingKey));
    } catch {
      return new Map();
    }
  });

  const updateFailedTrades = useCallback(
    (updater: (prev: Map<string, ClosedTrade>) => Map<string, ClosedTrade>) => {
      setFailedTrades((prev) => {
        const next = updater(prev);
        if (typeof window !== "undefined") {
          try {
            if (next.size === 0) {
              window.localStorage.removeItem(pendingKey);
            } else {
              window.localStorage.setItem(pendingKey, serializePendingTrades(next));
            }
          } catch {
            /* storage quota / private mode */
          }
        }
        return next;
      });
    },
    [pendingKey],
  );

  if (savedIdsRef.current === null && typeof window !== "undefined") {
    try { savedIdsRef.current = parseReplaySavedTradeIds(window.localStorage.getItem(savedIdsKey)); }
    catch { savedIdsRef.current = new Set(); }
  }
  if (syncedRef.current === null) {
    try {
      const stored: unknown = JSON.parse(window.localStorage.getItem(syncedKey) ?? "[]");
      syncedRef.current = new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : []);
    } catch { syncedRef.current = new Set(); }
  }

  const persistTrade = useCallback(
    async (trade: ClosedTrade) => {
      const clientRequestId = trade.syncId ?? `legacy:${trade.id}`;
      const synced = syncedRef.current ?? new Set<string>();
      if (synced.has(clientRequestId) || (!trade.syncId && savedIdsRef.current?.has(trade.id)) || inflightRef.current.has(clientRequestId)) return;
      inflightRef.current.add(clientRequestId);
      setSaving(count => count + 1);
      try {
        const saved = await createTrade.mutateAsync({
          id: session.id,
          data: {
            clientRequestId,
            direction: trade.direction,
            entryPrice: trade.entryPrice.toFixed(5),
            exitPrice: trade.exitPrice.toFixed(5),
            stopLoss: trade.stopLoss && trade.stopLoss > 0 ? trade.stopLoss.toFixed(5) : undefined,
            takeProfit: trade.takeProfit && trade.takeProfit > 0 ? trade.takeProfit.toFixed(5) : undefined,
            lotSize: trade.lots.toFixed(2),
            result: trade.result,
            pips: trade.pips.toFixed(1),
            initialRisk: trade.initialRiskAmount != null && trade.initialRiskAmount > 0 ? String(trade.initialRiskAmount) : null,
            cost: trade.cost == null ? null : String(trade.cost),
            netPnl: String(trade.profit),
            economicsProvenance: trade.initialRiskAmount != null && trade.cost != null ? "calculated" : "legacy_unknown",
            currency: "EUR",
            openTime: new Date(trade.entryTime * 1000).toISOString(),
            closeTime: new Date(trade.exitTime * 1000).toISOString(),
            notes: trade.note ?? undefined,
            tradeDate: new Date(trade.exitTime * 1000).toISOString().slice(0, 10),
          },
        });
        if (methodVersionId) {
          await addProcessEvidence({ methodVersionId, backtestTradeId: saved.id, purpose: "validation", source: "replay", requestId: crypto.randomUUID(), costsStatus: trade.cost == null ? "unknown" : "included", observedAt: new Date().toISOString(), adherence: "unknown", provenance: "calculated" });
          qc.invalidateQueries({ queryKey: traderProcessKey });
        }
        synced.add(clientRequestId);
        syncedRef.current = synced;
        updateFailedTrades(current => { const next = new Map(current); next.delete(clientRequestId); return next; });
        try {
          window.localStorage.setItem(syncedKey, JSON.stringify([...synced]));
        } catch {
          /* storage may be unavailable; dedupe stays in-memory */
        }
        qc.invalidateQueries({ queryKey: getGetBacktestTradesQueryKey(session.id) });
        qc.invalidateQueries({ queryKey: getGetBacktestSessionsQueryKey() });
      } catch {
        updateFailedTrades(current => new Map(current).set(clientRequestId, trade));
      } finally {
        inflightRef.current.delete(clientRequestId);
        setSaving(count => count - 1);
      }
    },
    [createTrade, qc, syncedKey, session.id, methodVersionId, updateFailedTrades],
  );

  // Auto-sync dei trade offline appena torna la connessione di rete
  useEffect(() => {
    if (typeof window === "undefined") return;
    const retryPending = () => {
      if (failedTrades.size > 0 && saving === 0 && navigator.onLine !== false) {
        void Promise.all([...failedTrades.values()].map(persistTrade));
      }
    };
    retryPending();
    window.addEventListener("online", retryPending);
    return () => window.removeEventListener("online", retryPending);
  }, [failedTrades, saving, persistTrade]);

  useEffect(() => {
    return () => {
      qc.invalidateQueries({ queryKey: getGetBacktestTradesQueryKey(session.id) });
      qc.invalidateQueries({ queryKey: getGetBacktestSessionsQueryKey() });
    };
  }, [qc, session.id]);

  const handleExit = useCallback(() => {
    qc.invalidateQueries({ queryKey: getGetBacktestTradesQueryKey(session.id) });
    qc.invalidateQueries({ queryKey: getGetBacktestSessionsQueryKey() });
    onExit();
  }, [qc, session.id, onExit]);

  return (
    <BacktestTerminal
      key={sessionKey}
      sessionKey={sessionKey}
      sessionName={session.name}
      symbol={session.pair}
      initialInterval={session.timeframe}
      onExit={handleExit}
      tournamentId={tournamentId}
      onTradeClosed={persistTrade}
      persistenceStatus={failedTrades.size ? (
        <div className="btm-sync-status" role="alert">
          <span>{uiText("backtest_terminal.save_failed")}</span>
          <button type="button" disabled={saving > 0} onClick={() => { void Promise.all([...failedTrades.values()].map(persistTrade)); }}>
            {uiText("backtest_terminal.retry_save")}
          </button>
        </div>
      ) : saving > 0 ? (
        <div className="btm-sync-status" role="status">{uiText("backtest_terminal.saving")}</div>
      ) : null}
    />
  );
}

export default function BacktestReplay({ params }: { params: { id: string } }) {
  const [, navigate] = useLocation();
  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const methodVersionId = searchParams.get("methodVersionId") || undefined;
  const tournamentIdParam = searchParams.get("tournamentId");
  const tournamentId = tournamentIdParam ? Number(tournamentIdParam) : undefined;
  const fallbackPair = searchParams.get("pair");
  const fallbackTimeframe = searchParams.get("timeframe");
  const fallbackName = searchParams.get("name");
  const sessionId = Number.parseInt(params.id, 10);
  const returnTo = tournamentId
    ? "/tornei?sub=backtest"
    : methodVersionId
      ? `/method?section=evidence${sessionId ? `&session=${sessionId}` : ""}`
      : `/backtest${sessionId ? `?session=${sessionId}` : ""}`;
  const { entitlements, isAdmin } = useLimenEntitlements();
  const sessions = useGetBacktestSessions();
  const dbSession = sessions.data?.find((candidate) => candidate.id === sessionId);
  const session = useMemo(() => {
    if (dbSession) return dbSession;
    if (!Number.isNaN(sessionId) && sessionId > 0 && (fallbackPair || tournamentId)) {
      return {
        id: sessionId,
        name: fallbackName || "Sessione Arena della Forgia",
        pair: fallbackPair || "XAU/USD",
        timeframe: fallbackTimeframe || "M5",
      };
    }
    return undefined;
  }, [dbSession, sessionId, fallbackPair, fallbackTimeframe, fallbackName, tournamentId]);

  // Protect active session from automatic update reloads while inside replay
  useEffect(() => {
    setCriticalSessionActive(true);
    return () => {
      setCriticalSessionActive(false);
    };
  }, []);

  // Track if session was successfully recognized at least once
  const sessionLoadedOnceRef = useRef(false);
  if (session) {
    sessionLoadedOnceRef.current = true;
  }

  // The terminal covers the whole viewport: freeze the page scroll behind it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) navigate(returnTo);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, returnTo]);

  // Unknown session only on initial mount (truly deleted or foreign id): back to session grid.
  // Never evict when queries invalidate in the background during active replay!
  useEffect(() => {
    if (!sessionLoadedOnceRef.current && sessions.isSuccess && !sessions.isFetching && !session) {
      navigate(returnTo);
    }
  }, [sessions.isSuccess, sessions.isFetching, session, navigate, returnTo]);

  if (!isAdmin && !entitlements.forgeOfThePast) {
    return (
      <div className="btm-root flex items-center justify-center bg-[#07080b] p-4">
        <LimenServiceLockGate
          serviceId="forge_of_the_past"
          onConfigureClick={() => navigate(returnTo)}
        />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="btm-root">
        <div className="btm-center" style={{ position: "static", flex: 1 }}>
          {sessions.isPending || sessions.isFetching ? (
            <div className="btm-spin" aria-hidden="true" />
          ) : (
            <span>{uiText("backtest_terminal.session_missing")}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="btm-root">
      <ProUpgradeGate feature="backtest" fillViewport>
        <BacktestErrorBoundary onExit={() => navigate(returnTo)}>
          <TerminalWithPersistence session={session} methodVersionId={methodVersionId} tournamentId={tournamentId} onExit={() => navigate(returnTo)} />
        </BacktestErrorBoundary>
      </ProUpgradeGate>
    </div>
  );
}
