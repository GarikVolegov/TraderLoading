import { useEffect, type ReactNode } from "react";
import { useLocation, useSearch } from "wouter";
import { SectionTabs } from "@/components/SectionTabs";
import { CalendarPlannerWorkspace } from "@/components/dashboard-workspaces/CalendarPlannerWorkspace";
import { useLanguage } from "@/contexts/LanguageContext";
import { parseJournalPlanView } from "@/lib/journalTabs";
import { updateWorkspaceQuery } from "@/lib/workspaceNavigation";

/** Legacy links resolve to their single owner; there is no second daily session. */
export function JournalPlan({ ideasGoals }: { ideasGoals: ReactNode }) {
  const { t } = useLanguage();
  const search = useSearch();
  const [, navigate] = useLocation();
  const view = parseJournalPlanView(search);
  useEffect(() => {
    if (view !== "oggi") return;
    const params = new URLSearchParams(search);
    const panel = params.get("panel"),
      focus = params.get("focus");
    const target =
      panel === "routine"
        ? "/routine"
        : panel === "checklist"
          ? "/method"
          : focus === "missioni"
            ? "/missions"
            : "/";
    const updates = {
      t: null,
      vista: null,
      panel: null,
      focus: null,
      ...(panel === "checklist"
        ? { section: "checklist" }
        : {}),
    };
    navigate(target + updateWorkspaceQuery(search, updates), { replace: true });
  }, [view, search, navigate]);
  if (view === "oggi") return <p role="status">{t("process.nav.today")}</p>;
  return (
    <div className="space-y-5">
      <SectionTabs
        ariaLabel={t("journal.workspace.plan")}
        value={view}
        items={[
          { value: "agenda", label: t("journal.workspace.agenda") },
          { value: "idee-obiettivi", label: t("journal.workspace.ideas_goals") },
        ]}
        onValueChange={(next) =>
          navigate(
            "/journal" +
              updateWorkspaceQuery(search, {
                t: "piano",
                vista: next,
                panel: null,
                start: null,
                focus: null,
              }),
          )
        }
      />
      {view === "agenda" ? <CalendarPlannerWorkspace /> : ideasGoals}
    </div>
  );
}
