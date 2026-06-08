import { useEffect, useRef } from "react";
import { useGetUserSettings, useGetMissions } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { getNotificationCopy, shouldNotifyOnce } from "@/lib/notifications";

export function DailyAlarmNotifier() {
  const { data: settings } = useGetUserSettings();
  const { data: missions } = useGetMissions();
  const { toast } = useToast();
  const { language } = useLanguage();
  const push = usePushNotifications();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!settings?.dailyReminderTime || !push.prefs.dailyReminder) return;

    const [h, m] = settings.dailyReminderTime.split(":").map(Number);
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    const delay = target.getTime() - now.getTime();
    if (delay <= 0) return;

    timerRef.current = setTimeout(() => {
      const copy = getNotificationCopy(language);
      const dayKey = target.toLocaleDateString("sv-SE");
      const dedupeKey = `daily-reminder:${dayKey}`;
      if (!shouldNotifyOnce(localStorage, dedupeKey, new Date(), 20 * 60 * 60 * 1000)) return;

      const pending = missions?.filter((ms) => !ms.completed).length ?? 0;
      const total = missions?.length ?? 0;
      const body = total > 0 ? copy.messages.dailyMissions(pending, total) : copy.messages.dailyEmpty;

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(copy.titles.dailyReminder, {
          body,
          icon: "/app-icon-192.png",
          tag: "daily-alarm",
        });
      } else {
        toast({ title: copy.titles.dailyReminder, description: body, duration: 8000 });
      }
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [settings?.dailyReminderTime, missions, toast, language, push.prefs.dailyReminder]);

  return null;
}
