import { AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";
import { getGetJournalEdgeQueryKey, useGetJournalEdge } from "@workspace/api-client-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { SigilIcon } from "@/components/ui/SigilIcon";

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
    <section
      aria-label={t("guard.title")}
      className={`relative overflow-hidden rounded-xl border p-4 sm:p-5 transition-all ${
        danger
          ? "border-destructive/60 bg-[#160c0f]/90 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
          : "border-[#C5A059]/35 bg-[#0E0F14]/90 shadow-[0_0_20px_rgba(197,160,89,0.08)] backdrop-blur-md"
      }`}
    >
      {/* Background ambient gradient */}
      <div
        className={`absolute -right-12 -top-12 h-36 w-36 rounded-full blur-3xl pointer-events-none ${
          danger ? "bg-destructive/15" : "bg-[#C5A059]/10"
        }`}
      />

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C5A059]/35 bg-[#C5A059]/10 text-[#C5A059]">
            <SigilIcon variant="keeper" size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#C5A059]">
                {"CUSTODE DELLA SOGLIA // SALVAGUARDIA LIVE"}
              </span>
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <h2 className="text-sm font-bold text-foreground">
              {t("guard.title")}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {guard && !unavailable && alerts.length === 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {"INTEGRITÀ RISPETTATA"}
            </span>
          )}
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label={t("market.retry")}
            className="rounded-lg border border-border/60 bg-secondary/40 p-1.5 text-muted-foreground transition-colors hover:border-[#C5A059]/40 hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-[#C5A059]" : ""}`} />
          </button>
        </div>
      </div>

      <div className="relative z-10 mt-3 space-y-2.5">
        {isPending && (
          <p role="status" className="font-mono text-xs text-muted-foreground">
            {t("market.loading")}
          </p>
        )}
        {unavailable && (
          <p role="alert" className="font-mono text-xs text-warning">
            {t("guard.unavailable")}
          </p>
        )}

        {alerts.length > 0 && (
          <ul className="space-y-2" aria-label={t("guard.title")}>
            {alerts.map((alert) => (
              <li
                key={alert.type}
                className={`flex items-start gap-2.5 rounded-lg border p-3 font-mono text-xs ${
                  alert.severity === "danger"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-warning/40 bg-warning/10 text-warning"
                }`}
              >
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <strong className="block font-sans text-sm font-bold">{t("guard.title")}</strong>
                  {t(`journal.edge.guard_${alert.type}`, {
                    value: alert.value,
                    threshold: alert.threshold,
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}

        {guard && !unavailable && alerts.length === 0 && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t(guard.todayTrades ? "guard.clear" : "guard.empty")}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/30 text-[10px] text-muted-foreground/75 font-mono">
          <span>{t("guard.scope")}</span>
          {guard && (
            <span>
              {t("guard.checked_at", {
                time: new Date(guard.evaluatedAt).toLocaleTimeString("it-IT", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  timeZone: "Europe/Rome",
                }),
              })}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
