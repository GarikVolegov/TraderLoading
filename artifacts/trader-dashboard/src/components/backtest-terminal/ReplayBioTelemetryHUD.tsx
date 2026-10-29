import { useEffect, useMemo, useState } from "react";
import { Heart, Volume2, VolumeX, ShieldAlert, Sparkles, Activity } from "lucide-react";
import type { ReplayEngine } from "./useReplayEngine";
import { getPipMultiplier } from "../../lib/pipMultiplier.js";
import { useSmartWatchHeartRate } from "../../hooks/useSmartWatchHeartRate.js";
import {
  startProceduralHeartbeat,
  setHeartbeatBpm,
  stopProceduralHeartbeat,
  isHeartbeatSoundMuted,
  setHeartbeatSoundMuted,
  getStopLossProximityThreshold,
  synestheticClick,
  isDeepWorkAmbienceActive,
  modulateDeepWorkByBpm,
} from "../../lib/soundFx.js";

interface ReplayBioTelemetryHUDProps {
  engine: ReplayEngine;
}

export type HrvCoherenceStatus = "elevata" | "vigile" | "inibita";

export interface TelemetryMetrics {
  bpm: number;
  intensity: number;
  status: "idle" | "calm" | "profit" | "attention" | "critical" | "unprotected";
  label: string;
  proximityDetail: string;
  color: string;
  bgRgba: string;
  borderRgba: string;
  hrvRmssd: number;
  hrvStatus: HrvCoherenceStatus;
}

export function computeModelledHrv(
  bpm: number,
  status: TelemetryMetrics["status"],
): { hrvRmssd: number; hrvStatus: HrvCoherenceStatus } {
  if (status === "critical" || status === "unprotected" || bpm >= 90) {
    const hrv = Math.max(12, Math.round(26 - Math.min(14, (bpm - 90) * 0.7)));
    return { hrvRmssd: hrv, hrvStatus: "inibita" };
  }
  if (status === "attention" || (bpm >= 75 && bpm < 90)) {
    const hrv = Math.max(28, Math.round(44 - (bpm - 75) * 1.1));
    return { hrvRmssd: hrv, hrvStatus: "vigile" };
  }
  const hrv = Math.min(85, Math.round(58 + Math.max(0, 75 - bpm) * 0.8));
  return { hrvRmssd: hrv, hrvStatus: "elevata" };
}

