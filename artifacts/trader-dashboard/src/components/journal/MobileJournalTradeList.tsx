// ─── MobileJournalTradeList (Ergonomic Mobile Trade Ledger & Bottom Sheet) ──
// Purpose-built mobile view for Il Libro della Verità (Journal):
// - Replaces the endless 5000px scroll of giant desktop cards on smartphone.
// - Compact luxury broker row list: Asset, Direction, Date, P&L in monospace, R:R.
// - Tapping any row opens the full trade dossier in LimenResponsiveDrawer (Bottom Sheet).
// - Top KPI summary bar: Win Rate, Net Profit, Total Trades.

import React, { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  CalendarDays,
  Tag,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Trash2,
  Edit2,
  Image as ImageIcon,
  ExternalLink,
  Layers,
  Sparkles,
} from "lucide-react";
import { useLanguage, useDateLocale, uiText } from "@/contexts/LanguageContext";
import { synestheticClick } from "@/lib/soundFx";
import { LimenResponsiveDrawer } from "@/components/ui/LimenResponsiveDrawer";
import { parseTradeContent } from "@/lib/parseTradeContent";
import type { JournalEntry } from "@workspace/api-client-react";

export interface MobileJournalTradeListProps {
  entries: JournalEntry[];
  onEditEntry?: (entry: JournalEntry) => void;
  onDeleteEntry?: (id: number) => void;
  currencySymbol?: string;
}

type PeriodFilter = "all" | "this_week" | "last_week" | "month";
type ResultFilter = "all" | "win" | "loss";

