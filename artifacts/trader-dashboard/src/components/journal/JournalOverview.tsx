import { processText } from "@/lib/processCopy";
import { Link } from "wouter";
import { RiskGuardPanel } from "@/components/RiskGuardPanel";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  LineChart,
  Activity,
  Sparkles,
  List,
  TrendingUp,
  ArrowRight,
  ChevronDown,
  Sliders,
} from "lucide-react";
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
import { CorrelationCard } from "./CorrelationCard";
import { EdgeQualityCard } from "./EdgeQualityCard";

const PROJECTION_STEPS = 20;

function fmtR(v: number | null): string {
  if (v === null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}R`;
}

function clampPct(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function JournalOverview({
  onNavigate,
}: {
  onNavigate: (tab: "revisione" | "trades", options?: Record<string, string>) => void;
}) {
  const { t, language } = useLanguage();
  const dateLocale = useDateLocale();
  const [analysisOpen, setAnalysisOpen] = useState(false);

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

  const rSamples = useMemo(() => edge?.rSamples ?? [], [edge?.rSamples]);

  const realized = useMemo(() => cumulativeR(rSamples), [rSamples]);
  const bands = useMemo(
    () =>
      monteCarloBands(rSamples, {
        steps: PROJECTION_STEPS,
        start: realized[realized.length - 1] ?? 0,
      }),
    [rSamples, realized],
  );
  const netR = edge?.rSamples && rSamples.length ? (realized[realized.length - 1] ?? null) : null;

  const overall = edge?.overall;
  const payoff =
    overall?.avgWinR != null && overall?.avgLossR != null && overall.avgLossR !== 0
      ? Math.abs(overall.avgWinR / overall.avgLossR)
      : null;
  const stopDiscipline = edge?.discipline.stopDiscipline;
  const disciplinePct = stopDiscipline ? 100 - stopDiscipline.pct : null;
  const revenge = edge?.highlights.postLoss?.trades ?? 0;

  const recentTrades = useMemo(() => {
    if (!entries) return [];
    return [...entries]
      .sort((a, b) => b.tradeDate.localeCompare(a.tradeDate))
      .slice(0, 5)
      .map((e) => {
        const parsed = e.manualTrade
          ? { ...e.manualTrade, stopLoss: e.manualTrade.stopLoss ?? undefined }
          : (parseTradeContent(e.content) ?? {});
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
    {
      l: t("journal.overview.edge_expectancy"),
      v: fmtR(overall?.expectancyR ?? null),
      pct: clampPct((overall?.expectancyR ?? 0) * 100),
      isPositive: (overall?.expectancyR ?? 0) >= 0,
    },
    {
      l: t("journal.overview.edge_payoff"),
      v: payoff === null ? "—" : payoff.toFixed(1),
      pct: clampPct((payoff ?? 0) * 33),
      isPositive: (payoff ?? 0) >= 1,
    },
    {
      l: t("journal.overview.edge_discipline"),
      v: disciplinePct === null ? "—" : `${clampPct(disciplinePct)}%`,
      pct: clampPct(disciplinePct ?? 0),
      isPositive: (disciplinePct ?? 0) >= 80,
    },
    {
      l: t("journal.overview.edge_revenge"),
      v: String(revenge),
      pct: revenge === 0 ? 0 : Math.min(100, revenge * 20),
      isPositive: revenge === 0,
    },
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
    <div className="space-y-6">
      {/* ── 1. ARCHITETTURA DI CONTESTO LIMEN ── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-[#0E0F14]/90 p-4 sm:p-5 backdrop-blur-md">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(197,160,89,0.08)_0%,transparent_75%)] pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#C5A059]">
              {"IL LIBRO DELLA VERITÀ // TRAIETTORIA MATEMATICA"}
            </span>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {processText(language, "legacyAnalytics")}{" "}
              <Link href="/method" className="text-[#C5A059] underline underline-offset-4">
                {t("process.nav.method")}
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* ── 2. CUSTODE DELLA DISCIPLINA LIVE ── */}
      <RiskGuardPanel />

      {/* ── 3. LE 4 FONDAMENTA IMMUTABILI (KPIs MONUMENTALI) ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t("journal.overview.kpi_total")}
          value={overall ? String(overall.closedTrades) : "—"}
          subtitle={edge?.rCoverage ? `${edge.rCoverage.withR} R · ${edge.rCoverage.withoutR} raw` : undefined}
          size="lg"
          className="border-[#C5A059]/30 bg-[#0E0F14]/90 shadow-[0_0_15px_rgba(197,160,89,0.05)] hover:border-[#C5A059]/50"
        />
        <StatTile
          label={t("journal.overview.kpi_winrate")}
          value={overall?.winRate != null ? `${overall.winRate}%` : "—"}
          tone="success"
          size="lg"
          className="border-[#C5A059]/30 bg-[#0E0F14]/90 shadow-[0_0_15px_rgba(197,160,89,0.05)] hover:border-[#C5A059]/50"
        />
        <StatTile
          label={`${t("journal.overview.kpi_net")} · ${processText(language, "estimated")}`}
          value={fmtR(netR)}
          tone={netR === null || netR >= 0 ? "primary" : "destructive"}
          size="lg"
          className="border-[#C5A059]/30 bg-[#0E0F14]/90 shadow-[0_0_15px_rgba(197,160,89,0.05)] hover:border-[#C5A059]/50"
        />
        <StatTile
          label={t("journal.overview.kpi_pf")}
          value={overall?.profitFactor != null ? overall.profitFactor.toFixed(1) : "—"}
          tone={overall?.profitFactor != null && overall.profitFactor >= 1.5 ? "gold" : "default"}
          size="lg"
          className="border-[#C5A059]/30 bg-[#0E0F14]/90 shadow-[0_0_15px_rgba(197,160,89,0.05)] hover:border-[#C5A059]/50"
        />
      </div>

      {overall && (
        <p className="px-1 text-xs font-mono text-muted-foreground">
          {t("intelligence.r_coverage", {
            withR: edge?.rCoverage?.withR ?? 0,
            total: overall.closedTrades,
            missing: edge?.rCoverage?.withoutR ?? overall.closedTrades,
          })}
        </p>
      )}

      {/* ── 4. EQUITY CURVE MONTE CARLO & SCOMPOSIZIONE EDGE ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* Equity curve */}
        <Card className="relative overflow-hidden border border-border/70 bg-[#0E0F14]/90 shadow-[0_0_24px_rgba(0,0,0,0.35)] backdrop-blur-md">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#C5A059]/40 to-transparent" />
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#C5A059]">
                <LineChart className="h-4 w-4" />
              </div>
              <div>
                <p className="font-display text-sm font-bold uppercase tracking-tight text-foreground">
                  {t("journal.overview.equity_title")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("journal.overview.equity_subtitle")}
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 px-2.5 py-1 font-mono text-xs font-bold text-[#C5A059]">
              <TrendingUp className="h-3 w-3" />
              {fmtR(netR)}
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {rSamples.length ? (
              <EquityCurveChart
                realized={realized}
                bands={bands}
                projectionSteps={PROJECTION_STEPS}
              />
            ) : (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {t("intelligence.status.insufficient")}
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/30 pt-3 text-[11px] font-mono text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-3 rounded-full bg-[#22C55E]" />
                <span className="text-foreground/90 font-medium">{t("journal.overview.legend_realized")}</span>
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-3.5 rounded border border-[#C5A059]/50 bg-[#C5A059]/20" />
                <span>{t("journal.overview.legend_band")}</span>
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-0 w-3.5 border-t-2 border-dashed border-[#E5C378]" />
                <span>{t("journal.overview.legend_median")}</span>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Edge breakdown */}
        <Card className="relative overflow-hidden border border-border/70 bg-[#0E0F14]/90 shadow-[0_0_24px_rgba(0,0,0,0.35)] backdrop-blur-md">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#C5A059]/40 to-transparent" />
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#C5A059]">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <p className="font-display text-sm font-bold uppercase tracking-tight text-foreground">
                  {t("journal.overview.edge_title")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("journal.overview.edge_subtitle")}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {edgeBars.map((m) => (
              <div key={m.l} className="space-y-1.5 rounded-lg border border-border/35 bg-[#14151B]/60 p-3">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-semibold text-foreground/90">{m.l}</span>
                  <span className={`font-mono text-sm font-bold ${m.isPositive ? "text-[#C5A059]" : "text-destructive"}`}>
                    {m.v}
                  </span>
                </div>
                <Progress value={m.pct} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── 5. LABORATORIO DIAGNOSTICO AVANZATO (ACCORDION ARCHITETTONICO) ── */}
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-[#0E0F14]/90 backdrop-blur-md shadow-md">
        <button
          type="button"
          onClick={() => setAnalysisOpen(!analysisOpen)}
          className="flex w-full items-center justify-between p-4 sm:p-5 text-left transition-colors hover:bg-secondary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#C5A059]/40 bg-[#C5A059]/10 text-[#C5A059]">
              <Sliders className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#C5A059]">
                  {"LABORATORIO DIAGNOSTICO LIMEN"}
                </span>
                <Badge variant="gold" className="text-[9px] uppercase">
                  {"3 MODULI"}
                </Badge>
              </div>
              <p className="font-display text-sm sm:text-base font-bold text-foreground">
                {t("journal.workspace.analysis")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("journal.workspace.analysis_desc")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`rounded-lg border border-border/60 bg-secondary/40 p-2 text-foreground transition-transform duration-300 ${analysisOpen ? "rotate-180" : ""}`}>
              <ChevronDown className="h-4 w-4" />
            </div>
          </div>
        </button>

        {analysisOpen && (
          <div className="border-t border-border/40 p-4 sm:p-6 space-y-5 bg-[#090A0D]/70 animate-in fade-in slide-in-from-top-2 duration-300">
            <EdgeQualityCard stats={edge?.stats} />
            <RiskOfRuinCard />
            <CorrelationCard />
          </div>
        )}
      </div>

      {/* ── 6. RASSEGNA PERIODICA (4-WEEK RECAP) & ULTIME OPERAZIONI ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 4-week recap */}
        <Card className="border border-border/70 bg-[#0E0F14]/90 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#C5A059]">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="font-display text-sm font-bold uppercase tracking-tight text-foreground">
                  {t("journal.overview.recap_title")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("journal.overview.recap_subtitle")}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 font-mono text-xs text-[#C5A059] hover:bg-[#C5A059]/10 hover:text-[#C5A059]"
              onClick={() => onNavigate("revisione", { kind: "four_week" })}
            >
              {t("journal.overview.recap_open")}
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {recapBlocks.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {recapBlocks.map((b) => (
                  <div key={b.k} className="rounded-xl border border-border/40 bg-[#14151B]/70 p-3.5">
                    <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#C5A059]">
                      {b.k}
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">{b.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {t("journal.overview.recap_empty")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent trades */}
        <Card className="border border-border/70 bg-[#0E0F14]/90 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#C5A059]">
                <List className="h-4 w-4" />
              </div>
              <div>
                <p className="font-display text-sm font-bold uppercase tracking-tight text-foreground">
                  {t("journal.overview.trades_title")}
                </p>
                <p className="text-[11px] text-muted-foreground">{t("journal.overview.trades_subtitle")}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 font-mono text-xs text-[#C5A059] hover:bg-[#C5A059]/10 hover:text-[#C5A059]"
              onClick={() => onNavigate("trades")}
            >
              {t("journal.tab.trades")}
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          {recentTrades.length > 0 ? (
            <div className="divide-y divide-border/25">
              {recentTrades.map((tr) => (
                <div
                  key={tr.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors"
                >
                  <span className="w-20 shrink-0 font-mono text-xs font-bold text-foreground">{tr.pair}</span>
                  {tr.dir && (
                    <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                      /buy|long/i.test(tr.dir) ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" : "bg-destructive/10 text-destructive border border-destructive/25"
                    }`}>
                      {tr.dir.toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground/90">{tr.note}</p>
                    <p className="text-[10px] font-mono text-muted-foreground/60">
                      {format(parseISO(tr.date), "d MMM yyyy", { locale: dateLocale })}
                    </p>
                  </div>
                  <span
                    className={`font-mono text-sm font-bold ${
                      tr.result === "win"
                        ? "text-emerald-400"
                        : tr.result === "loss"
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {fmtR(tr.r)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <CardContent>
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("journal.overview.trades_empty")}
              </p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
