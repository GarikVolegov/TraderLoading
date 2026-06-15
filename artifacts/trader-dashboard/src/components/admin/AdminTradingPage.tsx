import { useQuery } from "@tanstack/react-query";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { uiText } from "@/contexts/LanguageContext";
import { getAdminTradingOverview } from "@/lib/adminApi";
import { Activity, BookOpen, Database, FileText, TrendingUp, Wifi } from "lucide-react";
import { OperationalPageHeader, OperationalLoadingGrid } from "./operational";
import { formatAdminDate, statusVariant, AdminErrorState } from "./shared";

export function AdminTradingPage() {
  const trading = useQuery({
    queryKey: ["admin", "trading", "overview"],
    queryFn: getAdminTradingOverview,
  });
  const metrics = trading.data?.metrics;

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
