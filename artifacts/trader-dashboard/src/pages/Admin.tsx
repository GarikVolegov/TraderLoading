import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Bell,
  BookOpen,
  CheckCircle2,
  Cpu,
  Database,
  FileText,
  Library,
  MessageSquare,
  CreditCard,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Users,
  Wifi,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Link, Route, Switch, useLocation, useRoute } from "wouter";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { AdminShell } from "@/components/admin/AdminShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getAdminAudit,
  getAdminContentItems,
  getAdminContentOverview,
  getAdminDashboard,
  getAdminMe,
  getAdminSupportOverview,
  getAdminSubscriptions,
  getAdminSystemOverview,
  getAdminTradingOverview,
  getAdminUserDetail,
  getAdminUsers,
  publishAdminContentItem,
  reactivateAdminUser,
  revokeAdminUserSessions,
  suspendAdminUser,
  type AdminAuditRecord,
  type AdminContentItem,
  type AdminSubscriptionPlan,
  type AdminSubscriptionRow,
  type AdminSubscriptionStatus,
  type AdminSystemOverview,
  type AdminUserDetail,
  type AdminUserRow,
  unpublishAdminContentItem,
  updateAdminSubscription,
} from "@/lib/adminApi";

type AdminUserStatusFilter = "all" | "active" | "suspended" | "banned";

type AdminAuditPreview = {
  id: number;
  actorUserId: string;
  actorRole?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  reason?: string | null;
  createdAt: string;
};

const ADMIN_USER_STATUS_FILTERS: AdminUserStatusFilter[] = [
  "all",
  "active",
  "suspended",
  "banned",
];
const ADMIN_SUBSCRIPTION_PLANS: AdminSubscriptionPlan[] = [
  "free",
  "pro",
];
const ADMIN_SUBSCRIPTION_STATUSES: AdminSubscriptionStatus[] = [
  "active",
  "trialing",
  "past_due",
  "canceled",
];

function useAdminMe() {
  return useQuery({ queryKey: ["admin", "me"], queryFn: getAdminMe });
}

function getSearchParam(name: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) ?? "";
}

function getInitialAdminUserStatus(): AdminUserStatusFilter {
  const status = getSearchParam("status");
  return ADMIN_USER_STATUS_FILTERS.includes(status as AdminUserStatusFilter)
    ? (status as AdminUserStatusFilter)
    : "all";
}

function getInitialAdminUserQuery(): string {
  return getSearchParam("q");
}

function syncAdminUserFiltersToUrl(
  query: string,
  status: AdminUserStatusFilter,
  setLocation: ReturnType<typeof useLocation>[1],
) {
  const search = new URLSearchParams();
  const trimmed = query.trim();
  if (trimmed) search.set("q", trimmed);
  if (status !== "all") search.set("status", status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  setLocation(`/admin/users${suffix}`, { replace: true });
}

function formatAdminDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "suspended" || status === "banned") return "destructive";
  return "secondary";
}

function AdminPageSkeleton() {
  return (
    <div className="min-h-dvh bg-background p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    </div>
  );
}

function AdminErrorState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Alert variant="destructive">
      <ShieldAlert className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}

function AdminAccessBoundary({ children }: { children: ReactNode }) {
  const me = useAdminMe();

  if (me.isLoading) {
    return <AdminPageSkeleton />;
  }

  const adminMe = me.data;
  if (me.isError || !adminMe?.role) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-6">
        <section className="max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <ShieldCheck
            className="mx-auto h-10 w-10 text-destructive"
            aria-hidden="true"
          />
          <h1 className="mt-4 text-xl font-semibold">
            Accesso admin non disponibile
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Il tuo account non ha permessi per la console admin.
          </p>
        </section>
      </div>
    );
  }

  return (
    <AdminShell
      role={adminMe.role}
      permissions={adminMe.permissions}
      source={adminMe.source}
    >
      {children}
    </AdminShell>
  );
}

