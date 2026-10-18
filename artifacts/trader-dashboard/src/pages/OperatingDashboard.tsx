import { ContextWorkspace } from "@/components/ContextWorkspace";
import { ContextMarketDetail, PriceHistory } from "@/components/ContextMarketDetail";
import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { Link, useLocation, useSearch } from "wouter";
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  SlidersHorizontal,
  RefreshCw,
  ChevronRight,
  ClipboardCheck,
  BookOpen,
  Sunrise,
  Info,
  ExternalLink,
  Layers3,
} from "lucide-react";
import { getGetMarketContextQueryKey, useGetMarketContext } from "@workspace/api-client-react";
import { getPairLabel } from "@workspace/pair-catalog";
import { useBackground } from "@/contexts/BackgroundContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { PageLayout } from "@/components/PageLayout";
import { RiskGuardPanel } from "@/components/RiskGuardPanel";
import { ChecklistDashboardWidget } from "@/components/ChecklistDashboardWidget";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionTabs } from "@/components/SectionTabs";
import { centerView, resolveWorkspaceAlias, updateWorkspaceQuery } from "@/lib/workspaceNavigation";
import { CalendarWidget } from "@/components/CalendarWidget";
import { DirectionalOutlookPanel } from "@/components/DirectionalOutlookPanel";
import { MarketDecisionPanel } from "@/components/MarketDecisionPanel";
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
const signed = (value: number) => `${value > 0 ? "+" : ""}${value}`;

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
      {!focused && <SectionTabs
        ariaLabel={t("workspace.center_long")}
        value={view}
        items={[
          { value: "mercati", label: t("workspace.markets") },
          { value: "notizie", label: t("workspace.news") },
          { value: "strumenti", label: t("workspace.tools") },
        ]}
        onValueChange={(vista) =>
          navigate(
            `/${updateWorkspaceQuery(search, { vista, strumento: null, widget: null, layout: null, article: null })}`,
          )
        }
      />}
      <Suspense fallback={<Skeleton className="h-96" />}>
        {view === "mercati" && <OperatingCenter />}
        {view === "notizie" && <News />}
        {view === "strumenti" && (
          <>
            {!focused && <SectionTabs
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
            />}
            {sessions ? (
              <Sessions />
            ) : calculator ? (
              <div className="mx-auto max-w-xl py-6">
                <Calculator />
              </div>
            ) : (
              <Widgets embedded focusWidget={focusedWidget} />
            )}
          </>
        )}
      </Suspense>
    </PageLayout>
  );
}

