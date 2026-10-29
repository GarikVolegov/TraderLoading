import { useMemo } from "react";
import type { ReplayEngine } from "./useReplayEngine";
import { computeReplayTelemetry } from "./ReplayBioTelemetryHUD";
import { isVignetteOverlayEnabled } from "../../lib/soundFx.js";
import { ShieldAlert, Sparkles, AlertTriangle } from "lucide-react";

interface ReplayBiometricVignetteOverlayProps {
  engine: ReplayEngine;
}

export function ReplayBiometricVignetteOverlay({ engine }: ReplayBiometricVignetteOverlayProps) {
  const vignetteEnabled = isVignetteOverlayEnabled();

  const metrics = useMemo(() => {
    return computeReplayTelemetry(
      engine.positions,
      engine.currentPrice,
      engine.symbol,
      engine.openProfit,
    );
  }, [engine.positions, engine.currentPrice, engine.symbol, engine.openProfit]);

  // Se disattivato dalle impostazioni o non c'è tensione critica o profitto imminente,
  // la vignettatura resta completamente inerte e trasparente a zero costo di rendering.
  const isCritical = metrics.status === "critical";
  const isUnprotected = metrics.status === "unprotected";
  const isTargetImminent = metrics.status === "profit";
  const shouldDisplay = vignetteEnabled && (isCritical || isUnprotected || isTargetImminent);

  if (!shouldDisplay) {
    return null;
  }

  const pulsePeriod = (60 / Math.max(45, metrics.bpm)).toFixed(2);

  return (
    <div
      className="btm-biometric-vignette-overlay"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 12,
        overflow: "hidden",
        borderRadius: "inherit",
        transition: "opacity 0.4s ease",
      }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes btmCriticalVignettePulse {
          0%, 100% { opacity: 0.35; }
          30% { opacity: 0.88; }
          60% { opacity: 0.50; }
        }

        @keyframes btmTargetVignettePulse {
          0%, 100% { opacity: 0.30; }
          50% { opacity: 0.78; }
        }

        @keyframes btmUnprotectedStrobe {
          0%, 100% { opacity: 0.40; }
          50% { opacity: 0.92; }
        }
      `}</style>

      {/* Livello Vignettatura Perimetrale (GPU-composited opacity animation) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          willChange: "opacity",
          boxShadow: isCritical
            ? "inset 0 0 65px rgba(239, 68, 68, 0.30), inset 0 0 130px rgba(239, 68, 68, 0.14)"
            : isUnprotected
            ? "inset 0 0 80px rgba(245, 158, 11, 0.32), inset 0 0 140px rgba(239, 68, 68, 0.18)"
            : "inset 0 0 60px rgba(197, 160, 89, 0.26), inset 0 0 120px rgba(197, 160, 89, 0.12)",
          animation: isCritical
            ? `btmCriticalVignettePulse ${pulsePeriod}s ease-in-out infinite`
            : isUnprotected
            ? `btmUnprotectedStrobe 1.2s ease-in-out infinite`
            : `btmTargetVignettePulse 1.8s ease-in-out infinite`,
        }}
      />

      {/* Discreto Pillola Ottica Superiore Centrale */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 12px",
          borderRadius: 20,
          background: "rgba(13, 15, 20, 0.88)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          border: `1px solid ${metrics.borderRgba}`,
          color: metrics.color,
          boxShadow: `0 4px 20px rgba(0, 0, 0, 0.6), 0 0 15px ${metrics.bgRgba}`,
          userSelect: "none",
        }}
      >
        {isCritical ? (
          <ShieldAlert size={13} className="text-[#ef4444] shrink-0 animate-pulse" />
        ) : isUnprotected ? (
          <AlertTriangle size={13} className="text-[#f59e0b] shrink-0 animate-pulse" />
        ) : (
          <Sparkles size={13} className="text-[#E8C56A] shrink-0 animate-pulse" />
        )}

        <span className="font-mono text-[10.5px] font-bold tracking-tight uppercase whitespace-nowrap">
          {metrics.label}
        </span>

        <span className="text-[10px] text-muted-foreground whitespace-nowrap opacity-60">·</span>

        <span className="font-mono text-[10.5px] whitespace-nowrap" style={{ opacity: 0.9 }}>
          {metrics.proximityDetail}
        </span>

        <span
          className="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded whitespace-nowrap"
          style={{
            background: metrics.bgRgba,
            border: `1px solid ${metrics.borderRgba}`,
            color: metrics.color,
          }}
        >
          {metrics.bpm} BPM
        </span>
      </div>
    </div>
  );
}
