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
  onOpenTacticalBreath?: () => void;
  directionalBias?: {
    h4MasterBias?: string;
    edgeTier?: string;
    antiFadeProtected?: boolean;
  } | null;
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
  directionalBias,
}: CockpitAiSentinelCardProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem("tl_cockpit_sentinel_expanded") === "1";
    } catch {
      return false;
    }
  });

  const toggleExpanded = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("tl_cockpit_sentinel_expanded", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  const setup = analysis?.setup;
  const audit = analysis?.checklistAudit;
  const isLong = setup?.direction === "long";

  return (
    <div
      className={`border border-[#C5A059]/30 bg-[#0d0f14]/95 shadow-sm transition-all text-foreground ${
        isExpanded ? "rounded-xl p-2.5 backdrop-blur-sm" : "rounded-lg px-2.5 py-1.5"
      }`}
    >
      {/* ── BARRA HUD MICRO: Sentinella Visiva Header Compatto ── */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border transition-all ${
              isScanning
                ? "bg-[#C5A059]/20 border-[#C5A059] text-[#E8C56A] shadow-[0_0_8px_rgba(197,160,89,0.3)]"
                : setup
                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                : "bg-white/[0.04] border-white/10 text-[#C5A059]"
            }`}
          >
            {isScanning ? (
              <Loader2 size={11} className="animate-spin text-[#C5A059]" />
            ) : (
              <Eye size={11} className={setup ? "text-emerald-400" : "text-[#C5A059]"} />
            )}
          </div>

          <strong className="text-[11px] font-semibold tracking-tight text-foreground whitespace-nowrap">
            Sentinella Visiva
          </strong>

          {setup ? (
            <span
              className={`px-1.5 py-0.2 rounded font-mono text-[8.5px] font-bold border whitespace-nowrap ${
                isLong
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-300 border-rose-500/30"
              }`}
            >
              {setup.direction.toUpperCase()} @ {setup.entryPrice}
            </span>
          ) : (
            <span className="text-[8.5px] font-mono px-1.5 py-0.2 rounded bg-[#C5A059]/10 text-[#C5A059] border border-[#C5A059]/20 whitespace-nowrap">
              {isScanning ? "SCANSIONE..." : "STANDBY"}
            </span>
          )}

          {directionalBias?.h4MasterBias && (
            <span
              className={`text-[8px] font-mono px-1 py-0.2 rounded border whitespace-nowrap hidden sm:inline-block ${
                directionalBias.h4MasterBias === "BULLISH"
                  ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/30"
                  : directionalBias.h4MasterBias === "BEARISH"
                  ? "bg-rose-950/40 text-rose-400 border-rose-500/30"
                  : "bg-zinc-800 text-zinc-400 border-zinc-700"
              }`}
              title="Bias H4 (HTF TraderWiki)"
            >
              H4 {directionalBias.h4MasterBias}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {setup && !isExpanded && (
            <button
              type="button"
              onClick={() => onAdoptSetup(setup, audit?.ltfTrigger.triggerType)}
              className="py-0.5 px-2 rounded bg-gradient-to-r from-[#C5A059] to-[#d8b167] text-black font-bold text-[9px] font-mono flex items-center gap-1 shadow-sm hover:brightness-105 cursor-pointer whitespace-nowrap"
              title="Adotta Setup AI nel Varco"
            >
              <CheckCircle2 size={10} />
              <span>Adotta</span>
            </button>
          )}

          <button
            type="button"
            disabled={isScanning}
            onClick={onScan}
            className="py-0.5 px-2 rounded-md bg-[#C5A059]/15 hover:bg-[#C5A059]/25 border border-[#C5A059]/35 text-[#E8C56A] text-[9.5px] font-mono font-semibold flex items-center gap-1 cursor-pointer transition-all disabled:opacity-50 whitespace-nowrap"
            title="Scansiona Varco ora"
          >
            {isScanning ? (
              <Loader2 size={10} className="animate-spin text-[#C5A059]" />
            ) : (
              <Sparkles size={10} className="text-[#C5A059]" />
            )}
            <span>Scansiona Varco</span>
          </button>

          <button
            type="button"
            onClick={toggleExpanded}
            className="p-1 rounded text-muted-foreground hover:text-foreground border border-white/5 hover:border-white/20 transition-all cursor-pointer"
            title={isExpanded ? "Comprimi Sentinella Visiva" : "Espandi controlli e Audit della Sentinella"}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* ── DETTAGLI ESTESI QUANDO ESPANSA ── */}
      {isExpanded && (
        <div className="mt-2.5 pt-2 border-t border-white/10 space-y-2.5">
          {/* Subtitle / Stato del Flusso */}
          <p className="text-[10px] text-muted-foreground font-mono truncate">
            {isScanning
              ? "Scansione candele live in corso..."
              : setup
              ? `Entry ${setup.entryPrice} · SL ${setup.stopLossPrice} · 1:${setup.riskRewardRatio} R:R`
              : "In ascolto del flusso algoritmico del mercato"}
          </p>

          {/* Barra Controlli Rapidi (Analisi Continua & Auto-Allinea) */}
          <div className="grid grid-cols-2 gap-1.5">
            {onToggleContinuousAutoScan && (
              <button
                type="button"
                onClick={onToggleContinuousAutoScan}
                className={`py-1 px-2 rounded-md text-[9.5px] font-mono border transition-all cursor-pointer flex items-center justify-center gap-1.5 min-w-0 ${
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
                <span className="whitespace-nowrap">Analisi Continua</span>
              </button>
            )}

            {onToggleAutoAlignCockpit && (
              <button
                type="button"
                onClick={onToggleAutoAlignCockpit}
                className={`py-1 px-2 rounded-md text-[9.5px] font-mono border transition-all cursor-pointer flex items-center justify-center gap-1.5 min-w-0 ${
                  autoAlignCockpit
                    ? "bg-[#C5A059]/20 border-[#C5A059]/50 text-[#C5A059] font-bold"
                    : "bg-white/[0.02] border-white/10 text-muted-foreground hover:text-foreground"
                }`}
                title="Auto-Allinea: adatta automaticamente i parametri dello step al setup"
              >
                <Zap size={10} className="shrink-0" />
                <span className="whitespace-nowrap">Auto-Allinea</span>
              </button>
            )}
          </div>

          {/* Strip Adozione Setup Esteso */}
          {setup && (
            <div className="pt-2 border-t border-white/10 space-y-1.5">
              <div className="flex items-center justify-between gap-1.5 flex-wrap text-[10px] font-mono">
                <div className="flex items-center gap-1.5 min-w-0">
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

          {/* Audit Checklist AUREUS */}
          {audit && (
            <div className="space-y-1.5 pt-1 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Audit Checklist AUREUS
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
