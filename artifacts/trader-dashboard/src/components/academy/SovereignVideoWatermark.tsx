import React, { useMemo } from "react";

export interface SovereignVideoWatermarkProps {
  operatorName?: string;
  operatorId?: string;
  activeLessonTitle?: string;
  enabled?: boolean;
}

/**
 * SovereignVideoWatermark — AUREUS PROTOCOL Anti-Piracy Visual Sentinel.
 * Drifts slowly across the proprietary video canvas to defeat crop-and-screen-recording
 * attacks while maintaining full click/tap pass-through (`pointer-events: none`).
 */
export function SovereignVideoWatermark({
  operatorName = "Iniziato Aureus",
  operatorId = "OP-PROTO-01",
  activeLessonTitle,
  enabled = true,
}: SovereignVideoWatermarkProps) {
  if (!enabled) return null;

  // Short deterministic session verification digest
  const watermarkDigest = useMemo(() => {
    const raw = `${operatorId}-${new Date().toISOString().slice(0, 10)}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
  }, [operatorId]);

  return (
    <div
      className="sovereign-watermark-overlay absolute inset-0 pointer-events-none select-none overflow-hidden z-20"
      aria-hidden="true"
    >
      <style>{`
        @keyframes aureusWatermarkDrift {
          0% {
            top: 8%;
            left: 8%;
          }
          25% {
            top: 18%;
            left: 55%;
          }
          50% {
            top: 62%;
            left: 48%;
          }
          75% {
            top: 55%;
            left: 12%;
          }
          100% {
            top: 8%;
            left: 8%;
          }
        }
        .aureus-watermark-drift {
          animation: aureusWatermarkDrift 50s ease-in-out infinite;
        }
      `}</style>

      {/* Floating Orbital Watermark (subtle, non-intrusive, anti-rip) */}
      <div className="absolute aureus-watermark-drift max-w-[260px] p-2 rounded border border-[#C5A059]/25 bg-[#07080b]/40 backdrop-blur-[1px] opacity-25 shadow-lg">
        <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase font-bold text-[#E8C56A] tracking-wider whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C5A059] animate-pulse shrink-0" />
          <span>AUREUS PROTOCOL · DOTTRINA</span>
        </div>
        <div className="font-mono text-[8px] text-slate-300 truncate mt-0.5 whitespace-nowrap">
          {operatorName} · {operatorId.slice(0, 12)}
        </div>
        <div className="font-mono text-[7.5px] text-[#C5A059]/80 mt-0.5 whitespace-nowrap">
          SIGILLO #{watermarkDigest}
        </div>
      </div>

      {/* Static Security Perimeter Badges */}
      <div className="absolute top-2 right-2.5 font-mono text-[8px] tracking-widest text-[#E8C56A]/20 uppercase whitespace-nowrap">
        AUREUS • {operatorId.slice(-6)}
      </div>

      <div className="absolute bottom-2 left-2.5 font-mono text-[7.5px] tracking-wider text-slate-400/25 uppercase whitespace-nowrap">
        PROPRIETARY DOCTRINE · {watermarkDigest}
      </div>
    </div>
  );
}
