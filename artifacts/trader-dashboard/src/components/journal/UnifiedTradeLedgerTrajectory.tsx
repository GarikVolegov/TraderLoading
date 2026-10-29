import React, { memo, useMemo, useState } from "react";
import {
  Search,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Share2,
  Compass,
  FileCheck2,
  Heart,
  ShieldCheck,
  Wind,
} from "lucide-react";
import {
  useGetJournalEntries,
  getGetJournalEntriesQueryKey,
  type JournalEntry,
} from "@workspace/api-client-react";
import { EquityCurveChart, type TradePointDetail } from "./EquityCurveChart";
import { SovereignChronosHeatmap } from "./SovereignChronosHeatmap";
import { parseTradeContent } from "@/lib/parseTradeContent";
import { priceDecimals } from "@/components/backtest-terminal/format";
import { cumulativeR, monteCarloBands } from "@/lib/equityProjection";
import { synestheticClick } from "@/lib/soundFx";
import { cn } from "@/lib/utils";
import { HonorCardShareModal } from "@/components/honor-card/HonorCardShareModal";
import { NotaryScrollModal } from "@/components/notary/NotaryScrollModal";
import type { NotaryScrollData } from "@/lib/notaryScrollGenerator";
import { DisciplineVirtueRadarModal } from "./DisciplineVirtueRadarModal";
import { CardioPerformanceAnalyticsModal } from "./CardioPerformanceAnalyticsModal";
import { IntegrityConfessorModal } from "./IntegrityConfessorModal";
import { computeCardioPerformanceCorrelation } from "@/lib/bioLockGuard";
import { getConfessionForDate } from "@/lib/integrityConfessor";
import { LEAK_TAGS } from "./SessionDetailInspector";
import { extractProfitFromEntry } from "./DisciplineVirtueRadar";
import type { HonorCardData } from "@/lib/honorCardGenerator";

const PROJECTION_STEPS = 20;

interface UnifiedTradeLedgerTrajectoryProps {
  selectedTradeId?: number | string | null;
  onSelectTrade?: (tradeId: number | string) => void;
  className?: string;
}

const TradeLedgerRow = memo(function TradeLedgerRow({
  entry,
  isSelected,
  onSelectTrade,
}: {
  entry: JournalEntry;
  isSelected: boolean;
  onSelectTrade?: (id: number | string) => void;
}) {
  const parsed = parseTradeContent(entry.content ?? "");
  const isWin = entry.result === "win";
  const isLoss = entry.result === "loss";
  const pnl = parsed?.profit;

  // Clean asset name: strip .R and ticket numbers
  const cleanSymbol = (parsed?.symbol ?? entry.title ?? "ASSET")
    .replace(/\.R$/, "")
    .replace(/#\d+/g, "")
    .trim();

  // Direction: BUY -> LONG, SELL -> SHORT
  const rawDir = parsed?.direction ?? (entry.title.includes("BUY") ? "BUY" : entry.title.includes("SELL") ? "SELL" : "TRADE");
  const isLong = rawDir === "BUY" || rawDir === "LONG";
  const isShort = rawDir === "SELL" || rawDir === "SHORT";

  return (
    <tr
      onClick={() => {
        synestheticClick();
        onSelectTrade?.(entry.id);
      }}
      className={cn(
        "group cursor-pointer transition-colors select-none",
        isSelected
          ? "bg-[#C5A059]/15 border-l-2 border-l-[#C5A059]"
          : "hover:bg-white/[0.04]"
      )}
    >
      {/* Date */}
      <td className="py-1.5 px-2 sm:px-2.5 text-text-hi font-semibold whitespace-nowrap">
        {entry.tradeDate.slice(0, 10)}
      </td>

      {/* Clean Asset Name */}
      <td className="py-1.5 px-2 sm:px-2.5 font-bold whitespace-nowrap">
        <span className={cn(
          "transition-colors",
          isSelected ? "text-[#C5A059]" : "text-text-hi group-hover:text-[#C5A059]"
        )}>
          {cleanSymbol}
        </span>
      </td>

      {/* Direction (Noble desaturated badges) */}
      <td className="py-1.5 px-1.5 sm:px-2.5 text-center whitespace-nowrap">
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded px-1.5 sm:px-2 py-0.2 text-[9px] font-bold border whitespace-nowrap",
            isLong
              ? "border-success/30 bg-success/10 text-success"
              : isShort
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-border-subtle text-text-lo"
          )}
        >
          {isLong ? <ArrowUpRight size={10} /> : isShort ? <ArrowDownRight size={10} /> : null}
          {isLong ? "LONG" : isShort ? "SHORT" : rawDir}
        </span>
      </td>

      {/* Volume / Lots */}
      <td className="hidden sm:table-cell py-1.5 px-2.5 text-right text-text-lo whitespace-nowrap">
        {parsed?.volume != null ? `${parsed.volume} lotti` : "0.01"}
      </td>

      {/* Entry Price */}
      <td className="hidden sm:table-cell py-1.5 px-2.5 text-right text-text-hi font-medium whitespace-nowrap">
        {parsed?.entryPrice ? parsed.entryPrice.toFixed(priceDecimals(cleanSymbol || "EURUSD")) : "—"}
      </td>

      {/* Exit Price */}
      <td className="hidden sm:table-cell py-1.5 px-2.5 text-right text-text-lo whitespace-nowrap">
        {parsed?.exitPrice ? parsed.exitPrice.toFixed(priceDecimals(cleanSymbol || "EURUSD")) : "—"}
      </td>

      {/* Net PnL (Hero text) */}
      <td
        className={cn(
          "py-1.5 px-2 sm:px-2.5 text-right font-bold text-xs whitespace-nowrap",
          pnl != null && pnl > 0
            ? "text-success"
            : pnl != null && pnl < 0
            ? "text-destructive"
            : "text-text-lo"
        )}
      >
        {pnl != null ? `${pnl > 0 ? "+" : ""}${pnl.toFixed(2)} €` : "0.00 €"}
      </td>

      {/* Outcome Badge */}
      <td className="py-1.5 px-1.5 sm:px-2.5 text-center whitespace-nowrap">
        <span
          className={cn(
            "inline-flex rounded px-1.5 py-0.2 text-[9px] font-bold border whitespace-nowrap",
            isWin
              ? "border-success/40 bg-success/15 text-success"
              : isLoss
              ? "border-destructive/40 bg-destructive/15 text-destructive"
              : "border-[#C5A059]/30 bg-[#C5A059]/10 text-[#C5A059]"
          )}
        >
          {entry.result.toUpperCase()}
        </span>
      </td>
    </tr>
  );
});

