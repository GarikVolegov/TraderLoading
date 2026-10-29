import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetEconomicCalendar, type CalendarEvent } from "@workspace/api-client-react";
import { apiJSON } from "@/lib/apiFetch";
import {
  computeLimenIntegritySnapshot,
  type LimenIntegritySnapshot,
} from "../../../../../contracts/limenGrades";
import { cockpitContextReady, type CockpitAnalysis } from "../../../../../contracts/cockpit";
import type { ProcessState } from "@/lib/traderProcessApi";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Flame,
  AlertCircle,
  Headphones,
  Timer,
  AlertTriangle,
  Wind,
  Radio,
  Heart,
  Watch,
} from "lucide-react";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { useSmartWatchHeartRate } from "@/hooks/useSmartWatchHeartRate";
import { SmartWatchConnectModal } from "@/components/biometrics/SmartWatchConnectModal";
import {
  isDeepWorkAmbienceActive,
  toggleDeepWorkAmbience,
  subscribeDeepWorkAmbience,
  startProceduralHeartbeat,
  setHeartbeatBpm,
  stopProceduralHeartbeat,
  isHeartbeatActive,
  synestheticClick,
  synestheticAlert,
  synestheticMacroAlert,
} from "@/lib/soundFx";
import { TacticalBreathModal } from "./TacticalBreathModal";

export interface CockpitIntegritySentinelBarProps {
  state: ProcessState;
  analysis: CockpitAnalysis;
  tradesToday: number;
  maxTrades: number;
  onOpenProtection?: () => void;
  onOpenNews?: () => void;
  className?: string;
}

