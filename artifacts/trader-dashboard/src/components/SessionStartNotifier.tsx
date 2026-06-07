import { useEffect, useMemo, useState } from "react";
import { useBackground, type TradingSessionConfig } from "@/contexts/BackgroundContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { getLocalDateKey, isTradingSession, type MarketSessionConfig } from "@/lib/marketSessions";
import { getNotificationCopy, shouldNotifyOnce } from "@/lib/notifications";

function parseTime(time: string): { h: number; m: number } {
  const [h, m] = time.split(":").map(Number);
  return {
    h: Number.isFinite(h) ? h : 0,
    m: Number.isFinite(m) ? m : 0,
  };
}

function sessionsOpeningNow(sessions: TradingSessionConfig[], now: Date): TradingSessionConfig[] {
  const h = now.getHours();
  const m = now.getMinutes();
  return sessions.filter((session) => {
    if (!session.enabled || !isTradingSession(session as MarketSessionConfig)) return false;
    const open = parseTime(session.openUTC);
    return open.h === h && open.m === m;
  });
}

export function SessionStartNotifier() {
  const { tradingSessions } = useBackground();
  const { language } = useLanguage();
  const { toast } = useToast();
  const push = usePushNotifications();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const openingSessions = useMemo(() => sessionsOpeningNow(tradingSessions, now), [tradingSessions, now]);

  useEffect(() => {
    if (!push.ready || push.isSubscribed || !push.prefs.sessions || openingSessions.length === 0) return;

    const copy = getNotificationCopy(language);
    const dayKey = getLocalDateKey(now);

    for (const session of openingSessions) {
      const dedupeKey = `session-open:${session.id ?? session.name}:${dayKey}`;
      if (!shouldNotifyOnce(localStorage, dedupeKey, now, 20 * 60 * 60 * 1000)) continue;

      const title = copy.titles.sessionOpen(session.name);
      const body = copy.messages.sessionOpen;

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, {
          body,
          icon: "/favicon.ico",
          tag: `session-open-${session.id ?? session.name}`,
        });
      } else {
        toast({ title, description: body, duration: 8000 });
      }
    }
  }, [language, now, openingSessions, push.isSubscribed, push.prefs.sessions, push.ready, toast]);

  return null;
}
