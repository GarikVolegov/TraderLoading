import { useEffect, useRef, useState, useCallback } from "react";
import { useGetUserSettings } from "@workspace/api-client-react";
import { AppCallOverlay, type FiringAlarm } from "./AppCallOverlay";

export interface AlarmConfig {
  id: string;
  label: string;
  time: string;            // "HH:MM" local time
  days: number[];          // 0=Sun…6=Sat, empty=every day
  enabled: boolean;
  sound: "digital" | "gentle" | "pulse";
  snoozeMins: number;      // 0=no snooze
}

function parseAlarms(raw: string | null | undefined): AlarmConfig[] {
  if (!raw) return [];
  try { return JSON.parse(raw); }
  catch { return []; }
}

export function AlarmScheduler() {
  const { data: settings } = useGetUserSettings();
  const [firing, setFiring] = useState<FiringAlarm | null>(null);
  const firedRef = useRef<Map<string, string>>(new Map()); // id → "YYYY-MM-DD HH:MM"
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback((alarms: AlarmConfig[]) => {
    const now = new Date();
    const day = now.getDay();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const currentTime = `${hh}:${mm}`;
    const key = `${now.toISOString().slice(0, 10)} ${currentTime}`;

    for (const alarm of alarms) {
      if (!alarm.enabled) continue;
      if (alarm.time !== currentTime) continue;
      if (alarm.days.length > 0 && !alarm.days.includes(day)) continue;
      if (firedRef.current.get(alarm.id) === key) continue;

      firedRef.current.set(alarm.id, key);
      setFiring({
        id: alarm.id,
        label: alarm.label,
        time: alarm.time,
        sound: alarm.sound,
        snoozeMins: alarm.snoozeMins,
      });
      break; // one at a time
    }
  }, []);

  useEffect(() => {
    const alarms = parseAlarms((settings as any)?.alarmConfigs);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => check(alarms), 10_000);
    check(alarms);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [(settings as any)?.alarmConfigs, check]);

  const handleDismiss = () => setFiring(null);

  const handleSnooze = (mins: number) => {
    if (!firing) return;
    const later = new Date(Date.now() + mins * 60 * 1000);
    const hh = String(later.getHours()).padStart(2, "0");
    const mm = String(later.getMinutes()).padStart(2, "0");
    // Re-fire at snooze time by creating a temporary alarm
    const snoozeKey = `${later.toISOString().slice(0, 10)} ${hh}:${mm}`;
    // We remove the fired key so that a modified copy can fire
    firedRef.current.delete(firing.id + "_snooze");
    const snoozeAlarm: AlarmConfig = {
      id: firing.id + "_snooze",
      label: `${firing.label} (snooze)`,
      time: `${hh}:${mm}`,
      days: [],
      enabled: true,
      sound: firing.sound,
      snoozeMins: 0,
    };
    setFiring(null);
    // Schedule it
    setTimeout(() => {
      setFiring({
        id: snoozeAlarm.id,
        label: snoozeAlarm.label,
        time: snoozeAlarm.time,
        sound: snoozeAlarm.sound,
        snoozeMins: 0,
      });
    }, mins * 60 * 1000);
  };

  return (
    <AppCallOverlay alarm={firing} onDismiss={handleDismiss} onSnooze={handleSnooze} />
  );
}