export function CockpitIntegritySentinelBar({
  state,
  analysis,
  tradesToday,
  maxTrades,
  onOpenProtection,
  onOpenNews,
  className = "",
}: CockpitIntegritySentinelBarProps) {
  const now = useMinuteClock();

  // Query operatore: report di integrità
  const { data: serverIntegrity } = useQuery<LimenIntegritySnapshot>({
    queryKey: ["operator-integrity"],
    queryFn: () => apiJSON("profile/integrity"),
    staleTime: 30_000,
  });

  const integrity =
    serverIntegrity ??
    computeLimenIntegritySnapshot({
      legacyLevel: 1,
      consecutiveIntegralSessions: 0,
    });

  const integrityPct = integrity.integrityIndex ?? 100;
  const grade = integrity.currentGrade;

  // Calcolo durata sessione e Sentinel Affaticamento Decisionale (90 min)
  const sessionStartTime = state.session?.preparedAt || state.session?.createdAt;
  const elapsedMinutes = sessionStartTime
    ? Math.max(0, Math.floor((now.getTime() - new Date(sessionStartTime).getTime()) / 60_000))
    : 0;
  const isSessionActive = Boolean(state.session && state.session.state !== "closed");
  const isFatigued = isSessionActive && elapsedMinutes >= 90;

  const alertedFatigueRef = useRef(false);
  useEffect(() => {
    if (isFatigued && !alertedFatigueRef.current) {
      alertedFatigueRef.current = true;
      synestheticAlert();
    }
  }, [isFatigued]);

  // Sentinella Acustica Correnti Macro: rilevamento eventi ad alto impatto (T-15m, T-5m, T-1m)
  const { data: calendarEvents } = useGetEconomicCalendar();
  const imminentMacroEvent = useMemo(() => {
    if (!calendarEvents || calendarEvents.length === 0) return null;
    const nowMs = now.getTime();

    const highEvents = calendarEvents
      .filter((e) => e.impact === "High" || (e.impact as string) === "high")
      .map((e) => {
        const timeMs = e.date ? Date.parse(e.date) : null;
        return { event: e, timeMs };
      })
      .filter((item): item is { event: CalendarEvent; timeMs: number } => item.timeMs !== null && !isNaN(item.timeMs));

    const relevant = highEvents
      .map(({ event, timeMs }) => ({
        event,
        timeMs,
        diffMs: timeMs - nowMs,
        diffMinutes: Math.round((timeMs - nowMs) / 60_000),
      }))
      .filter((item) => item.diffMs >= -60_000 && item.diffMs <= 15 * 60_000)
      .sort((a, b) => a.diffMs - b.diffMs);

    return relevant[0] ?? null;
  }, [calendarEvents, now]);

  const alertedMacroWarningRef = useRef<string | null>(null);
  const alertedMacroImminentRef = useRef<string | null>(null);

  useEffect(() => {
    if (!imminentMacroEvent) return;
    const { event, diffMs } = imminentMacroEvent;
    const eventKey = `${event.country || ""}-${event.title || ""}-${event.date || ""}`;

    // T-5 minuti (tra 60s e 300s): doppio rintocco di campana monastica
    if (diffMs <= 5 * 60_000 && diffMs > 60_000) {
      if (alertedMacroWarningRef.current !== eventKey) {
        alertedMacroWarningRef.current = eventKey;
        synestheticMacroAlert("warning");
      }
    }

    // T-1 minuto (tra -30s e 60s): triplice rintocco aureo con sub-ancoraggio 108 Hz
    if (diffMs <= 60_000 && diffMs >= -30_000) {
      if (alertedMacroImminentRef.current !== eventKey) {
        alertedMacroImminentRef.current = eventKey;
        synestheticMacroAlert("imminent");
      }
    }
  }, [imminentMacroEvent]);

  // Telemetria reattiva Atmosfera Acustica Deep Work (432 Hz Zen)
  const [ambienceActive, setAmbienceActive] = useState(() => isDeepWorkAmbienceActive());
  const [breathModalOpen, setBreathModalOpen] = useState(false);
  const [smartWatchModalOpen, setSmartWatchModalOpen] = useState(false);
  const watchTelemetry = useSmartWatchHeartRate();

  useEffect(() => {
    return subscribeDeepWorkAmbience((active) => {
      setAmbienceActive(active);
    });
  }, []);

  const handleToggleAmbience = () => {
    synestheticClick();
    toggleDeepWorkAmbience();
  };

  // Calcolo 4 Fasi del Custode della Soglia
  const step1Ready = cockpitContextReady(analysis);
  const step2Ready = Boolean(analysis.scenario);
  const step3Ready = Boolean(
    analysis.trigger && analysis.itfSchema && analysis.ltfSchema && analysis.targetConfirmed
  );
  const step4Ready = Boolean(state.session?.state === "operation" || state.session?.state === "closed");

  const completedStepsCount = [step1Ready, step2Ready, step3Ready, step4Ready].filter(Boolean).length;
  const isOvertradingRisk = tradesToday >= maxTrades;
  const isDriftWarning = integrity.driftDetected || isOvertradingRisk;

  // ── Bio-Telemetria Cardiaca Live dell'Operatore ──
  const liveBioTelemetry = useMemo(() => {
    if (watchTelemetry.isLive) {
      const bpm = watchTelemetry.bpm;
      const status: "calm" | "vigilant" | "elevated" | "critical" =
        watchTelemetry.zone === "zen"
          ? "calm"
          : watchTelemetry.zone === "vigilant"
          ? "vigilant"
          : "critical";
      const color =
        watchTelemetry.zone === "zen"
          ? "#10b981"
          : watchTelemetry.zone === "vigilant"
          ? "#C5A059"
          : "#ef4444";
      const stressReason = watchTelemetry.isBleConnected
        ? (watchTelemetry.deviceName ? `${watchTelemetry.deviceName}` : "Smartwatch BLE")
        : "Smartwatch (Sim)";
      const intensity = Math.max(0, Math.min(1, (bpm - 60) / 45));

      return {
        bpm,
        intensity,
        stressReason,
        status,
        color,
        isWatchLive: true,
        deviceName: watchTelemetry.deviceName,
        batteryLevel: watchTelemetry.batteryLevel,
      };
    }

    let baseBpm = 60;
    let stressReason = "Assetto Sereno";
    let status: "calm" | "vigilant" | "elevated" | "critical" = "calm";
    let color = "#10b981";

    if (isDriftWarning) {
      baseBpm = Math.max(baseBpm, 96);
      stressReason = "Rischio Deriva";
      status = "critical";
      color = "#ef4444";
    } else if (imminentMacroEvent && imminentMacroEvent.diffMs <= 60_000) {
      baseBpm = Math.max(baseBpm, 92);
      stressReason = "Macro Imminente";
      status = "critical";
      color = "#ef4444";
    } else if (isOvertradingRisk) {
      baseBpm = Math.max(baseBpm, 88);
      stressReason = "Soglia Max";
      status = "elevated";
      color = "#f59e0b";
    } else if (isFatigued) {
      baseBpm = Math.max(baseBpm, 82);
      stressReason = "Affaticamento";
      status = "elevated";
      color = "#f59e0b";
    } else if (imminentMacroEvent && imminentMacroEvent.diffMs <= 300_000) {
      baseBpm = Math.max(baseBpm, 76);
      stressReason = "Allerta Macro";
      status = "vigilant";
      color = "#C5A059";
    } else if (tradesToday >= maxTrades * 0.75) {
      baseBpm = Math.max(baseBpm, 72);
      stressReason = "Quota 75%";
      status = "vigilant";
      color = "#C5A059";
    }

    const intensity = Math.max(0, Math.min(1, (baseBpm - 60) / 45));
    return {
      bpm: baseBpm,
      intensity,
      stressReason,
      status,
      color,
      isWatchLive: false,
      deviceName: undefined,
      batteryLevel: undefined,
    };
  }, [
    watchTelemetry.isLive,
    watchTelemetry.bpm,
    watchTelemetry.zone,
    watchTelemetry.isBleConnected,
    watchTelemetry.deviceName,
    watchTelemetry.batteryLevel,
    isDriftWarning,
    imminentMacroEvent,
    isOvertradingRisk,
    isFatigued,
    tradesToday,
    maxTrades,
  ]);

  const [heartbeatSoundActive, setHeartbeatSoundActive] = useState(false);

  useEffect(() => {
    if (heartbeatSoundActive) {
      startProceduralHeartbeat(liveBioTelemetry.bpm, liveBioTelemetry.intensity);
      setHeartbeatBpm(liveBioTelemetry.bpm, liveBioTelemetry.intensity);
    }
  }, [heartbeatSoundActive, liveBioTelemetry.bpm, liveBioTelemetry.intensity]);

  useEffect(() => {
    return () => {
      if (heartbeatSoundActive) {
        stopProceduralHeartbeat();
      }
    };
  }, [heartbeatSoundActive]);

  const handleToggleHeartbeat = () => {
    synestheticClick();
    if (heartbeatSoundActive) {
      stopProceduralHeartbeat();
      setHeartbeatSoundActive(false);
    } else {
      startProceduralHeartbeat(liveBioTelemetry.bpm, liveBioTelemetry.intensity);
      setHeartbeatSoundActive(true);
    }
  };

  // Colore semantico dell'Indice di Integrità
  const integrityColorClass = isDriftWarning
    ? "text-[#ef4444] border-[#ef4444]/40 bg-[#ef4444]/10"
    : integrityPct >= 90
    ? "text-[#10b981] border-[#10b981]/40 bg-[#10b981]/10"
    : "text-[#E8C56A] border-[#C5A059]/40 bg-[#C5A059]/10";

  // Calcolo circonferenza anello SVG (raggio 12, circ = 2 * PI * 12 ~= 75.39)
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (integrityPct / 100) * circumference;

  return (
    <div
      role="region"
      aria-label="Telemetria di Sessione e Integrità AUREUS"
      className={`min-w-0 shrink-0 rounded-xl border border-[#C5A059]/30 bg-[#0d0f14]/95 backdrop-blur-md px-3 py-2 shadow-[0_4px_20px_rgba(0,0,0,0.5)] ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* GRUPPO SINISTRA: Grado Sovrano & Indice di Integrità */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Anello di Integrità */}
          <div className="relative flex items-center justify-center shrink-0 w-8 h-8">
            <svg className="w-8 h-8 -rotate-90 transform" viewBox="0 0 32 32">
              <circle
                cx="16"
                cy="16"
                r={radius}
                className="stroke-white/10"
                strokeWidth="2.5"
                fill="transparent"
              />
              <circle
                cx="16"
                cy="16"
                r={radius}
                className={`transition-all duration-700 ease-out ${
                  isDriftWarning
                    ? "stroke-[#ef4444]"
                    : integrityPct >= 90
                    ? "stroke-[#10b981]"
                    : "stroke-[#C5A059]"
                }`}
                strokeWidth="2.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <span className="absolute font-mono text-[9px] font-bold tracking-tighter text-foreground whitespace-nowrap">
              {integrityPct}%
            </span>
          </div>

          {/* Dettagli Grado e Stato */}
          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] whitespace-nowrap">
                {grade.code}
              </span>
              <span className="text-[11px] font-semibold text-foreground truncate hidden sm:inline">
                {grade.title}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
              <span>Indice di Integrità</span>
              <span>·</span>
              <span className="text-foreground/80 whitespace-nowrap font-bold">
                {integrity.consecutiveIntegralSessions} sessioni d'Ordine
              </span>
            </div>
          </div>
        </div>

        {/* GRUPPO CENTRO: Telemetria Micro-Sessione, Timer e Guardrail */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {/* Badge Guardrail Rischio Giornaliero */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10.5px] font-mono ${
              isOvertradingRisk
                ? "border-[#ef4444]/40 bg-[#ef4444]/15 text-[#ef4444]"
                : "border-white/10 bg-white/5 text-muted-foreground"
            }`}
            title="Trade eseguiti nella sessione rispetto al limite massimo consentito"
          >
            {isOvertradingRisk ? (
              <AlertCircle size={13} className="shrink-0 text-[#ef4444]" />
            ) : (
              <Shield size={13} className="shrink-0 text-[#C5A059]" />
            )}
            <span className="whitespace-nowrap text-foreground font-semibold">
              {tradesToday} / {maxTrades} Trade
            </span>
            {isOvertradingRisk && (
              <span className="text-[9px] uppercase tracking-wider font-bold text-[#ef4444] whitespace-nowrap">
                Stop Rischio
              </span>
            )}
          </div>

          {/* Timer Disciplina di Sessione & Sentinel Fatica Mentale */}
          {isSessionActive && elapsedMinutes > 0 && (
            <button
              type="button"
              onClick={isFatigued ? () => setBreathModalOpen(true) : undefined}
              className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10.5px] font-mono transition-all ${
                isFatigued
                  ? "border-[#ef4444]/60 bg-[#ef4444]/15 hover:bg-[#ef4444]/25 hover:border-[#ef4444] text-[#ef4444] animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.3)] cursor-pointer"
                  : "border-white/10 bg-white/5 text-muted-foreground cursor-default"
              }`}
              title={
                isFatigued
                  ? "Sessione operativa superiore a 90 minuti: alto rischio di affaticamento decisionale. Clicca per avviare il Rituale del Respiro Tattico 4-7-8."
                  : "Tempo trascorso nella sessione operativa corrente"
              }
            >
              {isFatigued ? (
                <AlertTriangle size={13} className="shrink-0 text-[#ef4444]" />
              ) : (
                <Timer size={13} className="shrink-0 text-[#C5A059]" />
              )}
              <span className="whitespace-nowrap font-semibold text-foreground">
                {elapsedMinutes}m
              </span>
              {isFatigued && (
                <span className="text-[9px] uppercase tracking-wider font-bold text-[#ef4444] whitespace-nowrap">
                  Pausa 4-7-8
                </span>
              )}
            </button>
          )}

          {/* Sentinella Acustica Correnti Macro (Pre-Allerta T-5m & T-1m) */}
          {imminentMacroEvent && (
            <button
              type="button"
              onClick={
                onOpenNews
                  ? () => {
                      synestheticClick();
                      onOpenNews();
                    }
                  : undefined
              }
              className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10.5px] font-mono transition-all whitespace-nowrap ${
                onOpenNews ? "cursor-pointer" : "cursor-default"
              } ${
                imminentMacroEvent.diffMs <= 60_000
                  ? "border-[#ef4444]/60 bg-[#ef4444]/15 hover:bg-[#ef4444]/25 text-[#ef4444] animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.35)]"
                  : imminentMacroEvent.diffMinutes <= 5
                  ? "border-[#C5A059]/60 bg-[#C5A059]/20 hover:bg-[#C5A059]/30 text-[#E8C56A] animate-pulse shadow-[0_0_10px_rgba(197,160,89,0.3)]"
                  : "border-white/10 bg-white/5 hover:border-[#C5A059]/40 text-[#C5A059]"
              }`}
              title={
                imminentMacroEvent.diffMs <= 60_000
                  ? `TEMPESTA MACRO IMMINENTE: ${imminentMacroEvent.event.country} ${imminentMacroEvent.event.title} tra meno di 60 secondi. Massima disciplina, verifica stop loss.`
                  : `Allerta Macro: ${imminentMacroEvent.event.country} ${imminentMacroEvent.event.title} in arrivo tra ${imminentMacroEvent.diffMinutes} minuti.`
              }
            >
              {imminentMacroEvent.diffMs <= 60_000 ? (
                <AlertTriangle size={13} className="shrink-0 text-[#ef4444]" />
              ) : imminentMacroEvent.diffMinutes <= 5 ? (
                <Flame size={13} className="shrink-0 text-[#E8C56A]" />
              ) : (
                <Radio size={13} className="shrink-0 text-[#C5A059]" />
              )}
              <span className="font-bold text-foreground">
                {imminentMacroEvent.event.country ? `${imminentMacroEvent.event.country} ` : ""}
                {imminentMacroEvent.diffMs <= 60_000 ? "TEMPESTA" : "MACRO"}
              </span>
              <span
                className={`font-bold font-mono px-1 py-0.5 rounded text-[9px] ${
                  imminentMacroEvent.diffMs <= 60_000
                    ? "bg-[#ef4444]/20 text-[#ef4444]"
                    : "bg-[#C5A059]/20 text-[#E8C56A]"
                }`}
              >
                {imminentMacroEvent.diffMs <= 0
                  ? "ORA"
                  : imminentMacroEvent.diffMs <= 60_000
                  ? `${Math.max(1, Math.round(imminentMacroEvent.diffMs / 1000))}s`
                  : `${imminentMacroEvent.diffMinutes}m`}
              </span>
            </button>
          )}

          {/* Telemetria Custode della Soglia (4 Fasi) */}
          <div
            className="flex items-center gap-1 px-2 py-1 rounded border border-white/10 bg-white/5 text-[10.5px] font-mono"
            title="Stato di avanzamento de Il Custode della Soglia (Contesto, Svolta, Sigillo, Target)"
          >
            <span className="text-muted-foreground whitespace-nowrap">Soglia:</span>
            <div className="flex items-center gap-1">
              {[
                { label: "01", ready: step1Ready, name: "Contesto" },
                { label: "02", ready: step2Ready, name: "Svolta" },
                { label: "03", ready: step3Ready, name: "Sigillo" },
                { label: "04", ready: step4Ready, name: "Target" },
              ].map((s) => (
                <span
                  key={s.label}
                  className={`inline-block w-2 h-2 rounded-full transition-colors ${
                    s.ready ? "bg-[#10b981] shadow-[0_0_6px_rgba(16,185,129,0.5)]" : "bg-white/20"
                  }`}
                  title={`${s.label} ${s.name}: ${s.ready ? "Conforme" : "Incompleto"}`}
                />
              ))}
            </div>
            <span className="text-foreground font-bold ml-1 whitespace-nowrap">
              {completedStepsCount}/4
            </span>
          </div>

          {/* Chip Status Assetto */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-mono font-bold uppercase tracking-wider whitespace-nowrap ${integrityColorClass}`}
          >
            {isDriftWarning ? (
              <>
                <ShieldAlert size={12} className="shrink-0" />
                <span>Rischio Deriva</span>
              </>
            ) : completedStepsCount >= 3 ? (
              <>
                <ShieldCheck size={12} className="shrink-0" />
                <span>Assetto Consapevole</span>
              </>
            ) : (
              <>
                <Flame size={12} className="shrink-0 text-[#C5A059]" />
                <span>In Allineamento</span>
              </>
            )}
          </div>
        </div>

        {/* GRUPPO DESTRA: Azioni Rapide & Atmosfera Acustica */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Telemetria Cardiaca Live & Connessione Smartwatch */}
          <button
            type="button"
            onClick={() => {
              synestheticClick();
              setSmartWatchModalOpen(true);
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border font-mono text-[10.5px] font-semibold transition-all duration-200 shrink-0 whitespace-nowrap cursor-pointer ${
              liveBioTelemetry.isWatchLive
                ? "border-[#C5A059]/50 bg-[#C5A059]/15 text-[#E8C56A] shadow-[0_0_10px_rgba(197,160,89,0.2)]"
                : "border-white/10 bg-white/5 hover:border-[#C5A059]/40 hover:bg-[#C5A059]/10 text-muted-foreground hover:text-[#E8C56A]"
            }`}
            title={`Bio-Telemetria Cardiaca: ${liveBioTelemetry.bpm} BPM (${liveBioTelemetry.stressReason}). Clicca per collegare o gestire lo Smartwatch.`}
            aria-label={`Bio-telemetria cardiaca live: ${liveBioTelemetry.bpm} BPM`}
          >
            {liveBioTelemetry.isWatchLive ? (
              <Watch size={12} className="shrink-0 text-[#C5A059]" />
            ) : (
              <Heart
                size={12}
                className="shrink-0"
                style={{
                  color: liveBioTelemetry.color,
                  animation: `pulse ${(60 / liveBioTelemetry.bpm).toFixed(2)}s ease-in-out infinite`,
                }}
                fill={liveBioTelemetry.color}
              />
            )}
            <span className="font-mono text-[10.5px] font-bold whitespace-nowrap" style={{ color: liveBioTelemetry.color }}>
              {liveBioTelemetry.bpm} BPM
            </span>
            <span
              className="text-[9px] uppercase px-1 py-0.2 rounded font-mono hidden md:inline whitespace-nowrap"
              style={{
                background: "rgba(0,0,0,0.35)",
                color: liveBioTelemetry.color,
                border: `1px solid ${liveBioTelemetry.color}35`,
              }}
            >
              {liveBioTelemetry.stressReason}
            </span>
          </button>

          {/* Tasto Rapido Rituale del Respiro Tattico 4-7-8 */}
          <button
            type="button"
            onClick={() => {
              synestheticClick();
              setBreathModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-white/10 bg-white/5 hover:border-[#C5A059]/40 hover:bg-[#C5A059]/10 text-muted-foreground hover:text-[#E8C56A] font-mono text-[10.5px] font-semibold transition-all duration-200 shrink-0 whitespace-nowrap cursor-pointer"
            title="Avvia il Rituale del Respiro Tattico 4-7-8 per resettare il sistema nervoso autonomo"
          >
            <Wind size={12} className="shrink-0 text-[#C5A059]" />
            <span className="hidden sm:inline">Respiro 4-7-8</span>
            <span className="sm:hidden">4-7-8</span>
          </button>

          {/* Tasto Rapido Atmosfera Acustica Deep Work (432 Hz + Flusso Alpha) */}
          <button
            type="button"
            onClick={handleToggleAmbience}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10.5px] font-mono font-semibold transition-all duration-200 shrink-0 whitespace-nowrap cursor-pointer ${
              ambienceActive
                ? "border-[#C5A059]/60 bg-[#C5A059]/20 text-[#E8C56A] shadow-[0_0_12px_rgba(197,160,89,0.25)]"
                : "border-white/10 bg-white/5 hover:border-[#C5A059]/40 hover:bg-[#C5A059]/10 text-muted-foreground hover:text-[#E8C56A]"
            }`}
            title={
              ambienceActive
                ? "Atmosfera Acustica Deep Work (432 Hz Pitagorico + Flusso Alpha 1.4 Hz + Brown Noise) attiva. Clicca per disattivare."
                : "Attiva l'Atmosfera Acustica Deep Work (432 Hz + Flusso Alpha + Brown Noise) per massima concentrazione"
            }
          >
            <Headphones
              size={12}
              className={`shrink-0 ${ambienceActive ? "text-[#E8C56A] animate-pulse" : "text-muted-foreground"}`}
            />
            <span>{ambienceActive ? "432Hz Zen Attivo" : "432Hz Zen"}</span>
          </button>

          {/* Accesso Rapido Guardrail */}
          {onOpenProtection && (
            <button
              type="button"
              onClick={onOpenProtection}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#C5A059]/30 bg-[#C5A059]/10 hover:bg-[#C5A059]/20 hover:border-[#C5A059]/60 text-[#E8C56A] font-mono text-[10.5px] font-semibold transition-all duration-200 shrink-0 whitespace-nowrap"
              title="Apri le impostazioni di Rischio e i guardrail de Il Custode della Soglia"
            >
              <Shield size={12} className="shrink-0" />
              <span>Regole &amp; Rischio</span>
            </button>
          )}
        </div>
      </div>

      {/* Modale del Rituale del Respiro Tattico 4-7-8 */}
      <TacticalBreathModal
        isOpen={breathModalOpen}
        onClose={() => setBreathModalOpen(false)}
      />

      {/* Modale di Connessione Smartwatch Live */}
      <SmartWatchConnectModal
        open={smartWatchModalOpen}
        onClose={() => setSmartWatchModalOpen(false)}
      />
    </div>
  );
}