export function computeReplayTelemetry(
  positions: ReplayEngine["positions"],
  currentPrice: number,
  symbol: string,
  openProfit: number,
  slThreshold = getStopLossProximityThreshold(),
): TelemetryMetrics {
  if (!positions || positions.length === 0) {
    const hrv = computeModelledHrv(60, "idle");
    return {
      bpm: 60,
      intensity: 0,
      status: "idle",
      label: "STASI OPERATIVA",
      proximityDetail: "Nessun Rischio a Mercato",
      color: "#94a3b8",
      bgRgba: "rgba(148, 163, 184, 0.08)",
      borderRgba: "rgba(148, 163, 184, 0.25)",
      hrvRmssd: hrv.hrvRmssd,
      hrvStatus: hrv.hrvStatus,
    };
  }

  const multiplier = getPipMultiplier(symbol);
  let worstRatio = 1.0;
  let worstPos = positions[0];
  let hasAnyStop = false;

  for (const pos of positions) {
    const hasStop = (pos.hasStop || (pos.stopLoss && pos.stopLoss > 0)) && pos.stopLoss !== pos.entryPrice;
    if (hasStop) {
      hasAnyStop = true;
      let riskSpan = 0;
      let distToStop = 0;

      if (pos.direction === "buy") {
        riskSpan = Math.abs(pos.entryPrice - pos.stopLoss);
        distToStop = currentPrice - pos.stopLoss;
      } else {
        riskSpan = Math.abs(pos.stopLoss - pos.entryPrice);
        distToStop = pos.stopLoss - currentPrice;
      }

      if (riskSpan > 0) {
        const ratio = distToStop / riskSpan;
        if (ratio < worstRatio) {
          worstRatio = ratio;
          worstPos = pos;
        }
      }
    }
  }

  // Se nessun trade ha stop loss definito
  if (!hasAnyStop) {
    if (openProfit < 0) {
      const hrv = computeModelledHrv(94, "unprotected");
      return {
        bpm: 94,
        intensity: 0.85,
        status: "unprotected",
        label: "STOP ASSENTE",
        proximityDetail: "Rischio Non Recintato",
        color: "#ef4444",
        bgRgba: "rgba(239, 68, 68, 0.16)",
        borderRgba: "rgba(239, 68, 68, 0.45)",
        hrvRmssd: hrv.hrvRmssd,
        hrvStatus: hrv.hrvStatus,
      };
    }
    const hrv = computeModelledHrv(66, "calm");
    return {
      bpm: 66,
      intensity: 0.2,
      status: "calm",
      label: "NON RECINTATO",
      proximityDetail: "Integrità Parziale",
      color: "#f59e0b",
      bgRgba: "rgba(245, 158, 11, 0.12)",
      borderRgba: "rgba(245, 158, 11, 0.35)",
      hrvRmssd: hrv.hrvRmssd,
      hrvStatus: hrv.hrvStatus,
    };
  }

  // Trade in profitto
  if (worstRatio >= 1.0) {
    const hasTp = worstPos.takeProfit && worstPos.takeProfit > 0;
    if (hasTp) {
      const distToTarget = Math.abs(worstPos.takeProfit - currentPrice);
      const pipsToTarget = Math.max(0, distToTarget * multiplier);
      if (pipsToTarget < 12) {
        const hrv = computeModelledHrv(58, "profit");
        return {
          bpm: 58,
          intensity: 0.1,
          status: "profit",
          label: "TARGET IMMINENTE",
          proximityDetail: `TP a ${pipsToTarget.toFixed(1)} pips`,
          color: "#E8C56A",
          bgRgba: "rgba(197, 160, 89, 0.18)",
          borderRgba: "rgba(197, 160, 89, 0.55)",
          hrvRmssd: hrv.hrvRmssd,
          hrvStatus: hrv.hrvStatus,
        };
      }
    }

    const hrv = computeModelledHrv(60, "calm");
    return {
      bpm: 60,
      intensity: 0.05,
      status: "calm",
      label: "IN PROFITTO",
      proximityDetail: "Traiettoria Conforme",
      color: "#10b981",
      bgRgba: "rgba(16, 185, 129, 0.12)",
      borderRgba: "rgba(16, 185, 129, 0.35)",
      hrvRmssd: hrv.hrvRmssd,
      hrvStatus: hrv.hrvStatus,
    };
  }

  // Trade in drawdown verso lo Stop Loss
  const pipsToStop = Math.max(0, Math.abs(currentPrice - worstPos.stopLoss) * multiplier);

  if (worstRatio <= slThreshold) {
    // Sotto la soglia di distanza rimanente: stress elevato
    const stressFactor = Math.max(0, Math.min(1, (slThreshold - worstRatio) / slThreshold));
    const calculatedBpm = Math.round(85 + stressFactor * 20); // 85 -> 105 BPM
    const hrv = computeModelledHrv(calculatedBpm, "critical");

    return {
      bpm: calculatedBpm,
      intensity: 0.6 + stressFactor * 0.4,
      status: "critical",
      label: "SOGLIA CRITICA",
      proximityDetail: `Stop a ${pipsToStop.toFixed(1)} pips`,
      color: "#ef4444",
      bgRgba: "rgba(239, 68, 68, 0.22)",
      borderRgba: "rgba(239, 68, 68, 0.65)",
      hrvRmssd: hrv.hrvRmssd,
      hrvStatus: hrv.hrvStatus,
    };
  }

  const moderateBound = Math.min(0.65, slThreshold + 0.30);
  if (worstRatio <= moderateBound) {
    // Tra soglia e soglia+30%: allerta moderata
    const span = moderateBound - slThreshold;
    const stressFactor = span > 0 ? (moderateBound - worstRatio) / span : 0.5;
    const calculatedBpm = Math.round(68 + stressFactor * 16); // 68 -> 84 BPM
    const hrv = computeModelledHrv(calculatedBpm, "attention");

    return {
      bpm: calculatedBpm,
      intensity: 0.3 + stressFactor * 0.3,
      status: "attention",
      label: "ATTENZIONE STOP",
      proximityDetail: `Stop a ${pipsToStop.toFixed(1)} pips`,
      color: "#f59e0b",
      bgRgba: "rgba(245, 158, 11, 0.14)",
      borderRgba: "rgba(245, 158, 11, 0.4)",
      hrvRmssd: hrv.hrvRmssd,
      hrvStatus: hrv.hrvStatus,
    };
  }

  // Drawdown leggero ma controllato
  const hrv = computeModelledHrv(63, "calm");
  return {
    bpm: 63,
    intensity: 0.15,
    status: "calm",
    label: "DISCIPLINA",
    proximityDetail: `Stop a ${pipsToStop.toFixed(1)} pips`,
    color: "#94a3b8",
    bgRgba: "rgba(148, 163, 184, 0.1)",
    borderRgba: "rgba(148, 163, 184, 0.3)",
    hrvRmssd: hrv.hrvRmssd,
    hrvStatus: hrv.hrvStatus,
  };
}

