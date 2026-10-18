import { lazy, Suspense, useState, useRef } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import {
  TOOL_GROUPS,
  matchingTools,
  type ToolGroup,
} from "@/lib/workspaceTools";
import { processToolHref } from "@/lib/processToolNavigation";
import { updateWorkspaceQuery } from "@/lib/workspaceNavigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProcessFrame } from "@/components/process/ProcessUI";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";

const Wellbeing = lazy(() =>
  import("./Routine").then((module) => ({ default: module.RoutineWorkspace })),
);
const Missions = lazy(() =>
  import("./Missions").then((module) => ({ default: module.MissionsWorkspace })),
);

export default function Resources() {
  const { t } = useLanguage();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const view = params.get("view");
  const [, navigate] = useLocation();
  const query = params.get("q") ?? "";
  const setQuery = (q: string) =>
    navigate("/resources" + updateWorkspaceQuery(search, { q: q || null }), { replace: true });
  const tools = matchingTools(query, t);
  const catalogTools = tools;
  const searchInput = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState<ToolGroup | null>("context");
  const support = view === "wellbeing" || view === "missions";
  return (
    <ProcessFrame
      title={t(
        support
          ? view === "wellbeing"
            ? "process.resources.wellbeing"
            : "missions.title"
          : "process.resources.title",
      )}
      subtitle={t("process.resources.description")}
    >
      <div className="space-y-6 pb-8">
        {support ? (
          <>
            <Link
              href="/resources"
              className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={16} />
              {t("process.resources.back")}
            </Link>
            <Suspense fallback={<Skeleton className="h-64" />}>
              {view === "wellbeing" ? <Wellbeing embedded /> : <Missions embedded />}
            </Suspense>
          </>
        ) : (
          <div className="space-y-5">
            <h2 className="pt-3 text-lg font-semibold">{t("catalog.all")}</h2>
            <div className="space-y-2">
              <label htmlFor="resource-search" className="text-sm font-medium">
                {t("catalog.search")}
              </label>
              <div className="flex gap-2">
                <Input
                  id="resource-search"
                  ref={searchInput}
                  maxLength={160}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  type="search"
                />
                {query && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setQuery("");
                      searchInput.current?.focus();
                    }}
                  >
                    {t("catalog.clear")}
                  </Button>
                )}
              </div>
              {query && (
                <p role="status" className="text-sm text-muted-foreground">
                  {t("catalog.count")}: {tools.length}
                </p>
              )}
            </div>
            {tools.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("catalog.empty")}</p>
            )}
            <div className="divide-y divide-border rounded-2xl border border-border bg-card">
              {TOOL_GROUPS.filter((group) => catalogTools.some((tool) => tool.group === group)).map(
                (group) => (
                  <details
                    key={group}
                    open={Boolean(query) || expanded === group}
                    className="group px-5 py-1 sm:px-7"
                  >
                    <summary
                      onClick={(event) => {
                        event.preventDefault();
                        if (!query) setExpanded((current) => (current === group ? null : group));
                      }}
                      className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded-lg [&::-webkit-details-marker]:hidden"
                    >
                      <span className="text-base font-semibold">{t(`catalog.group.${group}`)}</span>
                      <ChevronDown
                        size={18}
                        className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <ul className="grid gap-1 pb-5 sm:grid-cols-2">
                      {catalogTools
                        .filter((tool) => tool.group === group)
                        .map((tool) => (
                          <li key={tool.id}>
                            <Link
                              href={processToolHref(tool.href, {
                                pair: params.get("pair"),
                                methodVersionId: params.get("methodVersionId"),
                                fromProcess: params.get("processReturn") === "1",
                              })}
                              className="flex min-h-16 items-center justify-between gap-3 rounded-lg px-3 py-3 text-sm hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                            >
                              <span>
                                <span className="block font-medium">{t(tool.labelKey)}</span>
                                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                                  {t(`catalog.hint.${tool.id}`)}
                                </span>
                              </span>
                              <ArrowRight size={15} className="shrink-0 text-muted-foreground" />
                            </Link>
                          </li>
                        ))}
                    </ul>
                  </details>
                ),
              )}
            </div>
          </div>
        )}
        {(
          <Link href="/" className={buttonVariants() + " min-h-11"}>
            {t("process.resources.return")}
            <ArrowRight size={16} />
          </Link>
        )}
      </div>
    </ProcessFrame>
  );
}