function AuditPreviewList({ audit }: { audit: AdminAuditPreview[] }) {
  if (audit.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        Nessuna azione admin recente.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {audit.slice(0, 6).map((item) => (
        <Link
          key={item.id}
          href={
            item.targetId
              ? `/admin/security?targetId=${encodeURIComponent(item.targetId)}`
              : "/admin/security"
          }
          className="grid gap-1 rounded-md border border-border p-3 text-sm transition-colors hover:bg-muted/60 md:grid-cols-[1fr_auto]"
        >
          <div>
            <div className="font-medium">{item.action}</div>
            <div className="text-xs text-muted-foreground">
              {item.actorUserId}
              {item.targetId
                ? ` su ${item.targetType ?? "target"}:${item.targetId}`
                : ""}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {formatAdminDate(item.createdAt)}
          </div>
        </Link>
      ))}
    </div>
  );
}

function AdminDashboardPage() {
  const dashboard = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: getAdminDashboard,
  });
  const metrics = dashboard.data?.metrics;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
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
          title="Dashboard non disponibile"
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
              <h2 className="text-sm font-semibold">Azioni urgenti</h2>
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
                <h2 className="text-sm font-semibold">Audit recente</h2>
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

function AdminUsersPage() {
  const [query, setQuery] = useState(getInitialAdminUserQuery);
  const [status, setStatus] = useState<AdminUserStatusFilter>(
    getInitialAdminUserStatus,
  );
  const [, setLocation] = useLocation();
  const users = useQuery({
    queryKey: ["admin", "users", query, status],
    queryFn: () => getAdminUsers({ q: query, status, limit: 50 }),
  });
  const rows = users.data?.users ?? [];

  useEffect(() => {
    syncAdminUserFiltersToUrl(query, status, setLocation);
  }, [query, setLocation, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Utenti</h1>
          <p className="text-sm text-muted-foreground">
            Cerca, filtra e apri i profili operativi.
          </p>
        </div>
        <Badge variant="outline">{rows.length} risultati</Badge>
      </div>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/80 p-4 md:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
            placeholder="Cerca email, nome o user id"
          />
        </div>
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as AdminUserStatusFilter)
          }
          className="min-h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="all">Tutti gli stati</option>
          <option value="active">Attivi</option>
          <option value="suspended">Sospesi</option>
          <option value="banned">Bannati</option>
        </select>
      </div>

      {users.isError ? (
        <AdminErrorState
          title="Utenti non disponibili"
          description="La ricerca utenti non ha risposto correttamente."
        />
      ) : (
        <section className="overflow-hidden rounded-lg border border-border bg-card/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utente</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Livello</TableHead>
                <TableHead>XP</TableHead>
                <TableHead className="text-right">Azione</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.isLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-8" />
                      </TableCell>
                    </TableRow>
                  ))
                : rows.map((user: AdminUserRow) => (
                    <TableRow key={user.profileId}>
                      <TableCell>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {user.userId ?? "guest"}
                        </div>
                      </TableCell>
                      <TableCell>{user.email ?? "-"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(user.status)}>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.level}</TableCell>
                      <TableCell>{user.xp}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!user.userId}
                          onClick={() =>
                            user.userId &&
                            setLocation(`/admin/users/${user.userId}`)
                          }
                        >
                          Apri
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
          {!users.isLoading && rows.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">
              Nessun utente trovato.
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function useAdminUserIdFromRoute() {
  const [, params] = useRoute("/admin/users/:userId");
  return params?.userId ?? "";
}

function AdminUserDetailTabs({ detail }: { detail: AdminUserDetail }) {
  const user = detail.user;
  const counters = user.counters;

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
        <TabsTrigger value="trading">Trading</TabsTrigger>
        <TabsTrigger value="audit">Audit</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <AdminMetricCard
            label="Trade"
            value={counters.trades}
            detail="Account trades importati"
            icon={Database}
          />
          <AdminMetricCard
            label="Journal"
            value={counters.journalEntries}
            detail="Entry salvate"
            icon={FileText}
          />
          <AdminMetricCard
            label="Backtest"
            value={counters.backtests}
            detail="Sessioni create"
            icon={BookOpen}
          />
        </div>
        <section className="rounded-lg border border-border bg-card/80 p-4">
          <h2 className="text-sm font-semibold">Profilo</h2>
          <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">User ID</dt>
              <dd className="font-mono text-xs">{user.userId ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Nome</dt>
              <dd>{user.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Livello</dt>
              <dd>{user.level}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">XP</dt>
              <dd>{user.xp}</dd>
            </div>
          </dl>
        </section>
      </TabsContent>
      <TabsContent value="security">
        <section className="rounded-lg border border-border bg-card/80 p-4">
          <h2 className="text-sm font-semibold">Ultimi login</h2>
          <div className="mt-3 space-y-2">
            {detail.loginAccess.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                Nessun login registrato.
              </div>
            ) : (
              detail.loginAccess.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-1 rounded-md border border-border p-3 text-sm md:grid-cols-[1fr_auto]"
                >
                  <div>
                    <div className="font-medium">{item.ipAddress}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.userAgent ?? "User agent non disponibile"}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatAdminDate(item.createdAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </TabsContent>
      <TabsContent value="trading">
        <section className="rounded-lg border border-border bg-card/80 p-4">
          <h2 className="text-sm font-semibold">Diagnostica trading</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Primo riepilogo operativo. I dettagli broker arriveranno nella
            prossima slice dedicata ai provider.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Badge variant="outline">{counters.trades} trade</Badge>
            <Badge variant="outline">{counters.backtests} backtest</Badge>
            <Badge variant="outline">{counters.journalEntries} journal</Badge>
          </div>
        </section>
      </TabsContent>
      <TabsContent value="audit">
        <AuditPreviewList audit={detail.audit} />
      </TabsContent>
    </Tabs>
  );
}

function AdminUserDetailPage() {
  const userId = useAdminUserIdFromRoute();
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["admin", "users", userId],
    queryFn: () => getAdminUserDetail(userId),
    enabled: Boolean(userId),
  });
  const [reason, setReason] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "users", userId] });
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
    qc.invalidateQueries({ queryKey: ["admin", "audit"] });
  };
  const revokeSessions = useMutation({
    mutationFn: () => revokeAdminUserSessions(userId, reason),
    onSuccess: () => {
      setReason("");
      invalidate();
    },
  });
  const suspend = useMutation({
    mutationFn: () => suspendAdminUser(userId, reason),
    onSuccess: () => {
      setReason("");
      invalidate();
    },
  });
  const reactivate = useMutation({
    mutationFn: () => reactivateAdminUser(userId, reason),
    onSuccess: () => {
      setReason("");
      invalidate();
    },
  });
  const disabled =
    reason.trim().length === 0 ||
    revokeSessions.isPending ||
    suspend.isPending ||
    reactivate.isPending;

  if (detail.isLoading) {
    return <Skeleton className="h-80" />;
  }

  if (detail.isError || !detail.data) {
    return (
      <AdminErrorState
        title="Utente non trovato"
        description="Il profilo richiesto non esiste o non hai permessi sufficienti."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/80 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{detail.data.user.name}</h1>
            <Badge variant={statusVariant(detail.data.user.status)}>
              {detail.data.user.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {detail.data.user.email ?? detail.data.user.userId}
          </p>
        </div>
        <div className="flex flex-col gap-2 md:min-w-[360px]">
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Motivo obbligatorio per azioni admin"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() => revokeSessions.mutate()}
            >
              Revoca sessioni
            </Button>
            <Button
              variant="destructive"
              disabled={disabled}
              onClick={() => suspend.mutate()}
            >
              Sospendi
            </Button>
            <Button
              variant="outline"
              disabled={disabled}
              onClick={() => reactivate.mutate()}
            >
              Riattiva
            </Button>
          </div>
        </div>
      </div>
      <AdminUserDetailTabs detail={detail.data} />
    </div>
  );
}

function OperationalPageHeader({
  title,
  description,
  onRefresh,
  refreshing,
}: {
  title: string;
  description: string;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
        <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
        Aggiorna
      </Button>
    </div>
  );
}

function OperationalLoadingGrid() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-28" />
      ))}
    </div>
  );
}

