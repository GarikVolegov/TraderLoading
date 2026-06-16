import { type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Flame,
  Gauge,
  Hourglass,
  LineChart,
  Repeat,
  ShieldAlert,
  TrendingDown,
  Trophy,
} from "lucide-react";
import { Siren } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  useGetJournalEdge,
  getGetJournalEdgeQueryKey,
  type EdgeSlice,
  type EdgeSliceRef,
  type RiskGuardReport,
  type RiskGuardAlert,
} from "@workspace/api-client-react";

const GUARD_ALERT_KEY: Record<RiskGuardAlert["type"], string> = {
  daily_loss: "journal.edge.guard_daily_loss",
  daily_loss_cash: "journal.edge.guard_daily_loss_cash",
  loss_streak: "journal.edge.guard_loss_streak",
  overtrading: "journal.edge.guard_overtrading",
  revenge: "journal.edge.guard_revenge",
};

const DIMENSION_KEYS: Record<EdgeSliceRef["dimension"], string> = {
  symbol: "journal.edge.dim_symbol",
  direction: "journal.edge.dim_direction",
  session: "journal.edge.dim_session",
  dayOfWeek: "journal.edge.dim_day",
};

function rColor(value: number | null): string {
  if (value === null || value === 0) return "text-muted-foreground";
  return value > 0 ? "text-success" : "text-destructive";
}

function fmtR(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}R`;
}

function fmtPct(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

function fmtMoney(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("it-IT", { maximumFractionDigits: 2 })}`;
}

