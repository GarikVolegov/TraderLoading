import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { deliverBrowserNotification, shouldNotifyOnce } from "@/lib/notifications";

function getNextSundayCouncilTarget(now: Date): { target: Date; dayKey: string; isLive: boolean; diffMs: number } {
  const day = now.getDay(); // 0 = Sunday
  const target = new Date(now);
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  target.setDate(now.getDate() + daysUntilSunday);
  target.setHours(21, 0, 0, 0);

  const diffMs = target.getTime() - now.getTime();
  // Live session: Sunday between 21:00 and 22:30 (90 min)
  if (day === 0 && diffMs <= 0 && diffMs >= -90 * 60 * 1000) {
    return { target, dayKey: target.toISOString().slice(0, 10), isLive: true, diffMs: 0 };
  }

  // If Sunday 21:00 has passed by more than 90 min, roll target to next Sunday
  if (diffMs < -90 * 60 * 1000) {
    target.setDate(target.getDate() + 7);
  }

  const updatedDiffMs = target.getTime() - now.getTime();
  return {
    target,
    dayKey: target.toISOString().slice(0, 10),
    isLive: false,
    diffMs: updatedDiffMs,
  };
}

export function SundayCouncilNotifier() {
  const { toast } = useToast();
  const push = usePushNotifications();
  const now = useMinuteClock();

  useEffect(() => {
    // If notifications are disabled globally or social/sessions prefs are off, skip
    if (!push.ready || (!push.prefs.social && !push.prefs.sessions)) return;

    const { dayKey, isLive, diffMs } = getNextSundayCouncilTarget(now);
    const hoursUntilCouncil = diffMs / (1000 * 60 * 60);

    // 1. LIVE NOW: Domenica dalle 21:00 alle 22:30
    if (isLive) {
      const dedupeKey = `council-notif-live:${dayKey}`;
      if (shouldNotifyOnce(localStorage, dedupeKey, now, 6 * 24 * 60 * 60 * 1000)) {
        const title = "Il Concilio della Domenica · In Sessione";
        const body = "La Convocazione Sovrana dell'Ordine è aperta. Unisciti agli Operatori nelle stanze vocali della Fratellanza.";
        void deliverBrowserNotification({
          title,
          body,
          tag: `council-live-${dayKey}`,
          showToast: () => toast({ title, description: body, duration: 9000 }),
        });
      }
      return;
    }

    // 2. UN GIORNO PRIMA: Sabato sera (tra 20 e 28 ore prima del Concilio)
    if (hoursUntilCouncil > 0 && hoursUntilCouncil <= 28 && hoursUntilCouncil >= 18) {
      const dedupeKey = `council-notif-1day:${dayKey}`;
      if (shouldNotifyOnce(localStorage, dedupeKey, now, 6 * 24 * 60 * 60 * 1000)) {
        const title = "Il Concilio della Domenica · Domani alle 21:00 CET";
        const body = "Mancano 24 ore. Le stanze vocali pubbliche di studio sono attive per confrontarsi e preparare la settimana.";
        void deliverBrowserNotification({
          title,
          body,
          tag: `council-1day-${dayKey}`,
          showToast: () => toast({ title, description: body, duration: 8000 }),
        });
      }
      return;
    }

    // 3. DUE GIORNI PRIMA: Venerdì sera (tra 44 e 52 ore prima del Concilio)
    if (hoursUntilCouncil > 28 && hoursUntilCouncil <= 52 && hoursUntilCouncil >= 42) {
      const dedupeKey = `council-notif-2days:${dayKey}`;
      if (shouldNotifyOnce(localStorage, dedupeKey, now, 6 * 24 * 60 * 60 * 1000)) {
        const title = "Il Concilio della Domenica · Mancano 2 Giorni";
        const body = "Allinea il Libro della Verità e prepara le mappe grafiche HTF per la prossima settimana.";
        void deliverBrowserNotification({
          title,
          body,
          tag: `council-2days-${dayKey}`,
          showToast: () => toast({ title, description: body, duration: 8000 }),
        });
      }
    }
  }, [now, push.prefs.social, push.prefs.sessions, push.ready, toast]);

  return null;
}