function OperatingCenter() {
  const { userId } = useAuth();
  const { t, language } = useLanguage();
  const { selectedPairs, settingsLoaded } = useBackground();
  const search = useSearch();
  const [, navigate] = useLocation();
  const requested = new URLSearchParams(search).get("pair");
  const pair = requested || selectedPairs[0] || "";
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const query = useGetMarketContext(
    { pair, horizon: "4h" },
    {
      query: {
        queryKey: getGetMarketContextQueryKey({ pair, horizon: "4h" }),
        enabled: settingsLoaded && Boolean(pair),
        staleTime: 30_000,
        refetchInterval: (q) =>
          q.state.data?.status === "warming"
            ? 5_000
            : q.state.data?.status === "available"
              ? 60_000
              : 15_000,
      },
    },
  );
  const data = query.data?.pair === pair ? query.data : undefined;
  const fresh = data && !query.isError && now - Date.parse(data.generatedAt) < 90_000;
  const score = fresh ? data.score : null;
  const busy =
    !settingsLoaded ||
    (Boolean(pair) && query.isPending) ||
    (!query.isError && data?.status === "warming");
  const bias =
    score === null ? "insufficient" : score > 15 ? "bullish" : score < -15 ? "bearish" : "balanced";
  const tone =
    score === null || Math.abs(score) <= 15 ? "neutral" : score > 0 ? "positive" : "negative";
  const date = (stamp: string, timeOnly = false) =>
    new Intl.DateTimeFormat(language, {
      timeZone: "Europe/Rome",
      ...(timeOnly ? {} : { day: "2-digit", month: "short" }),
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(stamp));
  const event = fresh ? data.events[0] : undefined;
  const number = (value: number) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: value > 100 ? 2 : 5 }).format(value);

  return (
    <>
      <main
        className="context-dashboard mx-auto max-w-[1680px] pb-8"
        aria-label={t("center.title")}
      >
        <header className="context-heading">
          <div className="context-brand">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" />
            <div>
              <h1>
                {t("center.brand_first")}
                <span>{t("center.brand_last")}</span>
                <i> / </i>
                <em>{t("center.workspace")}</em>
              </h1>
              <p className="context-eyebrow">{t("center.eyebrow")}</p>
            </div>
          </div>
          <div className="context-heading-actions">
            <span className="hidden md:inline text-xs text-muted-foreground">
              {new Intl.DateTimeFormat(language, {
                timeZone: "Europe/Rome",
                weekday: "short",
                day: "numeric",
                month: "long",
              }).format(now)}{" "}
              ·{" "}
              {new Intl.DateTimeFormat(language, {
                timeZone: "Europe/Rome",
                hour: "2-digit",
                minute: "2-digit",
              }).format(now)}{" "}
              Rome
            </span>
            <Link
              href="/?vista=strumenti"
              className="context-tool-link"
              aria-label={t("center.tools")}
            >
              <Layers3 size={15} />
              <span>{t("center.tools")}</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </header>

        <nav className="context-pairs" aria-label={t("center.select_pair")}>
          <div className="context-pair-list">
            {selectedPairs.map((symbol) => (
              <button
                key={symbol}
                type="button"
                aria-pressed={symbol === pair}
                onClick={() =>
                  navigate(`/${updateWorkspaceQuery(search, { pair: symbol, horizon: "4h" })}`)
                }
                className={symbol === pair ? "active" : ""}
              >
                {symbol === pair && <span className="context-pair-dot" />}
                {getPairLabel(symbol)}
              </button>
            ))}
          </div>
          <Link
            href="/settings?section=pairs"
            className="context-manage"
            aria-label={t("center.manage")}
            title={t("center.manage")}
          >
            <SlidersHorizontal size={17} />
          </Link>
        </nav>

        <div className="context-grid">
          <div className="context-market-column">
            {pair && (
              <DirectionalOutlookPanel
                outlook={data?.outlook}
                pair={pair}
                now={now}
                fresh={Boolean(fresh)}
              />
            )}
            {!pair && settingsLoaded ? (
              <p className="p-6 border rounded-xl">{t("center.empty_pairs")}</p>
            ) : (
              <section
                className="context-surface"
                aria-label={t("center.score")}
                data-testid="pair-context"
              >
                <div className="context-surface-top">
                  <span>
                    {getPairLabel(pair) || "—"}{" "}
                    <span className="text-muted-foreground font-normal">
                      / {t("center.horizon")}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void query.refetch()}
                    disabled={query.isFetching || !pair || !settingsLoaded}
                    aria-label={t("market.retry")}
                    className="context-refresh"
                  >
                    <RefreshCw size={15} className={query.isFetching ? "animate-spin" : ""} />
                    <span>{t("center.refresh")}</span>
                  </button>
                </div>
                <div className="context-reading">
                  <div className={`context-primary ${tone}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2>{t("center.score")}</h2>
                      <span className="context-experimental">{t("center.experimental")}</span>
                    </div>
                    <div className="context-score-row">
                      <span className="context-score" data-testid="context-score">
                        {score === null ? "—" : signed(score)}
                      </span>
                      <div className="context-verdict" role="status">
                        <span className="context-direction">
                          {score !== null &&
                            (score > 15 ? (
                              <ArrowUpRight size={22} />
                            ) : score < -15 ? (
                              <ArrowDownRight size={22} />
                            ) : null)}
                          {t(busy && score === null ? "center.warming" : `center.${bias}`)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t("center.score_hint")}
                        </span>
                      </div>
                    </div>
                    <div className="context-axis" aria-hidden="true">
                      <div className="context-axis-mid" />
                      {score !== null && (
                        <span
                          className="context-axis-pointer"
                          style={{ left: `${(score + 100) / 2}%` }}
                        />
                      )}
                    </div>
                    <div className="context-axis-labels">
                      <span>−100</span>
                      <span>{t("center.balanced")}</span>
                      <span>+100</span>
                    </div>
                    <p className="context-reading-note">
                      {query.isError
                        ? t(
                            (query.error as { status?: number })?.status === 400
                              ? "market.unsupported"
                              : "market.unavailable",
                            { symbols: pair },
                          )
                        : data && !fresh
                          ? t("market.stale")
                          : score === null
                            ? t("center.minimum")
                            : data?.disagreement
                              ? t("center.conflict")
                              : t("center.reading_note")}
                    </p>
                    <PriceHistory data={fresh ? data : undefined} />
                  </div>
                  <div className="context-contributors">
                    <div className="flex items-center justify-between gap-3 mb-5">
                      <h3>{t("center.factors")}</h3>
                      <span className="text-xs text-muted-foreground">{t("center.weight")}</span>
                    </div>
                    {(["price", "news", "retail", "cot"] as const).map((id, index) => {
                      const c = fresh ? data.components.find((item) => item.id === id) : undefined;
                      const value = c?.status === "available" ? c.score : null;
                      return (
                        <div key={id} className="context-factor">
                          <span className="context-factor-index">0{index + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between gap-2">
                              <span>{t(`center.${id}`)}</span>
                              <span className="text-muted-foreground text-xs">
                                {c?.weight ?? [35, 30, 15, 20][index]}%
                              </span>
                            </div>
                            <small className="context-factor-status">
                              {c?.status === "available"
                                ? id === "cot"
                                  ? `${t("center.weekly")} · ${c.observedAt?.slice(0, 10) ?? "—"}`
                                  : c.fetchedAt
                                    ? date(c.fetchedAt, true)
                                    : t("market.unknown_time")
                                : t(c?.status === "stale" ? "market.stale" : "market.unavailable")}
                            </small>
                            <div className="context-factor-track" aria-hidden="true">
                              {value !== null && value !== undefined && (
                                <span
                                  className={value >= 0 ? "positive" : "negative"}
                                  style={{
                                    width: `${Math.abs(value) / 2}%`,
                                    left: value >= 0 ? "50%" : `${50 + value / 2}%`,
                                  }}
                                />
                              )}
                            </div>
                          </div>
                          <span className="context-factor-value">
                            {value === null || value === undefined ? "—" : signed(value)}
                          </span>
                        </div>
                      );
                    })}
                    <div className="context-coverage">
                      <div className="flex items-center justify-between gap-3">
                        <span>{t("center.coverage")}</span>
                        <strong>{fresh ? data.coverage : 0}/100</strong>
                      </div>
                      <div className="context-coverage-track">
                        <span style={{ width: `${fresh ? data.coverage : 0}%` }} />
                      </div>
                      <p>
                        {t("center.coverage_hint")}
                        {fresh && data.status === "partial" && <> {t("center.partial")}.</>}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="context-conditions">
                  <div>
                    <span>{t("center.last_price")}</span>
                    <strong>{fresh && data.price !== null ? number(data.price) : "—"}</strong>
                    <small>
                      {fresh && data.priceChangePct !== null
                        ? `${signed(Number(data.priceChangePct.toFixed(2)))}% · ${t("center.previous_close")}`
                        : t("market.unavailable")}
                    </small>
                    {fresh && (
                      <small>{data.components.find((c) => c.id === "price")?.source}</small>
                    )}
                  </div>
                  <div>
                    <span>{t("center.range")}</span>
                    <strong>
                      {fresh && data.rangePercent !== null ? `${data.rangePercent}%` : "—"}
                    </strong>
                    <small>{t("center.range_note")}</small>
                  </div>
                  <div className="context-event">
                    <span>{t("center.event")}</span>
                    <strong>{event ? date(event.date) : "—"}</strong>
                    <small>
                      {event
                        ? `${event.country} · ${event.title}`
                        : fresh && data.calendarStatus === "available"
                          ? t("center.no_event")
                          : t("market.unavailable")}
                    </small>
                  </div>
                </div>
                <details className="context-details">
                  <summary>
                    <Info size={15} />
                    <span>{t("center.evidence")}</span>
                    <span className="context-calculated">
                      {fresh ? t("center.updated", { time: date(data.generatedAt, true) }) : ""}
                    </span>
                    <ChevronRight size={15} />
                  </summary>
                  <div className="context-detail-body">
                    {data && !fresh && <p role="status">{t("market.stale")}</p>}
                    <h3>{t("center.model")}</h3>
                    <p>{t("center.method")}</p>
                    <p>{t("center.model_note")}</p>
                    <div className="context-source-grid">
                      {data?.components.map((c) => (
                        <div key={c.id}>
                          <strong>{t(`center.${c.id}`)}</strong>
                          <p>{t(`center.note_${c.id}`)}</p>
                          <p>
                            {c.source} ·{" "}
                            {c.reason ? t(`center.reason_${c.reason}`) : t("market.available")}
                          </p>
                          <p>
                            {c.fetchedAt
                              ? t("market.fetched", { time: date(c.fetchedAt) })
                              : t("market.unavailable")}
                          </p>
                          <p>
                            {c.observedAt
                              ? t(
                                  c.id === "price" ? "center.bar_time" : "center.observation_time",
                                  { time: date(c.observedAt) },
                                )
                              : t("market.unknown_time")}
                          </p>
                        </div>
                      ))}
                    </div>
                    <h3>{t("center.news")}</h3>
                    {!data?.news.length && <p>{t("center.empty_news")}</p>}
                    {data?.news.map((item) => (
                      <Link
                        key={item.url}
                        href={`/${updateWorkspaceQuery(search, { vista: "notizie", article: item.url, pair, horizon: "4h" })}`}
                        className="context-news-link"
                      >
                        <span className="context-news-sign">{item.direction > 0 ? "+" : "−"}</span>
                        <div>
                          <span>{item.title}</span>
                          <small>
                            {item.source} · {date(item.publishedAt)} ·{" "}
                            {t(`center.theme_${item.theme}`)}
                          </small>
                        </div>
                        <ExternalLink size={14} />
                      </Link>
                    ))}
                    <span className="text-xs text-muted-foreground">{data?.version}</span>
                  </div>
                </details>
              </section>
            )}

            {pair && (
              <MarketDecisionPanel
                key={`${userId ?? "guest"}:${pair}`}
                snapshotId={data?.snapshotId}
                pair={pair}
                fresh={Boolean(fresh)}
              />
            )}
            <ContextMarketDetail data={fresh ? data : undefined} />
            <section className="context-surface p-4" aria-label={t("workspace.economic_calendar")}>
              <h2 className="mb-3 text-sm font-semibold">{t("workspace.economic_calendar")}</h2>
              <CalendarWidget />
            </section>
          </div>
          <aside className="context-rail">
            <div className="context-discipline">
              <RiskGuardPanel />
            </div>
            <section className="context-plan" aria-label={t("center.plan")}>
              <span className="context-eyebrow">{t("center.plan")}</span>
              <div>
                <button type="button" onClick={() => setChecklistOpen(true)}>
                  <ClipboardCheck size={17} />
                  {t("center.checklist")}
                  <ChevronRight size={15} />
                </button>
                <Link href="/journal?t=piano&vista=oggi&panel=routine">
                  <Sunrise size={17} />
                  {t("center.routine")}
                  <ChevronRight size={15} />
                </Link>
                <Link href="/journal?t=trades&new=1" className="context-journal-action">
                  <BookOpen size={17} />
                  {t("center.new_trade")}
                  <ArrowRight size={15} />
                </Link>
              </div>
            </section>
            <ContextWorkspace />
          </aside>
        </div>
      </main>
      <Modal
        isOpen={checklistOpen}
        onClose={() => setChecklistOpen(false)}
        title={t("center.checklist")}
      >
        <ChecklistDashboardWidget />
      </Modal>
    </>
  );
}
