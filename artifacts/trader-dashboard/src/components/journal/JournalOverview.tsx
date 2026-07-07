import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { LineChart, Activity, Sparkles, List, TrendingUp, ArrowRight } from "lucide-react";
import {
  useGetJournalEdge,
  getGetJournalEdgeQueryKey,
  useGetJournalEntries,
  getGetJournalEntriesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/ui/StatTile";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage, useDateLocale } from "@/contexts/LanguageContext";
import { getJournalRecapPeriod } from "@/lib/journalRecapPeriods";
import { fetchJournalRecap, journalRecapQueryKey } from "@/lib/journalRecapsApi";
import { parseTradeContent, tradeRMultiple } from "@/lib/parseTradeContent";
import { cumulativeR, monteCarloBands } from "@/lib/equityProjection";
import { EquityCurveChart } from "./EquityCurveChart";
import { RiskOfRuinCard } from "./RiskOfRuinCard";

const PROJECTION_STEPS = 20;

function fmtR(v: number | null): string {
  if (v === null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}R`;
}
function clampPct(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function JournalOverview({ onNavigate }: { onNavigate: (tab: "recap-mensile") => void }) {
  const { t } = useLanguage();
  const dateLocale = useDateLocale();

  const { data: edge } = useGetJournalEdge({
    query: { queryKey: getGetJournalEdgeQueryKey(), refetchInterval: 30_000 },
  });
  const { data: entries } = useGetJournalEntries({
    query: { queryKey: getGetJournalEntriesQueryKey(), refetchInterval: 30_000 },
  });

  const recapPeriod = useMemo(() => getJournalRecapPeriod("four_week"), []);
  const recapQuery = useQuery({
    queryKey: journalRecapQueryKey(recapPeriod),
    queryFn: () => fetchJournalRecap(recapPeriod),
  });

  const rSamples = useMemo(() => {
    if (!entries) return [] as number[];
    return [...entries]
      .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
      .map((e) => tradeRMultiple(parseTradeContent(e.content) ?? {}))
      .filter((r): r is number => r !== null);
  }, [entries]);

  const realized = useMemo(() => cumulativeR(rSamples), [rSamples]);
  const bands = useMemo(
    () => monteCarloBands(rSamples, { steps: PROJECTION_STEPS, start: realized[realized.length - 1] ?? 0 }),
    [rSamples, realized],
  );
  const netR = realized[realized.length - 1] ?? 0;

  const overall = edge?.overall;
  const payoff =
    overall?.avgWinR != null && overall?.avgLossR != null && overall.avgLossR !== 0
      ? Math.abs(overall.avgWinR / overall.avgLossR)
      : null;
  const disciplinePct = 100 - (edge?.discipline.stopDiscipline?.pct ?? 0);
  const revenge = edge?.highlights.postLoss?.trades ?? 0;

  const recentTrades = useMemo(() => {
    if (!entries) return [];
    return [...entries]
      .sort((a, b) => b.tradeDate.localeCompare(a.tradeDate))
      .slice(0, 5)
      .map((e) => {
        const parsed = parseTradeContent(e.content) ?? {};
        return {
          id: e.id,
          pair: parsed.symbol ?? e.title,
          dir: parsed.direction,
          note: e.title,
          date: e.tradeDate,
          r: tradeRMultiple(parsed),
          result: e.result,
        };
      });
  }, [entries]);

  const edgeBars = [
    { l: t("journal.overview.edge_expectancy"), v: fmtR(overall?.expectancyR ?? null), pct: clampPct((overall?.expectancyR ?? 0) * 100) },
    { l: t("journal.overview.edge_payoff"), v: payoff === null ? "—" : payoff.toFixed(1), pct: clampPct((payoff ?? 0) * 33) },
    { l: t("journal.overview.edge_discipline"), v: `${clampPct(disciplinePct)}%`, pct: clampPct(disciplinePct) },
    { l: t("journal.overview.edge_revenge"), v: String(revenge), pct: revenge === 0 ? 4 : Math.min(100, revenge * 20) },
  ];

  const recap = recapQuery.data;
  const recapBlocks = recap
    ? [
        { k: t("journal.overview.recap_judgment"), text: recap.overallJudgment },
        { k: t("journal.overview.recap_well"), text: recap.wentWell },
        { k: t("journal.overview.recap_wrong"), text: recap.wentWrong },
        { k: t("journal.overview.recap_patterns"), text: recap.patterns },
      ].filter((b) => b.text)
    : [];

  return (
    <div className="space-y-4">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t("journal.overview.kpi_total")} value={overall ? String(overall.closedTrades) : "—"} size="lg" />
        <StatTile label={t("journal.overview.kpi_winrate")} value={overall?.winRate != null ? `${overall.winRate}%` : "—"} tone="success" size="lg" />
        <StatTile label={t("journal.overview.kpi_net")} value={fmtR(netR)} tone={netR >= 0 ? "primary" : "destructive"} size="lg" />
        <StatTile label={t("journal.overview.kpi_pf")} value={overall?.profitFactor != null ? overall.profitFactor.toFixed(1) : "—"} size="lg" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* Equity curve */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LineChart className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-semibold">{t("journal.overview.equity_title")}</p>
                <p className="text-xs text-muted-foreground">{t("journal.overview.equity_subtitle")}</p>
              </div>
            </div>
            <Badge variant="secondary">
              <TrendingUp className="mr-1 h-3 w-3" />
              {fmtR(netR)}
            </Badge>
          </CardHeader>
          <CardContent className="pt-2">
            <EquityCurveChart realized={realized} bands={bands} projectionSteps={PROJECTION_STEPS} />
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-3.5 rounded bg-[hsl(142_71%_45%)]" />
                {t("journal.overview.legend_realized")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-3.5 rounded border border-[hsl(210_90%_62%/0.4)] bg-[hsl(210_90%_62%/0.22)]" />
                {t("journal.overview.legend_band")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0 w-3.5 border-t-2 border-dashed border-[hsl(210_90%_62%)]" />
                {t("journal.overview.legend_median")}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Edge breakdown */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-semibold">{t("journal.overview.edge_title")}</p>
                <p className="text-xs text-muted-foreground">{t("journal.overview.edge_subtitle")}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {edgeBars.map((m) => (
              <div key={m.l}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{m.l}</span>
                  <span className="font-mono font-bold">{m.v}</span>
                </div>
                <Progress value={m.pct} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Risk of ruin (bootstrapped from real R) */}
      <RiskOfRuinCard />

      {/* 4-week recap */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold">{t("journal.overview.recap_title")}</p>
              <p className="text-xs text-muted-foreground">{t("journal.overview.recap_subtitle")}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onNavigate("recap-mensile")}>
            {t("journal.overview.recap_open")}
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent>
          {recapBlocks.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {recapBlocks.map((b) => (
                <div key={b.k} className="rounded-lg border border-border/40 bg-secondary/30 p-3.5">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-primary">{b.k}</p>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">{b.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("journal.overview.recap_empty")}</p>
          )}
        </CardContent>
      </Card>

      {/* Recent trades */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <List className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-semibold">{t("journal.overview.trades_title")}</p>
            <p className="text-xs text-muted-foreground">{t("journal.overview.trades_subtitle")}</p>
          </div>
        </CardHeader>
        {recentTrades.length > 0 ? (
          <div>
            {recentTrades.map((tr) => (
              <div key={tr.id} className="flex items-center gap-3.5 border-t border-border/20 px-4 py-3">
                <span className="w-20 shrink-0 font-mono text-sm font-bold">{tr.pair}</span>
                {tr.dir && (
                  <Badge variant={/long/i.test(tr.dir) ? "secondary" : "destructive"}>{tr.dir.toUpperCase()}</Badge>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]">{tr.note}</p>
                  <p className="text-[11px] text-muted-foreground/60">
                    {format(parseISO(tr.date), "d MMM yyyy", { locale: dateLocale })}
                  </p>
                </div>
                <span
                  className={`font-mono text-base ${
                    tr.result === "win" ? "text-success" : tr.result === "loss" ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {fmtR(tr.r)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <CardContent>
            <p className="py-6 text-center text-sm text-muted-foreground">{t("journal.overview.trades_empty")}</p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
