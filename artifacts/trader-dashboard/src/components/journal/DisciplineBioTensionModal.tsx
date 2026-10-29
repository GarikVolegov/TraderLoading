import React, { useState } from "react";
import { Heart, X, Sparkles, Wind, ShieldCheck, Flame, Compass, Watch, Radio } from "lucide-react";
import {
  DisciplineBioTensionChart,
  type TradeBioTelemetryData,
} from "./DisciplineBioTensionChart";
import { useSmartWatchHeartRate } from "@/hooks/useSmartWatchHeartRate";
import { SmartWatchConnectModal } from "@/components/biometrics/SmartWatchConnectModal";

export interface DisciplineBioTensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  trade: TradeBioTelemetryData;
  onOpenTacticalBreath?: () => void;
}

export function DisciplineBioTensionModal({
  isOpen,
  onClose,
  trade,
  onOpenTacticalBreath,
}: DisciplineBioTensionModalProps) {
  const [smartWatchModalOpen, setSmartWatchModalOpen] = useState(false);
  const watch = useSmartWatchHeartRate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl rounded-2xl border border-[#C5A059]/40 bg-[#07080b] shadow-[0_0_50px_rgba(197,160,89,0.18)] flex flex-col max-h-[92vh] overflow-hidden">
        {/* Ceremonial Header */}
        <div className="flex items-center justify-between border-b border-[#C5A059]/20 px-4 py-3 bg-[#0d0f14]/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#ef4444]/15 border border-[#ef4444]/35 flex items-center justify-center text-[#ef4444] shrink-0">
              <Heart size={15} className="animate-pulse" />
            </div>
            <div>
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-[#E8C56A] flex items-center gap-1.5 m-0">
                Replay Termobarico &amp; Curva della Tensione
                <Sparkles size={11} className="text-[#C5A059]" />
              </h3>
              <p className="font-mono text-[9.5px] text-[#94A3B8] m-0">
                {trade.symbol || "Asset"} {trade.direction ? `(${trade.direction})` : ""} · Diagnostica Cardio-Fisiologica nel Libro della Verità
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSmartWatchModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-mono transition-colors ${
                watch.isLive
                  ? "border-[#10b981]/40 bg-[#10b981]/15 text-[#10b981]"
                  : "border-white/10 bg-white/5 hover:border-[#C5A059]/40 text-[#C5A059]"
              }`}
              title="Gestione Smartwatch e Cardiofrequenzimetro Live"
            >
              <Watch size={12} />
              <span className="whitespace-nowrap font-bold">
                {watch.isLive ? `${watch.bpm} BPM Live` : "Smartwatch BLE"}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg border border-white/10 bg-[#121318] hover:bg-[#1f2029] flex items-center justify-center text-[#94A3B8] hover:text-white transition-all cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-3 custom-scrollbar flex-1">
          {/* Main Chart */}
          <DisciplineBioTensionChart
            trade={trade}
            onOpenTacticalBreath={() => {
              onClose();
              onOpenTacticalBreath?.();
            }}
          />

          {/* Legenda Fisiologica delle 3 Soglie AUREUS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[10px]">
            <div className="p-2 rounded-lg bg-[#121318] border border-emerald-500/20 space-y-0.5">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Calma Stoica (50-74)</span>
              </div>
              <p className="text-[9px] text-[#94A3B8] m-0 leading-tight">
                Mente fredda e adesione chirurgica al piano d&apos;azione.
              </p>
            </div>

            <div className="p-2 rounded-lg bg-[#121318] border border-amber-500/20 space-y-0.5">
              <div className="flex items-center gap-1.5 text-amber-300 font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Tensione Attiva (75-89)</span>
              </div>
              <p className="text-[9px] text-[#94A3B8] m-0 leading-tight">
                Vigilanza acuta durante i pullback: disciplina mantenuta.
              </p>
            </div>

            <div className="p-2 rounded-lg bg-[#121318] border border-rose-500/20 space-y-0.5">
              <div className="flex items-center gap-1.5 text-rose-400 font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                <span>Soglia Critica (90+)</span>
              </div>
              <p className="text-[9px] text-[#94A3B8] m-0 leading-tight">
                Rischio di contrazione emotiva, anticipazione o chiusura da paura.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-4 py-2.5 bg-[#0d0f14]/80 flex items-center justify-between shrink-0 font-mono text-xs">
          {onOpenTacticalBreath ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenTacticalBreath();
              }}
              className="inline-flex items-center gap-1.5 text-[#E8C56A] hover:text-white transition-colors cursor-pointer"
            >
              <Wind size={13} />
              <span>Avvia Respiro Tattico 4-7-8</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#1E1F26] border border-white/10 text-[#CBD5E1] hover:bg-[#2A2B35] font-semibold transition-all cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>

      <SmartWatchConnectModal
        open={smartWatchModalOpen}
        onClose={() => setSmartWatchModalOpen(false)}
      />
    </div>
  );
}
