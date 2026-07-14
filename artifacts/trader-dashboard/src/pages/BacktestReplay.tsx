// ─── Backtest replay terminal page ───────────────────────────────────────────
// Full-screen route (/backtest/:id/replay) rendered above the app chrome
// (z-60 > nav z-50): looks up the session, gates on Pro and mounts the
// terminal. Esc or the header back button return to /backtest. Closed trades
// are persisted to the on-contract trades endpoint, deduped per session via
// the same saved-ids mechanism as the legacy chart mode.
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetBacktestTradesQueryKey,
  useCreateBacktestTrade,
  useGetBacktestSessions,
} from "@workspace/api-client-react";
import { ProUpgradeGate } from "@/components/ProUpgradeGate";
import { BacktestTerminal } from "@/components/backtest-terminal/BacktestTerminal";
import {
  createReplaySavedTradeIdsStorageKey,
  parseReplaySavedTradeIds,
  serializeReplaySavedTradeIds,
} from "@/components/chartReplayPersistence";
import { uiText } from "@/contexts/LanguageContext";
import type { ClosedTrade } from "@/lib/replay/types";

function TerminalWithPersistence({ session, onExit }: {
  session: { id: number; name: string; pair: string; timeframe: string };
  onExit: () => void;
}) {
  const qc = useQueryClient();
  // persistTrade's catch is deliberately silent (must never interrupt the
  // replay; the trade stays local and is retried later) — opt out of App.tsx's
  // global mutation-error toast to respect that design.
  const createTrade = useCreateBacktestTrade({ mutation: { meta: { suppressGlobalError: true } } });
  const sessionKey = `backtest-session-${session.id}`;
  const savedIdsKey = useMemo(() => createReplaySavedTradeIdsStorageKey(sessionKey), [sessionKey]);
  const savedIdsRef = useRef<Set<number> | null>(null);
  if (savedIdsRef.current === null && typeof window !== "undefined") {
    savedIdsRef.current = parseReplaySavedTradeIds(window.localStorage.getItem(savedIdsKey));
  }

  const persistTrade = useCallback(
    async (trade: ClosedTrade) => {
      const savedIds = savedIdsRef.current ?? new Set<number>();
      if (savedIds.has(trade.id)) return;
      try {
        await createTrade.mutateAsync({
          id: session.id,
          data: {
            direction: trade.direction,
            entryPrice: trade.entryPrice.toFixed(5),
            exitPrice: trade.exitPrice.toFixed(5),
            stopLoss: trade.stopLoss.toFixed(5),
            takeProfit: trade.takeProfit.toFixed(5),
            lotSize: trade.lots.toFixed(2),
            result: trade.result,
            pips: trade.pips.toFixed(1),
            tradeDate: new Date(trade.exitTime * 1000).toISOString().slice(0, 10),
          },
        });
        savedIds.add(trade.id);
        savedIdsRef.current = savedIds;
        try {
          window.localStorage.setItem(savedIdsKey, serializeReplaySavedTradeIds(savedIds));
        } catch {
          /* storage may be unavailable; dedupe stays in-memory */
        }
        qc.invalidateQueries({ queryKey: getGetBacktestTradesQueryKey(session.id) });
      } catch {
        // Persist failures must never break the replay; the trade stays local
        // (and is retried on the next session load via the notified set).
      }
    },
    [createTrade, qc, savedIdsKey, session.id],
  );

  return (
    <BacktestTerminal
      sessionKey={sessionKey}
      sessionName={session.name}
      symbol={session.pair}
      initialInterval={session.timeframe}
      onExit={onExit}
      onTradeClosed={persistTrade}
    />
  );
}

export default function BacktestReplay({ params }: { params: { id: string } }) {
  const [, navigate] = useLocation();
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
      if (event.key === "Escape" && !event.defaultPrevented) navigate("/backtest");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  // Unknown session (deleted or foreign id): back to the session grid.
  useEffect(() => {
    if (sessions.isSuccess && !session) navigate("/backtest");
  }, [sessions.isSuccess, session, navigate]);

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
        <TerminalWithPersistence session={session} onExit={() => navigate("/backtest")} />
      </ProUpgradeGate>
    </div>
  );
}
