import React, { useMemo, useState, useEffect } from "react";
import {
  Heart,
  Watch,
  ShieldCheck,
  ShieldAlert,
  Wind,
  X,
  TrendingUp,
  Flame,
  Lock,
  Unlock,
} from "lucide-react";
import type { JournalEntry } from "@workspace/api-client-react";
import {
  computeCardioPerformanceCorrelation,
  loadBioLockConfig,
  saveBioLockConfig,
  type BioLockConfig,
  type CardioBandMetrics,
} from "@/lib/bioLockGuard";
import { extractProfitFromEntry } from "./DisciplineVirtueRadar";
import { useSmartWatchHeartRate } from "@/hooks/useSmartWatchHeartRate";
import { SmartWatchConnectModal } from "@/components/biometrics/SmartWatchConnectModal";
import { synestheticClick } from "@/lib/soundFx";

export interface CardioPerformanceAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: JournalEntry[];
}

export function CardioPerformanceAnalyticsModal({
  isOpen,
  onClose,
  entries,
}: CardioPerformanceAnalyticsModalProps) {
  const watch = useSmartWatchHeartRate();
  const [smartWatchModalOpen, setSmartWatchModalOpen] = useState(false);
  const [bioLockConfig, setBioLockConfig] = useState<BioLockConfig>(() => loadBioLockConfig());

  useEffect(() => {
    if (isOpen) {
      setBioLockConfig(loadBioLockConfig());
    }
  }, [isOpen]);

  const handleToggleBioLock = () => {
    synestheticClick();
    const next: BioLockConfig = { ...bioLockConfig, enabled: !bioLockConfig.enabled };
    setBioLockConfig(next);
    saveBioLockConfig(next);
  };

  const handleChangeThreshold = (bpm: number) => {
    synestheticClick();
    const next: BioLockConfig = { ...bioLockConfig, maxBpmThreshold: bpm };
    setBioLockConfig(next);
    saveBioLockConfig(next);
  };

  const report = useMemo(() => {
    return computeCardioPerformanceCorrelation(
      entries,
      (e) => extractProfitFromEntry(e as JournalEntry),
      bioLockConfig.maxBpmThreshold
    );
  }, [entries, bioLockConfig.maxBpmThreshold]);

  if (!isOpen) return null;

  const bandList: CardioBandMetrics[] = [
    report.bands.zen,
    report.bands.vigilant,
    report.bands.drift,
  ];

  // Costruzione coordinate SVG per la curva comparativa delle 3 fasce cardio
  const svgWidth = 640;
  const svgHeight = 165;
  const padX = 36;
  const padY = 20;
  const plotW = svgWidth - padX * 2;
  const plotH = svgHeight - padY * 2;

  const allValues = [
    ...report.bands.zen.cumulativeCurve,
    ...report.bands.vigilant.cumulativeCurve,
    ...report.bands.drift.cumulativeCurve,
    0,
  ];
  const minVal = Math.min(...allValues, -10);
  const maxVal = Math.max(...allValues, 10);
  const valRange = Math.max(1, maxVal - minVal);

  const buildPath = (curve: number[]) => {
    if (curve.length <= 1) {
      const y0 = padY + plotH - ((0 - minVal) / valRange) * plotH;
      return `M ${padX} ${y0.toFixed(1)} L ${padX + plotW} ${y0.toFixed(1)}`;
    }
    return curve
      .map((val, idx) => {
        const x = padX + (idx / Math.max(1, curve.length - 1)) * plotW;
        const y = padY + plotH - ((val - minVal) / valRange) * plotH;
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const zeroY = padY + plotH - ((0 - minVal) / valRange) * plotH;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Correlazione Cardio-Performance nel Libro della Verità"
    >
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-4xl rounded-2xl border border-[#C5A059]/40 bg-[#07080b] text-foreground shadow-[0_0_50px_rgba(197,160,89,0.18)] flex flex-col max-h-[90vh] overflow-hidden">
        {/* ── HEADER SOVRANO ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#C5A059]/20 px-4 py-3 bg-[#0d0f14] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#C5A059]/15 border border-[#C5A059]/40 flex items-center justify-center text-[#E8C56A] shrink-0">
              <Heart size={16} className="text-[#C5A059]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-[#E8C56A] m-0">
                  Correlazione Cardio-Performance · Il Libro della Verità
                </h3>
                <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] whitespace-nowrap">
                  {report.totalAnalyzedTrades} Trade Analizzati
                </span>
              </div>
              <p className="font-mono text-[10px] text-[#94a3b8] m-0 truncate">
                Impatto della frequenza cardiaca (Assetto Zen vs Rischio Deriva) su Win Rate, Profit Factor ed Equità
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                synestheticClick();
                setSmartWatchModalOpen(true);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                watch.isLive
                  ? "border-[#10b981]/50 bg-[#10b981]/15 text-[#10b981]"
                  : "border-[#C5A059]/35 bg-[#C5A059]/10 hover:bg-[#C5A059]/20 text-[#E8C56A]"
              }`}
              title="Associa o gestisci lo Smartwatch Bluetooth per registrare il battito reale ad ogni esecuzione"
            >
              <Watch size={12} />
              <span>{watch.isLive ? `${watch.bpm} BPM Live` : "Smartwatch BLE"}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg border border-white/10 bg-[#11131c] hover:bg-white/10 flex items-center justify-center text-[#94a3b8] hover:text-white transition-colors cursor-pointer"
              aria-label="Chiudi finestra"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── CORPO ANALITICO SCROLLABILE ── */}
        <div className="p-4 overflow-y-auto space-y-3.5 scrollbar-thin scrollbar-thumb-[#C5A059]/30 flex-1">
          {/* 1. BARRA KPI SINTETICA & PRESIDIO BIO-LOCK */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 items-stretch">
            {/* KPI 1: Vantaggio Neocorticale */}
            <div className="rounded-xl border border-[#10b981]/30 bg-[#0d0f14] p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[9px] uppercase font-bold tracking-wider text-[#94a3b8]">
                  Vantaggio Neocorticale (Zen vs Deriva)
                </span>
                <ShieldCheck size={13} className="text-[#10b981] shrink-0" />
              </div>
              <div className="flex items-baseline justify-between gap-2 mt-1.5">
                <span className="font-mono text-lg font-bold text-[#10b981] whitespace-nowrap">
                  {report.clarityWinRateEdge >= 0 ? `+${report.clarityWinRateEdge}%` : `${report.clarityWinRateEdge}%`} WR
                </span>
                <span className="font-mono text-[10px] text-[#94a3b8] whitespace-nowrap">
                  Zen WR: <strong className="text-foreground">{report.bands.zen.winRate}%</strong>
                </span>
              </div>
            </div>

            {/* KPI 2: Erosione da Tachicardia */}
            <div className="rounded-xl border border-[#ef4444]/30 bg-[#0d0f14] p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[9px] uppercase font-bold tracking-wider text-[#94a3b8]">
                  Erosione in Rischio Deriva (≥ {bioLockConfig.maxBpmThreshold} BPM)
                </span>
                <Flame size={13} className="text-[#ef4444] shrink-0" />
              </div>
              <div className="flex items-baseline justify-between gap-2 mt-1.5">
                <span className="font-mono text-lg font-bold text-[#ef4444] whitespace-nowrap">
                  -{report.tachycardiaBleedEuro.toFixed(2)} €
                </span>
                <span className="font-mono text-[10px] text-[#94a3b8] whitespace-nowrap">
                  <strong className="text-foreground">{report.bands.drift.losses}</strong> Stop in Deriva
                </span>
              </div>
            </div>

            {/* KPI 3: Controllo Rapido Presidio Bio-Lock 4-7-8 */}
            <div className="rounded-xl border border-[#C5A059]/35 bg-[#0d0f14] p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[9px] uppercase font-bold tracking-wider text-[#E8C56A] flex items-center gap-1">
                  {bioLockConfig.enabled ? <Lock size={11} /> : <Unlock size={11} />}
                  <span>Presidio Bio-Lock Pre-Trade</span>
                </span>
                <button
                  type="button"
                  onClick={handleToggleBioLock}
                  className={`font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border transition-all cursor-pointer whitespace-nowrap ${
                    bioLockConfig.enabled
                      ? "bg-[#10b981]/15 border-[#10b981]/40 text-[#10b981]"
                      : "bg-white/5 border-white/15 text-[#94a3b8]"
                  }`}
                >
                  {bioLockConfig.enabled ? "ATTIVO" : "DISATTIVO"}
                </button>
              </div>
              <div className="flex items-center justify-between gap-1.5 mt-1.5">
                <span className="font-mono text-[10px] text-[#94a3b8] whitespace-nowrap">Soglia Blocco:</span>
                <div className="flex items-center gap-1">
                  {[85, 92, 100].map((bpm) => (
                    <button
                      key={bpm}
                      type="button"
                      onClick={() => handleChangeThreshold(bpm)}
                      className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                        bioLockConfig.maxBpmThreshold === bpm
                          ? "bg-[#C5A059]/25 border border-[#C5A059]/50 text-[#E8C56A]"
                          : "bg-white/5 border border-white/10 text-[#94a3b8] hover:text-white"
                      }`}
                    >
                      {bpm} BPM
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 2. MATRICE A 3 COLONNE BILANCIATE PER FASCIA CARDIACA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
            {bandList.map((band) => {
              const isPositive = band.netPnl >= 0;
              return (
                <div
                  key={band.id}
                  className="rounded-xl border bg-[#0d0f14] p-3.5 flex flex-col justify-between gap-3"
                  style={{ borderColor: `${band.color}40` }}
                >
                  {/* Testata Fascia */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: band.color }}
                        />
                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground whitespace-nowrap">
                          {band.title}
                        </span>
                      </div>
                      <span
                        className="font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded whitespace-nowrap"
                        style={{
                          backgroundColor: `${band.color}18`,
                          border: `1px solid ${band.color}45`,
                          color: band.color,
                        }}
                      >
                        {band.rangeLabel}
                      </span>
                    </div>

                    {/* Barra Win Rate */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between font-mono text-[10px] mb-1">
                        <span className="text-[#94a3b8]">Win Rate</span>
                        <span className="font-bold whitespace-nowrap" style={{ color: band.color }}>
                          {band.winRate}% ({band.wins}W / {band.losses}L)
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(4, band.winRate)}%`,
                            backgroundColor: band.color,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Griglia Metriche Finanziarie */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10 font-mono text-[10.5px]">
                    <div className="bg-[#11131c] rounded-lg p-2 border border-white/5">
                      <span className="text-[9px] uppercase text-[#94a3b8] block">P&amp;L Netto</span>
                      <strong
                        className={`text-xs font-bold whitespace-nowrap ${
                          isPositive ? "text-[#10b981]" : "text-[#ef4444]"
                        }`}
                      >
                        {isPositive ? `+${band.netPnl.toFixed(2)}` : band.netPnl.toFixed(2)} €
                      </strong>
                    </div>
                    <div className="bg-[#11131c] rounded-lg p-2 border border-white/5">
                      <span className="text-[9px] uppercase text-[#94a3b8] block">Profit Factor</span>
                      <strong className="text-xs font-bold text-foreground whitespace-nowrap">
                        PF {band.profitFactor.toFixed(2)}
                      </strong>
                    </div>
                    <div className="bg-[#11131c] rounded-lg p-2 border border-white/5">
                      <span className="text-[9px] uppercase text-[#94a3b8] block">Campione</span>
                      <strong className="text-xs font-bold text-foreground whitespace-nowrap">
                        {band.tradesCount} Trade
                      </strong>
                    </div>
                    <div className="bg-[#11131c] rounded-lg p-2 border border-white/5">
                      <span className="text-[9px] uppercase text-[#94a3b8] block">Media BPM</span>
                      <strong className="text-xs font-bold whitespace-nowrap" style={{ color: band.color }}>
                        {band.avgBpm > 0 ? `${band.avgBpm} BPM` : "—"}
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 3. CURVA DI RENDIMENTO CUMULATO SUDDIVISA PER FASCIA CARDIO */}
          <div className="rounded-xl border border-[#C5A059]/25 bg-[#0d0f14] p-3.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-[#C5A059]" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#E8C56A]">
                  Curva Comparativa di Rendimento per Fascia Biometrica (€)
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono text-[10px]">
                <span className="inline-flex items-center gap-1.5 text-[#10b981] whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-[#10b981]" />
                  Zen (&lt; 75 BPM)
                </span>
                <span className="inline-flex items-center gap-1.5 text-[#C5A059] whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-[#C5A059]" />
                  Vigile (75–{bioLockConfig.maxBpmThreshold - 1} BPM)
                </span>
                <span className="inline-flex items-center gap-1.5 text-[#ef4444] whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
                  Deriva (≥ {bioLockConfig.maxBpmThreshold} BPM)
                </span>
              </div>
            </div>

            <div className="w-full overflow-hidden rounded-lg bg-[#07080b] border border-white/5 p-2">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-[155px] overflow-visible"
                role="img"
                aria-label="Grafico comparativo delle 3 curve di rendimento per fascia cardiaca"
              >
                {/* Linea dello Zero */}
                <line
                  x1={padX}
                  y1={zeroY}
                  x2={padX + plotW}
                  y2={zeroY}
                  stroke="rgba(255,255,255,0.12)"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={padX - 6}
                  y={zeroY + 3}
                  textAnchor="end"
                  className="fill-[#94a3b8] font-mono text-[9px]"
                >
                  0€
                </text>

                {/* Curva Rischio Deriva (Rubino) */}
                <path
                  d={buildPath(report.bands.drift.cumulativeCurve)}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.85"
                />

                {/* Curva Assetto Vigile (Oro) */}
                <path
                  d={buildPath(report.bands.vigilant.cumulativeCurve)}
                  fill="none"
                  stroke="#C5A059"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.9"
                />

                {/* Curva Assetto Zen (Smeraldo) */}
                <path
                  d={buildPath(report.bands.zen.cumulativeCurve)}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Verdetto Sovrano */}
            <div className="flex items-center justify-between gap-2 pt-1 font-mono text-[10.5px] text-[#94a3b8]">
              <div className="flex items-center gap-2 min-w-0">
                <Wind size={13} className="text-[#C5A059] shrink-0" />
                <span className="truncate text-foreground/90">{report.sovereignVerdict}</span>
              </div>
              <span className="text-[9.5px] text-[#E8C56A] whitespace-nowrap shrink-0">
                {report.liveBleTaggedCount} Trade con Tag BPM Diretto
              </span>
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="border-t border-white/10 px-4 py-2.5 bg-[#0d0f14] flex items-center justify-between shrink-0 font-mono text-xs">
          <span className="text-[10px] text-[#94a3b8] whitespace-nowrap">
            Custode della Soglia · Bio-Telemetria AUREUS
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#C5A059]/15 border border-[#C5A059]/40 text-[#E8C56A] hover:bg-[#C5A059]/25 font-bold uppercase tracking-wider text-[10px] transition-all cursor-pointer"
          >
            Chiudi Analisi
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
