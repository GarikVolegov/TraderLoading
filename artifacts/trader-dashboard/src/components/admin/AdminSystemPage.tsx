import { useQuery } from "@tanstack/react-query";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { Badge } from "@/components/ui/badge";
import { uiText } from "@/contexts/LanguageContext";
import { getAdminSystemOverview, type AdminSystemOverview } from "@/lib/adminApi";
import { Cpu, Database, Server, Users } from "lucide-react";
import { OperationalPageHeader, OperationalLoadingGrid } from "./operational";
import { AdminErrorState } from "./shared";

function RuntimeFlagList({ flags }: { flags: AdminSystemOverview["flags"] }) {
  return (
    <section className="rounded-lg border border-border bg-card/80 p-4">
      <h2 className="text-sm font-semibold">{uiText("auto.ui.1d011abdd4")}</h2>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {flags.map((flag) => (
          <div
            key={flag.key}
            className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
          >
            <span className="font-mono text-xs">{flag.key}</span>
            <Badge variant={flag.configured ? "default" : "outline"}>
              {flag.configured ? "configurato" : "non configurato"}
            </Badge>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AdminSystemPage() {
  const system = useQuery({
    queryKey: ["admin", "system", "overview"],
    queryFn: getAdminSystemOverview,
  });
  const metrics = system.data?.metrics;
  const runtime = system.data?.runtime;

  return (
    <div className="space-y-5">
      <OperationalPageHeader
        title={uiText("auto.ui.c004160342")}
        description="Readiness API, configurazione runtime e superfici operative."
        onRefresh={() => system.refetch()}
        refreshing={system.isFetching}
      />
      {system.isLoading ? (
        <OperationalLoadingGrid />
      ) : system.isError ? (
        <AdminErrorState
          title={uiText("admin.system.unavailable")}
          description="La vista runtime non e stata caricata."
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard
              label="Database"
              value={runtime?.database.status ?? "error"}
              detail={`${runtime?.database.latencyMs ?? 0}ms`}
              icon={Server}
            />
            <AdminMetricCard
              label="Uptime"
              value={`${runtime?.uptimeSeconds ?? 0}s`}
              detail={runtime?.nodeEnv ?? "unknown"}
              icon={Cpu}
            />
            <AdminMetricCard
              label="Sessioni"
              value={metrics?.sessions ?? 0}
              detail="Session store"
              icon={Users}
            />
            <AdminMetricCard
              label="News snapshot"
              value={metrics?.newsSnapshots ?? 0}
              detail="Cache macro news"
              icon={Database}
            />
          </div>
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <RuntimeFlagList flags={system.data?.flags ?? []} />
            <section className="rounded-lg border border-border bg-card/80 p-4">
              <h2 className="text-sm font-semibold">{uiText("auto.ui.d57f61bdf1")}</h2>
              <dl className="mt-3 grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <dt className="text-muted-foreground">{uiText("auto.ui.3344676015")}</dt>
                  <dd className="font-mono text-xs">{runtime?.version ?? "-"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <dt className="text-muted-foreground">{uiText("auto.ui.ebc56aa4ac")}</dt>
                  <dd>{metrics?.pushSubscriptions ?? 0}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <dt className="text-muted-foreground">{uiText("auto.ui.e85836e710")}</dt>
                  <dd>{metrics?.adminUserStatuses ?? 0}</dd>
                </div>
              </dl>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
