import { useState, useMemo, useEffect, useRef } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  Layers,
  Sparkles,
  Lock,
  Zap,
  Target,
} from "lucide-react";
import type { BrokerSnapshot } from "@/components/broker-hub/types";
import {
  PROP_PROFILES,
  getStoredPropConfig,
  setStoredPropConfig,
  computePropGuardianTelemetry,
  copySetupToClipboard,
  type PropProfile,
  type SetupExportParams,
} from "@/lib/propGuardian";
import { useToast } from "@/hooks/use-toast";
import { synestheticConfirm, synestheticAlert, synestheticClick } from "@/lib/soundFx";

export interface CockpitPropGuardianBarProps {
  brokerSnapshot: BrokerSnapshot;
  onOpenBrokerHub: (tab?: "connect" | "accounts" | "history" | "recommended") => void;
  onTriggerBioLock?: (reason: string) => void;
  activeSetup?: SetupExportParams | null;
  className?: string;
}

export function CockpitPropGuardianBar({
  brokerSnapshot,
  onOpenBrokerHub,
  onTriggerBioLock,
  activeSetup,
  className = "",
}: CockpitPropGuardianBarProps) {
  const { toast } = useToast();
  const [copiedSetup, setCopiedSetup] = useState(false);
  const [propConfig, setPropConfig] = useState(() => getStoredPropConfig());
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  // Selettore profilo attivo
  const selectedProfile: PropProfile = useMemo(() => {
    return (
      PROP_PROFILES.find((p) => p.id === propConfig.profileId) ||
      PROP_PROFILES[0]
    );
  }, [propConfig.profileId]);

  const isBrokerConnected =
    brokerSnapshot.status === "connected" && Boolean(brokerSnapshot.profileId);

  // Calcolo telemetria in tempo reale
  const telemetry = useMemo(() => {
    // Se non connesso, forniamo telemetria neutra con profilo attivo
    const bal = isBrokerConnected ? brokerSnapshot.metrics.balance : 100_000;
    const eq = isBrokerConnected ? brokerSnapshot.metrics.equity : 100_000;
    const dailyProfit = isBrokerConnected ? brokerSnapshot.metrics.dailyProfit : 0;
    const curr = isBrokerConnected ? brokerSnapshot.metrics.currency || "EUR" : "EUR";

    return computePropGuardianTelemetry(bal, eq, dailyProfit, selectedProfile, curr, propConfig.phase || 1);
  }, [isBrokerConnected, brokerSnapshot.metrics, selectedProfile, propConfig.phase]);

  // Monitoraggio acustico e Bio-Lock al varco del 75%+
  const lastAlertTimestampRef = useRef<number>(0);
  useEffect(() => {
    if (isBrokerConnected && telemetry.isCriticalBreachRisk) {
      const now = Date.now();
      if (now - lastAlertTimestampRef.current > 60_000) {
        lastAlertTimestampRef.current = now;
        synestheticAlert();
        toast({
          title: "⚠️ Allerta Custode: Soglia Critica Drawdown 75%+",
          description: `Drawdown odierno al ${telemetry.currentDailyDrawdownPct.toFixed(2)}% (Max ${selectedProfile.maxDailyLossPct.toFixed(1)}% ${selectedProfile.name}). Attivazione presidio Bio-Lock per prevenire il breach.`,
          variant: "destructive",
        });
        if (onTriggerBioLock) {
          onTriggerBioLock(
            `Drawdown odierno al ${telemetry.currentDailyDrawdownPct.toFixed(2)}% supera la soglia di allerta del 75% per ${selectedProfile.name}. Esegui il Respiro Tattico 4-7-8 prima di riprendere le operazioni.`,
          );
        }
      }
    }
  }, [
    isBrokerConnected,
    telemetry.isCriticalBreachRisk,
    telemetry.currentDailyDrawdownPct,
    selectedProfile,
    onTriggerBioLock,
    toast,
  ]);

  const handleSelectProfile = (profileId: string) => {
    synestheticClick();
    const updated = { ...propConfig, profileId };
    setPropConfig(updated);
    setStoredPropConfig(updated);
    setIsProfileMenuOpen(false);
  };

  const handleCopySetup = async () => {
    if (!activeSetup) return;
    const enriched: SetupExportParams = {
      ...activeSetup,
      propFirmName: selectedProfile.name,
      dailyDrawdownPct: telemetry.currentDailyDrawdownPct,
      maxDailyLimitPct: selectedProfile.maxDailyLossPct,
    };
    const ok = await copySetupToClipboard(enriched);
    if (ok) {
      synestheticConfirm();
      setCopiedSetup(true);
      setTimeout(() => setCopiedSetup(false), 2500);
      toast({
        title: "Setup Esportato per MT5 / cTrader",
        description: `Parametri di ${activeSetup.market} (${activeSetup.side}) e sintassi d'ordine copiati negli appunti.`,
      });
    }
  };

  const usagePctClamped = Math.min(100, Math.max(0, telemetry.drawdownUsageRatio * 100));

  return (
    <div
      className={`relative px-3 py-2 rounded-xl bg-[#0d0f14]/95 border border-[#C5A059]/30 shadow-[0_4px_24px_rgba(0,0,0,0.7),0_0_15px_rgba(197,160,89,0.06)] font-mono text-xs select-none backdrop-blur-md ${className}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        {/* ── 1. Modulo Sinistro: Profilo Prop / Broker & Saldo Live ── */}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {/* Status Dot */}
          <span
            className={`flex h-2.5 w-2.5 rounded-full shrink-0 ${
              isBrokerConnected
                ? telemetry.isCriticalBreachRisk
                  ? "bg-[#ef4444] animate-ping shadow-[0_0_8px_#ef4444]"
                  : telemetry.status === "vigilance"
                  ? "bg-[#E8C56A] animate-pulse"
                  : "bg-[#10b981] animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                : "bg-[#C5A059]/60"
            }`}
          />

          {/* Selettore Profilo Prop Firm (FTMO, 5%ers, FundedNext...) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/50 border border-[#C5A059]/30 hover:border-[#C5A059]/70 text-[#E8C56A] text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
              title="Seleziona la Prop Firm o il Broker attivo per allineare le regole di Drawdown"
            >
              <ShieldCheck size={12} className="text-[#C5A059] shrink-0" />
              <span className="whitespace-nowrap">{selectedProfile.name}</span>
              <span className="text-[9px] text-[#94a3b8] font-normal whitespace-nowrap hidden sm:inline">
                ({selectedProfile.maxDailyLossPct}% Daily)
              </span>
              <ChevronDown size={11} className="text-[#C5A059]/80 ml-0.5" />
            </button>

            {/* Menu a tendina profili Prop Firm */}
            {isProfileMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 z-50 w-56 rounded-xl border border-[#C5A059]/40 bg-[#07080b]/98 backdrop-blur-xl p-1.5 shadow-[0_12px_36px_rgba(0,0,0,0.95)]">
                <div className="px-2 py-1 text-[9px] uppercase font-bold text-[#94a3b8] tracking-wider border-b border-white/10 mb-1">
                  Regole Prop Firm Sovrane
                </div>
                {PROP_PROFILES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProfile(p.id)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left text-[10.5px] transition-colors cursor-pointer ${
                      p.id === selectedProfile.id
                        ? "bg-[#C5A059]/20 text-[#E8C56A] font-bold border border-[#C5A059]/40"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="whitespace-nowrap">{p.name}</span>
                    <span className="text-[9px] text-[#94a3b8] font-mono whitespace-nowrap">{p.badge}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Nome Broker e Saldi (se connesso) */}
          {isBrokerConnected ? (
            <div className="flex items-center gap-2 text-[10.5px]">
              <span className="text-slate-400 font-bold whitespace-nowrap">
                {brokerSnapshot.brokerName}
              </span>
              <span className="text-white/20">·</span>
              <span className="text-slate-300 whitespace-nowrap">
                Bal:{" "}
                <strong className="text-white font-bold">
                  €{brokerSnapshot.metrics.balance.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </span>
              <span className="text-slate-300 whitespace-nowrap">
                Eq:{" "}
                <strong
                  className={`font-bold ${
                    brokerSnapshot.metrics.equity >= brokerSnapshot.metrics.balance
                      ? "text-[#10b981]"
                      : "text-rose-400"
                  }`}
                >
                  €{brokerSnapshot.metrics.equity.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </span>
            </div>
          ) : (
            <span className="text-slate-400 text-[10.5px] truncate hidden md:inline">
              Collega MT4/MT5 per tracciare il Max Daily Drawdown in tempo reale
            </span>
          )}
        </div>

        {/* ── 2. Modulo Centrale: Barra Telemetria Max Daily Drawdown ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 lg:gap-3 flex-1 max-w-xl">
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold">
              <span className="text-slate-300 whitespace-nowrap flex items-center gap-1">
                <span>Drawdown Oggi:</span>
                <span
                  className={`font-mono text-[11px] ${
                    telemetry.status === "critical"
                      ? "text-[#ef4444] font-bold"
                      : telemetry.status === "vigilance"
                      ? "text-[#E8C56A] font-bold"
                      : "text-[#10b981] font-semibold"
                  }`}
                >
                  {telemetry.currentDailyDrawdownPct.toFixed(2)}%
                </span>
                <span className="text-slate-500 font-normal">
                  / Max {selectedProfile.maxDailyLossPct.toFixed(1)}%
                </span>
              </span>

              {/* Status Badge */}
              <span
                className={`px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider font-bold whitespace-nowrap border ${
                  telemetry.status === "critical"
                    ? "bg-[#ef4444]/20 border-[#ef4444]/50 text-[#ef4444] animate-pulse"
                    : telemetry.status === "vigilance"
                    ? "bg-[#C5A059]/20 border-[#C5A059]/50 text-[#E8C56A]"
                    : "bg-[#10b981]/15 border-[#10b981]/35 text-[#10b981]"
                }`}
              >
                {telemetry.statusLabel}
              </span>
            </div>

            {/* Barra di Avanzamento con soglia critica 75% visibile */}
            <div className="relative h-2 w-full rounded-full bg-black/60 border border-white/10 overflow-hidden">
              {/* Indicatore visivo notch 75% (Soglia Bio-Lock) */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-[#ef4444]/70 z-10"
                style={{ left: "75%" }}
                title="Soglia Critica 75% (Allerta Bio-Lock)"
              />
              {/* Livello di Drawdown consumato */}
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  telemetry.status === "critical"
                    ? "bg-gradient-to-r from-[#C5A059] to-[#ef4444]"
                    : telemetry.status === "vigilance"
                    ? "bg-gradient-to-r from-[#10b981] to-[#E8C56A]"
                    : "bg-[#10b981]"
                }`}
                style={{ width: `${usagePctClamped}%` }}
              />
            </div>

            {/* Metriche di Rischio Residuo */}
            <div className="flex items-center justify-between text-[9px] text-slate-400">
              <span className="whitespace-nowrap">
                Perdita Odierna:{" "}
                <strong className="text-slate-200">
                  €{telemetry.currentDailyDrawdownAmount.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </span>
              <span className="whitespace-nowrap">
                Buffer Residuo:{" "}
                <strong
                  className={
                    telemetry.dailyLossRemainingBudget < 500 ? "text-rose-400" : "text-emerald-400"
                  }
                >
                  €{telemetry.dailyLossRemainingBudget.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </span>
            </div>

            {/* Obiettivo Profit Target (Fase 1 / Fase 2) */}
            <div className="pt-1 border-t border-white/5 flex items-center justify-between text-[9px] text-slate-400">
              <div className="flex items-center gap-1.5 min-w-0">
                <Target size={11} className="text-[#E8C56A] shrink-0" />
                <span className="text-slate-300 font-semibold whitespace-nowrap">
                  Target F{propConfig.phase || 1}:
                </span>
                <span className="font-mono text-emerald-400 font-bold whitespace-nowrap">
                  €{telemetry.currentProfitAmount.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-slate-500 whitespace-nowrap hidden sm:inline">
                  / €{telemetry.profitTargetAmount.toLocaleString("it-IT", { minimumFractionDigits: 0 })} ({telemetry.profitTargetPct}%)
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {telemetry.isTargetAchieved ? (
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[8.5px] font-bold uppercase whitespace-nowrap animate-pulse">
                    🏆 OBIETTIVO SUPERATO
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    <div className="w-12 h-1.5 rounded-full bg-black/60 border border-white/10 overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, telemetry.profitProgressPct))}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-[#E8C56A] font-bold whitespace-nowrap">
                      {telemetry.profitProgressPct.toFixed(1)}%
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    synestheticClick();
                    const nextPhase = (propConfig.phase === 2 ? 1 : 2) as 1 | 2;
                    const updated = { ...propConfig, phase: nextPhase };
                    setPropConfig(updated);
                    setStoredPropConfig(updated);
                  }}
                  className="px-1.5 py-0.2 rounded bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white text-[8px] font-bold uppercase transition-colors cursor-pointer whitespace-nowrap border border-white/10"
                  title="Cambia fase challenge: Fase 1 (10%) o Fase 2 (5%)"
                >
                  Fase {propConfig.phase || 1} ⮂
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. Modulo Destro: Esporta Setup MT5 / cTrader & Azioni Conto ── */}
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
          {/* Tasto Rapido Esporta Setup (se un setup è pianificato) */}
          {activeSetup && (
            <button
              type="button"
              onClick={handleCopySetup}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                copiedSetup
                  ? "bg-[#10b981]/25 border-[#10b981]/50 text-[#10b981]"
                  : "bg-[#C5A059]/15 border-[#C5A059]/40 hover:bg-[#C5A059]/30 text-[#E8C56A]"
              }`}
              title="Copia i parametri del setup formattati per MetaTrader 5 o cTrader"
            >
              {copiedSetup ? <Check size={12} /> : <Copy size={12} />}
              <span>{copiedSetup ? "Copiato!" : "Esporta MT5 / cTrader"}</span>
            </button>
          )}

          {/* Tasto Prova Rapida 100k Demo (quando non connesso) */}
          {!isBrokerConnected && (
            <button
              type="button"
              onClick={() => onOpenBrokerHub("connect")}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#C5A059]/25 to-[#E8C56A]/15 hover:from-[#C5A059]/40 hover:to-[#E8C56A]/30 border border-[#C5A059]/50 text-[#E8C56A] hover:text-white text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap active:scale-95"
              title="Attiva una prova rapida per testare il presidio drawdown in tempo reale"
            >
              <Zap size={11} className="text-[#E8C56A]" />
              <span className="hidden sm:inline">⚡ Prova 100k</span>
            </button>
          )}

          {/* Tasto Gestisci / Collega Conto */}
          <button
            type="button"
            onClick={() => onOpenBrokerHub(isBrokerConnected ? "accounts" : "connect")}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/50 border border-white/15 hover:border-[#C5A059]/50 text-slate-200 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap"
            title="Apri l'hub di connessione broker e prop firm"
          >
            <span>{isBrokerConnected ? "Gestisci Conto" : "Collega Conto"}</span>
          </button>

          {/* Tasto Broker & Prop Consigliati */}
          <button
            type="button"
            onClick={() => onOpenBrokerHub("recommended")}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#C5A059]/10 border border-[#C5A059]/30 hover:border-[#C5A059]/60 text-[#E8C56A] hover:text-[#F3D88C] text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap"
            title="Consulta i Broker ECN e le Prop Firm raccomandate da AUREUS"
          >
            <Sparkles size={11} className="text-[#C5A059]" />
            <span className="hidden sm:inline">Partner</span>
          </button>
        </div>
      </div>
    </div>
  );
}
