import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useGetUserSettings } from "@workspace/api-client-react";
import {
  decodeScheduledCallFromLocation,
  isScheduledCallDue,
  parseScheduledCalls,
  type ScheduledCallConfig,
} from "@/lib/scheduledCalls";

const ScheduledCallOverlay = lazy(() =>
  import("./ScheduledCallOverlay").then((m) => ({ default: m.ScheduledCallOverlay })),
);

export function ScheduledCallRuntime() {
  const { data: settings } = useGetUserSettings();
  const [activeCall, setActiveCall] = useState<ScheduledCallConfig | null>(null);
  const firedRef = useRef<Map<string, string>>(new Map());
  const snoozeTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const openedCall = decodeScheduledCallFromLocation(window.location.href);
    if (!openedCall) return;
    setActiveCall(openedCall);
    const url = new URL(window.location.href);
    url.searchParams.delete("scheduledCall");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    const calls = parseScheduledCalls(settings?.alarmConfigs);
    if (calls.length === 0) return;
    const check = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const now = new Date();
      const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}`;
      for (const call of calls) {
        if (!isScheduledCallDue(call, now)) continue;
        const key = `${call.id}:${minuteKey}`;
        if (firedRef.current.get(call.id) === key) continue;
        firedRef.current.set(call.id, key);
        setActiveCall(call);
        break;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    check();
    const timer = setInterval(check, 10_000);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [settings?.alarmConfigs]);

  useEffect(() => {
    return () => {
      snoozeTimersRef.current.forEach(clearTimeout);
      snoozeTimersRef.current = [];
    };
  }, []);

  const handleDismiss = useCallback(() => setActiveCall(null), []);

  const handleSnooze = useCallback((mins: number) => {
    if (!activeCall) return;
    setActiveCall(null);
    const timer = setTimeout(() => setActiveCall({ ...activeCall, snoozeMins: 0 }), Math.max(1, mins) * 60 * 1000);
    snoozeTimersRef.current.push(timer);
  }, [activeCall]);

  if (!activeCall) return null;

  return (
    <Suspense fallback={null}>
      <ScheduledCallOverlay call={activeCall} onDismiss={handleDismiss} onSnooze={handleSnooze} />
    </Suspense>
  );
}
