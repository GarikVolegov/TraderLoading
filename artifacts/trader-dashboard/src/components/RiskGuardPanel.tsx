import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import { getGetJournalEdgeQueryKey, useGetJournalEdge } from "@workspace/api-client-react";
import { useLanguage } from "@/contexts/LanguageContext";

/** Shares the generated query with JournalOverview; thresholds stay server-owned. */
export function RiskGuardPanel() {
  const { t } = useLanguage();
  const { data, isPending, isError, refetch, isFetching } = useGetJournalEdge({
    query: { queryKey: getGetJournalEdgeQueryKey(), refetchInterval: 30_000 },
  });
  const guard = data?.guard;
  const unavailable = isError || (!isPending && !guard);
  const alerts = guard?.alerts ?? [];
  const danger = alerts.some((alert) => alert.severity === "danger");
  return (
    <section aria-label={t("guard.title")} className={`rounded-xl border p-4 space-y-3 bg-card/80 ${danger ? "border-destructive/50" : "border-border/60"}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />{t("guard.title")}</h2>
        <button type="button" onClick={() => void refetch()} disabled={isFetching} aria-label={t("market.retry")} className="p-2 rounded-lg hover:bg-secondary disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>
      {isPending && <p role="status" className="text-sm text-muted-foreground">{t("market.loading")}</p>}
      {unavailable && <p role="alert" className="text-sm text-warning">{t("guard.unavailable")}</p>}
      {alerts.length > 0 && (
        <ul className="space-y-2" aria-label={t("guard.title")}>
          {alerts.map((alert) => (
            <li key={alert.type} className={`flex items-start gap-2 text-sm ${alert.severity === "danger" ? "text-destructive" : "text-warning"}`}>
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              {t(`journal.edge.guard_${alert.type}`, { value: alert.value, threshold: alert.threshold })}
            </li>
          ))}
        </ul>
      )}
      {guard && !unavailable && alerts.length === 0 && <p className="text-sm text-muted-foreground">{t(guard.todayTrades ? "guard.clear" : "guard.empty")}</p>}
      <p className="text-xs text-muted-foreground">{t("guard.scope")}{guard && <> · {t("guard.checked_at", { time: new Date(guard.evaluatedAt).toLocaleString() })}</>}</p>
    </section>
  );
}
