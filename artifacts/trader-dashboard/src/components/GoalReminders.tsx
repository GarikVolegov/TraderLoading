import { useEffect, useRef } from "react";
import { useGetIdeas } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { getNotificationCopy, shouldNotifyOnce } from "@/lib/notifications";

export function GoalReminders() {
  const { data: ideas } = useGetIdeas();
  const { toast } = useToast();
  const { language } = useLanguage();
  const push = usePushNotifications();
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (!ideas || !push.prefs.goals) return;

    const goals = ideas.filter((i) => i.type === "goal" && !i.completed && i.reminderTime);
    const now = new Date();
    const copy = getNotificationCopy(language);

    for (const goal of goals) {
      const [h, m] = goal.reminderTime!.split(":").map(Number);
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
      const delay = target.getTime() - now.getTime();
      if (delay <= 0) continue;

      const timer = setTimeout(() => {
        const dayKey = target.toLocaleDateString("sv-SE");
        const dedupeKey = `goal-reminder:${goal.id}:${dayKey}`;
        if (!shouldNotifyOnce(localStorage, dedupeKey, new Date(), 20 * 60 * 60 * 1000)) return;

        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(copy.titles.goalReminder, {
            body: goal.content,
            icon: "/favicon.ico",
            tag: `goal-reminder-${goal.id}`,
          });
        } else {
          toast({
            title: copy.titles.goalReminder,
            description: goal.content,
            duration: 8000,
          });
        }
      }, delay);
      timersRef.current.push(timer);
    }

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [ideas, toast, language, push.prefs.goals]);

  return null;
}
