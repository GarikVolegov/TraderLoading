import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { synestheticAlert } from "@/lib/soundFx";
import {
  loadStoredAlerts,
  saveStoredAlerts,
  isPriceAlertTriggered,
  type ReplayPriceAlert,
} from "@/lib/replay/alertModel";
import { formatPrice } from "./format";
import type { ReplayEngine } from "./useReplayEngine";

export function useReplayAlerts({
  engine,
  sessionKey = "varco",
  symbol: customSymbol,
  currentBar: customCurrentBar,
  isPlaying: customIsPlaying,
  onPause: customOnPause,
}: {
  engine?: ReplayEngine;
  sessionKey?: string;
  symbol?: string;
  currentBar?: { time: number; high: number; low: number; open: number; close: number } | null;
  isPlaying?: boolean;
  onPause?: () => void;
}) {
  const activeSymbol = customSymbol ?? engine?.symbol ?? "EURUSD";
  const activeCurrentBar = customCurrentBar !== undefined ? customCurrentBar : engine?.currentBar ?? null;
  const activeIsPlaying = customIsPlaying !== undefined ? customIsPlaying : engine?.playing ?? false;
  const activeStop = customOnPause ?? (engine ? () => engine.stop() : undefined);

  const { toast } = useToast();
  const [alerts, setAlerts] = useState<ReplayPriceAlert[]>(() =>
    loadStoredAlerts(sessionKey, activeSymbol),
  );

  const prevCloseRef = useRef<number | null>(null);
  const lastCheckedBarTimeRef = useRef<number | null>(null);

  // Sync state on session or symbol change
  useEffect(() => {
    setAlerts(loadStoredAlerts(sessionKey, activeSymbol));
    prevCloseRef.current = null;
    lastCheckedBarTimeRef.current = null;
  }, [sessionKey, activeSymbol]);

  // Persist whenever alerts change
  const persistAlerts = useCallback(
    (newAlerts: ReplayPriceAlert[]) => {
      setAlerts(newAlerts);
      saveStoredAlerts(sessionKey, activeSymbol, newAlerts);
    },
    [sessionKey, activeSymbol],
  );

  const createAlert = useCallback(
    (price: number, options?: Partial<ReplayPriceAlert>) => {
      const cleanPrice = Number(price.toFixed(5));
      const newAlert: ReplayPriceAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        symbol: activeSymbol,
        price: cleanPrice,
        createdAt: Date.now(),
        status: "active",
        condition: options?.condition ?? "crossing",
        pauseReplay: options?.pauseReplay ?? true,
        label: options?.label,
      };

      const updated = [...alerts, newAlert];
      persistAlerts(updated);

      toast({
        title: `Allerta Impostata a ${formatPrice(cleanPrice, activeSymbol)}`,
        description: `Segnale acustico e notifica attivati al raggiungimento del livello.`,
      });

      return newAlert;
    },
    [alerts, activeSymbol, persistAlerts, toast],
  );

  const removeAlert = useCallback(
    (id: string) => {
      const updated = alerts.filter((a) => a.id !== id);
      persistAlerts(updated);
    },
    [alerts, persistAlerts],
  );

  const updateAlertPrice = useCallback(
    (id: string, newPrice: number) => {
      const cleanPrice = Number(newPrice.toFixed(5));
      const updated = alerts.map((a) =>
        a.id === id ? { ...a, price: cleanPrice, status: "active" as const } : a,
      );
      persistAlerts(updated);
    },
    [alerts, persistAlerts],
  );

  const toggleAlert = useCallback(
    (id: string) => {
      const updated = alerts.map((a) =>
        a.id === id
          ? {
              ...a,
              status:
                a.status === "active"
                  ? ("disabled" as const)
                  : ("active" as const),
            }
          : a,
      );
      persistAlerts(updated);
    },
    [alerts, persistAlerts],
  );

  const clearAllAlerts = useCallback(() => {
    persistAlerts([]);
  }, [persistAlerts]);

  // ── Monitoraggio Replay / Live: Verifica Incrocio Candela Corrente ──
  useEffect(() => {
    const bar = activeCurrentBar;
    if (!bar) return;

    // Check bar only once per time tick
    if (lastCheckedBarTimeRef.current === bar.time) {
      prevCloseRef.current = bar.close;
      return;
    }
    lastCheckedBarTimeRef.current = bar.time;

    let anyTriggered = false;
    let shouldPauseReplay = false;

    const nextAlerts = alerts.map((alert) => {
      if (alert.status !== "active") return alert;

      const triggered = isPriceAlertTriggered(alert, bar, prevCloseRef.current);
      if (triggered) {
        anyTriggered = true;
        if (alert.pauseReplay) {
          shouldPauseReplay = true;
        }

        // Fire audio and toast
        synestheticAlert();
        toast({
          title: `🔔 Allerta Raggiunta: ${activeSymbol} a ${formatPrice(alert.price, activeSymbol)}`,
          description: `Il prezzo ha incrociato il livello impostato (${alert.label || "Alert Grafico"}).`,
        });

        return {
          ...alert,
          status: "triggered" as const,
          lastTriggeredAt: bar.time,
        };
      }
      return alert;
    });

    prevCloseRef.current = bar.close;

    if (anyTriggered) {
      persistAlerts(nextAlerts);
      if (shouldPauseReplay && activeIsPlaying && activeStop) {
        activeStop();
      }
    }
  }, [
    activeCurrentBar,
    activeIsPlaying,
    activeSymbol,
    activeStop,
    alerts,
    persistAlerts,
    toast,
  ]);

  const activeAlerts = alerts.filter((a) => a.status === "active");

  return {
    alerts,
    activeAlerts,
    activeCount: activeAlerts.length,
    createAlert,
    removeAlert,
    updateAlertPrice,
    toggleAlert,
    clearAllAlerts,
  };
}

export type ReplayAlertsApi = ReturnType<typeof useReplayAlerts>;
