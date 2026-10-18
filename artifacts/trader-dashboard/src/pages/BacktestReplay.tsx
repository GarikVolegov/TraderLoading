// ─── Backtest replay terminal page ───────────────────────────────────────────
// Full-screen route (/backtest/:id/replay) rendered above the app chrome
// (z-60 > nav z-50): looks up the session, gates on Pro and mounts the
// terminal. Esc or the header back button return to /backtest. Closed trades
// are persisted to the on-contract trades endpoint, deduped per session via
// the same saved-ids mechanism as the legacy chart mode.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetBacktestTradesQueryKey,
  useCreateBacktestTrade,
  useGetBacktestSessions,
} from "@workspace/api-client-react";
import { useProcessCopy } from "@/components/process/ProcessUI";
import { ProUpgradeGate } from "@/components/ProUpgradeGate";
import { BacktestTerminal } from "@/components/backtest-terminal/BacktestTerminal";
import {
  createReplaySavedTradeIdsStorageKey,
  parseReplaySavedTradeIds,
} from "@/components/chartReplayPersistence";
import { uiText } from "@/contexts/LanguageContext";
import type { ClosedTrade } from "@/lib/replay/types";
import { addProcessEvidence, traderProcessKey } from "@/lib/traderProcessApi";

function TerminalWithPersistence({ session, onExit, methodVersionId }: {
  session: { id: number; name: string; pair: string; timeframe: string };
  onExit: () => void;
  methodVersionId?: string;
}) {
  const qc = useQueryClient();
  const copy = useProcessCopy();
  // Keep failures local to the terminal and offer an explicit retry.
  const createTrade = useCreateBacktestTrade({ mutation: { meta: { suppressGlobalError: true } } });
  const sessionKey = `backtest-session-${session.id}`;
  const savedIdsKey = useMemo(() => createReplaySavedTradeIdsStorageKey(sessionKey), [sessionKey]);
  const savedIdsRef = useRef<Set<number> | null>(null);
  const syncedKey = `traderloading:backtest-save-receipts:${session.id}`;
  const syncedRef = useRef<Set<string> | null>(null);
  const inflightRef = useRef(new Set<string>());
  const [saving, setSaving] = useState(0);
  const [failedTrades, setFailedTrades] = useState(new Map<string, ClosedTrade>());
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
            stopLoss: trade.stopLoss.toFixed(5),
            takeProfit: trade.takeProfit.toFixed(5),
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
        setFailedTrades(current => { const next = new Map(current); next.delete(clientRequestId); return next; });
        try {
          window.localStorage.setItem(syncedKey, JSON.stringify([...synced]));
        } catch {
          /* storage may be unavailable; dedupe stays in-memory */
        }
        qc.invalidateQueries({ queryKey: getGetBacktestTradesQueryKey(session.id) });
      } catch {
        setFailedTrades(current => new Map(current).set(clientRequestId, trade));
      } finally {
        inflightRef.current.delete(clientRequestId);
        setSaving(count => count - 1);
      }
    },
    [createTrade, qc, syncedKey, session.id, methodVersionId],
  );

  return (
    <BacktestTerminal
      key={sessionKey}
      sessionKey={sessionKey}
      sessionName={session.name}
      symbol={session.pair}
      initialInterval={session.timeframe}
      onExit={onExit}
      onTradeClosed={persistTrade}
      persistenceStatus={failedTrades.size ? (
        <div className="btm-sync-status" role="alert">
          <span>{uiText("backtest_terminal.save_failed")}</span>
          <button type="button" disabled={saving > 0} onClick={() => { void Promise.all([...failedTrades.values()].map(persistTrade)); }}>
            {uiText("backtest_terminal.retry_save")}
          </button>
        </div>
      ) : saving > 0 ? <div className="btm-sync-status" role="status">{uiText("backtest_terminal.saving")}</div> : <div className="btm-sync-status">{copy("simulatedAmounts")}</div>}
    />
  );
}

export default function BacktestReplay({ params }: { params: { id: string } }) {
  const [, navigate] = useLocation();
  const search = useSearch();
  const methodVersionId = new URLSearchParams(search).get("methodVersionId") || undefined;
  const returnTo = methodVersionId ? "/method?section=evidence" : "/backtest";
  const sessions = useGetBacktestSessions();
  const sessionId = Number.parseInt(params.id, 10);
  const session = sessions.data?.find((candidate) => candidate.id === sessionId);

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

  // Unknown session (deleted or foreign id): back to the session grid.
  useEffect(() => {
    if (sessions.isSuccess && !session) navigate(returnTo);
  }, [sessions.isSuccess, session, navigate, returnTo]);

  if (!session) {
    return (
      <div className="btm-root">
        <div className="btm-center" style={{ position: "static", flex: 1 }}>
          {sessions.isPending ? (
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
        <TerminalWithPersistence session={session} methodVersionId={methodVersionId} onExit={() => navigate(returnTo)} />
      </ProUpgradeGate>
    </div>
  );
}
