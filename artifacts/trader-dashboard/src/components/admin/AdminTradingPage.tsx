import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { uiText } from "@/contexts/LanguageContext";
import {
  getAdminTradingOverview,
  getAdminTradingDiagnostics,
  retryAdminTradingSync,
} from "@/lib/adminApi";
import { Activity, BookOpen, Database, FileText, RefreshCw, TrendingUp, Wifi } from "lucide-react";
import { OperationalPageHeader, OperationalLoadingGrid } from "./operational";
import { formatAdminDate, statusVariant, AdminErrorState } from "./shared";

export function AdminTradingPage() {
  const qc = useQueryClient();
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const trading = useQuery({
    queryKey: ["admin", "trading", "overview"],
    queryFn: getAdminTradingOverview,
  });

  const diagnostics = useQuery({
    queryKey: ["admin", "trading", "diagnostics"],
    queryFn: getAdminTradingDiagnostics,
  });

  const retrySyncMutation = useMutation({
    mutationFn: (profileId?: string) => retryAdminTradingSync(profileId),
    onSuccess: (data) => {
      setSyncStatusMsg(data.message);
      qc.invalidateQueries({ queryKey: ["admin", "trading"] });
    },
    onError: (err: Error) => {
      setSyncStatusMsg(`Errore re-sync: ${err.message}`);
    },
  });

  const metrics = trading.data?.metrics;
  const brokerProfiles = diagnostics.data?.profiles ?? [];

  return (
    <div className="space-y-5">
      <OperationalPageHeader
        title={uiText("auto.ui.49352196f6")}
        description="Diagnostica aggregata su broker, import e backtest."
        onRefresh={() => trading.refetch()}
        refreshing={trading.isFetching}
      />
      {trading.isLoading ? (
        <OperationalLoadingGrid />
      ) : trading.isError ? (
        <AdminErrorState
          title={uiText("admin.trading.unavailable")}
          description="Le metriche trading admin non sono state caricate."
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <AdminMetricCard
              label="Broker profile"
              value={metrics?.brokerProfiles ?? 0}
              detail="Profili broker salvati"
              icon={Wifi}
            />
            <AdminMetricCard
              label="Trade importati"
              value={metrics?.importedTrades ?? 0}
              detail="Record account trades"
              icon={TrendingUp}
            />
            <AdminMetricCard
              label="Trade aperti"
              value={metrics?.openTrades ?? 0}
              detail="Status open"
              icon={Activity}
            />
            <AdminMetricCard
              label="Import oggi"
              value={metrics?.tradesToday ?? 0}
              detail="Creati da inizio giornata"
              icon={Database}
            />
            <AdminMetricCard
              label="Backtest"
              value={metrics?.backtestSessions ?? 0}
              detail="Sessioni create"
              icon={BookOpen}
            />
            <AdminMetricCard
              label="Trade backtest"
              value={metrics?.backtestTrades ?? 0}
              detail="Operazioni simulate"
              icon={FileText}
            />
          </div>

          {syncStatusMsg && (
            <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-xs text-primary flex items-center justify-between">
              <span>{syncStatusMsg}</span>
              <Button size="sm" variant="ghost" onClick={() => setSyncStatusMsg(null)}>
                Chiudi
              </Button>
            </div>
          )}

          {/* DIAGNOSTICA PROFILI BROKER & RE-SYNC */}
          <section className="overflow-hidden rounded-lg border border-border bg-card/80 space-y-3 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-primary" /> Diagnostica Connessioni Broker & Re-Sync
                </h2>
                <p className="text-xs text-muted-foreground">
                  Stato dei connector attivi, provider e forzatura sincronizzazione.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={retrySyncMutation.isPending}
                onClick={() => retrySyncMutation.mutate(undefined)}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Forza Re-Sync Globale
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profilo / Account</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Ambiente</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diagnostics.isLoading ? (
                  Array.from({ length: 2 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={5}>
                        <div className="h-6 bg-muted/40 animate-pulse rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : brokerProfiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-16 text-center text-xs text-muted-foreground">
                      Nessun profilo broker collegato al momento.
                    </TableCell>
                  </TableRow>
                ) : (
                  brokerProfiles.map((p, idx) => {
                    const prof = p as { id?: string; name?: string; provider?: string; environment?: string; status?: string };
                    return (
                      <TableRow key={prof.id ?? idx}>
                        <TableCell>
                          <div className="font-medium text-xs">{prof.name || prof.id}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{prof.id}</div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{prof.provider || "generic"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {prof.status || "active"}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize text-xs text-muted-foreground">
                          {prof.environment || "live"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={retrySyncMutation.isPending}
                            onClick={() => retrySyncMutation.mutate(prof.id)}
                          >
                            <RefreshCw className="mr-1 h-3 w-3" /> Re-Sync
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </section>
          <section className="overflow-hidden rounded-lg border border-border bg-card/80">
            <div className="border-b border-border p-4">
              <h2 className="text-sm font-semibold">{uiText("auto.ui.219d729ca5")}</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{uiText("auto.ui.a7677e84b6")}</TableHead>
                  <TableHead>{uiText("auto.ui.cef52217ee")}</TableHead>
                  <TableHead>{uiText("auto.ui.3f84ef531f")}</TableHead>
                  <TableHead>{uiText("auto.ui.148c60ecba")}</TableHead>
                  <TableHead>{uiText("auto.ui.64f7a1d46b")}</TableHead>
                  <TableHead>{uiText("auto.ui.e5e429bcc9")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(trading.data?.recentTrades ?? []).map((trade) => (
                  <TableRow key={trade.id}>
                    <TableCell>
                      <div className="font-medium">{trade.ticket}</div>
                      <div className="text-xs text-muted-foreground">
                        {trade.source} - {trade.direction}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {trade.userId}
                    </TableCell>
                    <TableCell>{trade.symbol}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(trade.status)}>
                        {trade.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{trade.profit ?? "-"}</TableCell>
                    <TableCell>{formatAdminDate(trade.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {(trading.data?.recentTrades ?? []).length === 0 && (
              <div className="p-6 text-sm text-muted-foreground">
                Nessun trade importato.
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
