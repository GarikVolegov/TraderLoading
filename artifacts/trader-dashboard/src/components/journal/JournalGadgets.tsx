import React from "react";
import {
  ShieldCheck,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ExecutionBlueprintWidget
 * Tactile technical blueprint visualizer for entry, stop loss, and target levels
 * with visual Risk:Reward ratio calculation and schematic coordinate lines.
 */
export function ExecutionBlueprintWidget({
  market,
  setup,
  entry,
  stop,
  initialRisk,
  currency = "EUR",
  netR,
  className,
}: {
  market?: string;
  setup?: string;
  entry?: string;
  stop?: string;
  initialRisk?: number;
  currency?: string;
  netR?: number | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border-subtle bg-surface-1 p-3 shadow-inner flex flex-col justify-between h-full min-h-[140px]",
        className
      )}
    >
      {/* Blueprint Grid Watermark */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:14px_14px] pointer-events-none" />

      <div className="relative z-10 flex flex-col h-full justify-between space-y-2">
        {/* Top Header: Market & Setup */}
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-[#C5A059]/10 text-[#C5A059] border border-[#C5A059]/30">
              <Target size={11} />
            </span>
            <span className="font-mono text-xs font-bold text-foreground">
              {market || "Asset a Mercato"}
            </span>
          </div>
          <span className="font-mono text-[10px] text-[#C5A059] bg-[#C5A059]/10 px-2 py-0.5 rounded border border-[#C5A059]/30">
            {setup || "Setup Tecnico"}
          </span>
        </div>

        {/* Visual Price Action Coordinate Schematic */}
        <div className="space-y-1.5 font-mono text-[11px] flex-1 justify-center flex flex-col">
          {/* Target / Upside Level */}
          <div className="flex items-center justify-between rounded bg-success/10 border border-success/20 px-2.5 py-1">
            <span className="text-success font-semibold flex items-center gap-1 text-[10px] uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Target / Espansione
            </span>
            <span className="text-success font-bold">
              {netR != null && netR > 0 ? `+${netR.toFixed(1)} R Realizzato` : "Obiettivo Dinamico"}
            </span>
          </div>

          {/* Entry Level */}
          <div className="flex items-center justify-between rounded bg-surface-2 border border-border-subtle px-2.5 py-1 shadow-sm">
            <span className="text-[#C5A059] font-semibold flex items-center gap-1 text-[10px] uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C5A059]" />
              Livello Entry
            </span>
            <span className="text-foreground font-bold font-mono">
              {entry || "Definito a Mercato"}
            </span>
          </div>

          {/* Stop Loss Level */}
          <div className="flex items-center justify-between rounded bg-destructive/10 border border-destructive/20 px-2.5 py-1">
            <span className="text-destructive font-semibold flex items-center gap-1 text-[10px] uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              Stop Loss Strutturale
            </span>
            <span className="text-destructive font-bold font-mono">
              {stop || "Protezione a Mercato"}
            </span>
          </div>
        </div>

        {/* Bottom Parameters & Risk Allocation */}
        <div className="flex items-center justify-between pt-1 border-t border-white/[0.06] text-[10px] font-mono text-muted-foreground shrink-0">
          <span>Rischio Allocato:</span>
          <span className="font-bold text-[#C5A059]">
            {initialRisk != null ? `${initialRisk} ${currency}` : "1.0 R Calcolato"}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * DisciplineStreakDock
 * Executive discipline & activity matrix anchored at the bottom of the session stream.
 * Displays recent activity dot matrix and discipline adherence streak.
 */
export function DisciplineStreakDock({
  totalSessions,
  conformingCount,
  deviationsCount,
  waitsCount,
  tradesCount,
  className,
}: {
  totalSessions: number;
  conformingCount: number;
  deviationsCount: number;
  waitsCount: number;
  tradesCount: number;
  className?: string;
}) {
  const adherence =
    conformingCount + deviationsCount > 0
      ? Math.round((conformingCount / (conformingCount + deviationsCount)) * 100)
      : totalSessions > 0
      ? 100
      : 0;

  // Generate 14 tactical activity indicator dots
  const activityDots = Array.from({ length: 14 }).map((_, i) => {
    if (i < conformingCount) return "conforming";
    if (i < conformingCount + waitsCount) return "wait";
    if (i < conformingCount + waitsCount + deviationsCount) return "deviation";
    return "empty";
  });

  return (
    <div
      className={cn(
        "rounded-xl border border-border-subtle bg-surface-1 p-3 shadow-lg select-none shrink-0",
        className
      )}
    >
      {/* Top Header: Streak Status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-success/10 text-success border border-success/30">
            <ShieldCheck size={12} />
          </span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-foreground">
            Codice di Disciplina
          </span>
        </div>
        <span
          className={cn(
            "rounded px-1.5 py-0.2 font-mono text-[10px] font-bold border",
            adherence >= 80
              ? "border-success/40 bg-success/15 text-success"
              : "border-[#C5A059]/40 bg-[#C5A059]/15 text-[#D4AF37]"
          )}
        >
          {adherence}% Conforme
        </span>
      </div>

      {/* 14-Day Activity Dot Matrix */}
      <div className="space-y-1 mb-2.5">
        <span className="block font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80">
          Attività Recente delle Sessioni:
        </span>
        <div className="flex items-center gap-1.5">
          {activityDots.map((dot, idx) => (
            <span
              key={idx}
              className={cn(
                "h-2 flex-1 rounded-sm transition-all",
                dot === "conforming"
                  ? "bg-success shadow-[0_0_4px_rgba(16,185,129,0.4)]"
                  : dot === "wait"
                  ? "bg-[#C5A059] shadow-[0_0_4px_rgba(197,160,89,0.4)]"
                  : dot === "deviation"
                  ? "bg-destructive shadow-[0_0_4px_rgba(239,68,68,0.4)]"
                  : "bg-surface-2"
              )}
            />
          ))}
        </div>
      </div>

      {/* Mini-Stats Grid */}
      <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-white/[0.06] font-mono text-center text-[10px]">
        <div className="rounded bg-surface-2 p-1 border border-white/[0.04]">
          <span className="text-muted-foreground/70 block text-[9px]">SIGILLI</span>
          <span className="text-foreground font-bold">{totalSessions}</span>
        </div>
        <div className="rounded bg-surface-2 p-1 border border-white/[0.04]">
          <span className="text-muted-foreground/70 block text-[9px]">A MERCATO</span>
          <span className="text-[#C5A059] font-bold">{tradesCount}</span>
        </div>
        <div className="rounded bg-surface-2 p-1 border border-white/[0.04]">
          <span className="text-muted-foreground/70 block text-[9px]">ATTESE</span>
          <span className="text-muted-foreground font-bold">{waitsCount}</span>
        </div>
      </div>
    </div>
  );
}
