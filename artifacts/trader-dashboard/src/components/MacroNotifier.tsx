import { useEffect, useRef } from "react";
import { useGetEconomicCalendar, useGetUserSettings } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { deliverBrowserNotification, getNotificationCopy, shouldNotifyOnce } from "@/lib/notifications";

function eventTimestamp(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function eventKey(event: { id?: string | number; date?: string | null; title?: string; country?: string }): string {
  return String(event.id ?? `${event.date ?? "unknown"}:${event.country ?? ""}:${event.title ?? ""}`)
    .toLowerCase()
    .replace(/[^a-z0-9:-]+/g, "-");
}

export function MacroNotifier() {
  const { data: settings } = useGetUserSettings();
  const { data: events } = useGetEconomicCalendar();
  const { toast } = useToast();
  const { language } = useLanguage();
  const push = usePushNotifications();
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (!events || !settings || !push.prefs.macroEvents) return;

    const now = Date.now();
    const preMins = settings.preMacroMinutes ?? 15;
    const copy = getNotificationCopy(language);
    const highImpact = events
      .filter((event) => event.impact === "High")
      .map((event) => ({ event, timestamp: eventTimestamp(event.date) }))
      .filter((entry): entry is { event: typeof events[number]; timestamp: number } => entry.timestamp !== null)
      .filter(({ timestamp }) => timestamp >= now && timestamp - now <= 24 * 60 * 60 * 1000);

    for (const { event, timestamp } of highImpact) {
      const fireAt = timestamp - preMins * 60_000;
      const delay = Math.max(0, fireAt - now);
      const timer = setTimeout(() => {
        const key = `macro:${eventKey(event)}`;
        if (!shouldNotifyOnce(localStorage, key, new Date(), 20 * 60 * 60 * 1000)) return;

        const label = `${event.country ? `${event.country}: ` : ""}${event.title ?? "High impact"}`;
        const body = copy.messages.macroEvents(1, label);

        void deliverBrowserNotification({
          title: copy.titles.macroAlert,
          body,
          tag: `macro-${eventKey(event)}`,
          showToast: () => toast({
            title: copy.titles.macroAlert,
            description: body,
            duration: 10000,
          }),
        });
      }, delay);
      timersRef.current.push(timer);
    }

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [events, settings, toast, language, push.prefs.macroEvents]);

  return null;
}
