import { lazy, Suspense, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { PageLayout } from "@/components/PageLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionTabs } from "@/components/SectionTabs";
import { centerView, resolveWorkspaceAlias, updateWorkspaceQuery } from "@/lib/workspaceNavigation";
import "./OperatingDashboard.css";

const Calculator = lazy(() =>
  import("@/components/LotCalculatorWidget").then((module) => ({
    default: module.LotCalculatorWidget,
  })),
);
const Widgets = lazy(() => import("./Dashboard"));
const News = lazy(() => import("./News").then((module) => ({ default: module.NewsWorkspace })));
const Sessions = lazy(() =>
  import("./Clock").then((module) => ({ default: module.ClockWorkspace })),
);
const TradingCockpit = lazy(() => import("./TradingCockpit"));

/** Keep existing widget ordering/settings reachable without loading the wall of
 * widgets into the default daily workflow. Favorite changes still use Settings.
 */
export default function OperatingDashboard() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const legacyDestination = resolveWorkspaceAlias("/", search);
  useEffect(() => {
    if (legacyDestination) navigate(legacyDestination, { replace: true });
  }, [legacyDestination, navigate]);
  const view = centerView(search);
  const focusedWidget = new URLSearchParams(search).get("widget") || undefined;
  const selectedTool = new URLSearchParams(search).get("strumento");
  const sessions = selectedTool === "sessioni";
  const calculator = selectedTool === "calcolatore";
  const focused = Boolean(focusedWidget || sessions || calculator || new URLSearchParams(search).get("processReturn") === "1");
  if (legacyDestination) return <Skeleton className="h-96" />;
  return (
    <PageLayout quiet>
      {!focused && (
        <SectionTabs
          ariaLabel={t("workspace.center_long")}
          value={view}
          items={[
            { value: "mercati", label: t("workspace.markets") },
            { value: "notizie", label: t("workspace.news") },
            { value: "strumenti", label: t("workspace.tools") },
          ]}
          onValueChange={(vista) =>
            navigate(
              `/${updateWorkspaceQuery(search, { vista: vista === "mercati" ? null : vista, strumento: null, widget: null, layout: null, article: null })}`,
            )
          }
        />
      )}
      <div className="flex flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden">
        <Suspense fallback={<Skeleton className="h-96" />}>
          {view === "mercati" && <TradingCockpit />}
          {view === "notizie" && (
            <div className="limen-scroll-pane">
              <News />
            </div>
          )}
          {view === "strumenti" && (
            <div className="limen-scroll-pane">
              {!focused && (
                <SectionTabs
                  value={sessions ? "sessioni" : calculator ? "calcolatore" : "widgets"}
                  ariaLabel={t("workspace.tools")}
                  items={[
                    { value: "widgets", label: t("workspace.tools") },
                    { value: "sessioni", label: t("workspace.sessions") },
                    { value: "calcolatore", label: t("lot_calculator.title") },
                  ]}
                  onValueChange={(value) =>
                    navigate(
                      `/${updateWorkspaceQuery(search, { strumento: value === "widgets" ? null : value, widget: null })}`,
                    )
                  }
                />
              )}
              {sessions ? (
                <Sessions />
              ) : calculator ? (
                <div className="mx-auto max-w-xl py-6">
                  <Calculator />
                </div>
              ) : (
                <Widgets embedded focusWidget={focusedWidget} />
              )}
            </div>
          )}
        </Suspense>
      </div>
    </PageLayout>
  );
}
