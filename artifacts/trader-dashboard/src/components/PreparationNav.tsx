import { Link, useLocation, useSearch } from "wouter";
import { BarChart3, Newspaper, CalendarDays, Clock3, Calculator } from "lucide-react";
import { PREPARATION_TOOLS } from "@/lib/workspaceTools";
import { processToolHref } from "@/lib/processToolNavigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePreparationContext } from "@/hooks/usePreparationContext";

const icons = {
  markets: BarChart3,
  news: Newspaper,
  "economic-calendar": CalendarDays,
  sessions: Clock3,
  calculator: Calculator,
};

export function PreparationNav() {
  const { t } = useLanguage();
  const [location] = useLocation();
  const params = new URLSearchParams(useSearch());
  const context = usePreparationContext();
  return (
    <nav aria-label={t("catalog.prepare.title")} className="mt-5 border-t border-border pt-4">
      <p className="mb-2 px-3 text-xs font-medium text-muted-foreground">
        {t("catalog.prepare.title")}
      </p>
      <ul className="space-y-1">
        {PREPARATION_TOOLS.map((tool) => {
          const Icon = icons[tool.id as keyof typeof icons];
          const destination = new URL(tool.href, "https://workspace.invalid");
          const selected =
            location === destination.pathname &&
            [...destination.searchParams].every(([key, value]) => params.get(key) === value);
          return (
            <li key={tool.id}>
              <Link
                href={processToolHref(tool.href, context)}
                aria-current={selected ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-sm leading-snug focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${selected ? "bg-primary/10 text-primary" : "text-foreground/90 hover:bg-secondary hover:text-foreground"}`}
              >
                <Icon size={17} className="shrink-0 text-primary" aria-hidden />
                {t(tool.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