export function ReplayBioTelemetryHUD({ engine }: ReplayBioTelemetryHUDProps) {
  const [muted, setMuted] = useState(() => isHeartbeatSoundMuted());
  const watch = useSmartWatchHeartRate();

  const metrics = useMemo(() => {
    return computeReplayTelemetry(
      engine.positions,
      engine.currentPrice,
      engine.symbol,
      engine.openProfit,
    );
  }, [engine.positions, engine.currentPrice, engine.symbol, engine.openProfit]);

  // Se lo smartwatch è connesso in tempo reale, usa i parametri biometrici reali dell'operatore
  const activeBpm = watch.isLive ? watch.bpm : metrics.bpm;
  const activeHrv = watch.isLive && watch.hrvRmssd != null ? watch.hrvRmssd : metrics.hrvRmssd;
  const activeHrvStatus: HrvCoherenceStatus =
    activeHrv >= 50 ? "elevata" : activeHrv >= 28 ? "vigile" : "inibita";

  // Gestione dell'audio procedurale in tempo reale legato allo stato di riproduzione
  useEffect(() => {
    if (engine.playing && !muted) {
      startProceduralHeartbeat(activeBpm, metrics.intensity);
      setHeartbeatBpm(activeBpm, metrics.intensity);
    } else {
      stopProceduralHeartbeat();
    }
    if (engine.playing && isDeepWorkAmbienceActive()) {
      modulateDeepWorkByBpm(activeBpm);
    }
  }, [engine.playing, activeBpm, metrics.intensity, muted]);

  // Pulizia all'unmount
  useEffect(() => {
    return () => {
      stopProceduralHeartbeat();
    };
  }, []);

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    synestheticClick();
    const nextMuted = !muted;
    setMuted(nextMuted);
    setHeartbeatSoundMuted(nextMuted);
  };

  const pulsePeriod = (60 / Math.max(45, activeBpm)).toFixed(2);

  return (
    <div
      className="btm-bio-telemetry-hud"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 32,
        padding: "0 10px",
        borderRadius: 6,
        background: metrics.bgRgba,
        border: `1px solid ${metrics.borderRgba}`,
        color: metrics.color,
        transition: "all 0.25s ease",
        userSelect: "none",
      }}
      title={`Bio-Telemetria Forgia: ${activeBpm} BPM · HRV ${activeHrv} ms · ${metrics.proximityDetail}`}
      role="status"
      aria-label={`Bio-telemetria cardiaca operativa: ${activeBpm} BPM, HRV ${activeHrv} ms`}
    >
      <style>{`
        @keyframes btmHeartPulse {
          0% { transform: scale(1); opacity: 0.85; }
          15% { transform: scale(1.24); opacity: 1; filter: drop-shadow(0 0 4px currentColor); }
          28% { transform: scale(1.05); opacity: 0.9; }
          42% { transform: scale(1.18); opacity: 1; filter: drop-shadow(0 0 3px currentColor); }
          70% { transform: scale(1); opacity: 0.85; }
          100% { transform: scale(1); opacity: 0.85; }
        }
      `}</style>

      {/* Icona Cardiaca Pulsante */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: engine.playing ? `btmHeartPulse ${pulsePeriod}s ease-in-out infinite` : "none",
        }}
      >
        {metrics.status === "critical" || metrics.status === "unprotected" ? (
          <ShieldAlert size={14} className="text-[#ef4444]" />
        ) : metrics.status === "profit" ? (
          <Sparkles size={14} className="text-[#E8C56A]" />
        ) : (
          <Heart size={14} fill={metrics.color} strokeWidth={1.5} />
        )}
      </div>

      {/* Frequenza Cardiaca & Badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          className="whitespace-nowrap font-mono text-xs font-bold tracking-tight"
          style={{ minWidth: 46 }}
        >
          {activeBpm} <span style={{ fontSize: 9, opacity: 0.8 }}>BPM</span>
        </span>

        {/* Micro-telemetria Coerenza HRV RMSSD */}
        <div
          className="whitespace-nowrap font-mono text-[9px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
          style={{
            background: "rgba(0, 0, 0, 0.45)",
            border: `1px solid ${
              activeHrvStatus === "elevata"
                ? "rgba(16, 185, 129, 0.4)"
                : activeHrvStatus === "vigile"
                ? "rgba(197, 160, 89, 0.4)"
                : "rgba(239, 68, 68, 0.45)"
            }`,
            color:
              activeHrvStatus === "elevata"
                ? "#10b981"
                : activeHrvStatus === "vigile"
                ? "#E8C56A"
                : "#ef4444",
          }}
          title={`Coerenza Autonomica HRV RMSSD: ${activeHrv} ms (${
            activeHrvStatus === "elevata"
              ? "Alta Coerenza · Parasimpatico Ottimale"
              : activeHrvStatus === "vigile"
              ? "Vigilanza Attiva"
              : "Inibizione Vagale · Tono Simpatico"
          })${watch.isLive ? " [Live Smartwatch]" : " [Modellata]"}`}
        >
          <Activity size={10} className="shrink-0" />
          <span>
            <span className="opacity-75 text-[8px] mr-0.5">HRV</span>
            <span className="font-bold">{activeHrv}</span>
            <span className="opacity-75 text-[8px] ml-0.5">ms</span>
          </span>
        </div>

        <span
          className="whitespace-nowrap font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded"
          style={{
            background: "rgba(0, 0, 0, 0.4)",
            border: `1px solid ${metrics.borderRgba}`,
            color: metrics.color,
          }}
        >
          {metrics.label}
        </span>

        {/* Micro-distanza in pips */}
        <span
          className="whitespace-nowrap font-mono text-[10px] hidden sm:inline"
          style={{ opacity: 0.85 }}
        >
          {metrics.proximityDetail}
        </span>
      </div>

      {/* Interruttore Audio Bio-Telemetrico */}
      <button
        type="button"
        onClick={toggleSound}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          color: muted ? "rgba(148, 163, 184, 0.45)" : metrics.color,
          padding: 2,
          cursor: "pointer",
          marginLeft: 2,
        }}
        title={muted ? "Abilita audio battito cardiaco" : "Silenzia audio battito cardiaco"}
        aria-label={muted ? "Abilita audio battito cardiaco" : "Silenzia audio battito cardiaco"}
      >
        {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
      </button>
    </div>
  );
}