function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours < 24) return mins ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}g ${hours % 24}h`;
}

function sliceLabel(dimension: EdgeSliceRef["dimension"] | "direction", label: string): string {
  if (dimension === "direction") {
    if (label === "long") return "Long";
    if (label === "short") return "Short";
  }
  return label;
}

function HeroStat({ label, value, valueClass, hint }: { label: string; value: string; valueClass?: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 p-4">
      <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl sm:text-3xl font-mono font-bold ${valueClass ?? "text-foreground"}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground/70 mt-1">{hint}</p>}
    </div>
  );
}

function VerdictCard({ tone, icon, heading, description }: {
  tone: "good" | "bad" | "neutral";
  icon: ReactNode;
  heading: string;
  description: string;
}) {
  const toneClass =
    tone === "good"
      ? "border-success/30 bg-success/5"
      : tone === "bad"
        ? "border-destructive/30 bg-destructive/5"
        : "border-border/50 bg-card/60";
  const iconClass = tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "text-muted-foreground";
  return (
    <div className={`rounded-2xl border p-4 backdrop-blur-sm ${toneClass}`}>
      <div className={`mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${iconClass}`}>
        {icon}
        {heading}
      </div>
      <p className="text-sm leading-relaxed text-foreground/90">{description}</p>
    </div>
  );
}

function BreakdownCard({ heading, icon, slices, dimension }: {
  heading: string;
  icon: ReactNode;
  slices: EdgeSlice[];
  dimension: EdgeSliceRef["dimension"];
}) {
  const { t } = useLanguage();
  if (slices.length === 0) return null;
  const maxAbs = Math.max(0.01, ...slices.map((s) => (s.expectancyR === null ? 0 : Math.abs(s.expectancyR))));

  return (
    <div className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/30 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-primary">{icon}</span>
        {heading}
      </div>
      <div className="space-y-3">
        {slices.map((slice) => {
          const r = slice.expectancyR;
          const width = r === null ? 0 : Math.round((Math.abs(r) / maxAbs) * 100);
          return (
            <div key={slice.label}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-foreground">{sliceLabel(dimension, slice.label)}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{t("journal.edge.trades_unit", { n: slice.trades })}</span>
                  <span>{t("journal.edge.win_unit", { pct: fmtPct(slice.winRate) })}</span>
                  <span className={`font-mono font-semibold ${rColor(r)}`}>{fmtR(r)}</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full ${r !== null && r >= 0 ? "bg-success/70" : "bg-destructive/70"}`}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RiskGuardBanner({ guard }: { guard: RiskGuardReport }) {
  const { t } = useLanguage();
  if (guard.alerts.length === 0) return null;
  const danger = guard.alerts.some((a) => a.severity === "danger");
  const toneClass = danger
    ? "border-destructive/50 bg-destructive/10 text-destructive"
    : "border-warning/50 bg-warning/10 text-warning";

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
        <Siren className="h-4 w-4" />
        {t("journal.edge.guard_title")}
      </div>
      <ul className="space-y-1.5">
        {guard.alerts.map((alert) => (
          <li key={alert.type} className="flex items-start gap-2 text-sm text-foreground/90">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />
            {t(GUARD_ALERT_KEY[alert.type], { value: alert.value, threshold: alert.threshold })}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function JournalEdge() {
  const { t } = useLanguage();
  const { data, isLoading } = useGetJournalEdge({
    query: { queryKey: getGetJournalEdgeQueryKey(), refetchInterval: 30_000 },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl animate-pulse bg-card/60 border border-border/30" />
        ))}
      </div>
    );
  }

  if (!data || data.overall.closedTrades === 0) {
    return (
      <Card className="bg-card/60 backdrop-blur-sm border-dashed border-border/30">
        <CardContent className="p-16 text-center">
          <LineChart className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-bold mb-2">{t("journal.edge.empty_title")}</h3>
          <p className="text-muted-foreground max-w-md mx-auto">{t("journal.edge.empty_desc")}</p>
        </CardContent>
      </Card>
    );
  }

  const { overall, breakdowns, highlights, discipline, guard } = data;
  const showDiscipline =
    discipline.stopDiscipline || discipline.holdTime || discipline.drawdown ||
    (discipline.overtrading?.busyExpectancyR != null && discipline.overtrading?.calmExpectancyR != null);
  const rCoverage = overall.closedTrades > 0
    ? t("journal.edge.r_coverage", { withR: overall.tradesWithR, total: overall.closedTrades })
    : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Circuit-breaker: risk patterns active right now */}
      <RiskGuardBanner guard={guard} />

      {/* Hero metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <HeroStat
          label={t("journal.edge.expectancy")}
          value={fmtR(overall.expectancyR)}
          valueClass={`font-mono ${rColor(overall.expectancyR)}`}
          hint={rCoverage}
        />
        <HeroStat
          label={t("journal.edge.win_rate")}
          value={fmtPct(overall.winRate)}
          hint={t("journal.edge.closed_trades", { n: overall.closedTrades })}
        />
        <HeroStat
          label={t("journal.edge.profit_factor")}
          value={overall.profitFactor === null ? "—" : overall.profitFactor.toFixed(2)}
          valueClass={`font-mono ${overall.profitFactor !== null && overall.profitFactor >= 1 ? "text-success" : "text-destructive"}`}
        />
        <HeroStat
          label={t("journal.edge.net_pnl")}
          value={fmtMoney(overall.netProfit)}
          valueClass={`font-mono ${overall.netProfit >= 0 ? "text-success" : "text-destructive"}`}
          hint={overall.avgWin !== null && overall.avgLoss !== null
            ? t("journal.edge.avg_label", { win: fmtMoney(overall.avgWin), loss: fmtMoney(overall.avgLoss) })
            : undefined}
        />
      </div>

      {/* Verdict: edge, leak, revenge */}
      {(highlights.bestSlice || highlights.worstSlice || highlights.postLoss) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {highlights.bestSlice && (
            <VerdictCard
              tone="good"
              icon={<Trophy className="h-4 w-4" />}
              heading={t("journal.edge.best_title")}
              description={t("journal.edge.best_body", {
                dim: t(DIMENSION_KEYS[highlights.bestSlice.dimension]),
                label: sliceLabel(highlights.bestSlice.dimension, highlights.bestSlice.label),
                r: fmtR(highlights.bestSlice.expectancyR),
                trades: highlights.bestSlice.trades,
              })}
            />
          )}
          {highlights.worstSlice && (
            <VerdictCard
              tone="bad"
              icon={<AlertTriangle className="h-4 w-4" />}
              heading={t("journal.edge.worst_title")}
              description={t("journal.edge.worst_body", {
                dim: t(DIMENSION_KEYS[highlights.worstSlice.dimension]),
                label: sliceLabel(highlights.worstSlice.dimension, highlights.worstSlice.label),
                r: fmtR(highlights.worstSlice.expectancyR),
                trades: highlights.worstSlice.trades,
              })}
            />
          )}
          {highlights.postLoss && (
            <VerdictCard
              tone={
                highlights.postLoss.expectancyR !== null &&
                highlights.postLoss.baselineExpectancyR !== null &&
                highlights.postLoss.expectancyR < highlights.postLoss.baselineExpectancyR
                  ? "bad"
                  : "neutral"
              }
              icon={<Flame className="h-4 w-4" />}
              heading={t("journal.edge.revenge_title")}
              description={t("journal.edge.revenge_body", {
                trades: highlights.postLoss.trades,
                r: fmtR(highlights.postLoss.expectancyR),
                baseline: fmtR(highlights.postLoss.baselineExpectancyR),
              })}
            />
          )}
        </div>
      )}

      {/* Breakdowns */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <BreakdownCard heading={t("journal.edge.by_session")} icon={<Activity className="h-4 w-4" />} slices={breakdowns.bySession} dimension="session" />
        <BreakdownCard heading={t("journal.edge.by_day")} icon={<CalendarDays className="h-4 w-4" />} slices={breakdowns.byDayOfWeek} dimension="dayOfWeek" />
        <BreakdownCard heading={t("journal.edge.by_direction")} icon={<Gauge className="h-4 w-4" />} slices={breakdowns.byDirection} dimension="direction" />
        <BreakdownCard heading={t("journal.edge.by_symbol")} icon={<BarChart3 className="h-4 w-4" />} slices={breakdowns.bySymbol.slice(0, 8)} dimension="symbol" />
      </div>

      {/* Discipline: the behavioural leaks that empty the account */}
      {showDiscipline && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t("journal.edge.discipline")}</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {discipline.stopDiscipline && (
              <VerdictCard
                tone={discipline.stopDiscipline.pct === 0 ? "good" : discipline.stopDiscipline.pct <= 20 ? "neutral" : "bad"}
                icon={<ShieldAlert className="h-4 w-4" />}
                heading={t("journal.edge.stop_title")}
                description={discipline.stopDiscipline.pct === 0
                  ? t("journal.edge.stop_ok")
                  : t("journal.edge.stop_bad", {
                      pct: discipline.stopDiscipline.pct,
                      beyond: discipline.stopDiscipline.lossesBeyond1R,
                      losses: discipline.stopDiscipline.losses,
                    })}
              />
            )}

            {discipline.holdTime && (
              <VerdictCard
                tone={discipline.holdTime.avgLoserMinutes > discipline.holdTime.avgWinnerMinutes ? "bad" : "neutral"}
                icon={<Hourglass className="h-4 w-4" />}
                heading={t("journal.edge.hold_title")}
                description={t(
                  discipline.holdTime.avgLoserMinutes > discipline.holdTime.avgWinnerMinutes
                    ? "journal.edge.hold_disposition"
                    : "journal.edge.hold_coherent",
                  {
                    loser: fmtDuration(discipline.holdTime.avgLoserMinutes),
                    winner: fmtDuration(discipline.holdTime.avgWinnerMinutes),
                  },
                )}
              />
            )}

            {discipline.overtrading?.busyExpectancyR != null && discipline.overtrading?.calmExpectancyR != null && (
              <VerdictCard
                tone={discipline.overtrading.busyExpectancyR < discipline.overtrading.calmExpectancyR ? "bad" : "neutral"}
                icon={<Repeat className="h-4 w-4" />}
                heading={t("journal.edge.overtrading_title")}
                description={t("journal.edge.overtrading_body", {
                  threshold: discipline.overtrading.busyThreshold,
                  busy: fmtR(discipline.overtrading.busyExpectancyR),
                  calm: fmtR(discipline.overtrading.calmExpectancyR),
                  peak: discipline.overtrading.busiestDayTrades,
                })}
              />
            )}

            {discipline.drawdown && (
              <VerdictCard
                tone="neutral"
                icon={<TrendingDown className="h-4 w-4" />}
                heading={t("journal.edge.drawdown_title")}
                description={t("journal.edge.drawdown_body", {
                  streak: discipline.drawdown.longestLossStreak,
                  dd: fmtMoney(-discipline.drawdown.maxDrawdown),
                })}
              />
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