export function MobileJournalTradeList({
  entries,
  onEditEntry,
  onDeleteEntry,
  currencySymbol = "€",
}: MobileJournalTradeListProps) {
  const { t, language } = useLanguage();
  const dateLocale = useDateLocale();
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");

  // Filter entries based on period and outcome
  const filteredEntries = useMemo(() => {
    const now = Date.now();
    const oneDay = 86_400_000;
    const sevenDays = 7 * oneDay;
    const thirtyDays = 30 * oneDay;

    return entries.filter((entry) => {
      // Result filter
      if (resultFilter === "win" && entry.result !== "win") return false;
      if (resultFilter === "loss" && entry.result !== "loss") return false;

      // Period filter
      if (periodFilter === "all") return true;

      const tradeTs = parseISO(entry.tradeDate).getTime();
      const diff = now - tradeTs;

      if (periodFilter === "this_week") {
        return diff <= sevenDays && diff >= -oneDay;
      }
      if (periodFilter === "last_week") {
        return diff > sevenDays && diff <= 14 * oneDay;
      }
      if (periodFilter === "month") {
        return diff <= thirtyDays && diff >= -oneDay;
      }
      return true;
    });
  }, [entries, periodFilter, resultFilter]);

  // Compute summary KPIs dynamically on filtered subset
  const kpis = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let totalPnl = 0;

    for (const e of filteredEntries) {
      if (e.result === "win") wins++;
      else if (e.result === "loss") losses++;

      if (e.content) {
        const parsed = parseTradeContent(e.content);
        if (parsed?.profit != null) {
          totalPnl += parsed.profit;
        }
      }
    }

    const total = filteredEntries.length;
    const winRate = total > 0 ? Math.round((wins / (wins + losses || 1)) * 100) : 0;
    return { wins, losses, total, winRate, totalPnl };
  }, [filteredEntries]);

  const selectedParsed = useMemo(() => {
    if (!selectedEntry?.content) return null;
    return parseTradeContent(selectedEntry.content);
  }, [selectedEntry]);

  return (
    <div className="md:hidden space-y-3 font-mono select-none">
      {/* ── Period Carousel & Outcome Switcher ── */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          {[
            { id: "all", label: "Tutti i Trade" },
            { id: "this_week", label: "Questa Settimana" },
            { id: "last_week", label: "Settimana Scorsa" },
            { id: "month", label: "Ultimi 30 Giorni" },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => {
                synestheticClick();
                setPeriodFilter(chip.id as PeriodFilter);
              }}
              className={`px-2.5 py-1 rounded-lg text-[9.5px] font-bold uppercase tracking-wider whitespace-nowrap border transition-all cursor-pointer ${
                periodFilter === chip.id
                  ? "border-[#C5A059] bg-[#C5A059]/25 text-[#E8C56A] shadow-[0_0_10px_rgba(197,160,89,0.3)]"
                  : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {[
            { id: "all", label: "Tutti" },
            { id: "win", label: "Solo Win" },
            { id: "loss", label: "Solo Loss" },
          ].map((res) => (
            <button
              key={res.id}
              type="button"
              onClick={() => {
                synestheticClick();
                setResultFilter(res.id as ResultFilter);
              }}
              className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider whitespace-nowrap border transition-all cursor-pointer ${
                resultFilter === res.id
                  ? res.id === "win"
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                    : res.id === "loss"
                      ? "border-rose-500 bg-rose-500/20 text-rose-400"
                      : "border-[#C5A059] bg-[#C5A059]/20 text-[#E8C56A]"
                  : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
              }`}
            >
              {res.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Top Mobile KPI Sticky Capsule Ribbon (Dynamic for visible period) ── */}
      <div className="sticky top-1 z-20 grid grid-cols-3 gap-2 p-2.5 rounded-xl border border-[#C5A059]/40 bg-[#07080b]/95 backdrop-blur-xl shadow-[0_6px_24px_rgba(0,0,0,0.85)]">
        <div className="text-center border-r border-white/10 pr-1">
          <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
            Win Rate
          </div>
          <div className={`text-xs font-bold mt-0.5 ${kpis.winRate >= 50 ? "text-emerald-400" : "text-[#E8C56A]"}`}>
            {kpis.winRate}%
          </div>
        </div>

        <div className="text-center border-r border-white/10 pr-1">
          <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
            Trade
          </div>
          <div className="text-xs font-bold text-slate-200 mt-0.5">
            {kpis.total}
          </div>
        </div>

        <div className="text-center">
          <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
            P&L Netto
          </div>
          <div
            className={`text-xs font-bold mt-0.5 whitespace-nowrap ${
              kpis.totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {kpis.totalPnl >= 0 ? "+" : ""}
            {kpis.totalPnl.toFixed(2)} {currencySymbol}
          </div>
        </div>
      </div>

      {/* ── Compact Trade Rows List ── */}
      {filteredEntries.length === 0 ? (
        <div className="p-6 rounded-xl border border-dashed border-white/15 bg-white/5 text-center text-xs text-slate-400">
          Nessun trade registrato per i filtri selezionati.
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredEntries.map((entry) => {
          const parsed = entry.content ? parseTradeContent(entry.content) : null;
          const isWin = entry.result === "win";
          const isLoss = entry.result === "loss";
          const isBe = entry.result === "breakeven";

          const resultLabel = isWin ? "WIN" : isLoss ? "LOSS" : "BE";
          const resultBadgeClass = isWin
            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
            : isLoss
              ? "border-rose-500/50 bg-rose-500/15 text-rose-400"
              : "border-slate-500/40 bg-slate-500/15 text-slate-300";

          const direction = parsed?.direction?.toLowerCase();
          const isLong = direction?.includes("buy") || direction?.includes("long");
          const isShort = direction?.includes("sell") || direction?.includes("short");

          const pnlValue = parsed?.profit;
          const hasImage = entry.images && entry.images.length > 0;

          return (
            <div
              key={entry.id}
              onClick={() => {
                synestheticClick();
                setSelectedEntry(entry);
              }}
              className="p-2.5 rounded-xl border border-white/10 bg-[#0d0f14]/90 hover:border-[#C5A059]/40 active:bg-[#141722] transition-colors cursor-pointer flex items-center justify-between gap-2 shadow-sm"
            >
              {/* Left: Direction Icon + Asset Symbol + Date */}
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                    isLong
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : isShort
                        ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
                        : "border-[#C5A059]/40 bg-[#C5A059]/10 text-[#E8C56A]"
                  }`}
                >
                  {isLong ? (
                    <TrendingUp size={14} />
                  ) : isShort ? (
                    <TrendingDown size={14} />
                  ) : (
                    <Minus size={14} />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-foreground truncate">
                      {entry.title || parsed?.symbol || "Trade"}
                    </span>
                    {hasImage && (
                      <ImageIcon size={11} className="text-[#E8C56A] shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[9.5px] text-slate-400 mt-0.5">
                    <span>
                      {format(parseISO(entry.tradeDate), "d MMM", { locale: dateLocale })}
                    </span>
                    {parsed?.volume != null && (
                      <>
                        <span>·</span>
                        <span>{parsed.volume.toFixed(2)} Lot</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: P&L + Result Chip + Chevron */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  {pnlValue != null ? (
                    <div
                      className={`text-xs font-bold whitespace-nowrap ${
                        pnlValue >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {pnlValue >= 0 ? "+" : ""}
                      {pnlValue.toFixed(2)} {parsed?.currency || currencySymbol}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400">—</div>
                  )}
                  <span
                    className={`inline-block px-1.5 py-0.2 rounded font-bold uppercase text-[8.5px] border mt-0.5 ${resultBadgeClass}`}
                  >
                    {resultLabel}
                  </span>
                </div>

                <ChevronRight size={14} className="text-slate-500" />
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* ── Trade Detail Dossier (Bottom Sheet) ── */}
      <LimenResponsiveDrawer
        open={selectedEntry !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedEntry(null);
        }}
        title={selectedEntry?.title || "Dossier del Trade"}
        subtitle={
          selectedEntry
            ? `${format(parseISO(selectedEntry.tradeDate), "EEEE d MMMM yyyy", { locale: dateLocale })} · Il Libro della Verità`
            : undefined
        }
      >
        {selectedEntry && (
          <div className="space-y-4 font-mono text-xs">
            {/* Screenshot Hero */}
            {selectedEntry.images && selectedEntry.images.length > 0 && (
              <div className="aspect-video w-full rounded-xl overflow-hidden border border-[#C5A059]/30 relative bg-black shadow-md">
                <img
                  src={selectedEntry.images[0].url}
                  alt={selectedEntry.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Coordinates Matrix */}
            {selectedParsed && (
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-black/60 border border-white/10 text-[11px]">
                {selectedParsed.symbol && (
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-400">Strumento:</span>
                    <span className="font-bold text-[#E8C56A] uppercase">{selectedParsed.symbol}</span>
                  </div>
                )}
                {selectedParsed.direction && (
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-400">Direzione:</span>
                    <span className="font-bold uppercase text-foreground">{selectedParsed.direction}</span>
                  </div>
                )}
                {selectedParsed.entryPrice != null && (
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-400">Prezzo Entry:</span>
                    <span className="font-bold text-foreground">{selectedParsed.entryPrice}</span>
                  </div>
                )}
                {selectedParsed.exitPrice != null && (
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-400">Prezzo Exit:</span>
                    <span className="font-bold text-foreground">{selectedParsed.exitPrice}</span>
                  </div>
                )}
                {selectedParsed.stopLoss != null && (
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-400">Stop Loss:</span>
                    <span className="font-bold text-rose-400">{selectedParsed.stopLoss}</span>
                  </div>
                )}
                {selectedParsed.takeProfit != null && (
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-slate-400">Take Profit:</span>
                    <span className="font-bold text-emerald-400">{selectedParsed.takeProfit}</span>
                  </div>
                )}
                {selectedParsed.profit != null && (
                  <div className="flex justify-between pt-1 col-span-2">
                    <span className="text-slate-400">P&L Netto:</span>
                    <span
                      className={`font-bold text-sm ${
                        selectedParsed.profit >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {selectedParsed.profit >= 0 ? "+" : ""}
                      {selectedParsed.profit.toFixed(2)} {selectedParsed.currency || currencySymbol}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            {selectedEntry.tags && (
              <div className="flex flex-wrap gap-1.5">
                {selectedEntry.tags.split(",").map((t, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/30 text-[#E8C56A] text-[9.5px] font-bold uppercase tracking-wider"
                  >
                    #{t.trim()}
                  </span>
                ))}
              </div>
            )}

            {/* Note / Reflection */}
            {selectedEntry.content && (
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 leading-relaxed text-[11px] whitespace-pre-wrap">
                {selectedEntry.content}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#C5A059]/20">
              {onEditEntry && (
                <button
                  type="button"
                  onClick={() => {
                    const e = selectedEntry;
                    setSelectedEntry(null);
                    onEditEntry(e);
                  }}
                  className="flex-1 py-2 rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/15 text-[#E8C56A] text-xs font-bold uppercase tracking-wider hover:bg-[#C5A059]/25 transition-colors text-center"
                >
                  Modifica
                </button>
              )}
              {onDeleteEntry && (
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedEntry.id;
                    setSelectedEntry(null);
                    onDeleteEntry(id);
                  }}
                  className="py-2 px-3 rounded-lg border border-rose-500/40 bg-rose-500/15 text-rose-300 text-xs font-bold uppercase tracking-wider hover:bg-rose-500/25 transition-colors text-center"
                >
                  Elimina
                </button>
              )}
            </div>
          </div>
        )}
      </LimenResponsiveDrawer>
    </div>
  );
}
