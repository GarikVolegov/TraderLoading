import { useQuery } from "@tanstack/react-query";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { uiText } from "@/contexts/LanguageContext";
import { getAdminSupportOverview } from "@/lib/adminApi";
import { Activity, AlertTriangle, Bell, ShieldCheck } from "lucide-react";
import { OperationalPageHeader, OperationalLoadingGrid } from "./operational";
import { formatAdminDate, AdminErrorState } from "./shared";

export function AdminSupportPage() {
  const support = useQuery({
    queryKey: ["admin", "support", "overview"],
    queryFn: getAdminSupportOverview,
  });
  const metrics = support.data?.metrics;

  return (
    <div className="space-y-5">
      <OperationalPageHeader
        title={uiText("auto.ui.6f2eaf5d94")}
        description="Triage account e segnali utili per assistere utenti reali."
        onRefresh={() => support.refetch()}
        refreshing={support.isFetching}
      />
      {support.isLoading ? (
        <OperationalLoadingGrid />
      ) : support.isError ? (
        <AdminErrorState
          title={uiText("admin.support.unavailable")}
          description="La vista support non e stata caricata."
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard
              label="Sospesi"
              value={metrics?.suspendedUsers ?? 0}
              detail="Account da verificare"
              icon={AlertTriangle}
            />
            <AdminMetricCard
              label="Attivi oggi"
              value={metrics?.activeToday ?? 0}
              detail="Login access"
              icon={Activity}
            />
            <AdminMetricCard
              label="Push subscriber"
              value={metrics?.pushSubscribers ?? 0}
              detail="Endpoint notifiche"
              icon={Bell}
            />
            <AdminMetricCard
              label="Azioni admin oggi"
              value={metrics?.adminActionsToday ?? 0}
              detail="Audit log creati"
              icon={ShieldCheck}
            />
          </div>
          <section className="rounded-lg border border-border bg-card/80 p-4">
            <h2 className="text-sm font-semibold">{uiText("auto.ui.f08d782f0a")}</h2>
            <div className="mt-3 space-y-2">
              {(support.data?.recentLoginAccess ?? []).map((item) => (
                <div
                  key={item.id}
                  className="grid gap-1 rounded-md border border-border p-3 text-sm md:grid-cols-[1fr_auto]"
                >
                  <div>
                    <div className="font-mono text-xs">{item.userId}</div>
                    <div className="text-muted-foreground">{item.ipAddress}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatAdminDate(item.createdAt)}
                  </div>
                </div>
              ))}
              {(support.data?.recentLoginAccess ?? []).length === 0 && (
                <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Nessun accesso registrato.
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
