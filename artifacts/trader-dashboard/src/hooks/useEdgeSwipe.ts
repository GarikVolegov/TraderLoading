import { useCallback, useRef } from "react";
import { synestheticSwipe } from "@/lib/soundFx";

export interface SwipeResolutionInput {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  minDistance?: number;
  ratio?: number;
  isEdge?: "left" | "right" | null;
}

/**
 * Pure calculation to determine if a gesture qualifies as a valid horizontal swipe.
 * Avoids false triggers during vertical scroll by checking dx vs dy ratio.
 */
export function resolveSwipeGesture({
  startX,
  startY,
  endX,
  endY,
  minDistance = 44,
  ratio = 1.25,
}: SwipeResolutionInput): "left" | "right" | null {
  const dx = endX - startX;
  const dy = endY - startY;

  if (Math.abs(dx) > minDistance && Math.abs(dx) > Math.abs(dy) * ratio) {
    return dx < 0 ? "left" : "right";
  }
  return null;
}

export interface UseEdgeSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  edgeThreshold?: number; // Distance in px from bezel edge to qualify as edge touch (default 36)
  minDistance?: number;   // Minimum horizontal distance required to trigger swipe (default 44)
  ratio?: number;         // Ratio of dx to dy to prevent firing during vertical scroll (default 1.25)
  disabled?: boolean;
  soundEnabled?: boolean; // Play subtle synesthetic swipe effect on trigger (default true)
}

export function useEdgeSwipe({
  onSwipeLeft,
  onSwipeRight,
  edgeThreshold = 36,
  minDistance = 44,
  ratio = 1.25,
  disabled = false,
  soundEnabled = true,
}: UseEdgeSwipeOptions) {
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isEdgeTouchRef = useRef<"left" | "right" | null>(null);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const clientX = touch.clientX;
      const clientY = touch.clientY;
      const windowWidth = typeof window !== "undefined" ? window.innerWidth : 400;

      const isLeftEdge = clientX <= edgeThreshold;
      const isRightEdge = clientX >= windowWidth - edgeThreshold;
      isEdgeTouchRef.current = isLeftEdge ? "left" : isRightEdge ? "right" : null;

      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [data-prevent-swipe]")) return;

      // Allow bezel edge swipes even when touching interactive canvas elements
      if (target?.closest("canvas") && !isLeftEdge && !isRightEdge) return;

      touchStartXRef.current = clientX;
      touchStartYRef.current = clientY;
    },
    [disabled, edgeThreshold],
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || touchStartXRef.current === null || touchStartYRef.current === null) return;
      if (e.changedTouches.length !== 1) {
        touchStartXRef.current = null;
        touchStartYRef.current = null;
        isEdgeTouchRef.current = null;
        return;
      }

      const startX = touchStartXRef.current;
      const startY = touchStartYRef.current;
      const isEdge = isEdgeTouchRef.current;

      touchStartXRef.current = null;
      touchStartYRef.current = null;
      isEdgeTouchRef.current = null;

      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [data-prevent-swipe]")) return;
      if (target?.closest("canvas") && !isEdge) return;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;

      const gesture = resolveSwipeGesture({
        startX,
        startY,
        endX,
        endY,
        minDistance,
        ratio,
        isEdge,
      });

      if (gesture === "left" && onSwipeLeft) {
        if (soundEnabled) synestheticSwipe();
        onSwipeLeft();
      } else if (gesture === "right" && onSwipeRight) {
        if (soundEnabled) synestheticSwipe();
        onSwipeRight();
      }
    },
    [disabled, minDistance, onSwipeLeft, onSwipeRight, ratio, soundEnabled],
  );

  return {
    onTouchStart,
    onTouchEnd,
  };
}
