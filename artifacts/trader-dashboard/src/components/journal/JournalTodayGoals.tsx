import { Link } from "wouter";
import { Target } from "lucide-react";
import { getGetIdeasQueryKey, useGetIdeas } from "@workspace/api-client-react";
import { useLanguage } from "@/contexts/LanguageContext";

/** Mounted only in Today: the goal editor remains in Ideas and goals. */
export function JournalTodayGoals() {
  const { t, language } = useLanguage();
  const query = useGetIdeas({ query: { queryKey: getGetIdeasQueryKey() } });
  const goals = (query.data ?? []).filter(idea => idea.type === "goal" && !idea.completed);
  const visible = [...goals].sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    return rank[a.importance ?? "medium"] - rank[b.importance ?? "medium"]
      || (a.deadlineDate ?? "9999").localeCompare(b.deadlineDate ?? "9999");
  }).slice(0, 5);
  return <section className="rounded-xl border border-border bg-card p-4 space-y-3" aria-labelledby="today-goals-title">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="today-goals-title" className="flex items-center gap-2 text-sm font-semibold"><Target className="h-4 w-4 text-primary" />{t("journal.workspace.active_goals")}</h2>
      <Link href="/journal?t=piano&vista=idee-obiettivi&focus=obiettivi" className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline">{t("journal.workspace.ideas_goals")}</Link>
    </div>
    {query.isLoading ? <p role="status" className="text-sm text-muted-foreground">{t("common.loading")}</p>
      : query.isError ? <p role="status" className="text-sm text-muted-foreground">{t("journal.workspace.goals_error")}</p>
        : visible.length === 0 ? <p className="text-sm text-muted-foreground">{t("journal.workspace.no_active_goals")}</p>
          : <ul className="divide-y divide-border">{visible.map(goal => <li key={goal.id} className="flex items-start justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 break-words">{goal.content}</span>
            {goal.deadlineDate && <time dateTime={goal.deadlineDate} className="shrink-0 text-xs text-muted-foreground">{new Date(`${goal.deadlineDate}T12:00:00`).toLocaleDateString(language)}</time>}
          </li>)}</ul>}
  </section>;
}
