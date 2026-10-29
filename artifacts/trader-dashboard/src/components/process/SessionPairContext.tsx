import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { fetchMarketContext, fetchMarketDecision } from "@/lib/marketIntelligenceApi";
import { DirectionalOutlookPanel } from "@/components/DirectionalOutlookPanel";
import { ContextMarketDetail, PriceHistory } from "@/components/ContextMarketDetail";
import { Button } from "@/components/ui/button";
import "@/pages/OperatingDashboard.css";

/** The same canonical quantitative context, inside the preparation rather than behind a link. */
export function SessionPairContext({
  pair,
  onSnapshot,
  decisionId,
  onRefresh,
}: {
  pair: string;
  decisionId?: string;
  onRefresh?: () => void;
  onSnapshot: (id: string | null) => void;
}) {
  const { userId } = useAuth();
  const { t, language } = useLanguage();
  const time = (stamp: string) =>
    Number.isFinite(Date.parse(stamp))
      ? new Intl.DateTimeFormat(language, {
          timeZone: "Europe/Rome",
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(stamp))
      : "—";
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const original = useQuery({
    queryKey: ["session-original-decision", userId, decisionId],
    queryFn: () => fetchMarketDecision(decisionId!),
    enabled: Boolean(userId && decisionId),
  });
  const query = useQuery({
    queryKey: ["session-pair-context", userId, pair],
    queryFn: () => fetchMarketContext(pair),
    enabled: Boolean(pair && userId && !decisionId),
    staleTime: 30_000,
    refetchInterval: (query) =>
      query.state.data?.refreshing || query.state.data?.status === "warming" ? 1_500 : 60_000,
  });
  const received = decisionId ? original.data?.snapshot : query.data;
  const data = received?.pair === pair ? received : undefined;
  const pending = decisionId ? original.isPending : query.isPending;
  const collecting = !decisionId && Boolean(data?.refreshing || data?.status === "warming");
  const relatedNews = data?.relatedNews ?? data?.news ?? [];
  const fresh = Boolean(
    data &&
    !(decisionId ? original.isError : query.isError) &&
    now - Date.parse(data.generatedAt) < 90_000,
  );
  const snapshotId = decisionId
    ? (original.data?.snapshotId ?? null)
    : fresh && data?.snapshotId && /^[a-f0-9]{64}$/.test(data.snapshotId)
      ? data.snapshotId
      : null;
  useEffect(() => {
    onSnapshot(snapshotId);
  }, [snapshotId, onSnapshot]);
  if (!pair) return null;
  const score = fresh ? data?.score : null;
  return (
    <div className="session-pair-context" data-pair={pair} aria-busy={collecting}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <strong>{pair}</strong>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            if (decisionId) onRefresh?.();
            else void query.refetch();
          }}
          disabled={query.isFetching}
        >
          {t("center.refresh")}
        </Button>
      </div>
      {(pending || collecting) && (
        <p role="status" aria-live="polite">
          {t("center.warming")}
        </p>
      )}
      {(decisionId ? original.isError : query.isError) && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("market.unavailable")}
        </p>
      )}
      {data && !collecting && (
        <DirectionalOutlookPanel
          outlook={data.outlook}
          directionalBias={data.directionalBias}
          pair={pair}
          now={now}
          fresh={fresh}
        />
      )}
      <section className="process-plan-summary" aria-label={t("center.score")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-medium">{t("center.score")}</h3>
          <span className="text-xs text-muted-foreground">{t("center.experimental")}</span>
        </div>
        <div className="flex items-center gap-4">
          <strong className="font-mono text-3xl">
            {score == null ? "—" : `${score > 0 ? "+" : ""}${score}`}
          </strong>
          <span className="text-sm">
            {t(
              score == null
                ? collecting || pending
                  ? "center.warming"
                  : "center.insufficient"
                : score > 15
                  ? "center.bullish"
                  : score < -15
                    ? "center.bearish"
                    : "center.balanced",
            )}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {!fresh && data ? t("market.stale") : t("center.score_hint")}
        </p>
        <PriceHistory data={fresh ? data : undefined} />
        <details>
          <summary>{t("center.factors")}</summary>
          <ul className="space-y-3 text-sm">
            {data?.components.map((item) => (
              <li key={item.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {t(`center.${item.id}`)} · {item.source}
                </span>
                <span>
                  {fresh && item.status === "available"
                    ? (item.score ?? "—")
                    : t("market.unavailable")}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </section>
      <section className="process-plan-summary">
        <h3 className="font-medium">{t("workspace.news")}</h3>
        {relatedNews.length ? (
          relatedNews.slice(0, 3).map((item) => (
            <p key={item.url} className="text-sm">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                {item.title}
              </a>
              <span className="block text-xs text-muted-foreground">
                {item.source} · {time(item.publishedAt)} · Europe/Rome
              </span>
            </p>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            {t(
              collecting || pending
                ? "center.warming"
                : data?.components.find((item) => item.id === "news")?.reason === "no_direction"
                  ? "center.no_recent_news"
                  : "market.unavailable",
            )}
          </p>
        )}
      </section>
      <section className="process-plan-summary">
        <h3 className="font-medium">{t("nav.calendar")}</h3>
        {data?.events.length ? (
          data.events.map((event, index) => (
            <p key={index} className="text-sm">
              {time(event.date)} · Europe/Rome · {event.country} · {event.title} · {event.impact}
            </p>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            {data?.calendarStatus === "available"
              ? t("center.no_event")
              : t(collecting || pending ? "center.warming" : "market.unavailable")}
          </p>
        )}
      </section>
      <details>
        <summary>{t("center.market_detail")}</summary>
        <ContextMarketDetail data={fresh ? data : undefined} />
      </details>
    </div>
  );
}
