import React, { useState } from "react";
import {
  type VarcoVisionResponse,
  type VarcoSetupPlan,
  type VarcoChecklistAudit,
  type VarcoProceduralStep,
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
  Loader2,
  Play,
  Clock,
  Layers,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { getCockpitSchematic } from "@/lib/cockpitSchematics";
import {
  deriveConceptInsights,
  type LimenOperativeMemoryState,
} from "@/lib/replay/limenOperativeMemory";

interface BacktestAiSentinelPanelProps {
  isScanning: boolean;
  analysis: VarcoVisionResponse | null;
  onScan: () => void;
  onExecuteSetup: (setup: VarcoSetupPlan) => void;
  showOverlay: boolean;
  onToggleOverlay: () => void;
  autoAuditOnStep?: boolean;
  onToggleAutoAudit?: () => void;
  autoExecuteAi?: boolean;
  onToggleAutoExecute?: () => void;
  missedMoveNotice?: string | null;
  onDismissMissedNotice?: () => void;
  operativeMemory?: LimenOperativeMemoryState;
  onResetMemory?: () => void;
  symbol: string;
  interval: string;
}

export function BacktestAiSentinelPanel({
  isScanning,
  analysis,
  onScan,
  onExecuteSetup,
  showOverlay,
  onToggleOverlay,
  autoAuditOnStep = false,
  onToggleAutoAudit,
  autoExecuteAi = false,
  onToggleAutoExecute,
  missedMoveNotice,
  onDismissMissedNotice,
  operativeMemory,
  onResetMemory,
  symbol,
  interval,
}: BacktestAiSentinelPanelProps) {
  const [selectedPhase, setSelectedPhase] = useState<number>(3); // Default to Step 3 (Trigger/Limit)
  const setup = analysis?.setup;
  const audit = analysis?.checklistAudit;
  const proceduralSteps = analysis?.proceduralSteps;
  const isLong = setup?.direction === "long";
  const isLimit = setup?.orderType === "limit";

  const activeStep = proceduralSteps?.find((s) => s.phase === selectedPhase);
  const activeSchematic = activeStep?.schematicId ? getCockpitSchematic(activeStep.schematicId) : null;

  return (
    <div className="rounded-xl border border-[#C5A059]/30 bg-black/60 p-3 shadow-xl space-y-3 backdrop-blur-md text-foreground">
      {/* ── Testata Sentinella Forgia ── */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#C5A059]/20 border border-[#C5A059]/40 flex items-center justify-center text-[#C5A059]">
            <Eye size={14} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <strong className="text-xs font-semibold text-foreground">Sentinella della Forgia</strong>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#C5A059]/15 text-[#E8C56A] border border-[#C5A059]/35 font-bold uppercase tracking-wider whitespace-nowrap">
                PROCEDURALE AUREUS
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground whitespace-nowrap">Audit retrospettivo & ordini Limit</p>
          </div>
        </div>

        <button
          type="button"
          disabled={isScanning}
          onClick={onScan}
          className="py-1 px-2.5 rounded-lg bg-[#C5A059]/20 hover:bg-[#C5A059]/30 border border-[#C5A059]/50 text-[#C5A059] text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02] disabled:opacity-50"
          title="Scansiona la barra storica corrente nel replay seguendo la procedura a 4 fasi"
        >
          {isScanning ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              <span>Procedura...</span>
            </>
          ) : (
            <>
              <Sparkles size={12} />
              <span>Scansiona Barra</span>
            </>
          )}
        </button>
      </div>

      {/* ── Toggle Opzioni Rapide (Overlay, Analisi Continua, Auto-Esecuzione) ── */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono pt-0.5">
        <button
          type="button"
          onClick={onToggleOverlay}
          className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
            showOverlay
              ? "bg-[#C5A059]/20 border-[#C5A059]/40 text-[#C5A059]"
              : "bg-white/[0.02] border-white/10 text-muted-foreground hover:text-foreground"
          }`}
          title="Mostra o nascondi le fasce del setup sul canvas di replay"
        >
          {showOverlay ? "Overlay: On" : "Overlay: Off"}
        </button>

        {onToggleAutoAudit && (
          <button
            type="button"
            onClick={onToggleAutoAudit}
            className={`px-2 py-0.5 rounded border transition-colors cursor-pointer flex items-center gap-1 ${
              autoAuditOnStep
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 font-semibold"
                : "bg-white/[0.02] border-white/10 text-muted-foreground hover:text-foreground"
            }`}
            title="Esegue automaticamente l'analisi continua ad ogni avanzamento di barra nel replay"
          >
            {autoAuditOnStep && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            <span>{autoAuditOnStep ? "Analisi Continua: On" : "Analisi: Off"}</span>
          </button>
        )}

        {onToggleAutoExecute && (
          <button
            type="button"
            onClick={onToggleAutoExecute}
            className={`px-2 py-0.5 rounded border transition-colors cursor-pointer flex items-center gap-1 ${
              autoExecuteAi
                ? "bg-[#C5A059]/25 border-[#C5A059]/60 text-[#F5D061] font-semibold"
                : "bg-white/[0.02] border-white/10 text-muted-foreground hover:text-foreground"
            }`}
            title="Quando un setup è pronto, piazza automaticamente l'ordine Limit/Market nella Forgia senza dover cliccare"
          >
            {autoExecuteAi && <span className="w-1.5 h-1.5 rounded-full bg-[#C5A059] animate-pulse" />}
            <span>{autoExecuteAi ? "Auto-Esegui: On" : "Auto-Esegui: Off"}</span>
          </button>
        )}
      </div>

      {/* ── Banner Missed Move (Target Raggiunto Senza Retest) ── */}
      {missedMoveNotice && (
        <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 text-[11px] space-y-1">
          <div className="flex items-center justify-between font-semibold text-amber-300">
            <span className="flex items-center gap-1 font-mono text-[10px] uppercase">
              <Clock size={11} className="text-amber-400" />
              <span>Target Raggiunto Senza Retest (Missed Move)</span>
            </span>
            {onDismissMissedNotice && (
              <button
                type="button"
                onClick={onDismissMissedNotice}
                className="text-amber-400/70 hover:text-amber-200 text-[10px] cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
          <p className="text-[10px] text-amber-200/90 leading-tight">
            {missedMoveNotice}
          </p>
        </div>
      )}

      {/* ── Stepper Procedurale Finestra Operativa (4 Fasi) ── */}
      {proceduralSteps && proceduralSteps.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-white/10">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Layers size={11} className="text-[#C5A059]" />
              <span>Procedura a 4 Fasi ({symbol} · {interval})</span>
            </span>
            <span className="text-emerald-400 font-bold">
              {analysis?.confidenceScore}% Conforme
            </span>
          </div>

          {/* Pipeline Visuale delle 4 Fasi */}
          <div className="grid grid-cols-4 gap-1">
            {proceduralSteps.map((step) => {
              const isSelected = selectedPhase === step.phase;
              return (
                <button
                  key={step.phase}
                  type="button"
                  onClick={() => setSelectedPhase(step.phase)}
                  className={`py-1 px-1.5 rounded text-center transition-all cursor-pointer border text-[9.5px] font-mono ${
                    isSelected
                      ? "bg-[#C5A059]/25 border-[#C5A059] text-foreground font-bold shadow-sm"
                      : step.valid
                      ? "bg-white/[0.03] border-emerald-500/30 text-emerald-300 hover:bg-white/[0.06]"
                      : "bg-white/[0.02] border-amber-500/30 text-amber-300 hover:bg-white/[0.06]"
                  }`}
                  title={step.note}
                >
                  <div className="flex items-center justify-center gap-1">
                    {step.valid ? (
                      <CheckCircle2 size={10} className="text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle size={10} className="text-amber-400 shrink-0" />
                    )}
                    <span className="whitespace-nowrap">Fase {step.phase}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Sintesi Chirurgica della Fase Selezionata */}
          {activeStep && (
            <div className="p-1.5 rounded-lg bg-black/40 border border-white/5 space-y-1 text-[10.5px]">
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold text-foreground text-[11px] truncate">{activeStep.title}</span>
                {activeSchematic && (
                  <span className="text-[8.5px] font-mono px-1.5 py-0.5 rounded bg-[#C5A059]/15 text-[#E8C56A] border border-[#C5A059]/30 whitespace-nowrap shrink-0">
                    {activeSchematic.title.startsWith("Trigger:")
                      ? activeSchematic.title
                      : `Schematica: ${activeSchematic.title}`}
                  </span>
                )}
              </div>
              <details className="text-[9.5px] text-muted-foreground/80 cursor-pointer pt-0.5">
                <summary className="hover:text-[#C5A059] transition-colors select-none font-mono text-[9px] flex items-center justify-between">
                  <span>Nota Analitica Fase {selectedPhase}</span>
                  <span className="text-[8px] text-muted-foreground">espandi ▾</span>
                </summary>
                <p className="mt-1 p-1.5 rounded bg-black/50 border border-white/5 leading-relaxed font-sans text-muted-foreground/90">
                  {activeStep.note}
                </p>
                {activeSchematic && (
                  <div className="pt-1 border-t border-white/5 text-[9px] text-muted-foreground/80 space-y-0.5 font-mono">
                    {activeSchematic.keyPoints.slice(0, 2).map((kp, idx) => (
                      <div key={idx} className="flex items-start gap-1">
                        <ChevronRight size={10} className="shrink-0 text-[#C5A059] mt-0.5" />
                        <span>{kp}</span>
                      </div>
                    ))}
                  </div>
                )}
              </details>
            </div>
          )}
        </div>
      )}

      {/* ── Box Setup Rilevato & Esecuzione Replay (Limit / Market) ── */}
      {setup ? (
        <div className="space-y-2 pt-1 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  isLong
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                }`}
              >
                {isLong ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                <span>{setup.direction.toUpperCase()}</span>
              </span>

              {/* Badge Tipo Ordine: Limit vs Market */}
              <span
                className={`px-1.5 py-0.2 rounded font-mono text-[9px] font-bold uppercase border ${
                  isLimit
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 flex items-center gap-1"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                }`}
              >
                {isLimit && <Clock size={10} className="shrink-0" />}
                <span>{isLimit ? "PENDING LIMIT" : "A MERCATO"}</span>
              </span>
            </div>

            <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
              R:R <strong className="text-foreground">1:{setup.riskRewardRatio}</strong> · Lotti:{" "}
              <strong className="text-foreground">{setup.lotSize}L</strong>
            </span>
          </div>

          {/* Badge Le 4 Domande & Router di Zona */}
          <div className="flex flex-wrap items-center gap-1 text-[9px] font-mono">
            {setup.sessionName && (
              <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-muted-foreground whitespace-nowrap">
                {setup.sessionName}
              </span>
            )}
            {setup.zoneScenario && (
              <span className="px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/30 text-[#C5A059] font-semibold whitespace-nowrap">
                Router: {setup.zoneScenario === "valid_zone" ? "Bivio 1" : setup.zoneScenario === "no_zone" ? "Bivio 2" : "Bivio 3 (Causa 2)"}
              </span>
            )}
            {setup.triggerType && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold whitespace-nowrap">
                Trigger: {setup.triggerType}
              </span>
            )}
            {setup.imbalancePercent != null && (
              <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-muted-foreground whitespace-nowrap">
                SOW/SOS: {setup.imbalancePercent}%
              </span>
            )}
          </div>

          {/* ── BARRA VISIVA SPETTRO PREZZO / RISCHIO-RENDIMENTO ── */}
          <div className="p-2 rounded-lg bg-black/50 border border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-[9px] font-mono">
              <span className="text-rose-400 font-bold">SL {setup.stopLossPrice}</span>
              <span className="text-amber-300 font-bold">ENTRY {setup.entryPrice}</span>
              <span className="text-amber-400 font-semibold">BE {setup.breakEvenPrice}</span>
              <span className="text-emerald-400 font-bold">TP1 {setup.takeProfit1Price}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/10 flex overflow-hidden border border-white/10" title="Spettro Operativo Wyckoff: Stop Loss → Entry → BE 1:1.5R → TP1 1:3R">
              <div className="bg-rose-500/80 w-[24%]" title={`SL: ${setup.stopLossPrice}`} />
              <div className="bg-[#C5A059] w-[14%]" title={`Entry: ${setup.entryPrice}`} />
              <div className="bg-amber-400/80 w-[30%]" title={`BE 1:1.5R: ${setup.breakEvenPrice}`} />
              <div className="bg-emerald-500 w-[32%]" title={`TP1 1:3R (50%): ${setup.takeProfit1Price}`} />
            </div>
          </div>

          {/* ── GRIGLIA PREZZI 2x2 SPAZIOSA E LEGGIBILE (Zero Sovrapposizioni) ── */}
          <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
            <div className={`p-2 rounded-lg border flex items-center justify-between ${isLimit ? "bg-amber-500/10 border-amber-500/30" : "bg-black/40 border-white/10"}`}>
              <span className="text-[9px] text-muted-foreground uppercase">{isLimit ? "Entry Limit" : "Entry Mkt"}</span>
              <span className={`font-bold whitespace-nowrap ${isLimit ? "text-amber-300" : "text-foreground"}`}>
                {setup.entryPrice}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-black/40 border border-rose-500/30 flex items-center justify-between">
              <span className="text-[9px] text-rose-400/80 uppercase">SL ({setup.pipsRisk}p)</span>
              <span className="text-rose-400 font-bold whitespace-nowrap">{setup.stopLossPrice}</span>
            </div>
            <div className="p-2 rounded-lg bg-black/40 border border-amber-500/20 flex items-center justify-between">
              <span className="text-[9px] text-amber-400/80 uppercase">BE (1:1.5R)</span>
              <span className="text-amber-300 font-bold whitespace-nowrap">{setup.breakEvenPrice}</span>
            </div>
            <div className="p-2 rounded-lg bg-black/40 border border-emerald-500/30 flex items-center justify-between">
              <span className="text-[9px] text-emerald-400/80 uppercase">TP1 (1:3R)</span>
              <span className="text-emerald-300 font-bold whitespace-nowrap">{setup.takeProfit1Price}</span>
            </div>
          </div>

          {/* ── REGOLE DI GESTIONE & INVALIDAZIONE (Accordion a Scomparsa) ── */}
          <details className="text-[9.5px] font-mono text-muted-foreground bg-white/[0.02] p-2 rounded-lg border border-white/5 cursor-pointer">
            <summary className="flex items-center justify-between text-[#C5A059] font-bold select-none text-[9px] uppercase tracking-wider">
              <span>Regole di Gestione Step 04 & Dottrina</span>
              <span className="text-[8px] text-muted-foreground">dettagli ▾</span>
            </summary>
            <div className="pt-2 space-y-1.5 border-t border-white/5 mt-1.5">
              {setup.entryReason && (
                <p className="flex items-start gap-1 text-amber-300/90 font-mono text-[9px]">
                  <Clock size={11} className="shrink-0 mt-0.5 text-amber-400" />
                  <span>{setup.entryReason}</span>
                </p>
              )}
              <p className="flex items-center gap-1 text-muted-foreground font-mono text-[9px]">
                <Zap size={10} className="shrink-0 text-amber-400" />
                <span>
                  <strong>BE:</strong>{" "}
                  {setup.breakEvenRule
                    .replace("sgnt_be", "mgmt_be")
                    .replace("sgmt_be", "mgmt_be")}
                </span>
              </p>
              <p className="flex items-center gap-1 text-emerald-300/90 font-mono text-[9px]">
                <Target size={10} className="shrink-0 text-emerald-400" />
                <span>
                  <strong>TP1:</strong>{" "}
                  {setup.takeProfit1Rule.replace("ngst_tp1", "mgmt_tp1")}
                </span>
              </p>
            </div>
          </details>

          {/* Indicatore Auto-Esecuzione & Pulsante d'Azione Primario */}
          {autoExecuteAi && (
            <div className="flex items-center justify-center gap-1.5 py-1 px-2 rounded-md bg-[#C5A059]/10 border border-[#C5A059]/30 text-[#C5A059] text-[10px] font-mono">
              <Zap size={11} className="text-[#C5A059] animate-pulse" />
              <span>Auto-Esecuzione attiva: Setup sincronizzato automaticamente</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => onExecuteSetup(setup)}
            className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#C5A059] to-[#d8b167] hover:brightness-110 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all hover:scale-[1.01]"
          >
            <Play size={14} className="fill-black" />
            <span className="whitespace-nowrap">
              {isLimit
                ? `Piazza ${setup.direction === "long" ? "Buy Limit" : "Sell Limit"} nella Forgia`
                : "Esegui Setup a Mercato nella Forgia"}
            </span>
          </button>
        </div>
      ) : !analysis ? (
        <div className="text-center py-2 px-1 text-[11px] text-muted-foreground">
          <p>
            Posiziona il replay storico su qualsiasi barra passata e clicca <em>"Scansiona Barra"</em> per attivare la procedura a 4 fasi.
          </p>
        </div>
      ) : (
        <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
          <p className="font-semibold">{analysis.summary}</p>
          <p className="text-[10px] text-amber-300/80 mt-1">{analysis.doctrineAdvice}</p>
        </div>
      )}

      {/* ── Memoria Operativa Antifragile & Flip Compatta (Micro-Dashboard) ── */}
      {operativeMemory && (() => {
        const insights = deriveConceptInsights(operativeMemory);
        const s4 = operativeMemory.step4CareStats;
        return (
          <div className="pt-2 border-t border-white/10 space-y-1.5 text-[10px] font-mono">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              <span className="text-[#C5A059] font-bold uppercase tracking-wider flex items-center gap-1 whitespace-nowrap">
                <Shield size={11} />
                <span>Memoria Antifragile & Flip</span>
              </span>
              {onResetMemory && (
                <button
                  type="button"
                  onClick={onResetMemory}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Resetta memoria operativa per questo asset"
                >
                  <RotateCcw size={10} />
                </button>
              )}
            </div>

            {operativeMemory.flipActive && operativeMemory.flipDirection && (
              <div className="p-1.5 rounded bg-rose-500/15 border border-rose-500/40 text-rose-200 flex items-center gap-1.5 text-[9.5px]">
                <Zap size={11} className="text-rose-400 shrink-0 animate-pulse" />
                <span>
                  <strong>REGOLA DEL FLIP ATTIVA:</strong> Schematica violata → Solo continuazione{" "}
                  <strong>{operativeMemory.flipDirection.toUpperCase()}</strong>
                </span>
              </div>
            )}

            {/* Micro-Dashboard KPI a 3 Colonne Spaziose */}
            <div className="grid grid-cols-3 gap-1 text-center font-mono text-[9px] p-1.5 rounded-lg bg-black/40 border border-white/5">
              <div>
                <span className="text-muted-foreground block text-[8px] uppercase">Win Rate</span>
                <strong className="text-emerald-400 whitespace-nowrap">{operativeMemory.stats.winRate}%</strong>
              </div>
              <div>
                <span className="text-muted-foreground block text-[8px] uppercase">Totale R</span>
                <strong className={`whitespace-nowrap ${operativeMemory.stats.totalR >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {operativeMemory.stats.totalR >= 0 ? "+" : ""}{operativeMemory.stats.totalR}R
                </strong>
              </div>
              <div>
                <span className="text-muted-foreground block text-[8px] uppercase">Cura Step 04</span>
                <strong className="text-amber-300 whitespace-nowrap">+{s4?.savedRiskR ?? 0}R Salvati</strong>
              </div>
            </div>

            {/* Statistiche Concetti in Accordion Compatto */}
            {insights.activeConcepts.length > 0 && (
              <details className="text-[9px] font-mono text-muted-foreground pt-0.5">
                <summary className="cursor-pointer text-[#C5A059] hover:underline flex items-center justify-between select-none">
                  <span>Statistiche Concetti ({insights.activeConcepts.length}) ▾</span>
                  {insights.bestTrigger && (
                    <span className="text-emerald-400">Top: {insights.bestTrigger}</span>
                  )}
                </summary>
                <div className="mt-1 max-h-24 overflow-y-auto space-y-0.5 pr-0.5 border border-white/5 p-1 rounded bg-black/40">
                  {insights.activeConcepts.slice(0, 6).map((c) => (
                    <div
                      key={`${c.category}:${c.key}`}
                      className="flex items-center justify-between text-[8.5px] px-1 py-0.5 rounded bg-white/[0.02]"
                    >
                      <span className="truncate text-foreground/90 max-w-[140px]" title={c.label}>
                        {c.label}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                        <span className="text-muted-foreground">{c.trades}T</span>
                        <span className={c.winRate >= 50 ? "text-emerald-400 font-bold" : "text-amber-300"}>
                          {c.winRate}%
                        </span>
                        <span className={c.expectancyR >= 0 ? "text-emerald-300" : "text-rose-400"}>
                          {c.expectancyR >= 0 ? "+" : ""}{c.expectancyR}R
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {operativeMemory.learnedLessons[0] && (
              <p className="text-[9px] text-muted-foreground/90 bg-black/40 p-1.5 rounded border border-white/5 leading-snug font-sans truncate" title={operativeMemory.learnedLessons[0]}>
                <strong className="text-[#C5A059] font-mono">Lezione:</strong> {operativeMemory.learnedLessons[0]}
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
