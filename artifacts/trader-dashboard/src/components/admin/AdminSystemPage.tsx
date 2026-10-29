import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { uiText } from "@/contexts/LanguageContext";
import {
  getAdminSystemOverview,
  getAdminSystemFlags,
  toggleAdminSystemFlag,
  type AdminSystemOverview,
} from "@/lib/adminApi";
import { Activity, AlertTriangle, CheckCircle2, Cpu, Database, RefreshCw, Server, ShieldCheck, Sliders, Users, Zap } from "lucide-react";
import { OperationalPageHeader, OperationalLoadingGrid } from "./operational";
import { AdminErrorState } from "./shared";

function InteractiveFeatureFlagsSection() {
  const qc = useQueryClient();
  const flagsQuery = useQuery({
    queryKey: ["admin", "system", "flags"],
    queryFn: getAdminSystemFlags,
  });

  const toggleMutation = useMutation({
    mutationFn: (variables: { key: string; enabled: boolean }) =>
      toggleAdminSystemFlag(variables.key, variables.enabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "system", "flags"] });
    },
  });

  const flags = flagsQuery.data?.flags ?? [];

  return (
    <section className="rounded-lg border border-border bg-card/80 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" /> Interruttori Operativi di Sistema
          </h2>
          <p className="text-xs text-muted-foreground">
            Controllo dinamico dei feature flags e dello stato di manutenzione della piattaforma.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => flagsQuery.refetch()}
          disabled={flagsQuery.isFetching}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {flagsQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)
        ) : (
          flags.map((flag) => (
            <div
              key={flag.key}
              className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold">{flag.key}</span>
                  <Badge
                    variant={flag.enabled ? "default" : "secondary"}
                    className={flag.enabled ? "bg-emerald-600 text-white" : ""}
                  >
                    {flag.enabled ? "ATTIVO" : "DISATTIVATO"}
                  </Badge>
                </div>
                {flag.description && (
                  <p className="mt-1 text-xs text-muted-foreground truncate">{flag.description}</p>
                )}
              </div>
              <Button
                size="sm"
                variant={flag.enabled ? "destructive" : "outline"}
                disabled={toggleMutation.isPending}
                onClick={() =>
                  toggleMutation.mutate({
                    key: flag.key,
                    enabled: !flag.enabled,
                  })
                }
              >
                {flag.enabled ? "Disattiva" : "Attiva"}
              </Button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

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

function SovereignWatchdogSection({
  watchdog,
  circuitBreakers,
}: {
  watchdog?: AdminSystemOverview["watchdog"];
  circuitBreakers?: AdminSystemOverview["circuitBreakers"];
}) {
  const circuits = circuitBreakers ? Object.entries(circuitBreakers) : [];

  return (
    <section className="rounded-lg border border-[#C5A059]/30 bg-[#0d0f14]/90 p-4 space-y-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#C5A059]/15 pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#C5A059]" />
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-[#E8C56A] uppercase font-mono">
              Sentinella d'Integrità &amp; Telemetria Sovrana
            </h2>
            <p className="text-xs text-muted-foreground">
              Monitoraggio proattivo dell'Event Loop, auto-curazione dei task asincroni e stato circuit breaker.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase tracking-wider whitespace-nowrap border ${
              watchdog?.status === "healthy"
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                : watchdog?.status === "degraded"
                  ? "bg-[#C5A059]/20 border-[#C5A059]/50 text-[#E8C56A]"
                  : "bg-destructive/20 border-destructive/50 text-destructive"
            }`}
          >
            ● {watchdog?.status ?? "attivo"}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-border bg-[#11131c] p-3 space-y-1">
          <p className="text-[11px] font-mono text-muted-foreground uppercase">Event Loop Lag (p95)</p>
          <p className="font-mono text-base font-bold text-white whitespace-nowrap">
            {watchdog?.eventLoopDelayMs.p95 ?? 0} <span className="text-xs text-muted-foreground">ms</span>
          </p>
          <p className="text-[10px] text-muted-foreground">
            Media: <span className="font-mono text-white/80">{watchdog?.eventLoopDelayMs.mean ?? 0} ms</span> · Max: <span className="font-mono text-white/80">{watchdog?.eventLoopDelayMs.max ?? 0} ms</span>
          </p>
        </div>

        <div className="rounded-md border border-border bg-[#11131c] p-3 space-y-1">
          <p className="text-[11px] font-mono text-muted-foreground uppercase">Auto-Curazioni Task</p>
          <p className="font-mono text-base font-bold text-emerald-400 whitespace-nowrap">
            {watchdog?.recoveredRejections ?? 0} <span className="text-xs text-muted-foreground">isolate</span>
          </p>
          <p className="text-[10px] text-muted-foreground">
            Errori asincroni neutralizzati senza crash di runtime
          </p>
        </div>

        <div className="rounded-md border border-border bg-[#11131c] p-3 space-y-1">
          <p className="text-[11px] font-mono text-muted-foreground uppercase">Anomalie Registrate</p>
          <p className="font-mono text-base font-bold text-white whitespace-nowrap">
            {watchdog?.totalAnomalies ?? 0} <span className="text-xs text-muted-foreground">totali</span>
          </p>
          <p className="text-[10px] text-muted-foreground">
            Ring buffer immutabile (ultime 100 istanze)
          </p>
        </div>

        <div className="rounded-md border border-border bg-[#11131c] p-3 space-y-1">
          <p className="text-[11px] font-mono text-muted-foreground uppercase">Uptime Protetto</p>
          <p className="font-mono text-base font-bold text-[#E8C56A] whitespace-nowrap">
            {Math.floor((watchdog?.uptimeSeconds ?? 0) / 3600)}h {Math.floor(((watchdog?.uptimeSeconds ?? 0) % 3600) / 60)}m
          </p>
          <p className="text-[10px] text-muted-foreground">
            Sessione attiva: <span className="font-mono text-white/80">{watchdog?.uptimeSeconds ?? 0}s</span>
          </p>
        </div>
      </div>

      {watchdog?.maintenance && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-[#11131c] p-2.5 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            <span className="text-muted-foreground uppercase text-[11px]">Auto-Curazione Programmata &amp; DB Vacuum:</span>
            <span className="text-white font-bold">
              {watchdog.maintenance.status === "completed" ? "Regolare" : watchdog.maintenance.status}
            </span>
            {watchdog.maintenance.dbPingMs !== null && (
              <span className="text-muted-foreground">
                (Pool Ping: <span className="text-emerald-400 font-semibold">{watchdog.maintenance.dbPingMs} ms</span>)
              </span>
            )}
            {watchdog.maintenance.prunedOrphanRooms > 0 && (
              <span className="text-[#E8C56A]">
                · Bonificate {watchdog.maintenance.prunedOrphanRooms} stanze orfane
              </span>
            )}
          </div>
          {watchdog.maintenance.lastRunAt && (
            <span className="text-[10px] text-muted-foreground">
              Ultimo ciclo: {new Date(watchdog.maintenance.lastRunAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {circuits.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-[#C5A059]" />
            Circuit Breakers Provider Upstream
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {circuits.map(([name, stats]) => (
              <div
                key={name}
                className="flex items-center justify-between rounded border border-border bg-[#11131c] p-2.5 text-xs"
              >
                <div className="min-w-0 pr-2">
                  <span className="font-mono font-semibold text-white capitalize">{name}</span>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    Succ: {stats.successCount} · Fall: {stats.failureCount}
                  </div>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold uppercase whitespace-nowrap border ${
                    stats.state === "CLOSED"
                      ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-400"
                      : stats.state === "HALF_OPEN"
                        ? "bg-[#C5A059]/20 border-[#C5A059]/40 text-[#E8C56A]"
                        : "bg-destructive/20 border-destructive/40 text-destructive"
                  }`}
                >
                  {stats.state}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {watchdog?.recentAnomalies && watchdog.recentAnomalies.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-[#C5A059]" />
            Registro Anomalie Recenti (Watchdog Log)
          </h3>
          <div className="rounded border border-border bg-[#11131c] divide-y divide-border overflow-hidden">
            {watchdog.recentAnomalies.slice(0, 5).map((anomaly) => (
              <div key={anomaly.id} className="p-2.5 flex items-start justify-between gap-3 text-xs">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold uppercase border ${
                        anomaly.severity === "critical"
                          ? "bg-destructive/20 border-destructive/40 text-destructive"
                          : "bg-[#C5A059]/15 border-[#C5A059]/35 text-[#E8C56A]"
                      }`}
                    >
                      {anomaly.kind}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {new Date(anomaly.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-white/90 truncate font-mono text-[11px]">{anomaly.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
          <SovereignWatchdogSection
            watchdog={system.data?.watchdog}
            circuitBreakers={system.data?.circuitBreakers}
          />
          <InteractiveFeatureFlagsSection />
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
