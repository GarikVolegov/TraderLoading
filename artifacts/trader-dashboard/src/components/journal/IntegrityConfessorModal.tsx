import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Sparkles,
  Check,
  Clock,
  Flame,
  FileCheck2,
  Lock,
} from "lucide-react";
import {
  computeConfessionScore,
  getConfessionForDate,
  saveConfession,
  type ConfessionAnswers,
  type ConfessionRecord,
  type StopLossChoice,
  type AntiOvertradingChoice,
  type TruthfulLedgerChoice,
} from "@/lib/integrityConfessor";
import {
  synestheticClick,
  synestheticCheck,
  synestheticTrophy,
  synestheticAlert,
} from "@/lib/soundFx";

export interface IntegrityConfessorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfessionSaved?: (record: ConfessionRecord) => void;
}

export function IntegrityConfessorModal({
  isOpen,
  onClose,
  onConfessionSaved,
}: IntegrityConfessorModalProps) {
  const existingToday = useMemo(() => (isOpen ? getConfessionForDate() : null), [isOpen]);

  const [stopLoss, setStopLoss] = useState<StopLossChoice>(
    existingToday?.answers.stopLoss || "strict"
  );
  const [antiOvertrading, setAntiOvertrading] = useState<AntiOvertradingChoice>(
    existingToday?.answers.antiOvertrading || "monastic"
  );
  const [truthfulLedger, setTruthfulLedger] = useState<TruthfulLedgerChoice>(
    existingToday?.answers.truthfulLedger || "faithful"
  );
  const [tacticalNote, setTacticalNote] = useState<string>(
    existingToday?.answers.tacticalNote || ""
  );
  const [isSaved, setIsSaved] = useState(Boolean(existingToday));

  useEffect(() => {
    if (existingToday) {
      setStopLoss(existingToday.answers.stopLoss);
      setAntiOvertrading(existingToday.answers.antiOvertrading);
      setTruthfulLedger(existingToday.answers.truthfulLedger);
      setTacticalNote(existingToday.answers.tacticalNote || "");
      setIsSaved(true);
    } else {
      setIsSaved(false);
    }
  }, [existingToday]);

  const currentEvaluation = useMemo(() => {
    return computeConfessionScore({
      stopLoss,
      antiOvertrading,
      truthfulLedger,
      tacticalNote,
    });
  }, [stopLoss, antiOvertrading, truthfulLedger, tacticalNote]);

  if (!isOpen) return null;

  const handleSelectStopLoss = (val: StopLossChoice) => {
    synestheticClick();
    setStopLoss(val);
    setIsSaved(false);
  };

  const handleSelectOvertrading = (val: AntiOvertradingChoice) => {
    synestheticClick();
    setAntiOvertrading(val);
    setIsSaved(false);
  };

  const handleSelectLedger = (val: TruthfulLedgerChoice) => {
    synestheticClick();
    setTruthfulLedger(val);
    setIsSaved(false);
  };

  const handleSave = () => {
    const answers: ConfessionAnswers = {
      stopLoss,
      antiOvertrading,
      truthfulLedger,
      tacticalNote: tacticalNote.trim() || undefined,
    };
    const record = saveConfession(answers);
    setIsSaved(true);

    if (record.score >= 90) {
      synestheticTrophy();
    } else if (record.score >= 60) {
      synestheticCheck();
    } else {
      synestheticAlert();
    }

    if (onConfessionSaved) {
      onConfessionSaved(record);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Il Confessore dell'Integrità"
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col max-h-[94vh] w-full max-w-3xl rounded-2xl border border-[#C5A059]/40 bg-[#07080b] shadow-[0_0_50px_rgba(197,160,89,0.2)] overflow-hidden my-auto selection:bg-[#C5A059]/30"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Solenne */}
        <div className="flex items-center justify-between border-b border-[#C5A059]/25 bg-[#0d0f14] px-5 sm:px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/15 text-[#E8C56A] shadow-[0_0_12px_rgba(197,160,89,0.25)]">
              <FileCheck2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-sm sm:text-base font-bold tracking-wider text-white uppercase">
                  Il Confessore dell'Integrità
                </h2>
                <span
                  className="rounded px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider border whitespace-nowrap"
                  style={{
                    backgroundColor: `${currentEvaluation.sealColor}20`,
                    borderColor: `${currentEvaluation.sealColor}60`,
                    color: currentEvaluation.sealColor,
                  }}
                >
                  {currentEvaluation.score}% Indice
                </span>
              </div>
              <p className="font-mono text-[11px] text-slate-400">
                Esame di coscienza operativo · Auto-disciplina quotidiana
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            aria-label="Chiudi Confessore"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo Modale Scrollabile */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#050608]/90">
          {/* Banner Stoico */}
          <div className="rounded-xl border border-[#C5A059]/25 bg-[#0d0f14]/80 p-3 sm:p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Sparkles size={16} className="text-[#E8C56A] shrink-0" />
              <p className="text-xs font-serif italic text-slate-300 leading-snug">
                «Il mercato non mente mai. Non mentire a te stesso: l'integrità è l'unico vero scudo contro la Deriva.»
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-1 font-mono text-[10px] text-slate-500 whitespace-nowrap">
              <Clock size={12} className="text-[#C5A059]" />
              <span>Oggi: {new Date().toLocaleDateString("it-IT")}</span>
            </div>
          </div>

          {/* Domanda 1: Stop Loss */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#E8C56A] flex items-center gap-1.5">
                <span>1.</span>
                <span>Rispetto Rigoroso dello Stop Loss</span>
              </span>
              <span className="font-mono text-[10px] text-slate-500 whitespace-nowrap">Peso: 35%</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectStopLoss("strict")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  stopLoss === "strict"
                    ? "border-emerald-500/60 bg-emerald-500/15 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                    : "border-white/10 bg-[#0d0f14] hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-serif text-xs font-bold text-white">Nessuna Esitazione</span>
                  {stopLoss === "strict" && <Check size={14} className="text-emerald-400" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Stop rispettato all'istante senza sperare nel rimbalzo.
                </p>
                <span className="mt-2 inline-block font-mono text-[9px] text-emerald-400 font-bold whitespace-nowrap">
                  +35 PUNTI
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectStopLoss("hesitated")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  stopLoss === "hesitated"
                    ? "border-[#C5A059]/60 bg-[#C5A059]/15 shadow-[0_0_15px_rgba(197,160,89,0.15)]"
                    : "border-white/10 bg-[#0d0f14] hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-serif text-xs font-bold text-white">Tentennamento</span>
                  {stopLoss === "hesitated" && <Check size={14} className="text-[#E8C56A]" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Ho provato esitazione emotiva, ma non ho spostato lo stop.
                </p>
                <span className="mt-2 inline-block font-mono text-[9px] text-[#E8C56A] font-bold whitespace-nowrap">
                  +15 PUNTI
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectStopLoss("violated")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  stopLoss === "violated"
                    ? "border-red-500/60 bg-red-500/15 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                    : "border-white/10 bg-[#0d0f14] hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-serif text-xs font-bold text-red-400">Violazione Tattica</span>
                  {stopLoss === "violated" && <Check size={14} className="text-red-400" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Stop allargato, rimosso o bloccato in speranza.
                </p>
                <span className="mt-2 inline-block font-mono text-[9px] text-red-400 font-bold whitespace-nowrap">
                  -10 PENALITÀ
                </span>
              </button>
            </div>
          </section>

          {/* Domanda 2: Anti-Overtrading */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#E8C56A] flex items-center gap-1.5">
                <span>2.</span>
                <span>Silenzio Operativo &amp; Anti-Overtrading</span>
              </span>
              <span className="font-mono text-[10px] text-slate-500 whitespace-nowrap">Peso: 35%</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectOvertrading("monastic")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  antiOvertrading === "monastic"
                    ? "border-emerald-500/60 bg-emerald-500/15 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                    : "border-white/10 bg-[#0d0f14] hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-serif text-xs font-bold text-white">Chiusura Monastica</span>
                  {antiOvertrading === "monastic" && <Check size={14} className="text-emerald-400" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Sessione interrotta al raggiungimento del limite stabilito.
                </p>
                <span className="mt-2 inline-block font-mono text-[9px] text-emerald-400 font-bold whitespace-nowrap">
                  +35 PUNTI
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectOvertrading("tempted")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  antiOvertrading === "tempted"
                    ? "border-[#C5A059]/60 bg-[#C5A059]/15 shadow-[0_0_15px_rgba(197,160,89,0.15)]"
                    : "border-white/10 bg-[#0d0f14] hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-serif text-xs font-bold text-white">Impulso Dominato</span>
                  {antiOvertrading === "tempted" && <Check size={14} className="text-[#E8C56A]" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Avvertito il desiderio di forzare entrate, ma sono uscito.
                </p>
                <span className="mt-2 inline-block font-mono text-[9px] text-[#E8C56A] font-bold whitespace-nowrap">
                  +20 PUNTI
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectOvertrading("violated")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  antiOvertrading === "violated"
                    ? "border-red-500/60 bg-red-500/15 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                    : "border-white/10 bg-[#0d0f14] hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-serif text-xs font-bold text-red-400">Overtrading Attivo</span>
                  {antiOvertrading === "violated" && <Check size={14} className="text-red-400" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Ho aperto trade impulsivi fuori piano e fuori orario.
                </p>
                <span className="mt-2 inline-block font-mono text-[9px] text-red-400 font-bold whitespace-nowrap">
                  -10 PENALITÀ
                </span>
              </button>
            </div>
          </section>

          {/* Domanda 3: Trascrizione Fedele */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#E8C56A] flex items-center gap-1.5">
                <span>3.</span>
                <span>Verità nel Registro (Zero Omissioni)</span>
              </span>
              <span className="font-mono text-[10px] text-slate-500 whitespace-nowrap">Peso: 30%</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectLedger("faithful")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  truthfulLedger === "faithful"
                    ? "border-emerald-500/60 bg-emerald-500/15 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                    : "border-white/10 bg-[#0d0f14] hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-serif text-xs font-bold text-white">Trascrizione Fedele</span>
                  {truthfulLedger === "faithful" && <Check size={14} className="text-emerald-400" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Tutti i trade, inclusi gli stop o le deviazioni, sono stati registrati.
                </p>
                <span className="mt-2 inline-block font-mono text-[9px] text-emerald-400 font-bold whitespace-nowrap">
                  +30 PUNTI
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectLedger("partial")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  truthfulLedger === "partial"
                    ? "border-[#C5A059]/60 bg-[#C5A059]/15 shadow-[0_0_15px_rgba(197,160,89,0.15)]"
                    : "border-white/10 bg-[#0d0f14] hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-serif text-xs font-bold text-white">Registro Parziale</span>
                  {truthfulLedger === "partial" && <Check size={14} className="text-[#E8C56A]" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Sessione parzialmente registrata, da completare a breve.
                </p>
                <span className="mt-2 inline-block font-mono text-[9px] text-[#E8C56A] font-bold whitespace-nowrap">
                  +10 PUNTI
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectLedger("omitted")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  truthfulLedger === "omitted"
                    ? "border-red-500/60 bg-red-500/15 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                    : "border-white/10 bg-[#0d0f14] hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-serif text-xs font-bold text-red-400">Omissione Voluta</span>
                  {truthfulLedger === "omitted" && <Check size={14} className="text-red-400" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Operazioni negative non registrate per timore o vergogna.
                </p>
                <span className="mt-2 inline-block font-mono text-[9px] text-red-400 font-bold whitespace-nowrap">
                  -20 PENALITÀ
                </span>
              </button>
            </div>
          </section>

          {/* Nota Tattica dell'Operatore */}
          <div className="space-y-1.5">
            <label className="font-mono text-xs uppercase tracking-wider text-slate-400 block">
              Riflessione Tattica dell'Operatore (Massimo 1 riga)
            </label>
            <input
              type="text"
              maxLength={120}
              value={tacticalNote}
              onChange={(e) => {
                setTacticalNote(e.target.value);
                setIsSaved(false);
              }}
              placeholder="es. Mantenuta la pazienza all'apertura di Londra. Zero esitazioni sullo stop."
              className="w-full rounded-xl border border-white/10 bg-[#0d0f14] px-3.5 py-2 text-xs font-mono text-white placeholder:text-slate-600 focus:border-[#C5A059]/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer con Punteggio e Azione di Sigillo */}
        <div className="border-t border-[#C5A059]/25 bg-[#0d0f14] px-5 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center border font-mono font-bold text-sm shrink-0"
              style={{
                backgroundColor: `${currentEvaluation.sealColor}15`,
                borderColor: `${currentEvaluation.sealColor}50`,
                color: currentEvaluation.sealColor,
              }}
            >
              {currentEvaluation.score}%
            </div>
            <div>
              <div className="text-xs font-serif font-bold text-white flex items-center gap-1.5">
                {currentEvaluation.score >= 90 ? (
                  <ShieldCheck size={14} className="text-emerald-400" />
                ) : currentEvaluation.score >= 60 ? (
                  <Shield size={14} className="text-[#C5A059]" />
                ) : (
                  <ShieldAlert size={14} className="text-red-400" />
                )}
                <span>{currentEvaluation.sealLabel}</span>
              </div>
              <p className="text-[10px] font-mono text-slate-400">
                {isSaved ? "Confessione registrata nel ledger" : "Pronto per l'apposizione del sigillo"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-white/10 hover:border-white/20 bg-white/5 text-xs font-mono text-slate-300 hover:text-white transition-all cursor-pointer whitespace-nowrap"
            >
              Chiudi
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-lg border border-[#C5A059] bg-gradient-to-r from-[#C5A059] to-[#E8C56A] hover:brightness-110 text-[#07080b] font-mono text-xs font-bold transition-all shadow-[0_0_15px_rgba(197,160,89,0.3)] cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              {isSaved ? (
                <>
                  <Check size={14} className="stroke-[3]" />
                  <span>Sigillata nel Registro</span>
                </>
              ) : (
                <>
                  <Lock size={14} />
                  <span>Apponi Sigillo di Confessione</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
