import React, { useState } from "react";
import {
  type VarcoVisionResponse,
  type VarcoSetupPlan,
} from "@workspace/api-client-react";
import {
  Eye,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Zap,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  RotateCcw,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  deriveConceptInsights,
  type LimenOperativeMemoryState,
} from "@/lib/replay/limenOperativeMemory";

interface CockpitAiSentinelCardProps {
  isScanning: boolean;
  analysis: VarcoVisionResponse | null;
  onScan: () => void;
  onAdoptSetup: (setup: VarcoSetupPlan, triggerType?: string) => void;
  showOverlay: boolean;
  onToggleOverlay: () => void;
  currentPhase: number;
  continuousAutoScan?: boolean;
  onToggleContinuousAutoScan?: () => void;
  autoAlignCockpit?: boolean;
  onToggleAutoAlignCockpit?: () => void;
  operativeMemory?: LimenOperativeMemoryState;
  onResetMemory?: () => void;
  interval?: string;
}

export function CockpitAiSentinelCard({
  isScanning,
  analysis,
  onScan,
  onAdoptSetup,
  showOverlay,
  onToggleOverlay,
  continuousAutoScan = true,
  onToggleContinuousAutoScan,
  autoAlignCockpit = true,
  onToggleAutoAlignCockpit,
  operativeMemory,
  onResetMemory,
}: CockpitAiSentinelCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const setup = analysis?.setup;
  const audit = analysis?.checklistAudit;
  const isLong = setup?.direction === "long";

  return (
    <div className="rounded-xl border border-[#C5A059]/30 bg-[#0d0f14]/90 p-2.5 shadow-md backdrop-blur-sm transition-all text-foreground">
      {/* ── BARRA HUD: Sentinella Visiva Header ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
              isScanning
                ? "bg-[#C5A059]/20 border-[#C5A059] text-[#E8C56A] shadow-[0_0_10px_rgba(197,160,89,0.4)]"
                : setup
                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                : "bg-white/[0.04] border-white/10 text-[#C5A059]"
            }`}
          >
            {isScanning ? (
              <Loader2 size={13} className="animate-spin text-[#C5A059]" />
            ) : (
              <Eye size={13} className={setup ? "text-emerald-400" : "text-[#C5A059]"} />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <strong className="text-xs font-semibold tracking-tight text-foreground whitespace-nowrap">
                Sentinella Visiva
              </strong>
              {setup ? (
                <span
                  className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold border whitespace-nowrap ${
                    isLong
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                  }`}
                >
                  {setup.direction.toUpperCase()} · {setup.triggerType || "TRIGGER"}
                </span>
              ) : (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#C5A059]/10 text-[#C5A059] border border-[#C5A059]/20 whitespace-nowrap">
                  STANDBY
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground font-mono truncate">
              {isScanning
                ? "Scansione candele live..."
                : setup
                ? `Entry ${setup.entryPrice} · SL ${setup.stopLossPrice} · 1:${setup.riskRewardRatio} R:R`
                : "In ascolto del flusso"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground border border-white/5 hover:border-white/20 transition-all cursor-pointer shrink-0"
          title={isExpanded ? "Comprimi dettagli" : "Espandi dettagli Audit e Memoria"}
        >
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* ── BARRA CONTROLLI RAPIDI A GRIGLIA (Zero Overlap) ── */}
      <div className="grid grid-cols-3 gap-1.5 mt-2 pt-2 border-t border-white/10">
        {onToggleContinuousAutoScan && (
          <button
            type="button"
            onClick={onToggleContinuousAutoScan}
            className={`py-1 px-1.5 rounded-md text-[9.5px] font-mono border transition-all cursor-pointer flex items-center justify-center gap-1 min-w-0 ${
              continuousAutoScan
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-semibold"
                : "bg-white/[0.02] border-white/10 text-muted-foreground hover:text-foreground"
            }`}
            title="Analisi Continua: scansiona in automatico ad ogni nuova candela"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                continuousAutoScan ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/40"
              }`}
            />
            <span className="whitespace-nowrap truncate">Analisi Continua</span>
          </button>
        )}

        {onToggleAutoAlignCockpit && (
          <button
            type="button"
            onClick={onToggleAutoAlignCockpit}
            className={`py-1 px-1.5 rounded-md text-[9.5px] font-mono border transition-all cursor-pointer flex items-center justify-center gap-1 min-w-0 ${
              autoAlignCockpit
                ? "bg-[#C5A059]/20 border-[#C5A059]/50 text-[#C5A059] font-bold"
                : "bg-white/[0.02] border-white/10 text-muted-foreground hover:text-foreground"
            }`}
            title="Auto-Allinea: adatta automaticamente i parametri dello step al setup"
          >
            <Zap size={10} className="shrink-0" />
            <span className="whitespace-nowrap truncate">Auto-Allinea</span>
          </button>
        )}

        <button
          type="button"
          disabled={isScanning}
          onClick={onScan}
          className="py-1 px-1.5 rounded-md bg-[#C5A059]/20 hover:bg-[#C5A059]/30 border border-[#C5A059]/50 text-[#C5A059] text-[9.5px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all disabled:opacity-50 min-w-0"
          title="Scansiona Varco ora"
        >
          {isScanning ? (
            <Loader2 size={10} className="animate-spin shrink-0" />
          ) : (
            <Sparkles size={10} className="shrink-0" />
          )}
          <span className="whitespace-nowrap truncate">Scansiona Varco</span>
        </button>
      </div>

      {/* ── STRIP DI ADOZIONE SETUP (Se presente) ── */}
      {setup && (
        <div className="mt-2 pt-2 border-t border-white/10 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <span className="text-muted-foreground">Setup:</span>
              <span className={isLong ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                {setup.direction.toUpperCase()} @ {setup.entryPrice}
              </span>
              <span className="text-muted-foreground">SL: {setup.stopLossPrice}</span>
            </div>

            <button
              type="button"
              onClick={onToggleOverlay}
              className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                showOverlay
                  ? "bg-[#C5A059]/20 border-[#C5A059]/40 text-[#C5A059]"
                  : "bg-white/[0.02] border-white/10 text-muted-foreground hover:text-foreground"
              }`}
            >
              {showOverlay ? "Grafico: On" : "Grafico: Off"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => onAdoptSetup(setup, audit?.ltfTrigger.triggerType)}
            className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-[#C5A059] to-[#d8b167] text-black font-bold text-[10px] flex items-center justify-center gap-1.5 shadow-sm hover:brightness-105 cursor-pointer transition-all"
          >
            <CheckCircle2 size={12} />
            <span>Adotta Setup AI nel Varco (Auto-Compila)</span>
          </button>
        </div>
      )}

      {/* ── CASSETTO ESPLORATIVO RIPIEGABILE (Audit 4 Fasi & Memoria Antifragile) ── */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
          {/* Audit Checklist LIMEN */}
          {audit && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Audit Checklist LIMEN
                </span>
                <span className="text-[9px] font-mono text-emerald-400">
                  {analysis?.confidenceScore}% Conforme
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <div
                  className={`p-1.5 rounded-md border flex items-start gap-1.5 ${
                    audit.htfContext.valid
                      ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                      : "bg-white/[0.02] border-white/10 text-muted-foreground"
                  }`}
                >
                  {audit.htfContext.valid ? (
                    <CheckCircle2 size={12} className="shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertTriangle size={12} className="shrink-0 text-amber-400 mt-0.5" />
                  )}
                  <div className="truncate">
                    <span className="font-semibold block text-[10px]">1. Contesto HTF</span>
                    <span className="text-[9px] text-muted-foreground line-clamp-1" title={audit.htfContext.note}>
                      {audit.htfContext.note}
                    </span>
                  </div>
                </div>

                <div
                  className={`p-1.5 rounded-md border flex items-start gap-1.5 ${
                    audit.turningPoint.valid
                      ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                      : "bg-white/[0.02] border-white/10 text-muted-foreground"
                  }`}
                >
                  {audit.turningPoint.valid ? (
                    <CheckCircle2 size={12} className="shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertTriangle size={12} className="shrink-0 text-amber-400 mt-0.5" />
                  )}
                  <div className="truncate">
                    <span className="font-semibold block text-[10px]">2. Punto Svolta</span>
                    <span className="text-[9px] text-muted-foreground line-clamp-1" title={audit.turningPoint.note}>
                      {audit.turningPoint.note}
                    </span>
                  </div>
                </div>

                <div
                  className={`p-1.5 rounded-md border flex items-start gap-1.5 ${
                    audit.ltfTrigger.valid
                      ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                      : "bg-white/[0.02] border-white/10 text-muted-foreground"
                  }`}
                >
                  {audit.ltfTrigger.valid ? (
                    <CheckCircle2 size={12} className="shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertTriangle size={12} className="shrink-0 text-amber-400 mt-0.5" />
                  )}
                  <div className="truncate">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold block text-[10px]">3. Trigger</span>
                      {audit.ltfTrigger.triggerType && (
                        <span className="px-1 py-0.2 rounded bg-primary/20 text-primary font-mono text-[8px] font-bold">
                          {audit.ltfTrigger.triggerType}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-muted-foreground line-clamp-1" title={audit.ltfTrigger.note}>
                      {audit.ltfTrigger.note}
                    </span>
                  </div>
                </div>

                <div
                  className={`p-1.5 rounded-md border flex items-start gap-1.5 ${
                    audit.riskGuard.valid
                      ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                      : "bg-white/[0.02] border-white/10 text-muted-foreground"
                  }`}
                >
                  {audit.riskGuard.valid ? (
                    <CheckCircle2 size={12} className="shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertTriangle size={12} className="shrink-0 text-amber-400 mt-0.5" />
                  )}
                  <div className="truncate">
                    <span className="font-semibold block text-[10px]">4. Rischio & Size</span>
                    <span className="text-[9px] text-muted-foreground line-clamp-1" title={audit.riskGuard.note}>
                      {audit.riskGuard.recommendedLots
                        ? `${audit.riskGuard.recommendedLots}L (€${audit.riskGuard.riskAmount})`
                        : audit.riskGuard.note}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Memoria Antifragile & Statistiche per Singolo Concetto */}
          {operativeMemory && (() => {
            const insights = deriveConceptInsights(operativeMemory);
            return (
              <div className="pt-2 border-t border-white/10 space-y-2 text-[10px] font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[#C5A059] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Shield size={11} />
                    <span>Statistiche per Singolo Concetto</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {operativeMemory.stats.totalTrades > 0 && (
                      <span className="text-emerald-400 font-bold">
                        WR: {operativeMemory.stats.winRate}% ({operativeMemory.stats.wins}W/{operativeMemory.stats.losses}L · {operativeMemory.stats.totalR >= 0 ? "+" : ""}{operativeMemory.stats.totalR}R)
                      </span>
                    )}
                    {onResetMemory && (
                      <button
                        type="button"
                        onClick={onResetMemory}
                        className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                        title="Resetta memoria operativa per questo asset"
                      >
                        <RotateCcw size={10} />
                      </button>
                    )}
                  </div>
                </div>

                {insights.activeConcepts.length > 0 ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-thin">
                    {insights.activeConcepts.slice(0, 5).map((c) => (
                      <div
                        key={c.key}
                        className="flex items-center justify-between p-1 rounded bg-black/40 border border-white/5 text-[9px]"
                      >
                        <span className="text-foreground truncate max-w-[130px]">{c.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{c.trades}T</span>
                          <span className={c.winRate >= 50 ? "text-emerald-400" : "text-amber-400"}>
                            {c.winRate}% WR
                          </span>
                          <span className={c.totalR >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                            {c.totalR >= 0 ? "+" : ""}{c.totalR}R
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[9px] text-muted-foreground italic">Nessun trade registrato per questo asset.</p>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
