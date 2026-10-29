import React, { useState } from "react";
import type { JournalEntry } from "@workspace/api-client-react";
import { DisciplineVirtueRadar } from "./DisciplineVirtueRadar";
import { Compass, X, Shield, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DisciplineVirtueRadarModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: JournalEntry[];
  currentEntry?: JournalEntry | null;
}

export function DisciplineVirtueRadarModal({
  isOpen,
  onClose,
  entries,
  currentEntry,
}: DisciplineVirtueRadarModalProps) {
  const [filterMode, setFilterMode] = useState<"all" | "current">("all");

  if (!isOpen) return null;

  // Filtered subset if "current" selected
  const displayedEntries =
    filterMode === "current" && currentEntry ? [currentEntry] : entries;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-[#C5A059]/35 bg-[#07080b] shadow-[0_0_50px_rgba(197,160,89,0.15)] flex flex-col max-h-[92vh] overflow-hidden">
        {/* ── CEREMONIAL HEADER ── */}
        <div className="flex items-center justify-between border-b border-[#C5A059]/20 px-4 py-3 bg-[#0d0f14]/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#C5A059]/15 border border-[#C5A059]/30 flex items-center justify-center text-[#E8C56A] shrink-0">
              <Compass size={16} />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-[#E8C56A] flex items-center gap-1.5">
                Mappa della Disciplina
                <Sparkles size={11} className="text-[#C5A059]" />
              </h3>
              <p className="font-mono text-[9.5px] text-text-lo">
                Analisi vettoriale delle Virtù d&apos;Integrità e dei Leak della Deriva
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-white/10 bg-surface-1 hover:bg-surface-2 flex items-center justify-center text-text-lo hover:text-text-hi transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* ── FILTER TOGGLE BAR ── */}
        <div className="px-4 pt-3 shrink-0 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-1 p-0.5 text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={cn(
                "px-3 py-1 rounded font-semibold transition-all whitespace-nowrap",
                filterMode === "all"
                  ? "bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/40 font-bold"
                  : "text-text-lo hover:text-text-hi",
              )}
            >
              Archivio Completo ({entries.length})
            </button>
            {currentEntry && (
              <button
                type="button"
                onClick={() => setFilterMode("current")}
                className={cn(
                  "px-3 py-1 rounded font-semibold transition-all whitespace-nowrap",
                  filterMode === "current"
                    ? "bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/40 font-bold"
                    : "text-text-lo hover:text-text-hi",
                )}
              >
                Trade Selezionato (#{currentEntry.id})
              </button>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[9px] font-mono text-text-lo">
            <Shield size={10} className="text-[#10b981]" />
            <span>Verde: Virtù</span>
            <span className="text-white/20">|</span>
            <span className="text-[#ef4444]">Rosso: Leak</span>
          </div>
        </div>

        {/* ── RADAR BODY ── */}
        <div className="p-4 overflow-y-auto overflow-x-hidden flex-1 scrollbar-thin scrollbar-thumb-[#C5A059]/20">
          <DisciplineVirtueRadar
            entries={displayedEntries}
            currentEntry={currentEntry}
          />
        </div>
      </div>
    </div>
  );
}