function AdminTradingPage() {
  const trading = useQuery({
    queryKey: ["admin", "trading", "overview"],
    queryFn: getAdminTradingOverview,
  });
  const metrics = trading.data?.metrics;

  return (
    <div className="space-y-5">
      <OperationalPageHeader
        title="Trading"
        description="Diagnostica aggregata su broker, import e backtest."
        onRefresh={() => trading.refetch()}
        refreshing={trading.isFetching}
      />
      {trading.isLoading ? (
        <OperationalLoadingGrid />
      ) : trading.isError ? (
        <AdminErrorState
          title="Trading non disponibile"
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
              <h2 className="text-sm font-semibold">Ultimi trade importati</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Utente</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>PnL</TableHead>
                  <TableHead>Data</TableHead>
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

function AdminContentInventoryTable({
  items,
  actionPending,
  onAction,
}: {
  items: AdminContentItem[];
  actionPending: boolean;
  onAction: (item: AdminContentItem, action: "publish" | "unpublish") => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/70 p-6 text-sm text-muted-foreground">
        Nessun contenuto library presente. Crea o importa contenuti dalla sezione
        Library per renderli gestibili qui.
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card/80">
      <div className="flex flex-col gap-1 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Publishing queue</h2>
          <p className="text-xs text-muted-foreground">
            Contenuti library ordinati per ultimo aggiornamento.
          </p>
        </div>
        <Badge variant="outline">{items.length} elementi</Badge>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contenuto</TableHead>
            <TableHead>Collection</TableHead>
            <TableHead>Livello</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead>Aggiornato</TableHead>
            <TableHead className="text-right">Azione</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="font-medium">{item.title}</div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {item.type}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {item.collectionTitle ?? "Senza collection"}
              </TableCell>
              <TableCell className="tabular-nums">
                {item.requiredLevel}
              </TableCell>
              <TableCell>
                <Badge variant={item.published ? "default" : "secondary"}>
                  {item.published ? "Pubblicato" : "Bozza"}
                </Badge>
              </TableCell>
              <TableCell>{formatAdminDate(item.updatedAt)}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant={item.published ? "outline" : "default"}
                  size="sm"
                  disabled={actionPending}
                  onClick={() =>
                    onAction(item, item.published ? "unpublish" : "publish")
                  }
                >
                  {item.published ? "Ritira" : "Pubblica"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

function AdminContentPage() {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const content = useQuery({
    queryKey: ["admin", "content", "overview"],
    queryFn: getAdminContentOverview,
  });
  const contentItems = useQuery({
    queryKey: ["admin-content-items"],
    queryFn: () => getAdminContentItems({ limit: 25 }),
  });
  const contentAction = useMutation({
    mutationFn: ({
      item,
      action,
    }: {
      item: AdminContentItem;
      action: "publish" | "unpublish";
    }) =>
      action === "publish"
        ? publishAdminContentItem(item.id, reason)
        : unpublishAdminContentItem(item.id, reason),
    onSuccess: () => {
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-content-items"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "content", "overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
  });
  const metrics = content.data?.metrics;
  const reasonReady = reason.trim().length >= 3;

  return (
    <div className="space-y-5">
      <OperationalPageHeader
        title="Content"
        description="Inventario publishing: library, missioni, milestone, quote e community."
        onRefresh={() => {
          content.refetch();
          contentItems.refetch();
        }}
        refreshing={content.isFetching || contentItems.isFetching}
      />
      {content.isLoading || contentItems.isLoading ? (
        <OperationalLoadingGrid />
      ) : content.isError || contentItems.isError ? (
        <AdminErrorState
          title="Content non disponibile"
          description="L'inventario contenuti non e stato caricato."
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <AdminMetricCard
              label="Collection"
              value={metrics?.collections ?? 0}
              detail={`${metrics?.publishedCollections ?? 0} pubblicate`}
              icon={Library}
            />
            <AdminMetricCard
              label="Contenuti"
              value={metrics?.contents ?? 0}
              detail={`${metrics?.publishedContents ?? 0} pubblicati`}
              icon={BookOpen}
            />
            <AdminMetricCard
              label="Mission template"
              value={metrics?.missionTemplates ?? 0}
              detail="Template riutilizzabili"
              icon={CheckCircle2}
            />
            <AdminMetricCard
              label="Milestone"
              value={metrics?.levelMilestones ?? 0}
              detail="Progressione livelli"
              icon={TrendingUp}
            />
            <AdminMetricCard
              label="Quote"
              value={metrics?.quotes ?? 0}
              detail="Frasi motivazionali"
              icon={FileText}
            />
            <AdminMetricCard
              label="Community"
              value={metrics?.communities ?? 0}
              detail={`${metrics?.communityMessages ?? 0} messaggi`}
              icon={MessageSquare}
            />
          </div>
          <Alert variant={contentAction.isError ? "destructive" : "default"}>
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Motivo azione editoriale</AlertTitle>
            <AlertDescription>
              Inserisci un motivo prima di pubblicare o ritirare un contenuto.
              Ogni modifica viene scritta nell'audit trail.
            </AlertDescription>
          </Alert>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Es. Revisione editoriale completata"
              aria-label="Motivo azione contenuto"
            />
            <Button
              variant="outline"
              onClick={() => {
                content.refetch();
                contentItems.refetch();
              }}
              disabled={content.isFetching || contentItems.isFetching}
            >
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Aggiorna
            </Button>
          </div>
          {!reasonReady && (
            <p className="text-xs text-muted-foreground">
              Il motivo deve avere almeno 3 caratteri per abilitare le azioni.
            </p>
          )}
          <AdminContentInventoryTable
            items={contentItems.data?.items ?? []}
            actionPending={contentAction.isPending || !reasonReady}
            onAction={(item, action) => {
              if (!reasonReady) return;
              contentAction.mutate({ item, action });
            }}
          />
        </>
      )}
    </div>
  );
}

function formatOptionalAdminDate(value: string | null): string {
  return value ? formatAdminDate(value) : "-";
}

function formatAdminSubscriptionPlan(plan: AdminSubscriptionPlan): string {
  return plan === "pro" ? "Pro - 7 euro" : "Free";
}

function AdminSubscriptionBadge({ row }: { row: AdminSubscriptionRow }) {
  const paid = row.plan !== "free";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={paid ? "default" : "secondary"}>
        {formatAdminSubscriptionPlan(row.plan)}
      </Badge>
      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
      {row.manualOverride && <Badge variant="outline">manualOverride</Badge>}
    </div>
  );
}

function AdminSubscriptionsPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedPlan, setSelectedPlan] =
    useState<AdminSubscriptionPlan>("pro");
  const [selectedStatus, setSelectedStatus] =
    useState<AdminSubscriptionStatus>("active");
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");
  const subscriptions = useQuery({
    queryKey: ["admin", "subscriptions", query],
    queryFn: () => getAdminSubscriptions({ q: query, limit: 50 }),
  });
  const subscriptionAction = useMutation({
    mutationFn: ({
      userId,
      plan,
      status,
      periodEnd,
    }: {
      userId: string;
      plan: AdminSubscriptionPlan;
      status: AdminSubscriptionStatus;
      periodEnd: string | null;
    }) =>
      updateAdminSubscription(userId, {
        plan,
        status,
        currentPeriodEnd: periodEnd,
        reason,
      }),
    onSuccess: () => {
      setFormError("");
      queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
    onError: () => {
      setFormError("Aggiornamento non riuscito. Controlla piano, stato e motivo.");
    },
  });
  const metrics = subscriptions.data?.metrics;
  const reasonReady = reason.trim().length >= 3;

  function selectRow(row: AdminSubscriptionRow) {
    setSelectedUserId(row.userId ?? "");
    setSelectedPlan(row.plan);
    setSelectedStatus(row.status);
    setCurrentPeriodEnd(
      row.currentPeriodEnd ? row.currentPeriodEnd.slice(0, 10) : "",
    );
  }

  function submitSubscriptionUpdate(
    userId = selectedUserId,
    plan = selectedPlan,
    status = selectedStatus,
    periodEnd: string | null = currentPeriodEnd.trim() || null,
  ) {
    const trimmedUserId = userId.trim();
    if (!trimmedUserId) {
      setFormError("Seleziona o inserisci uno userId.");
      return;
    }
    if (!reasonReady) {
      setFormError("Inserisci un motivo di almeno 3 caratteri.");
      return;
    }
    setSelectedUserId(trimmedUserId);
    setSelectedPlan(plan);
    setSelectedStatus(status);
    if (periodEnd === null) setCurrentPeriodEnd("");
    subscriptionAction.mutate({
      userId: trimmedUserId,
      plan,
      status,
      periodEnd,
    });
  }

  return (
    <div className="space-y-5">
      <OperationalPageHeader
        title="Abbonamenti"
        description="Gestione manuale piani Free e Pro - 7 euro con audit obbligatorio."
        onRefresh={() => subscriptions.refetch()}
        refreshing={subscriptions.isFetching}
      />
      {subscriptions.isLoading ? (
        <OperationalLoadingGrid />
      ) : subscriptions.isError ? (
        <AdminErrorState
          title="Abbonamenti non disponibili"
          description="La lista abbonamenti non e stata caricata."
        />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard
              label="Utenti visibili"
              value={metrics?.visibleUsers ?? 0}
              detail="Risultati della vista corrente"
              icon={Users}
            />
            <AdminMetricCard
              label="Override manuali"
              value={metrics?.manualOverrides ?? 0}
              detail="Record gestiti da admin"
              icon={ShieldCheck}
            />
            <AdminMetricCard
              label="Active"
              value={metrics?.activeSubscriptions ?? 0}
              detail="Abbonamenti attivi"
              icon={CheckCircle2}
            />
            <AdminMetricCard
              label="Paid"
              value={metrics?.paidPlans ?? 0}
              detail="Piano Pro a 7 euro"
              icon={CreditCard}
            />
          </div>

          <section className="rounded-lg border border-border bg-card/80 p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_160px_160px_170px_minmax(260px,1.2fr)_auto]">
              <Input
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                placeholder="userId"
                aria-label="User ID abbonamento"
              />
              <select
                value={selectedPlan}
                onChange={(event) =>
                  setSelectedPlan(event.target.value as AdminSubscriptionPlan)
                }
                className="min-h-10 rounded-md border border-input bg-background px-3 text-sm"
                aria-label="Piano abbonamento"
              >
                {ADMIN_SUBSCRIPTION_PLANS.map((plan) => (
                  <option key={plan} value={plan}>
                    {formatAdminSubscriptionPlan(plan)}
                  </option>
                ))}
              </select>
              <select
                value={selectedStatus}
                onChange={(event) =>
                  setSelectedStatus(
                    event.target.value as AdminSubscriptionStatus,
                  )
                }
                className="min-h-10 rounded-md border border-input bg-background px-3 text-sm"
                aria-label="Stato abbonamento"
              >
                {ADMIN_SUBSCRIPTION_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <Input
                type="date"
                value={currentPeriodEnd}
                onChange={(event) => setCurrentPeriodEnd(event.target.value)}
                aria-label="Fine periodo abbonamento"
              />
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Motivo obbligatorio"
                aria-label="Motivo modifica abbonamento"
              />
              <Button
                onClick={() => submitSubscriptionUpdate()}
                disabled={subscriptionAction.isPending || !reasonReady}
              >
                Applica
              </Button>
            </div>
            {(formError || !reasonReady) && (
              <p className="mt-2 text-xs text-muted-foreground">
                {formError ||
                  "Il motivo deve avere almeno 3 caratteri per abilitare upgrade e downgrade."}
              </p>
            )}
          </section>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9"
                placeholder="Cerca per nome, email, userId o piano"
                aria-label="Cerca abbonamenti"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => subscriptions.refetch()}
              disabled={subscriptions.isFetching}
            >
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Aggiorna
            </Button>
          </div>

          <section className="overflow-hidden rounded-lg border border-border bg-card/80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utente</TableHead>
                  <TableHead>Abbonamento</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Ultima modifica</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(subscriptions.data?.subscriptions ?? []).map((row) => (
                  <TableRow key={row.profileId}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => selectRow(row)}
                        className="text-left"
                      >
                        <div className="font-medium">{row.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {row.userId}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {row.email ?? "email non disponibile"}
                        </div>
                      </button>
                    </TableCell>
                    <TableCell>
                      <AdminSubscriptionBadge row={row} />
                      <div className="mt-1 text-xs text-muted-foreground">
                        Source: {row.source}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatOptionalAdminDate(row.currentPeriodEnd)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatOptionalAdminDate(row.updatedAt)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.updatedBy ?? "nessun override"}
                      </div>
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          subscriptionAction.isPending ||
                          !reasonReady ||
                          !row.userId
                        }
                        onClick={() =>
                          row.userId &&
                          submitSubscriptionUpdate(row.userId, "pro", "active")
                        }
                      >
                        Upgrade Pro
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          subscriptionAction.isPending ||
                          !reasonReady ||
                          !row.userId
                        }
                        onClick={() =>
                          row.userId &&
                          submitSubscriptionUpdate(row.userId, "free", "active", null)
                        }
                      >
                        Downgrade Free
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {(subscriptions.data?.subscriptions ?? []).length === 0 && (
              <div className="p-6 text-sm text-muted-foreground">
                Nessun utente trovato per la ricerca corrente.
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function AdminSupportPage() {
  const support = useQuery({
    queryKey: ["admin", "support", "overview"],
    queryFn: getAdminSupportOverview,
  });
  const metrics = support.data?.metrics;

  return (
    <div className="space-y-5">
      <OperationalPageHeader
        title="Supporto"
        description="Triage account e segnali utili per assistere utenti reali."
        onRefresh={() => support.refetch()}
        refreshing={support.isFetching}
      />
      {support.isLoading ? (
        <OperationalLoadingGrid />
      ) : support.isError ? (
        <AdminErrorState
          title="Supporto non disponibile"
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
            <h2 className="text-sm font-semibold">Ultimi accessi</h2>
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

function RuntimeFlagList({ flags }: { flags: AdminSystemOverview["flags"] }) {
  return (
    <section className="rounded-lg border border-border bg-card/80 p-4">
      <h2 className="text-sm font-semibold">Runtime flags</h2>
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

function AdminSystemPage() {
  const system = useQuery({
    queryKey: ["admin", "system", "overview"],
    queryFn: getAdminSystemOverview,
  });
  const metrics = system.data?.metrics;
  const runtime = system.data?.runtime;

  return (
    <div className="space-y-5">
      <OperationalPageHeader
        title="Sistema"
        description="Readiness API, configurazione runtime e superfici operative."
        onRefresh={() => system.refetch()}
        refreshing={system.isFetching}
      />
      {system.isLoading ? (
        <OperationalLoadingGrid />
      ) : system.isError ? (
        <AdminErrorState
          title="Sistema non disponibile"
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
              <h2 className="text-sm font-semibold">Runtime inventory</h2>
              <dl className="mt-3 grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <dt className="text-muted-foreground">Versione</dt>
                  <dd className="font-mono text-xs">{runtime?.version ?? "-"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <dt className="text-muted-foreground">Push subscriptions</dt>
                  <dd>{metrics?.pushSubscriptions ?? 0}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <dt className="text-muted-foreground">User status rows</dt>
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

function getInitialAuditTargetId(): string {
  return getSearchParam("targetId");
}

function AdminSecurityPage() {
  const [actor, setActor] = useState("");
  const [targetId, setTargetId] = useState(getInitialAuditTargetId);
  const audit = useQuery({
    queryKey: ["admin", "audit", actor, targetId],
    queryFn: () =>
      getAdminAudit({
        actor: actor.trim() || undefined,
        targetId: targetId.trim() || undefined,
        limit: 50,
      }),
  });
  const rows = audit.data?.audit ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sicurezza</h1>
          <p className="text-sm text-muted-foreground">
            Audit log admin con filtri per attore e target.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => audit.refetch()}
          disabled={audit.isFetching}
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Aggiorna
        </Button>
      </div>
      <div className="grid gap-3 rounded-lg border border-border bg-card/80 p-4 md:grid-cols-2">
        <Input
          value={actor}
          onChange={(event) => setActor(event.target.value)}
          placeholder="Filtra actor user id"
        />
        <Input
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
          placeholder="Filtra target id"
        />
      </div>
      {audit.isError ? (
        <AdminErrorState
          title="Audit non disponibile"
          description="Il log sicurezza non e stato caricato."
        />
      ) : (
        <section className="overflow-hidden rounded-lg border border-border bg-card/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Azione</TableHead>
                <TableHead>Attore</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.isLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-8" />
                      </TableCell>
                    </TableRow>
                  ))
                : rows.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.action}</TableCell>
                      <TableCell>
                        <div>{item.actorUserId}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.actorRole}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{item.targetType}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {item.targetId}
                        </div>
                      </TableCell>
                      <TableCell>{item.reason ?? "-"}</TableCell>
                      <TableCell>{formatAdminDate(item.createdAt)}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
          {!audit.isLoading && rows.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">
              Nessun evento audit trovato.
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminAccessBoundary>
      <Switch>
        <Route path="/admin/users/:userId" component={AdminUserDetailPage} />
        <Route path="/admin/users" component={AdminUsersPage} />
        <Route path="/admin/trading" component={AdminTradingPage} />
        <Route path="/admin/content" component={AdminContentPage} />
        <Route path="/admin/subscriptions" component={AdminSubscriptionsPage} />
        <Route path="/admin/support" component={AdminSupportPage} />
        <Route path="/admin/system" component={AdminSystemPage} />
        <Route path="/admin/audit" component={AdminSecurityPage} />
        <Route path="/admin/security" component={AdminSecurityPage} />
        <Route path="/admin" component={AdminDashboardPage} />
      </Switch>
    </AdminAccessBoundary>
  );
}
