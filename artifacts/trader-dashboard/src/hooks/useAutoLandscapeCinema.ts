/**
 * AUREUS PROTOCOL — Auto-Landscape Pivot & Fullscreen Cinema Mode Hook
 *
 * Rileva in tempo reale la rotazione dello smartphone in orizzontale (Landscape),
 * attivando l'esperienza a schermo intero senza barre di sistema (TradingView-like)
 * con ergonomia ottimizzata per i pollici e trigger acustico-aptico sincronizzato.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { synestheticCinemaToggle } from "@/lib/soundFx";

export interface AutoLandscapeCinemaOptions {
  /** Query breakpoint. Default: smartphone/compact foldables in landscape */
  query?: string;
  /** Callback invocato al cambio di stato */
  onCinemaChange?: (isActive: boolean) => void;
  /** Abilita feedback sinestetico (audio + aptico) */
  enableAudioFeedback?: boolean;
}

export function useAutoLandscapeCinema(options?: AutoLandscapeCinemaOptions) {
  const query =
    options?.query ??
    "(orientation: landscape) and (max-height: 640px) and (max-width: 1024px)";
  const enableAudio = options?.enableAudioFeedback ?? true;

  const [isLandscape, setIsLandscape] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    try {
      return window.matchMedia(query).matches;
    } catch {
      return false;
    }
  });

  const [manualCinema, setManualCinema] = useState<boolean>(false);
  const wasLandscapeRef = useRef<boolean>(isLandscape);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(query);
    } catch {
      return;
    }

    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      const matches = Boolean(e.matches);
      setIsLandscape(matches);
      if (matches !== wasLandscapeRef.current) {
        wasLandscapeRef.current = matches;
        if (enableAudio) {
          synestheticCinemaToggle(matches);
        }
        options?.onCinemaChange?.(matches);
      }
    };

    handler(mq);

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", handler);
    } else if (typeof (mq as any).addListener === "function") {
      (mq as any).addListener(handler);
    }

    // Supporto per ScreenOrientation API nativo (Safari iOS 16.4+, Android Chrome)
    const handleScreenOrientation = () => {
      handler(mq);
    };
    if (typeof window !== "undefined" && window.screen?.orientation) {
      try {
        window.screen.orientation.addEventListener("change", handleScreenOrientation);
      } catch {}
    }

    return () => {
      if (typeof mq.removeEventListener === "function") {
        mq.removeEventListener("change", handler);
      } else if (typeof (mq as any).removeListener === "function") {
        (mq as any).removeListener(handler);
      }
      if (typeof window !== "undefined" && window.screen?.orientation) {
        try {
          window.screen.orientation.removeEventListener("change", handleScreenOrientation);
        } catch {}
      }
    };
  }, [query, enableAudio, options]);

  const toggleManualCinema = useCallback(
    (forcedState?: boolean) => {
      setManualCinema((prev) => {
        const next = typeof forcedState === "boolean" ? forcedState : !prev;
        if (enableAudio) {
          synestheticCinemaToggle(next);
        }
        return next;
      });
    },
    [enableAudio]
  );

  const exitCinema = useCallback(() => {
    setManualCinema(false);
    setIsLandscape(false);
    if (enableAudio) {
      synestheticCinemaToggle(false);
    }
  }, [enableAudio]);

  const isCinemaActive = isLandscape || manualCinema;

  return {
    isLandscape,
    manualCinema,
    isCinemaActive,
    setManualCinema,
    toggleManualCinema,
    exitCinema,
  };
}
