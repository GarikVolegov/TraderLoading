import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { uiText } from "@/contexts/LanguageContext";
import { getAdminDashboard } from "@/lib/adminApi";
import { Activity, AlertTriangle, BookOpen, Database, FileText, RefreshCw, Users } from "lucide-react";
import { AdminErrorState, AuditPreviewList } from "./shared";

export function AdminDashboardPage() {
  const dashboard = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: getAdminDashboard,
  });
  const metrics = dashboard.data?.metrics;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{uiText("admin.dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground">
            Vista operativa su utenti, trading data e attivita admin.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => dashboard.refetch()}
          disabled={dashboard.isFetching}
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Aggiorna
        </Button>
      </div>

      {dashboard.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      ) : dashboard.isError ? (
        <AdminErrorState
          title={uiText("admin.dashboard.unavailable")}
          description="Le metriche admin non sono state caricate. Riprova o controlla i log API."
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <AdminMetricCard
              label="Profili"
              value={metrics?.totalProfiles ?? 0}
              detail="Utenti con profilo"
              icon={Users}
            />
            <AdminMetricCard
              label="Attivi oggi"
              value={metrics?.activeToday ?? 0}
              detail="Login access registrati"
              icon={Activity}
            />
            <AdminMetricCard
              label="Trade oggi"
              value={metrics?.tradesToday ?? 0}
              detail="Import account trades"
              icon={Database}
            />
            <AdminMetricCard
              label="Journal oggi"
              value={metrics?.journalToday ?? 0}
              detail="Entry create oggi"
              icon={FileText}
            />
            <AdminMetricCard
              label="Backtest oggi"
              value={metrics?.backtestsToday ?? 0}
              detail="Sessioni create oggi"
              icon={BookOpen}
            />
            <AdminMetricCard
              label="Sospesi"
              value={metrics?.suspendedUsers ?? 0}
              detail="Account con blocco admin"
              icon={AlertTriangle}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="rounded-lg border border-border bg-card/80 p-4">
              <h2 className="text-sm font-semibold">{uiText("auto.ui.ebc9cfde58")}</h2>
              <div className="mt-3 space-y-2">
                {(dashboard.data?.urgentActions ?? []).map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-center justify-between rounded-md border border-border p-3 text-sm transition-colors hover:bg-muted"
                  >
                    <span>{item.label}</span>
                    <span className="font-semibold tabular-nums">
                      {item.count}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
            <section className="rounded-lg border border-border bg-card/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">{uiText("auto.ui.4dd1c1fe89")}</h2>
                <Link
                  href="/admin/security"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Apri log
                </Link>
              </div>
              <div className="mt-3">
                <AuditPreviewList audit={dashboard.data?.recentAudit ?? []} />
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
