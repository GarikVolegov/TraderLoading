// ─── LimenPullToRefresh (Tactile Mobile Pull-to-Refresh with Sovereign Feedback) ──
// Canonical mobile refresh interaction for AUREUS OS:
// - Seamless touch gesture detection with natural spring resistance.
// - Tactile gold seal indicator with progressive rotation and haptic trigger.
// - Zero interference with standard vertical scroll when container is scrolled.

import React, { useState, useRef, useCallback } from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { hapticLight, hapticSuccess } from "@/lib/haptics.js";
import { synestheticClick } from "@/lib/soundFx";

export interface LimenPullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  threshold?: number;
  maxPull?: number;
}

export function LimenPullToRefresh({
  onRefresh,
  children,
  disabled = false,
  className = "",
  threshold = 56,
  maxPull = 88,
}: LimenPullToRefreshProps) {
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const thresholdPassedRef = useRef(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || isRefreshing || e.touches.length !== 1) return;

      const container = containerRef.current;
      // Only initiate pull-to-refresh if container is at the very top (scrollTop <= 0)
      if (container && container.scrollTop > 0) return;

      touchStartYRef.current = e.touches[0].clientY;
      isPullingRef.current = false;
      thresholdPassedRef.current = false;
    },
    [disabled, isRefreshing],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || isRefreshing || touchStartYRef.current === null) return;

      const container = containerRef.current;
      if (container && container.scrollTop > 0) {
        touchStartYRef.current = null;
        setPullY(0);
        return;
      }

      const currentY = e.touches[0].clientY;
      const rawDy = currentY - touchStartYRef.current;

      if (rawDy > 0) {
        isPullingRef.current = true;
        // Non-linear dampening resistance curve
        const dampened = Math.min(maxPull, Math.pow(rawDy, 0.82) * 2.2);
        setPullY(dampened);

        // Tactile haptic feedback once threshold is crossed
        if (dampened >= threshold && !thresholdPassedRef.current) {
          thresholdPassedRef.current = true;
          hapticLight();
        } else if (dampened < threshold && thresholdPassedRef.current) {
          thresholdPassedRef.current = false;
        }
      } else {
        setPullY(0);
      }
    },
    [disabled, isRefreshing, maxPull, threshold],
  );

  const handleTouchEnd = useCallback(async () => {
    if (disabled || isRefreshing || touchStartYRef.current === null) return;

    touchStartYRef.current = null;

    if (pullY >= threshold) {
      setIsRefreshing(true);
      setPullY(threshold);
      synestheticClick();

      try {
        await Promise.resolve(onRefresh());
        hapticSuccess();
      } catch {
        // Refresh error handled silently by TanStack or internal toast
      } finally {
        setIsRefreshing(false);
        setPullY(0);
      }
    } else {
      setPullY(0);
    }
    isPullingRef.current = false;
  }, [disabled, isRefreshing, onRefresh, pullY, threshold]);

  const progress = Math.min(1, pullY / threshold);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative overflow-y-auto ${className}`}
    >
      {/* ── Visual Refresh Pill / Indicator ── */}
      <div
        className="pointer-events-none absolute left-0 right-0 flex items-center justify-center transition-all duration-200 z-30"
        style={{
          top: 0,
          transform: `translateY(${pullY - 42}px)`,
          opacity: pullY > 12 ? Math.min(1, (pullY - 12) / 24) : 0,
        }}
      >
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#07080b]/95 border border-[#C5A059]/50 shadow-[0_4px_16px_rgba(0,0,0,0.85),0_0_12px_rgba(197,160,89,0.2)] backdrop-blur-md">
          {isRefreshing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 text-[#E8C56A] animate-spin" />
              <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-[#E8C56A]">
                Sincronizzazione...
              </span>
            </>
          ) : (
            <>
              <ArrowDown
                className="w-3.5 h-3.5 text-[#C5A059] transition-transform duration-150"
                style={{
                  transform: `rotate(${progress >= 1 ? 180 : progress * 180}deg)`,
                }}
              />
              <span className="font-mono text-[9px] uppercase tracking-wider text-slate-300 font-semibold">
                {progress >= 1 ? "Rilascia per Sincronizzare" : "Trascina per Aggiornare"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Content Container with Smooth Spring Translate ── */}
      <div
        style={{
          transform: `translateY(${pullY > 0 ? pullY * 0.45 : 0}px)`,
          transition: isPullingRef.current ? "none" : "transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
