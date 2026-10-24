import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Shield } from "lucide-react";
import type { BrotherhoodSceneController } from "./brotherhoodSceneEngine";

export function BrotherhoodMonolithScene() {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<BrotherhoodSceneController | null>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const element = hostRef.current;
    if (!element) return;

    void import("./brotherhoodSceneEngine")
      .then(({ createBrotherhoodScene }) => {
        if (cancelled) return;
        controllerRef.current = createBrotherhoodScene(element, reducedMotion, () => {
          if (!cancelled) {
            setReady(false);
            setFailed(true);
          }
        });
        if (controllerRef.current) setReady(true);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, [reducedMotion]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!controllerRef.current || !hostRef.current) return;
    const rect = hostRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5; // -0.5 to 0.5
    controllerRef.current.setTargetAngles(x * 0.9, -y * 0.6);
  };

  const handlePointerLeave = () => {
    controllerRef.current?.setTargetAngles(0, 0);
  };

  return (
    <div
      className="relative w-full h-[240px] sm:h-[290px] flex items-center justify-center overflow-hidden select-none"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {/* Ambient background radial glow */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(197,160,89,0.12)_0%,rgba(10,11,16,0)_70%)]"
      />

      {/* 3D Canvas Host */}
      <div
        ref={hostRef}
        className={`w-full h-full cursor-grab active:cursor-grabbing transition-opacity duration-700 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Fallback in case WebGL is disabled or fails */}
      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
          <div className="h-16 w-16 rounded-2xl border border-[#C5A059]/40 bg-gradient-to-br from-[#1A1812] to-[#0A0A0C] flex items-center justify-center text-[#C5A059] shadow-[0_0_30px_rgba(197,160,89,0.25)]">
            <Shield className="h-8 w-8 text-[#C5A059]" />
          </div>
        </div>
      )}
    </div>
  );
}
