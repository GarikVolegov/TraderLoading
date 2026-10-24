import React, { useMemo, useState } from "react";
import {
  Search,
  X,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  useGetJournalEntries,
  getGetJournalEntriesQueryKey,
} from "@workspace/api-client-react";
import { EquityCurveChart, type TradePointDetail } from "./EquityCurveChart";
import { SovereignChronosHeatmap } from "./SovereignChronosHeatmap";
import { parseTradeContent } from "@/lib/parseTradeContent";
import { cumulativeR, monteCarloBands } from "@/lib/equityProjection";
import { cn } from "@/lib/utils";

const PROJECTION_STEPS = 20;

interface UnifiedTradeLedgerTrajectoryProps {
  selectedTradeId?: number | string | null;
  onSelectTrade?: (tradeId: number | string) => void;
  className?: string;
}

export function UnifiedTradeLedgerTrajectory({
  selectedTradeId,
  onSelectTrade,
  className,
}: UnifiedTradeLedgerTrajectoryProps) {
  const [searchFilter, setSearchFilter] = useState("");
  const [resultFilter, setResultFilter] = useState<"all" | "win" | "loss" | "be">("all");

  const { data: entries, isLoading: entriesLoading } = useGetJournalEntries({
    query: { queryKey: getGetJournalEntriesQueryKey(), refetchInterval: 30_000 },
  });

  // Sort chronologically (oldest to newest) to build real, authentic equity trajectory from ALL journal entries
  const chronologicalEntries = useMemo(() => {
    return [...(entries ?? [])].sort((a, b) => {
      const da = new Date(a.tradeDate).getTime();
      const db = new Date(b.tradeDate).getTime();
      return da - db;
    });
  }, [entries]);

  // Extract REAL PnL series measured directly in Euro (€)
  const { euroSamples, tradeDetails, realizedEuro, netPnlTotal } = useMemo(() => {
    const euroList: number[] = [];
    const details: TradePointDetail[] = [];
    let cumEuro = 0;

    for (const entry of chronologicalEntries) {
      const parsed = parseTradeContent(entry.content ?? "");
      const profit = parsed?.profit ?? 0;
      cumEuro += profit;
      euroList.push(profit);

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
      });
    }

    return {
      euroSamples: euroList,
      tradeDetails: details,
      realizedEuro: cumulativeR(euroList),
      netPnlTotal: cumEuro,
    };
  }, [chronologicalEntries]);

  // Monte Carlo simulation in EURO driven by trader's actual profit distribution
  const bands = useMemo(() => {
    const effectiveSamples = euroSamples.length > 0 ? euroSamples : [0];
    const startVal = realizedEuro[realizedEuro.length - 1] ?? 0;
    return monteCarloBands(effectiveSamples, {
      steps: PROJECTION_STEPS,
      start: startVal,
    });
  }, [euroSamples, realizedEuro]);

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

  // Ledger stats
  const ledgerStats = useMemo(() => {
    const list = entries ?? [];
    let wins = 0;
    let losses = 0;
    let be = 0;

    for (const e of list) {
      if (e.result === "win") wins++;
      if (e.result === "loss") losses++;
      if (e.result === "breakeven") be++;
    }

    const total = list.length;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    return { total, wins, losses, be, winRate };
  }, [entries]);

  return (
    <div
      className={cn(
        "flex flex-col h-full min-h-0 overflow-hidden bg-surface-1 rounded-2xl border border-border-subtle shadow-xl p-3 gap-2.5 select-none",
        className
      )}
    >
      {/* ── TOP SECTION (~40% ALTEZZA): TRAIETTORIA + HEATMAP CALENDAR SPLIT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 h-[40%] min-h-[185px] shrink-0">
        {/* Trajectory Equity Curve Card in Euro (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-xl border border-border-subtle/80 bg-surface-0/60 p-3 shadow-inner overflow-hidden">
          {/* Header (Decoupled, zero overlap) */}
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5 shrink-0 whitespace-nowrap">
            <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span className="rounded bg-surface-2 border border-border-subtle px-2 py-0.5 text-text-lo">
                <strong className="text-text-hi">{ledgerStats.total}</strong> Trade
              </span>
              <span className="rounded bg-[#C5A059]/10 border border-[#C5A059]/30 px-2 py-0.5 text-[#C5A059] font-bold">
                Win Rate: {ledgerStats.winRate}%
              </span>
            </div>
          </div>

          {/* Interactive SVG Chart Area with Real Journal Data in Euro & Fixed HUD */}
          <div className="flex-1 flex items-center justify-center min-h-0 py-1 overflow-hidden">
            {realizedEuro.length > 0 ? (
              <EquityCurveChart
                realized={realizedEuro}
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

          {/* Bottom Chart Legend (Clean 1-line, no wrapping, measured in Euro) */}
          <div className="flex items-center justify-between text-[10px] font-mono text-text-lo border-t border-white/[0.06] pt-1 shrink-0 whitespace-nowrap">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success" />
                Storico Reale ({ledgerStats.total})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#C5A059]" />
                Monte Carlo (p10-p90)
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span>Netto Storico:</span>
              <strong className={netPnlTotal >= 0 ? "text-success font-bold" : "text-destructive font-bold"}>
                {netPnlTotal >= 0 ? `+${netPnlTotal.toFixed(2)}` : netPnlTotal.toFixed(2)} €
              </strong>
            </div>
          </div>
        </div>

        {/* Sovereign Chronos Heatmap Calendar (5 Cols) */}
        <div className="lg:col-span-5 h-full min-h-0 overflow-hidden">
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
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-text-lo" />
              <input
                type="text"
                placeholder="Cerca per asset, data..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="h-6 w-28 sm:w-40 pl-6 pr-5 text-[11px] font-mono bg-surface-2 border border-border-subtle rounded text-text-hi placeholder:text-text-lo/60 focus:border-[#C5A059]/50 focus:outline-none"
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
                <th className="py-1.5 px-2.5">Data</th>
                <th className="py-1.5 px-2.5">Asset</th>
                <th className="py-1.5 px-2.5 text-center">Direzione</th>
                <th className="py-1.5 px-2.5 text-right">Volume</th>
                <th className="py-1.5 px-2.5 text-right">Entry</th>
                <th className="py-1.5 px-2.5 text-right">Exit</th>
                <th className="py-1.5 px-2.5 text-right">PnL Netto</th>
                <th className="py-1.5 px-2.5 text-center">Esito</th>
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
                filteredEntries.map((entry) => {
                  const parsed = parseTradeContent(entry.content ?? "");
                  const isWin = entry.result === "win";
                  const isLoss = entry.result === "loss";
                  const pnl = parsed?.profit;
                  const isSelected = selectedTradeId != null && String(selectedTradeId) === String(entry.id);

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
                      key={entry.id}
                      onClick={() => onSelectTrade?.(entry.id)}
                      className={cn(
                        "group cursor-pointer transition-colors select-none",
                        isSelected
                          ? "bg-[#C5A059]/15 border-l-2 border-l-[#C5A059]"
                          : "hover:bg-white/[0.04]"
                      )}
                    >
                      {/* Date */}
                      <td className="py-1.5 px-2.5 text-text-hi font-semibold">
                        {entry.tradeDate.slice(0, 10)}
                      </td>

                      {/* Clean Asset Name */}
                      <td className="py-1.5 px-2.5 font-bold">
                        <span className={cn(
                          "transition-colors",
                          isSelected ? "text-[#C5A059]" : "text-text-hi group-hover:text-[#C5A059]"
                        )}>
                          {cleanSymbol}
                        </span>
                      </td>

                      {/* Direction (Noble desaturated badges) */}
                      <td className="py-1.5 px-2.5 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center gap-0.5 rounded px-2 py-0.2 text-[9px] font-bold border",
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
                      <td className="py-1.5 px-2.5 text-right text-text-lo">
                        {parsed?.volume != null ? `${parsed.volume} lotti` : "0.01"}
                      </td>

                      {/* Entry Price */}
                      <td className="py-1.5 px-2.5 text-right text-text-hi font-medium">
                        {parsed?.entryPrice ? parsed.entryPrice.toFixed(2) : "—"}
                      </td>

                      {/* Exit Price */}
                      <td className="py-1.5 px-2.5 text-right text-text-lo">
                        {parsed?.exitPrice ? parsed.exitPrice.toFixed(2) : "—"}
                      </td>

                      {/* Net PnL (Hero text) */}
                      <td
                        className={cn(
                          "py-1.5 px-2.5 text-right font-bold text-xs",
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
                      <td className="py-1.5 px-2.5 text-center">
                        <span
                          className={cn(
                            "inline-flex rounded px-1.5 py-0.2 text-[9px] font-bold border",
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
                })
              )}
            </tbody>
          </table>
        </div>

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
    </div>
  );
}
