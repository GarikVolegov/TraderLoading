import React, { useState, useMemo, useEffect } from "react";
import { useTraderProcess } from "@/hooks/useTraderProcess";
import {
  useGetJournalEntries,
  getGetJournalEntriesQueryKey,
  type JournalEntry,
} from "@workspace/api-client-react";
import { SessionDetailInspector } from "./SessionDetailInspector";
import { UnifiedTradeLedgerTrajectory } from "./UnifiedTradeLedgerTrajectory";
import { cn } from "@/lib/utils";
import type { ProcessSession } from "@/lib/traderProcessApi";

interface SovereignJournalCockpitProps {
  initialTab?: "dossier" | "registro";
  onNavigateTab?: (tab: string, options?: Record<string, string>) => void;
}

export function SovereignJournalCockpit({
  initialTab = "registro",
  onNavigateTab,
}: SovereignJournalCockpitProps) {
  const query = useTraderProcess();
  const state = query.data;

  // Retrieve trade entries from database
  const { data: entries } = useGetJournalEntries({
    query: { queryKey: getGetJournalEntriesQueryKey(), refetchInterval: 60_000, staleTime: 30_000 },
  });

  // Sessions from process state
  const allSessions: ProcessSession[] = useMemo(() => {
    return state?.sessions ? [...state.sessions].reverse() : [];
  }, [state?.sessions]);

  // Sorted trade entries (newest first, identical to UnifiedTradeLedgerTrajectory table)
  const sortedEntries = useMemo(() => {
    if (!entries) return [];
    return [...entries].sort((a, b) => {
      return new Date(b.tradeDate).getTime() - new Date(a.tradeDate).getTime();
    });
  }, [entries]);

  // Selected trade ID (defaults to first available entry in sorted list)
  const [selectedTradeId, setSelectedTradeId] = useState<string | number | null>(() => {
    if (entries && entries.length > 0) {
      const sorted = [...entries].sort((a, b) => new Date(b.tradeDate).getTime() - new Date(a.tradeDate).getTime());
      return sorted[0]?.id ?? null;
    }
    return null;
  });

  useEffect(() => {
    if (!selectedTradeId && sortedEntries.length > 0) {
      setSelectedTradeId(sortedEntries[0].id);
    }
  }, [sortedEntries, selectedTradeId]);

  // Selected session ID
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(() => {
    if (allSessions.length > 0) return allSessions[0].id;
    return null;
  });

  useEffect(() => {
    if (!selectedSessionId && allSessions.length > 0) {
      setSelectedSessionId(allSessions[0].id);
    }
  }, [allSessions, selectedSessionId]);

  // Find currently selected JournalEntry
  const selectedJournalEntry: JournalEntry | null = useMemo(() => {
    if (!sortedEntries || sortedEntries.length === 0) return null;
    if (!selectedTradeId) return sortedEntries[0] ?? null;
    return sortedEntries.find((e) => String(e.id) === String(selectedTradeId)) ?? sortedEntries[0] ?? null;
  }, [sortedEntries, selectedTradeId]);

  // Trade index within sorted list
  const tradeIndex = useMemo(() => {
    if (!selectedTradeId || sortedEntries.length === 0) return 0;
    const idx = sortedEntries.findIndex((e) => String(e.id) === String(selectedTradeId));
    return idx >= 0 ? idx : 0;
  }, [sortedEntries, selectedTradeId]);

  // Stepper navigation handler (< Trade X di Y >)
  const handleNavigateTrade = (direction: "prev" | "next") => {
    if (sortedEntries.length === 0) return;
    const nextIdx = direction === "prev" ? Math.max(0, tradeIndex - 1) : Math.min(sortedEntries.length - 1, tradeIndex + 1);
    const targetEntry = sortedEntries[nextIdx];
    if (targetEntry) {
      setSelectedTradeId(targetEntry.id);
      // Auto-match session if evidence exists
      const matchedSession = allSessions.find(
        (s) => (state?.evidence ?? []).some((e) => e.sessionId === s.id && String(e.accountTradeId) === String(targetEntry.id))
      );
      if (matchedSession) {
        setSelectedSessionId(matchedSession.id);
      }
    }
  };

  // Find currently selected ProcessSession (by ID or matched from trade)
  const selectedSession: ProcessSession | null = useMemo(() => {
    if (selectedSessionId) {
      const match = allSessions.find((s) => s.id === selectedSessionId);
      if (match) return match;
    }
    return allSessions[0] ?? null;
  }, [allSessions, selectedSessionId]);

  const selectedEvidence = useMemo(() => {
    if (!selectedSession || !state?.evidence) return [];
    return state.evidence.filter((ev) => ev.sessionId === selectedSession.id);
  }, [selectedSession, state?.evidence]);

  const selectedMethod = useMemo(() => {
    if (!selectedSession || !state?.methods) return undefined;
    return state.methods.find((m) => m.id === selectedSession.methodVersionId);
  }, [selectedSession, state?.methods]);

  // Mobile-only view state (< xl)
  const [mobileActiveView, setMobileActiveView] = useState<"registro" | "dossier">("registro");

  return (
    <div className="flex flex-col h-[calc(100dvh-var(--app-header-offset)-var(--bottom-nav-clearance)-4.25rem)] lg:h-full min-h-[520px] lg:min-h-0 w-full overflow-hidden pb-1 select-none">
      {/* ── MOBILE-ONLY VIEW SWITCHER (< xl) ── */}
      <div className="flex xl:hidden items-center justify-between gap-2 border-b border-border-subtle pb-2 mb-2 shrink-0 mobile-compact-bar">
        <div className="flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-1 p-0.5 text-xs font-mono">
          <button
            type="button"
            onClick={() => setMobileActiveView("registro")}
            className={cn(
              "px-2.5 sm:px-3 py-1 rounded font-semibold transition-all whitespace-nowrap",
              mobileActiveView === "registro"
                ? "bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/40 font-bold"
                : "text-text-lo hover:text-text-hi"
            )}
          >
            Registro &amp; Traiettoria
          </button>
          <button
            type="button"
            onClick={() => setMobileActiveView("dossier")}
            className={cn(
              "px-2.5 sm:px-3 py-1 rounded font-semibold transition-all whitespace-nowrap",
              mobileActiveView === "dossier"
                ? "bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/40 font-bold"
                : "text-text-lo hover:text-text-hi"
            )}
          >
            Dossier Tattico
          </button>
        </div>
        {sortedEntries.length > 0 && (
          <span className="font-mono text-[10px] text-[#E8C56A] bg-[#C5A059]/10 border border-[#C5A059]/30 px-2 py-0.5 rounded font-bold whitespace-nowrap">
            #{tradeIndex + 1}/{sortedEntries.length} Trade
          </span>
        )}
      </div>

      {/* ── UNIFIED MASTER COCKPIT: DUAL INTERLOCKING MACRO-BLOCKS ── */}
      <main className="flex-1 min-h-0 grid grid-cols-12 gap-2.5 overflow-hidden">
        {/* ── LEFT MACRO-BLOCK (58% Width on Desktop): TRAJECTORY, HEATMAP & LEDGER TABLE ── */}
        <section
          className={cn(
            "col-span-12 xl:col-span-7 2xl:col-span-7 flex flex-col h-full min-h-0 overflow-hidden",
            mobileActiveView === "dossier" ? "hidden xl:flex" : "flex"
          )}
        >
          <UnifiedTradeLedgerTrajectory
            selectedTradeId={selectedTradeId}
            onSelectTrade={(tradeId) => {
              setSelectedTradeId(tradeId);
              // Check if there is an associated session in evidence
              const matchedSession = allSessions.find(
                (s) => (state?.evidence ?? []).some((e) => e.sessionId === s.id && String(e.accountTradeId) === String(tradeId))
              );
              if (matchedSession) {
                setSelectedSessionId(matchedSession.id);
              }
              // On mobile, automatically flip to dossier when clicked
              if (window.innerWidth < 1280) {
                setMobileActiveView("dossier");
              }
            }}
          />
        </section>

        {/* ── RIGHT MACRO-BLOCK (42% Width on Desktop): REAL-TIME TACTICAL DOSSIER ── */}
        <section
          className={cn(
            "col-span-12 xl:col-span-5 2xl:col-span-5 flex flex-col h-full min-h-0 overflow-hidden",
            mobileActiveView === "registro" ? "hidden xl:flex" : "flex"
          )}
        >
          <SessionDetailInspector
            session={selectedSession}
            evidence={selectedEvidence}
            method={selectedMethod}
            journalEntry={selectedJournalEntry}
            tradeIndex={tradeIndex}
            totalTrades={sortedEntries.length}
            onNavigateTrade={handleNavigateTrade}
            activeLiveSession={state?.session ?? null}
          />
        </section>
      </main>
    </div>
  );
}
