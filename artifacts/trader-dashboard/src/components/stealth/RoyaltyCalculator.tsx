import { useState } from "react";
import { Users, CheckCircle, Sparkles, ArrowRight } from "lucide-react";
import { calculateRoyalty } from "@/lib/stealthTracking";

interface RoyaltyCalculatorProps {
  onRequestAccess?: () => void;
}

export function RoyaltyCalculator({ onRequestAccess }: RoyaltyCalculatorProps) {
  const [sliderValue, setSliderValue] = useState<number>(3); // Default 3 members
  const stats = calculateRoyalty(sliderValue);

  return (
    <div className="w-full space-y-6">
      {/* 2-Column Grid: Quota Operativa Card + Interactive Royalty Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column (5 Cols): Card Quota Operativa */}
        <div className="lg:col-span-5 rounded-2xl border border-[#1E2230] bg-[#0E1017] p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden shadow-xl">
          {/* Subtle glow effect */}
          <div className="absolute top-0 right-0 -mt-8 -mr-8 h-32 w-32 rounded-full bg-[#10B981]/10 blur-2xl pointer-events-none" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-bold tracking-widest text-[#10B981] uppercase px-2.5 py-1 rounded border border-[#10B981]/30 bg-[#10B981]/10">
                LABORATORIO CONTINUO
              </span>
              <span className="font-mono text-xs text-slate-500">NESSUN VINCOLO ANNUALE</span>
            </div>

            <div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                Quota di Mantenimento Infrastruttura
              </h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Nessuna vendita di corsi statici. L'accesso è strutturato come quota di ricerca, aggiornamento settimanale
                e mantenimento dell'infrastruttura di analisi.
              </p>
            </div>

            {/* Price Tag */}
            <div className="py-2 border-y border-[#1E2230] my-4">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-black font-mono text-white tracking-tight">€150</span>
                <span className="font-mono text-sm text-slate-400">/ mese</span>
              </div>
              <p className="mt-1 font-mono text-[11px] text-slate-500">
                Rinnovabile mese per mese. Disdici con un clic in autonomia senza penali.
              </p>
            </div>

            {/* Bullet Points */}
            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <CheckCircle className="h-4 w-4 text-[#10B981] shrink-0 mt-0.5" />
                <span>
                  <strong>Libreria Concettuale Step-by-Step</strong> + Video ad altissima risoluzione su grafico reale.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle className="h-4 w-4 text-[#10B981] shrink-0 mt-0.5" />
                <span>
                  <strong>Case Studies Settimanali a mercati chiusi:</strong> scomposizione di tutti i setup verificatisi.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle className="h-4 w-4 text-[#10B981] shrink-0 mt-0.5" />
                <span>
                  <strong>Checklist Pre-Entry Interattive:</strong> protocolli di invalidazione matematica pre-sessione.
                </span>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              type="button"
              onClick={onRequestAccess}
              className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl border border-[#10B981] bg-[#10B981]/15 text-[#10B981] font-bold text-xs tracking-wider uppercase transition-all hover:bg-[#10B981] hover:text-[#090A0F]"
            >
              CANDIDATI PER ACCEDERE AL LABORATORIO
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Right Column (7 Cols): Simulator Slider & Royalty 20% Breakdown */}
        <div className="lg:col-span-7 rounded-2xl border border-[#1E2230] bg-[#090A0F] p-6 sm:p-7 flex flex-col justify-between shadow-2xl relative">
          <div className="space-y-5">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <span className="font-mono text-xs font-bold text-amber-400 uppercase tracking-wider">
                  PROGRAMMA MERITOCRATICO // ROYALTY RICORRENTE 20%
                </span>
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                Simulatore Autofinanziamento & Borsa di Studio
              </h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Azzeramento della quota tramite condivisione meritocratica. Per ogni collega di studio invitato che
                mantiene attivo l'accesso, il sistema ti accredita una{" "}
                <strong className="text-white">Royalty ricorrente del 20% (€30/mese per utente)</strong>.
              </p>
            </div>

            {/* Slider Component */}
            <div className="rounded-xl border border-[#1E2230] bg-[#11131A] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono font-semibold text-slate-300 uppercase flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#10B981]" />
                  COLLEGHI DI STUDIO ATTIVI INVITATI:
                </label>
                <span className="font-mono text-2xl font-black text-[#10B981] bg-[#10B981]/15 border border-[#10B981]/30 px-3 py-0.5 rounded-lg">
                  {sliderValue}
                </span>
              </div>

              {/* Native range slider customized */}
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={sliderValue}
                onChange={(e) => setSliderValue(parseInt(e.target.value, 10))}
                className="w-full h-2.5 rounded-lg appearance-none cursor-pointer bg-[#1E2230] accent-[#10B981]"
              />

              <div className="flex justify-between font-mono text-[11px] text-slate-500">
                <span>0 colleghi (€0/m)</span>
                <span className="text-amber-400 font-semibold">5 colleghi (€150/m = Quota Zero)</span>
                <span>20 colleghi (€600/m)</span>
              </div>
            </div>

            {/* Real-time Math Output Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
              {/* Generated Monthly Royalty */}
              <div className="rounded-xl border border-[#1E2230] bg-[#11131A] p-4">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">
                  ROYALTY MENSILE GENERATA
                </div>
                <div className="text-2xl font-bold text-white">
                  €{stats.monthlyRoyalty} <span className="text-xs text-slate-400 font-normal">/ mese</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {sliderValue} utenti × €30 (20% di €150)
                </div>
              </div>

              {/* Net Subscription Cost */}
              <div className="rounded-xl border border-[#1E2230] bg-[#11131A] p-4">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider mb-1">
                  COSTO NETTO DEL TUO ACCESSO
                </div>

                {sliderValue < 5 ? (
                  <div>
                    <div className="text-2xl font-bold text-amber-400">
                      €{stats.netCost} <span className="text-xs text-slate-400 font-normal">/ mese</span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      Coperto al {stats.coveragePercent}% (€150 - €{stats.monthlyRoyalty})
                    </div>
                  </div>
                ) : sliderValue === 5 ? (
                  <div>
                    <div className="text-lg font-black text-[#10B981] flex items-center gap-1.5">
                      €0 / MESE
                    </div>
                    <div className="mt-1 inline-block text-[10px] font-bold tracking-wider text-[#10B981] bg-[#10B981]/20 border border-[#10B981]/40 px-2 py-0.5 rounded">
                      AUTOFINANZIATO AL 100%
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xl font-black text-[#10B981]">
                      +€{stats.netProfit} / MESE
                    </div>
                    <div className="mt-1 inline-block text-[10px] font-bold tracking-wider text-[#10B981] bg-[#10B981]/25 border border-[#10B981] px-2 py-0.5 rounded">
                      PROFITTO NETTO RICORRENTE
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Threshold Visual Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-slate-400">PROGRESSO VERSO L'AZZERAMENTO TOTALE:</span>
                <span className={sliderValue >= 5 ? "text-[#10B981] font-bold" : "text-amber-400 font-bold"}>
                  {sliderValue >= 5 ? "OBIETTIVO COMPLETATO" : `${stats.coveragePercent}%`}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#181C28] overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    sliderValue >= 5 ? "bg-gradient-to-r from-emerald-500 to-teal-400" : "bg-amber-400"
                  }`}
                  style={{ width: `${Math.min(100, (sliderValue / 5) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-[#1E2230] flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400">
            <span>REGOLA STEALTH: TRACCIAMENTO AUTOMATICO A 60 GIORNI</span>
            <span className="text-slate-500">ACCREDITI RICORRENTI TRAMITE STRIPE CONNECT</span>
          </div>
        </div>
      </div>
    </div>
  );
}
