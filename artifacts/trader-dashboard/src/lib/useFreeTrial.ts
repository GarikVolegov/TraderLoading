import { useEffect, useState, useTransition } from "react";
import { useBillingStatus, startTrial as apiStartTrial } from "./billingApi";

export const FREE_TRIAL_STORAGE_KEY = "tl_free_trial_state_v1";
export const FREE_TRIAL_DURATION_MS = 24 * 60 * 60 * 1000; // 24 ore

export interface FreeTrialRecord {
  isActive: boolean;
  startedAt: number;
  expiresAt: number;
  plan: "trial_1_day";
  monthlyPrice: number;
}

/**
 * Start the 1-day free trial (24h validity).
 * Persists in local storage for instant guest/candidate access and attempts server sync.
 */
export function startFreeTrial(): FreeTrialRecord {
  const now = Date.now();
  const record: FreeTrialRecord = {
    isActive: true,
    startedAt: now,
    expiresAt: now + FREE_TRIAL_DURATION_MS,
    plan: "trial_1_day",
    monthlyPrice: 150,
  };

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(FREE_TRIAL_STORAGE_KEY, JSON.stringify(record));
      window.dispatchEvent(new CustomEvent("tl:trial-state-changed", { detail: record }));
    } catch {
      // Storage resilient
    }
  }

  // Attempt server synchronization in background if user is authenticated
  apiStartTrial().catch(() => {
    // Non-blocking for unauthenticated candidates
  });

  return record;
}

/**
 * Read the current active free trial from localStorage. Returns null if missing or expired.
 */
export function getStoredFreeTrial(): FreeTrialRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FREE_TRIAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "expiresAt" in parsed &&
      typeof (parsed as FreeTrialRecord).expiresAt === "number"
    ) {
      const record = parsed as FreeTrialRecord;
      if (Date.now() < record.expiresAt) {
        return { ...record, isActive: true };
      }
      // Expired: cleanup
      window.localStorage.removeItem(FREE_TRIAL_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent("tl:trial-state-changed", { detail: null }));
    }
  } catch {
    // Storage read fallback
  }
  return null;
}

export function isFreeTrialActive(): boolean {
  return getStoredFreeTrial() !== null;
}

export function clearFreeTrial(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(FREE_TRIAL_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent("tl:trial-state-changed", { detail: null }));
    } catch {
      // Storage cleanup fallback
    }
  }
}

export function formatTrialRemaining(expiresAt: number | null): string {
  if (!expiresAt) return "0h 0m";
  const diff = Math.max(0, expiresAt - Date.now());
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}h ${minutes}m`;
}

/**
 * React hook to observe trial status across client storage and server billing state.
 */
export function useFreeTrial() {
  const billing = useBillingStatus();
  const [localTrial, setLocalTrial] = useState<FreeTrialRecord | null>(() => getStoredFreeTrial());
  const [, startTransition] = useTransition();

  useEffect(() => {
    const handleUpdate = () => {
      startTransition(() => {
        setLocalTrial(getStoredFreeTrial());
      });
    };
    window.addEventListener("tl:trial-state-changed", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    const interval = window.setInterval(handleUpdate, 15000);

    return () => {
      window.removeEventListener("tl:trial-state-changed", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
      window.clearInterval(interval);
    };
  }, []);

  const isServerTrial =
    billing.data?.isTrial === true ||
    billing.data?.status === "trialing" ||
    billing.data?.source === "trial_1_day";

  const isLocalActive = localTrial !== null && Date.now() < localTrial.expiresAt;
  const isFreeTrial = isLocalActive || isServerTrial;

  const effectiveExpiresAt =
    localTrial?.expiresAt ??
    (billing.data?.currentPeriodEnd ? new Date(billing.data.currentPeriodEnd).getTime() : null);

  const remainingTime = formatTrialRemaining(effectiveExpiresAt);

  return {
    isFreeTrial,
    remainingTime,
    expiresAt: effectiveExpiresAt,
    startTrial: startFreeTrial,
    clearTrial: clearFreeTrial,
  };
}
