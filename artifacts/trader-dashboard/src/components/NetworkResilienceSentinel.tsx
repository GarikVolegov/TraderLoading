import React, { useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WifiOff, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

export function NetworkResilienceSentinel() {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  });
  const [showRestored, setShowRestored] = useState(false);
  const wasOfflineRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        setShowRestored(true);

        // Scaglionamento intelligente: ricarica solo le query attive a schermo
        // evitando il Thundering Herd su tabelle e viste non visualizzate
        try {
          void queryClient.invalidateQueries({ refetchType: "active" });
        } catch {
          // Guard against queryClient teardown
        }

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setShowRestored(false);
        }, 3200);
      }
    }

    function handleOffline() {
      setIsOnline(false);
      wasOfflineRef.current = true;
      setShowRestored(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [queryClient]);

  if (isOnline && !showRestored) {
    return null;
  }

  const isRestored = isOnline && showRestored;

  return (
    <aside
      role="status"
      aria-live="polite"
      className={cn(
        "fixed top-2.5 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto",
        "flex items-center gap-2 px-3.5 py-1.5 rounded-full border shadow-2xl backdrop-blur-md select-none transition-all duration-300",
        isRestored
          ? "bg-[#07080b]/95 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.25)] text-emerald-400"
          : "bg-[#07080b]/95 border-destructive/60 shadow-[0_0_20px_rgba(239,68,68,0.25)] text-destructive",
      )}
    >
      <div className="relative flex items-center justify-center">
        {isRestored ? (
          <>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <Wifi size={13} className="ml-1 text-emerald-400" />
          </>
        ) : (
          <>
            <span className="absolute h-2 w-2 rounded-full bg-destructive animate-ping opacity-75" />
            <span className="relative h-2 w-2 rounded-full bg-destructive" />
            <WifiOff size={13} className="ml-1 text-destructive" />
          </>
        )}
      </div>

      <span className="font-mono text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
        {isRestored
          ? "Sincronizzazione Ripristinata · Telemetria Attiva"
          : "Modalità Offline · Riconnessione in corso..."}
      </span>
    </aside>
  );
}
