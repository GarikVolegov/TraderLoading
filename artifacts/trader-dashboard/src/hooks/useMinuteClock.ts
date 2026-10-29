import { useEffect, useState } from "react";

export function msUntilNextMinute(nowMs: number): number {
  const remainder = ((nowMs % 60_000) + 60_000) % 60_000;
  const delay = 60_000 - remainder + 50;
  return Math.max(1_000, Math.min(60_050, delay));
}

export function isSameMinute(a: Date, b: Date): boolean {
  return Math.floor(a.getTime() / 60_000) === Math.floor(b.getTime() / 60_000);
}

type ClockListener = (now: Date) => void;

const listeners = new Set<ClockListener>();
let currentMinuteDate = new Date();
let timerId: ReturnType<typeof setTimeout> | null = null;
let visibilityAttached = false;

function broadcastIfMinuteChanged() {
  const next = new Date();
  if (!isSameMinute(currentMinuteDate, next)) {
    currentMinuteDate = next;
    for (const listener of listeners) {
      listener(currentMinuteDate);
    }
  }
}

function scheduleNextTick() {
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
  if (listeners.size === 0 || typeof window === "undefined") {
    return;
  }
  const delay = msUntilNextMinute(Date.now());
  timerId = setTimeout(() => {
    timerId = null;
    broadcastIfMinuteChanged();
    scheduleNextTick();
  }, delay);
}

function onVisibilityChange() {
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    broadcastIfMinuteChanged();
    scheduleNextTick();
  }
}

function subscribeClock(listener: ClockListener): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") {
    currentMinuteDate = new Date();
    scheduleNextTick();
    if (!visibilityAttached && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
      visibilityAttached = true;
    }
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (visibilityAttached && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        visibilityAttached = false;
      }
    }
  };
}

/**
 * Shared singleton clock that updates subscribers strictly once per minute at the :00
 * boundary (and immediately on tab resume if the minute advanced while backgrounded).
 * Eliminates redundant 10s/15s/30s intervals across TopNav, BottomNav and SessionStartNotifier.
 */
export function useMinuteClock(): Date {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    setNow((prev) => {
      const fresh = new Date();
      return isSameMinute(prev, fresh) ? prev : fresh;
    });
    return subscribeClock(setNow);
  }, []);

  return now;
}
