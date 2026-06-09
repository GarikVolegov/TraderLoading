import { useEffect, useRef } from "react";
import { useGetMissions, useGetChecklist } from "@workspace/api-client-react";
import { useLoading } from "@/contexts/LoadingContext";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { deliverBrowserNotification, shouldNotifyOnce } from "@/lib/notifications";

export function WelcomeNotification() {
  const { isLoading } = useLoading();
  const { t } = useLanguage();
  const firedRef = useRef(false);
  const { data: missions } = useGetMissions();
  const { data: checklist } = useGetChecklist();
  const { toast } = useToast();

  useEffect(() => {
    if (isLoading || firedRef.current) return;
    if (!missions || !checklist) return;
    firedRef.current = true;
    if (!shouldNotifyOnce(localStorage, "welcome-summary", new Date(), 6 * 60 * 60 * 1000)) return;

    const totalMissions = missions.length;
    const doneMissions = missions.filter((m) => m.completed).length;
    const pendingMissions = totalMissions - doneMissions;

    const totalChecklist = checklist.length;
    const doneChecklist = checklist.filter((c) => c.completed).length;

    const lines: string[] = [];
    if (totalMissions > 0) {
      lines.push(
        pendingMissions === 0
          ? `${t("welcome.missions")} ${doneMissions}/${totalMissions}`
          : `${t("welcome.missions")} ${pendingMissions} - ${doneMissions}/${totalMissions}`,
      );
    }
    if (totalChecklist > 0) {
      lines.push(`${t("welcome.checklist")} ${doneChecklist}/${totalChecklist}`);
    }

    if (lines.length === 0) return;

    const summary = lines.join(" | ");
    const showToast = () => {
      toast({
        title: t("welcome.summary"),
        description: summary,
        duration: 6000,
      });
    };

    void deliverBrowserNotification({
      title: "TraderLoading",
      body: lines.join("\n"),
      tag: "welcome-summary",
      showToast,
    });
  }, [isLoading, missions, checklist, toast, t]);

  return null;
}