export function UnifiedTradeLedgerTrajectory({
  selectedTradeId,
  onSelectTrade,
  className,
}: UnifiedTradeLedgerTrajectoryProps) {
  const [searchFilter, setSearchFilter] = useState("");
  const [resultFilter, setResultFilter] = useState<"all" | "win" | "loss" | "be">("all");
  const [mobileChartTab, setMobileChartTab] = useState<"trajectory" | "heatmap">("trajectory");
  const [showRadarModal, setShowRadarModal] = useState(false);
  const [showCardioModal, setShowCardioModal] = useState(false);
  const [showConfessorModal, setShowConfessorModal] = useState(false);
  const todayConfession = useMemo(() => getConfessionForDate(), [showConfessorModal]);
  const [showIdealCurve, setShowIdealCurve] = useState(false);
  const [riskMultiplier, setRiskMultiplier] = useState<number>(1.0);
  const [ledgerPage, setLedgerPage] = useState(1);
  const LEDGER_PAGE_SIZE = 40;

  const { data: entries, isLoading: entriesLoading } = useGetJournalEntries({
    query: { queryKey: getGetJournalEntriesQueryKey(), refetchInterval: 60_000, staleTime: 30_000 },
  });

  // Sort chronologically (oldest to newest) to build real, authentic equity trajectory from ALL journal entries
  const chronologicalEntries = useMemo(() => {
    return [...(entries ?? [])].sort((a, b) => {
      const da = new Date(a.tradeDate).getTime();
      const db = new Date(b.tradeDate).getTime();
      return da - db;
    });
  }, [entries]);

  // Extract REAL and IDEAL (Zero-Leak) PnL series measured directly in Euro (€)
  const {
    euroSamples,
    idealEuro,
    idealPnlTotal,
    totalFrictionBleed,
    tradeDetails,
    realizedEuro,
    netPnlTotal,
  } = useMemo(() => {
    const euroList: number[] = [];
    const idealEuroList: number[] = [];
    let cumEuro = 0;
    let cumIdealEuro = 0;
    let totalBleed = 0;

    // Point 0 represents the baseline origin (aligns index 1:1 with cumulativeR output)
    const details: TradePointDetail[] = [
      {
        date: chronologicalEntries[0]?.tradeDate?.slice(0, 10),
        title: "Origine Capitale",
        pnl: 0,
        cumulativeEuro: 0,
        idealCumulativeEuro: 0,
      },
    ];

    for (const entry of chronologicalEntries) {
      const parsed = parseTradeContent(entry.content ?? "");
      const profit = parsed?.profit != null && Number.isFinite(parsed.profit)
        ? parsed.profit
        : extractProfitFromEntry(entry);
      const rawTags = (entry.tags ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
      const matchedLeaks = LEAK_TAGS.filter((l) => rawTags.includes(l.id.toLowerCase()));
      const hasLeak = matchedLeaks.length > 0;
      const leakNames = matchedLeaks.map((l) => l.label);

      // Zero-Leak logic: emotional drift trades with losses are eliminated in ideal trajectory
      const bleedAmount = hasLeak && profit < 0 ? Math.abs(profit) : 0;
      const idealProfit = hasLeak && profit < 0 ? 0 : profit;

      cumEuro += profit;
      cumIdealEuro += idealProfit;
      totalBleed += bleedAmount;

      euroList.push(profit);
      idealEuroList.push(idealProfit);

      // Clean symbol name (strip .R and ticket numbers)
      const cleanTitle = (parsed?.symbol ?? entry.title ?? "Trade")
        .replace(/\.R$/, "")
        .replace(/#\d+/g, "")
        .trim();

      details.push({
        date: entry.tradeDate.slice(0, 10),
        title: cleanTitle,
        pnl: profit,
        cumulativeEuro: Math.round(cumEuro * 100) / 100,
        idealCumulativeEuro: Math.round(cumIdealEuro * 100) / 100,
        hasLeak,
        leakNames,
        bleedAmount: Math.round(bleedAmount * 100) / 100,
      });
    }

    return {
      euroSamples: euroList,
      idealEuro: cumulativeR(idealEuroList),
      idealPnlTotal: cumIdealEuro,
      totalFrictionBleed: totalBleed,
      tradeDetails: details,
      realizedEuro: cumulativeR(euroList),
      netPnlTotal: cumEuro,
    };
  }, [chronologicalEntries]);

  // Monte Carlo simulation in EURO driven by trader's actual profit distribution and parametric risk
  const bands = useMemo(() => {
    const effectiveSamples = euroSamples.length > 0 ? euroSamples : [0];
    const startVal = realizedEuro[realizedEuro.length - 1] ?? 0;
    return monteCarloBands(effectiveSamples, {
      steps: PROJECTION_STEPS,
      start: startVal,
      riskMultiplier,
    });
  }, [euroSamples, realizedEuro, riskMultiplier]);

  // Filtered entries for the ledger table (latest first)
  const filteredEntries = useMemo(() => {
    const list = [...(entries ?? [])].sort((a, b) => {
      return new Date(b.tradeDate).getTime() - new Date(a.tradeDate).getTime();
    });

    return list.filter((entry) => {
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase().trim();
        const matches =
          (entry.title ?? "").toLowerCase().includes(q) ||
          (entry.tradeDate ?? "").toLowerCase().includes(q) ||
          (entry.content ?? "").toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (resultFilter === "win") return entry.result === "win";
      if (resultFilter === "loss") return entry.result === "loss";
      if (resultFilter === "be") return entry.result === "breakeven";

      return true;
    });
  }, [entries, searchFilter, resultFilter]);

  const totalLedgerPages = Math.max(1, Math.ceil(filteredEntries.length / LEDGER_PAGE_SIZE));
  const activeLedgerPage = Math.min(ledgerPage, totalLedgerPages);
  const paginatedEntries = useMemo(() => {
    const startIndex = (activeLedgerPage - 1) * LEDGER_PAGE_SIZE;
    return filteredEntries.slice(startIndex, startIndex + LEDGER_PAGE_SIZE);
  }, [filteredEntries, activeLedgerPage]);

  // Ledger stats & Calma Operativa
  const ledgerStats = useMemo(() => {
    const list = entries ?? [];
    let wins = 0;
    let losses = 0;
    let be = 0;
    let calmCount = 0;
    let calmWins = 0;

    for (const e of list) {
      if (e.result === "win") wins++;
      if (e.result === "loss") losses++;
      if (e.result === "breakeven") be++;

      const rawTags = (e.tags ?? "").toLowerCase();
      const rawContent = (e.content ?? "").toLowerCase();
      const isCalm = rawTags.includes("respiro") || rawContent.includes("respiro tattico");
      if (isCalm) {
        calmCount++;
        if (e.result === "win") calmWins++;
      }
    }

    const total = list.length;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    const calmPct = total > 0 ? Math.round((calmCount / total) * 100) : 0;
    const calmWinRate = calmCount > 0 ? Math.round((calmWins / calmCount) * 100) : 0;

    return { total, wins, losses, be, winRate, calmCount, calmPct, calmWinRate };
  }, [entries]);

  const [showHonorCard, setShowHonorCard] = useState(false);

  const honorCardData: HonorCardData = useMemo(() => {
    const opName =
      (typeof window !== "undefined"
        ? localStorage.getItem("aureus_nickname") || localStorage.getItem("tl_nickname")
        : null) || "Operatore";

    let peak = 0;
    let maxDdVal = 0;
    for (const val of realizedEuro) {
      if (val > peak) peak = val;
      const dd = peak - val;
      if (dd > maxDdVal) maxDdVal = dd;
    }
    const ddPercent = peak > 0 ? (maxDdVal / peak) * 100 : 0;

    return {
      title: "LIBRO DELLA VERITA · REGISTRO ESECUTIVO",
      subtitle: "Attestato crittografico di fedeltà al piano operativo e tracciamento in Euro.",
      operatorName: opName,
      asset: "PORTAFOGLIO GLOBALE",
      winRate: ledgerStats.winRate,
      winTrades: ledgerStats.wins,
      totalTrades: ledgerStats.total,
      drawdown: Number(ddPercent.toFixed(2)),
      maxAllowedDrawdown: 10,
      totalProfitFormatted: `${netPnlTotal >= 0 ? "+" : ""}${netPnlTotal.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
      integrityScore: ledgerStats.winRate >= 50 ? 95 : 85,
    };
  }, [ledgerStats, realizedEuro, netPnlTotal]);

  const [showNotaryModal, setShowNotaryModal] = useState(false);

  const cardioSummary = useMemo(() => {
    return computeCardioPerformanceCorrelation(
      entries ?? [],
      (t) => extractProfitFromEntry(t as unknown as JournalEntry),
      92
    );
  }, [entries]);

  const notaryData: NotaryScrollData = useMemo(() => {
    const opName =
      (typeof window !== "undefined"
        ? localStorage.getItem("aureus_nickname") || localStorage.getItem("tl_nickname")
        : null) || "Operatore";

    let peak = 0;
    let maxDdVal = 0;
    for (const val of realizedEuro) {
      if (val > peak) peak = val;
      const dd = peak - val;
      if (dd > maxDdVal) maxDdVal = dd;
    }
    const ddPercent = peak > 0 ? (maxDdVal / peak) * 100 : 0;

    return {
      operatorName: opName,
      gradeTitle: "Custode del Registro",
      gradeCode: "GRADO II",
      integrityIndex: 100,
      consecutiveSessions: ledgerStats.total,
      violationsCount: 0,
      winRate: ledgerStats.winRate,
      totalTrades: ledgerStats.total,
      profitFormatted: `${netPnlTotal >= 0 ? "+" : ""}${netPnlTotal.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
      maxDrawdown: Number(ddPercent.toFixed(2)),
      cardioMetrics: {
        zenWinRate: cardioSummary.bands.zen.winRate,
        zenPct: cardioSummary.totalAnalyzedTrades > 0
          ? Math.round((cardioSummary.bands.zen.tradesCount / cardioSummary.totalAnalyzedTrades) * 100)
          : 0,
        avgBpm: cardioSummary.bands.zen.avgBpm || 68,
        totalTrades: cardioSummary.totalAnalyzedTrades,
      },
      pillars: {
        patience: 92,
        risk: 100,
        precision: ledgerStats.winRate >= 50 ? 90 : 75,
        firmness: 95,
        integrity: 100,
      },
    };
  }, [ledgerStats, realizedEuro, netPnlTotal, cardioSummary]);

  return (
    <div
      className={cn(
        "flex flex-col h-full min-h-0 overflow-hidden bg-surface-1 rounded-2xl border border-border-subtle shadow-xl p-3 gap-2.5 select-none",
        className
      )}
    >
      {/* ── MOBILE SUB-TOGGLE (< lg): TRAIETTORIA vs CALENDARIO RESA ── */}
      <div className="flex lg:hidden items-center justify-between gap-2 shrink-0 mobile-compact-bar">
        <div className="flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-0 p-0.5 text-[10px] font-mono">
          <button
            type="button"
            onClick={() => setMobileChartTab("trajectory")}
            className={cn(
              "px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all whitespace-nowrap",
              mobileChartTab === "trajectory"
                ? "bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/40"
                : "text-text-lo hover:text-text-hi"
            )}
          >
            Traiettoria (€)
          </button>
          <button
            type="button"
            onClick={() => setMobileChartTab("heatmap")}
            className={cn(
              "px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all whitespace-nowrap",
              mobileChartTab === "heatmap"
                ? "bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/40"
                : "text-text-lo hover:text-text-hi"
            )}
          >
            Resa Mensile
          </button>
        </div>
        <span className="font-mono text-[10px] text-text-lo whitespace-nowrap">
          Netto:{" "}
          <strong className={netPnlTotal >= 0 ? "text-success font-bold" : "text-destructive font-bold"}>
            {netPnlTotal >= 0 ? `+${netPnlTotal.toFixed(2)}` : netPnlTotal.toFixed(2)} €
          </strong>
        </span>
      </div>

      {/* ── TOP SECTION (~40% ALTEZZA): TRAIETTORIA + HEATMAP CALENDAR SPLIT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 h-[215px] lg:h-[40%] min-h-[185px] shrink-0">
        {/* Trajectory Equity Curve Card in Euro (7 Cols) */}
        <div
          className={cn(
            "lg:col-span-7 flex-col justify-between rounded-xl border border-border-subtle/80 bg-surface-0/60 p-2.5 sm:p-3 shadow-inner overflow-hidden h-full",
            mobileChartTab === "heatmap" ? "hidden lg:flex" : "flex"
          )}
        >
          {/* Header (Decoupled, zero overlap) */}
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-b border-white/[0.06] pb-1.5 shrink-0">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <img
                src="/images/emblems/patrimonio.png"
                alt="Traiettoria"
                className="w-5 h-5 object-contain drop-shadow-[0_0_8px_rgba(197,160,89,0.3)] shrink-0"
              />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-text-hi">
                Traiettoria dei Rendimenti (€)
              </span>
            </div>

            {/* Clean badges with proper spacing */}
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
              <span className="rounded bg-surface-2 border border-border-subtle px-2 py-0.5 text-text-lo whitespace-nowrap">
                <strong className="text-text-hi">{ledgerStats.total}</strong> Trade
              </span>
              <span className="rounded bg-[#C5A059]/10 border border-[#C5A059]/30 px-2 py-0.5 text-[#C5A059] font-bold whitespace-nowrap">
                Win Rate: {ledgerStats.winRate}%
              </span>
              {ledgerStats.calmCount > 0 && (
                <span
                  className="hidden md:inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-emerald-400 font-bold whitespace-nowrap"
                  title={`Calma Operativa: ${ledgerStats.calmCount} trade registrati con rituale 4-7-8 (${ledgerStats.calmPct}% del totale). Win Rate con Calma: ${ledgerStats.calmWinRate}%`}
                >
                  <Wind size={10} className="text-emerald-400" />
                  <span>Calma: {ledgerStats.calmWinRate}% WR</span>
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  synestheticClick();
                  setShowCardioModal(true);
                }}
                title="Analisi Correlazione Cardio-Performance (Zen < 75 BPM vs Vigile 75-91 BPM vs Deriva ≥ 92 BPM)"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-2 border border-border-subtle hover:border-[#C5A059]/40 text-text-lo hover:text-text-hi font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap"
              >
                <Heart size={10} className="text-[#ef4444]" />
                <span className="hidden sm:inline">Cardio · WR</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  synestheticClick();
                  setShowRadarModal(true);
                }}
                title="Esplora Mappa Radiale Virtù e Leak"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-2 border border-border-subtle hover:border-[#C5A059]/40 text-text-lo hover:text-text-hi font-bold transition-all shadow-sm"
              >
                <Compass size={10} className="text-[#C5A059]" />
                <span className="hidden sm:inline">Mappa Disciplina</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  synestheticClick();
                  setShowConfessorModal(true);
                }}
                title="Il Confessore dell'Integrità · Debriefing di Disciplina Giornaliera"
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border transition-all shadow-sm cursor-pointer whitespace-nowrap ${
                  todayConfession
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25"
                    : "bg-[#C5A059]/15 border-[#C5A059]/40 text-[#E8C56A] hover:bg-[#C5A059]/25"
                }`}
              >
                <ShieldCheck size={10} className={todayConfession ? "text-emerald-400" : "text-[#E8C56A]"} />
                <span className="hidden sm:inline">
                  {todayConfession ? `Confessione: ${todayConfession.score}%` : "Il Confessore"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  synestheticClick();
                  setShowHonorCard(true);
                }}
                title="Condividi Scheda d'Onore del Registro"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 hover:bg-[#C5A059]/25 text-[#E8C56A] font-bold transition-all shadow-sm cursor-pointer"
              >
                <Share2 size={10} />
                <span className="hidden sm:inline">Scheda d&apos;Onore</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  synestheticClick();
                  setShowNotaryModal(true);
                }}
                title="Attestazione Notarile A4 con firma crittografica SHA-256"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gradient-to-r from-[#C5A059]/20 to-[#E8C56A]/20 border border-[#C5A059]/45 hover:from-[#C5A059]/35 hover:to-[#E8C56A]/35 text-[#E8C56A] font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap"
              >
                <FileCheck2 size={10} className="text-[#E8C56A]" />
                <span className="hidden sm:inline">Pergamena A4</span>
              </button>
            </div>
          </div>

          {/* Interactive SVG Chart Area with Real Journal Data in Euro & Fixed HUD */}
          <div className="flex-1 flex items-center justify-center min-h-0 py-1 overflow-hidden">
            {realizedEuro.length > 0 ? (
              <EquityCurveChart
                realized={realizedEuro}
                ideal={idealEuro}
                showIdealCurve={showIdealCurve}
                bands={bands}
                projectionSteps={PROJECTION_STEPS}
                tradeDetails={tradeDetails}
                currency="€"
              />
            ) : (
              <p className="text-xs text-text-lo italic font-mono">
                Caricamento dati di traiettoria...
              </p>
            )}
          </div>

          {/* Bottom Chart Legend (Clean 1-line, responsive wrap, measured in Euro) */}
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] font-mono text-text-lo border-t border-white/[0.06] pt-1 shrink-0">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success" />
                Storico Reale ({ledgerStats.total})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#C5A059]" />
                Monte Carlo
              </span>

              {/* Rischio Parametrico Selector (0.5x, 1.0x, 1.5x, 2.0x) */}
              <div className="flex items-center gap-1 bg-surface-2/70 border border-border-subtle rounded px-1.5 py-0.5">
                <span className="text-text-lo/70 text-[9px] uppercase tracking-wider">Rischio:</span>
                {[0.5, 1.0, 1.5, 2.0].map((mult) => (
                  <button
                    key={mult}
                    type="button"
                    onClick={() => {
                      synestheticClick();
                      setRiskMultiplier(mult);
                    }}
                    title={`Riscala la proiezione Monte Carlo con moltiplicatore di rischio ${mult.toFixed(1)}x`}
                    className={cn(
                      "px-1 py-0.2 rounded text-[9px] font-bold transition-all cursor-pointer font-mono",
                      riskMultiplier === mult
                        ? "bg-[#C5A059]/25 text-[#E8C56A] border border-[#C5A059]/40 shadow-sm"
                        : "text-text-lo hover:text-text-hi"
                    )}
                  >
                    {mult.toFixed(1)}x
                  </button>
                ))}
              </div>

              {/* Curva Zero Leak / Frizione Emotiva Toggle */}
              <button
                type="button"
                onClick={() => {
                  synestheticClick();
                  setShowIdealCurve((prev) => !prev);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded transition-all cursor-pointer font-bold",
                  showIdealCurve
                    ? "bg-[#E8C56A]/20 border border-[#E8C56A]/50 text-[#F3D88C]"
                    : "bg-surface-2/60 border border-border-subtle text-text-lo hover:text-text-hi hover:border-[#C5A059]/30"
                )}
                title="Confronta la traiettoria reale con la curva ideale priva di perdite da indisciplina (FOMO, Revenge, Anticipazione)"
              >
                <span className="h-2 w-2 rounded-full bg-[#E8C56A] shadow-[0_0_6px_rgba(232,197,106,0.6)]" />
                <span>Curva Zero Leak</span>
                {totalFrictionBleed > 0 && (
                  <span className="ml-0.5 text-[9px] px-1 py-0.2 rounded bg-red-950/60 border border-red-500/30 text-red-300 font-mono">
                    -{totalFrictionBleed.toFixed(0)}€
                  </span>
                )}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {showIdealCurve && (
                <span className="text-[#E8C56A] font-bold">
                  Ideale: +{idealPnlTotal.toFixed(2)} €
                </span>
              )}
              <div className="flex items-center gap-1">
                <span>Netto Storico:</span>
                <strong className={netPnlTotal >= 0 ? "text-success font-bold" : "text-destructive font-bold"}>
                  {netPnlTotal >= 0 ? `+${netPnlTotal.toFixed(2)}` : netPnlTotal.toFixed(2)} €
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Sovereign Chronos Heatmap Calendar (5 Cols) */}
        <div
          className={cn(
            "lg:col-span-5 h-full min-h-0 overflow-hidden",
            mobileChartTab === "trajectory" ? "hidden lg:block" : "block"
          )}
        >
          <SovereignChronosHeatmap
            entries={entries}
            onSelectDay={(dayStr) => setSearchFilter(dayStr)}
          />
        </div>
      </div>

      {/* ── BOTTOM SECTION (~60% ALTEZZA): REGISTRO OPERAZIONI TABELLARE (CLEAN, NO TAGS/TICKETS) ── */}
      <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-border-subtle/80 bg-surface-0/60 p-3 shadow-inner overflow-hidden">
        {/* Table Filter & Subtitle Bar */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2 mb-1.5">
          <div className="flex items-center gap-2">
            <img
              src="/images/emblems/libro-della-verita.png"
              alt="Registro"
              className="w-5 h-5 object-contain"
            />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-text-hi">
              Registro Esecuzioni a Mercato
            </span>
            <span className="font-mono text-[9px] text-[#C5A059] bg-[#C5A059]/10 px-2 py-0.5 rounded border border-[#C5A059]/30 font-bold">
              {filteredEntries.length} Operazioni
            </span>
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter("")}
                className="text-[9px] font-mono text-text-lo hover:text-text-hi flex items-center gap-1 bg-surface-2 px-1.5 py-0.5 rounded border border-border-subtle"
              >
                Filtro: {searchFilter} <X size={10} />
              </button>
            )}
          </div>

          {/* Search & Result Filters */}
          <div className="flex flex-wrap items-center gap-2 mobile-compact-bar">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-text-lo" />
              <input
                type="text"
                placeholder="Cerca per asset, data..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="mobile-compact-input h-6 w-28 sm:w-40 pl-6 pr-5 text-[11px] font-mono bg-surface-2 border border-border-subtle rounded text-text-hi placeholder:text-text-lo/60 focus:border-[#C5A059]/50 focus:outline-none"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-lo hover:text-text-hi"
                >
                  <X size={11} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 font-mono text-[10px]">
              <button
                type="button"
                onClick={() => setResultFilter("all")}
                className={cn(
                  "rounded px-2 py-0.5 font-semibold transition-all",
                  resultFilter === "all"
                    ? "bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/40"
                    : "text-text-lo hover:text-text-hi"
                )}
              >
                Tutte
              </button>
              <button
                type="button"
                onClick={() => setResultFilter("win")}
                className={cn(
                  "rounded px-2 py-0.5 font-semibold transition-all",
                  resultFilter === "win"
                    ? "bg-success/15 text-success border border-success/40"
                    : "text-text-lo hover:text-text-hi"
                )}
              >
                Win ({ledgerStats.wins})
              </button>
              <button
                type="button"
                onClick={() => setResultFilter("loss")}
                className={cn(
                  "rounded px-2 py-0.5 font-semibold transition-all",
                  resultFilter === "loss"
                    ? "bg-destructive/15 text-destructive border border-destructive/40"
                    : "text-text-lo hover:text-text-hi"
                )}
              >
                Loss ({ledgerStats.losses})
              </button>
              <button
                type="button"
                onClick={() => setResultFilter("be")}
                className={cn(
                  "rounded px-2 py-0.5 font-semibold transition-all",
                  resultFilter === "be"
                    ? "bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/40"
                    : "text-text-lo hover:text-text-hi"
                )}
              >
                B/E ({ledgerStats.be})
              </button>
            </div>
          </div>
        </div>

        {/* Table Content (CLEAN & EXPANDED: Zero ticket noise, zero tags) */}
        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-0">
          <table className="w-full text-left font-mono text-xs">
            <thead className="sticky top-0 bg-surface-1/95 backdrop-blur text-[10px] text-text-lo uppercase border-b border-border-subtle z-10">
              <tr>
                <th className="py-1.5 px-2 sm:px-2.5 whitespace-nowrap">Data</th>
                <th className="py-1.5 px-2 sm:px-2.5 whitespace-nowrap">Asset</th>
                <th className="py-1.5 px-1.5 sm:px-2.5 text-center whitespace-nowrap">Direzione</th>
                <th className="hidden sm:table-cell py-1.5 px-2.5 text-right whitespace-nowrap">Volume</th>
                <th className="hidden sm:table-cell py-1.5 px-2.5 text-right whitespace-nowrap">Entry</th>
                <th className="hidden sm:table-cell py-1.5 px-2.5 text-right whitespace-nowrap">Exit</th>
                <th className="py-1.5 px-2 sm:px-2.5 text-right whitespace-nowrap">PnL Netto</th>
                <th className="py-1.5 px-1.5 sm:px-2.5 text-center whitespace-nowrap">Esito</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-text-lo italic text-xs">
                    Nessun trade archiviato corrispondente ai criteri.
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry) => (
                  <TradeLedgerRow
                    key={entry.id}
                    entry={entry}
                    isSelected={selectedTradeId != null && String(selectedTradeId) === String(entry.id)}
                    onSelectTrade={onSelectTrade}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalLedgerPages > 1 && (
          <div className="shrink-0 flex items-center justify-between border-t border-white/[0.06] pt-1.5 px-1 font-mono text-[10px]">
            <span className="text-text-lo">
              Pagina <strong className="text-[#C5A059]">{activeLedgerPage}</strong> di {totalLedgerPages} ({filteredEntries.length} esecuzioni)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={activeLedgerPage <= 1}
                onClick={() => {
                  synestheticClick();
                  setLedgerPage((p) => Math.max(1, p - 1));
                }}
                className="rounded border border-border-subtle bg-surface-2 px-2 py-0.5 text-text-hi hover:border-[#C5A059]/40 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                Prec
              </button>
              <button
                type="button"
                disabled={activeLedgerPage >= totalLedgerPages}
                onClick={() => {
                  synestheticClick();
                  setLedgerPage((p) => Math.min(totalLedgerPages, p + 1));
                }}
                className="rounded border border-border-subtle bg-surface-2 px-2 py-0.5 text-text-hi hover:border-[#C5A059]/40 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                Succ
              </button>
            </div>
          </div>
        )}

        {/* Integrated Bottom Telemetry Summary */}
        <div className="shrink-0 flex items-center justify-between border-t border-white/[0.06] pt-1.5 mt-1 font-mono text-[10px] text-text-lo">
          <div className="flex items-center gap-3">
            <span>
              Storico: <strong className="text-text-hi">{ledgerStats.total} Trade</strong> (
              <span className="text-success">{ledgerStats.wins} Win</span> /{" "}
              <span className="text-destructive">{ledgerStats.losses} Loss</span>)
            </span>
            <span>
              Win Rate: <strong className="text-text-hi">{ledgerStats.winRate}%</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>PnL Netto Storico:</span>
            <strong className={netPnlTotal >= 0 ? "text-success text-xs" : "text-destructive text-xs"}>
              {netPnlTotal >= 0 ? `+${netPnlTotal.toFixed(2)}` : netPnlTotal.toFixed(2)} €
            </strong>
          </div>
        </div>
      </div>

      <HonorCardShareModal
        isOpen={showHonorCard}
        onClose={() => setShowHonorCard(false)}
        data={honorCardData}
      />

      <NotaryScrollModal
        isOpen={showNotaryModal}
        onClose={() => setShowNotaryModal(false)}
        data={notaryData}
      />

      <DisciplineVirtueRadarModal
        isOpen={showRadarModal}
        onClose={() => setShowRadarModal(false)}
        entries={entries ?? []}
      />

      <CardioPerformanceAnalyticsModal
        isOpen={showCardioModal}
        onClose={() => setShowCardioModal(false)}
        entries={entries ?? []}
      />

      <IntegrityConfessorModal
        isOpen={showConfessorModal}
        onClose={() => setShowConfessorModal(false)}
      />
    </div>
  );
}
