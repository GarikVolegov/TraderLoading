import React, { useState, useMemo, useEffect } from "react";
import { ShieldCheck, Activity, Sparkles, Plus } from "lucide-react";
import { useSearch } from "wouter";
import { useTraderProcess } from "@/hooks/useTraderProcess";
import {
  useGetJournalEntries,
  getGetJournalEntriesQueryKey,
  type JournalEntry,
} from "@workspace/api-client-react";
import { SessionDetailInspector } from "./SessionDetailInspector";
import { UnifiedTradeLedgerTrajectory } from "./UnifiedTradeLedgerTrajectory";
import { JournalEntryModal } from "@/components/JournalEntryModal";
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
  const search = useSearch();
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(() =>
    new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("new") === "1"
  );

  useEffect(() => {
    if (new URLSearchParams(search).get("new") === "1") {
      setIsEntryModalOpen(true);
    }
  }, [search]);

  // Real-time Sovereign Telemetry calculations
  const telemetry = useMemo(() => {
    const total = sortedEntries.length;
    if (total === 0) {
      return {
        total: 0,
        winRate: "0.0",
        profitFactor: "—",
        integrityPct: 100,
        hrvStatus: "Elevata" as const,
      };
    }

    let wins = 0;
    let grossWin = 0;
    let grossLoss = 0;
    let disciplinedTrades = 0;

    for (const e of sortedEntries) {
      const isWin = e.result === "win";
      if (isWin) wins++;

      const rawTags = typeof e.tags === "string" ? e.tags.split(",") : Array.isArray(e.tags) ? (e.tags as string[]) : [];
      const tags = rawTags.map((t: string) => t.trim().toLowerCase());
      const hasLeak = tags.some((t: string) =>
        ["fomo", "revenge", "anticipazione", "uscita_prematura", "esitazione"].includes(t)
      );
      if (!hasLeak) disciplinedTrades++;

      const pnl = e.manualTrade?.profit ?? 0;
      if (pnl > 0) grossWin += pnl;
      else if (pnl < 0) grossLoss += Math.abs(pnl);
    }

    const winRate = ((wins / total) * 100).toFixed(1);
    const profitFactor = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : grossWin > 0 ? "MAX" : "1.00";
    const integrityPct = Math.round((disciplinedTrades / total) * 100);
    const hrvStatus = integrityPct >= 85 ? "Elevata" : integrityPct >= 70 ? "Vigile" : "Inibita";

    return {
      total,
      winRate,
      profitFactor,
      integrityPct,
      hrvStatus,
    };
  }, [sortedEntries]);

  return (
    <div className="flex flex-col h-auto xl:h-[calc(100dvh-var(--app-header-offset)-var(--bottom-nav-clearance)-4.25rem)] lg:h-full min-h-0 w-full overflow-y-auto xl:overflow-hidden pb-4 select-none">
      {/* ── SOVEREIGN TELEMETRY COMMAND BAR (Desktop & Large Viewports) ── */}
      <div className="hidden xl:flex items-center justify-between gap-3 px-3 py-1.5 mb-2 rounded-lg border border-[#C5A059]/25 bg-[#07080b]/90 backdrop-blur-md shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold text-[#E8C56A] uppercase tracking-wider bg-[#C5A059]/15 border border-[#C5A059]/35 px-2 py-0.5 rounded whitespace-nowrap">
            👑 IL LIBRO DELLA VERITÀ
          </span>
          <span className="text-xs font-mono text-[#94a3b8] whitespace-nowrap">
            Registro Monastico d'Integrità
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-tight whitespace-nowrap">Campione:</span>
            <span className="text-xs font-mono font-bold text-[#E8C56A] whitespace-nowrap">{telemetry.total} Trade</span>
          </div>

          <div className="h-3 w-[1px] bg-[#C5A059]/20" />

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-tight whitespace-nowrap">Win Rate:</span>
            <span className={cn("text-xs font-mono font-bold whitespace-nowrap", Number(telemetry.winRate) >= 50 ? "text-[#10b981]" : "text-[#ef4444]")}>
              {telemetry.winRate}%
            </span>
          </div>

          <div className="h-3 w-[1px] bg-[#C5A059]/20" />

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-tight whitespace-nowrap">Profit Factor:</span>
            <span className="text-xs font-mono font-bold text-[#E8C56A] whitespace-nowrap">
              PF {telemetry.profitFactor}
            </span>
          </div>

          <div className="h-3 w-[1px] bg-[#C5A059]/20" />

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-tight whitespace-nowrap">Integrità:</span>
            <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-[#10b981] whitespace-nowrap">
              <ShieldCheck className="w-3.5 h-3.5 text-[#10b981]" />
              {telemetry.integrityPct}%
            </span>
          </div>

          <div className="h-3 w-[1px] bg-[#C5A059]/20" />

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-tight whitespace-nowrap">Bio-Coerenza:</span>
            <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-[#E8C56A] whitespace-nowrap">
              <Activity className="w-3.5 h-3.5 text-[#E8C56A]" />
              {telemetry.hrvStatus}
            </span>
          </div>

          <div className="h-3 w-[1px] bg-[#C5A059]/20" />

          <div className="flex items-center gap-1">
            <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#10b981]/15 border border-[#10b981]/35 text-[#10b981] whitespace-nowrap">
              CUSTODE: ATTIVO
            </span>
          </div>
        </div>
      </div>
      {/* ── MOBILE SOVEREIGN TELEMETRY RIBBON (< xl) ── */}
      <div className="flex xl:hidden items-center gap-2 overflow-x-auto scrollbar-none px-2.5 py-1.5 mb-2 rounded-lg border border-[#C5A059]/30 bg-[#07080b]/95 backdrop-blur-md shrink-0 select-none shadow-sm">
        <span className="font-mono text-[9px] font-bold text-[#E8C56A] uppercase tracking-wider bg-[#C5A059]/15 border border-[#C5A059]/35 px-1.5 py-0.5 rounded whitespace-nowrap">
          👑 LA VERITÀ
        </span>
        <div className="flex items-center gap-1 font-mono text-[10px] whitespace-nowrap">
          <span className="text-muted-foreground uppercase text-[9px]">Trade:</span>
          <span className="font-bold text-[#E8C56A]">{telemetry.total}</span>
        </div>
        <div className="h-3 w-[1px] bg-[#C5A059]/20 shrink-0" />
        <div className="flex items-center gap-1 font-mono text-[10px] whitespace-nowrap">
          <span className="text-muted-foreground uppercase text-[9px]">WR:</span>
          <span className={cn("font-bold", Number(telemetry.winRate) >= 50 ? "text-[#10b981]" : "text-[#ef4444]")}>
            {telemetry.winRate}%
          </span>
        </div>
        <div className="h-3 w-[1px] bg-[#C5A059]/20 shrink-0" />
        <div className="flex items-center gap-1 font-mono text-[10px] whitespace-nowrap">
          <span className="text-muted-foreground uppercase text-[9px]">PF:</span>
          <span className="font-bold text-[#E8C56A]">{telemetry.profitFactor}</span>
        </div>
        <div className="h-3 w-[1px] bg-[#C5A059]/20 shrink-0" />
        <div className="flex items-center gap-1 font-mono text-[10px] whitespace-nowrap">
          <ShieldCheck className="w-3 h-3 text-[#10b981]" />
          <span className="font-bold text-[#10b981]">{telemetry.integrityPct}%</span>
        </div>
        <div className="h-3 w-[1px] bg-[#C5A059]/20 shrink-0" />
        <div className="flex items-center gap-1 font-mono text-[10px] whitespace-nowrap">
          <Activity className="w-3 h-3 text-[#E8C56A]" />
          <span className="font-bold text-[#E8C56A]">{telemetry.hrvStatus}</span>
        </div>
      </div>

      {/* ── MOBILE-ONLY VIEW SWITCHER (< xl) ── */}
      <div className="flex xl:hidden items-center justify-between gap-1.5 border-b border-[#C5A059]/20 pb-2 mb-2 shrink-0 mobile-compact-bar">
        <div className="flex items-center gap-1 rounded-lg border border-[#C5A059]/30 bg-[#0d0f14] p-0.5 text-[11px] font-mono">
          <button
            type="button"
            onClick={() => setMobileActiveView("registro")}
            className={cn(
              "px-2 sm:px-3 py-1 rounded-md font-semibold transition-all whitespace-nowrap",
              mobileActiveView === "registro"
                ? "bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/50 font-bold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            01 · Registro &amp; Curva
          </button>
          <button
            type="button"
            onClick={() => setMobileActiveView("dossier")}
            className={cn(
              "px-2 sm:px-3 py-1 rounded-md font-semibold transition-all whitespace-nowrap",
              mobileActiveView === "dossier"
                ? "bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/50 font-bold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            02 · Dossier Tattico
          </button>
        </div>
        <button
          type="button"
          onClick={() => setIsEntryModalOpen(true)}
          data-testid="journal-open-chained-entry-modal-btn"
          className="inline-flex items-center gap-1 rounded-lg border border-[#C5A059]/50 bg-[#C5A059] hover:bg-[#E8C56A] px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#07080b] shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>Registra Trade</span>
        </button>
      </div>

      {/* ── UNIFIED MASTER COCKPIT: DUAL INTERLOCKING MACRO-BLOCKS ── */}
      <main className="flex-1 min-h-0 grid grid-cols-12 gap-2.5 overflow-visible xl:overflow-hidden">
        {/* ── LEFT MACRO-BLOCK (58% Width on Desktop): TRAJECTORY, HEATMAP & LEDGER TABLE ── */}
        <section
          className={cn(
            "col-span-12 xl:col-span-7 2xl:col-span-7 flex flex-col h-auto xl:h-full min-h-0 overflow-visible xl:overflow-hidden",
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
            "col-span-12 xl:col-span-5 2xl:col-span-5 flex flex-col h-auto xl:h-full min-h-0 overflow-visible xl:overflow-hidden",
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

      <JournalEntryModal
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
      />
    </div>
  );
}
