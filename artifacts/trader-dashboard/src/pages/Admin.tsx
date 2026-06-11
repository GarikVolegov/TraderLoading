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
  Save,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Trash2,
  Upload,
  Users,
  Wifi,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Link, Route, Switch, useLocation, useRoute } from "wouter";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { AdminShell } from "@/components/admin/AdminShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { billingQueryKey } from "@/lib/billingApi";
import { uiText } from "@/contexts/LanguageContext";
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
  type AdminLibraryContent,
  type AdminLibraryContentPayload,
  type AdminLibraryContentType,
  type AdminMilestonePayload,
  type AdminContentItem,
  type AdminSubscriptionPlan,
  type AdminSubscriptionRow,
  type AdminSubscriptionStatus,
  type AdminSystemOverview,
  type AdminUserDetail,
  type AdminUserRow,
  createAdminLibraryContent,
  deleteAdminLibraryContent,
  deleteAdminMilestoneFile,
  getAdminLibraryContents,
  getAdminMilestoneDetail,
  unpublishAdminContentItem,
  updateAdminSubscription,
  updateAdminLibraryContent,
  updateAdminMilestone,
  uploadAdminLibraryFile,
  uploadAdminMilestoneFile,
  toggleAdminMilestoneFileDownloadable,
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

const ADMIN_LIBRARY_CONTENT_TYPES: AdminLibraryContentType[] = [
  "document",
  "mindmap",
  "video",
];

const DEFAULT_ADMIN_LIBRARY_FORM: AdminLibraryContentPayload = {
  collectionId: null,
  type: "document",
  title: "",
  description: "",
  bodyMarkdown: "",
  fileUrl: null,
  fileName: null,
  fileSize: 0,
  mimeType: null,
  embedUrl: null,
  tags: [],
  requiredLevel: 0,
  orderIndex: 0,
  published: false,
};

const DEFAULT_ADMIN_MILESTONE_FORM: AdminMilestonePayload = {
  title: "",
  description: "",
  skills: [],
  badgeEmoji: "T",
  badgeColor: "#4ca973",
};

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
          <h1 className="text-2xl font-semibold">{uiText("admin.users.title")}</h1>
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
            placeholder={uiText("auto.ui.a09bda942e")}
          />
        </div>
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as AdminUserStatusFilter)
          }
          className="min-h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="all">{uiText("auto.ui.bb894e3bb7")}</option>
          <option value="active">{uiText("auto.ui.ded055b716")}</option>
          <option value="suspended">{uiText("auto.ui.1d2fb38e6f")}</option>
          <option value="banned">{uiText("auto.ui.fffe3601b7")}</option>
        </select>
      </div>

      {users.isError ? (
        <AdminErrorState
          title={uiText("auto.ui.dd9b118f73")}
          description="La ricerca utenti non ha risposto correttamente."
        />
      ) : (
        <section className="overflow-hidden rounded-lg border border-border bg-card/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{uiText("auto.ui.cef52217ee")}</TableHead>
                <TableHead>{uiText("auto.ui.84add5b295")}</TableHead>
                <TableHead>{uiText("auto.ui.148c60ecba")}</TableHead>
                <TableHead>{uiText("auto.ui.227771829c")}</TableHead>
                <TableHead>XP</TableHead>
                <TableHead className="text-right">{uiText("auto.ui.f18824e55d")}</TableHead>
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
        <TabsTrigger value="overview">{uiText("auto.ui.0efc2e6be4")}</TabsTrigger>
        <TabsTrigger value="security">{uiText("auto.ui.f25ce1b8a3")}</TabsTrigger>
        <TabsTrigger value="trading">{uiText("auto.ui.49352196f6")}</TabsTrigger>
        <TabsTrigger value="audit">{uiText("auto.ui.fa1703dd78")}</TabsTrigger>
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
          <h2 className="text-sm font-semibold">{uiText("auto.ui.afedc6c955")}</h2>
          <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">{uiText("auto.ui.23bf49dab1")}</dt>
              <dd className="font-mono text-xs">{user.userId ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{uiText("auto.ui.13030dd962")}</dt>
              <dd>{user.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{uiText("auto.ui.227771829c")}</dt>
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
          <h2 className="text-sm font-semibold">{uiText("auto.ui.7ef3c32295")}</h2>
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
          <h2 className="text-sm font-semibold">{uiText("auto.ui.fc2aef325d")}</h2>
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
        title={uiText("auto.ui.6e0c705c78")}
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
            placeholder={uiText("auto.ui.591f0a108f")}
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
          <h2 className="text-sm font-semibold">{uiText("admin.content.publishing_queue")}</h2>
          <p className="text-xs text-muted-foreground">
            Contenuti library ordinati per ultimo aggiornamento.
          </p>
        </div>
        <Badge variant="outline">{items.length} elementi</Badge>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{uiText("auto.ui.fd19042867")}</TableHead>
            <TableHead>{uiText("auto.ui.30c54a96f8")}</TableHead>
            <TableHead>{uiText("auto.ui.227771829c")}</TableHead>
            <TableHead>{uiText("auto.ui.148c60ecba")}</TableHead>
            <TableHead>{uiText("auto.ui.4e35f7f30b")}</TableHead>
            <TableHead className="text-right">{uiText("auto.ui.f18824e55d")}</TableHead>
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

function formatAdminFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseAdminStringList(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function tagsFromLibraryContent(content: AdminLibraryContent): string {
  try {
    const parsed = JSON.parse(content.tags);
    return Array.isArray(parsed) ? parsed.map(String).join(", ") : "";
  } catch {
    return "";
  }
}

function skillsFromMilestone(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function contentTypeLabel(type: AdminLibraryContentType): string {
  if (type === "video") return "Video";
  if (type === "mindmap") return "Mappa mentale";
  return "Documento";
}

function AdminLibraryContentManager() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [form, setForm] = useState<AdminLibraryContentPayload>(DEFAULT_ADMIN_LIBRARY_FORM);
  const contents = useQuery({
    queryKey: ["admin", "library", "contents"],
    queryFn: getAdminLibraryContents,
  });
  const saveContent = useMutation({
    mutationFn: () => {
      const payload: AdminLibraryContentPayload = {
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        bodyMarkdown: form.bodyMarkdown?.trim() ?? "",
        embedUrl: form.embedUrl?.trim() || null,
        tags: parseAdminStringList(tagInput),
        requiredLevel: Number(form.requiredLevel) || 0,
        orderIndex: Number(form.orderIndex) || 0,
      };
      return editingId
        ? updateAdminLibraryContent(editingId, payload)
        : createAdminLibraryContent(payload);
    },
    onSuccess: () => {
      setEditingId(null);
      setTagInput("");
      setForm(DEFAULT_ADMIN_LIBRARY_FORM);
      queryClient.invalidateQueries({ queryKey: ["admin", "library", "contents"] });
      queryClient.invalidateQueries({ queryKey: ["admin-content-items"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "content", "overview"] });
    },
  });
  const uploadFile = useMutation({
    mutationFn: uploadAdminLibraryFile,
    onSuccess: (file) => {
      setForm((current) => ({
        ...current,
        fileUrl: file.fileUrl,
        fileName: file.fileName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
      }));
    },
  });
  const deleteContent = useMutation({
    mutationFn: deleteAdminLibraryContent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "library", "contents"] });
      queryClient.invalidateQueries({ queryKey: ["admin-content-items"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "content", "overview"] });
    },
  });

  function editContent(content: AdminLibraryContent) {
    setEditingId(content.id);
    setTagInput(tagsFromLibraryContent(content));
    setForm({
      collectionId: content.collectionId,
      type: content.type,
      title: content.title,
      description: content.description,
      bodyMarkdown: content.bodyMarkdown,
      fileUrl: content.fileUrl,
      fileName: content.fileName,
      fileSize: content.fileSize,
      mimeType: content.mimeType,
      embedUrl: content.embedUrl,
      tags: parseAdminStringList(tagsFromLibraryContent(content)),
      requiredLevel: content.requiredLevel,
      orderIndex: content.orderIndex,
      published: content.published,
    });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) uploadFile.mutate(file);
    event.currentTarget.value = "";
  }

  function submitContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) return;
    saveContent.mutate();
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(320px,420px)_1fr]">
      <form onSubmit={submitContent} className="space-y-3 rounded-lg border border-border bg-card/80 p-4">
        <div>
          <h2 className="text-sm font-semibold">
            {editingId ? "Modifica contenuto biblioteca" : "Nuovo contenuto biblioteca"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Carica documenti, video o contenuti testuali sbloccabili per livello.
          </p>
        </div>
        <select
          value={form.type}
          onChange={(event) =>
            setForm((current) => ({ ...current, type: event.target.value as AdminLibraryContentType }))
          }
          className="min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Tipo contenuto biblioteca"
        >
          {ADMIN_LIBRARY_CONTENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {contentTypeLabel(type)}
            </option>
          ))}
        </select>
        <Input
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          placeholder="Titolo"
          aria-label="Titolo contenuto biblioteca"
        />
        <Textarea
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          placeholder="Descrizione breve"
          aria-label="Descrizione contenuto biblioteca"
          className="min-h-20"
        />
        {form.type === "video" ? (
          <Input
            value={form.embedUrl ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, embedUrl: event.target.value }))}
            placeholder="Link YouTube, Vimeo o embed"
            aria-label="Link video biblioteca"
          />
        ) : (
          <Textarea
            value={form.bodyMarkdown ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, bodyMarkdown: event.target.value }))}
            placeholder="Note, testo o contenuto markdown"
            aria-label="Testo contenuto biblioteca"
            className="min-h-24"
          />
        )}
        {form.type === "document" && (
          <div className="rounded-md border border-dashed border-border p-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
              <Upload className="h-4 w-4" aria-hidden="true" />
              {uploadFile.isPending ? "Caricamento..." : "Carica file"}
              <input type="file" className="hidden" onChange={handleFileChange} />
            </label>
            {form.fileName && (
              <p className="mt-2 truncate text-xs text-muted-foreground">
                {form.fileName} - {formatAdminFileSize(form.fileSize ?? 0)}
              </p>
            )}
          </div>
        )}
        <Input
          value={tagInput}
          onChange={(event) => setTagInput(event.target.value)}
          placeholder="Tag separati da virgola"
          aria-label="Tag biblioteca"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="number"
            min={0}
            value={form.requiredLevel}
            onChange={(event) => setForm((current) => ({ ...current, requiredLevel: Number(event.target.value) }))}
            aria-label="Livello sblocco biblioteca"
          />
          <Input
            type="number"
            value={form.orderIndex}
            onChange={(event) => setForm((current) => ({ ...current, orderIndex: Number(event.target.value) }))}
            aria-label="Ordine biblioteca"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(event) => setForm((current) => ({ ...current, published: event.target.checked }))}
          />
          Pubblica subito
        </label>
        {(saveContent.isError || uploadFile.isError) && (
          <p className="text-xs text-destructive">Salvataggio o upload non riuscito.</p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {editingId && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingId(null);
                setTagInput("");
                setForm(DEFAULT_ADMIN_LIBRARY_FORM);
              }}
            >
              Annulla
            </Button>
          )}
          <Button type="submit" disabled={!form.title.trim() || saveContent.isPending || uploadFile.isPending}>
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            {editingId ? "Aggiorna" : "Crea"}
          </Button>
        </div>
      </form>

      <section className="overflow-hidden rounded-lg border border-border bg-card/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contenuto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Livello</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(contents.data ?? []).map((content) => (
              <TableRow key={content.id}>
                <TableCell>
                  <div className="font-medium">{content.title}</div>
                  <div className="max-w-sm truncate text-xs text-muted-foreground">
                    {content.fileName ?? content.embedUrl ?? content.description}
                  </div>
                </TableCell>
                <TableCell>{contentTypeLabel(content.type)}</TableCell>
                <TableCell>{content.requiredLevel}</TableCell>
                <TableCell>
                  <Badge variant={content.published ? "default" : "secondary"}>
                    {content.published ? "Pubblicato" : "Bozza"}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button type="button" size="sm" variant="outline" onClick={() => editContent(content)}>
                    Modifica
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => deleteContent.mutate(content.id)}
                    disabled={deleteContent.isPending}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {contents.isLoading && <div className="p-4 text-sm text-muted-foreground">Caricamento contenuti...</div>}
        {!contents.isLoading && (contents.data ?? []).length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">Nessun contenuto biblioteca.</div>
        )}
      </section>
    </div>
  );
}

function AdminMilestonesContentManager() {
  const queryClient = useQueryClient();
  const [level, setLevel] = useState(1);
  const [skillInput, setSkillInput] = useState("");
  const [form, setForm] = useState<AdminMilestonePayload>(DEFAULT_ADMIN_MILESTONE_FORM);
  const detail = useQuery({
    queryKey: ["admin", "milestones", level],
    queryFn: () => getAdminMilestoneDetail(level),
  });
  const saveMilestone = useMutation({
    mutationFn: () =>
      updateAdminMilestone(level, {
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        skills: parseAdminStringList(skillInput),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "milestones", level] });
      queryClient.invalidateQueries({ queryKey: ["admin", "content", "overview"] });
    },
  });
  const uploadFile = useMutation({
    mutationFn: (file: File) => uploadAdminMilestoneFile(level, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "milestones", level] });
    },
  });
  const toggleDownloadable = useMutation({
    mutationFn: ({ fileId, downloadable }: { fileId: number; downloadable: boolean }) =>
      toggleAdminMilestoneFileDownloadable(fileId, downloadable),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "milestones", level] });
    },
  });
  const deleteFile = useMutation({
    mutationFn: deleteAdminMilestoneFile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "milestones", level] });
    },
  });

  useEffect(() => {
    const milestone = detail.data?.milestone;
    if (!milestone) {
      setForm(DEFAULT_ADMIN_MILESTONE_FORM);
      setSkillInput("");
      return;
    }
    const skills = skillsFromMilestone(milestone.skills);
    setForm({
      title: milestone.title,
      description: milestone.description,
      skills,
      badgeEmoji: milestone.badgeEmoji,
      badgeColor: milestone.badgeColor,
    });
    setSkillInput(skills.join(", "));
  }, [detail.data?.milestone]);

  function handleMilestoneUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) uploadFile.mutate(file);
    event.currentTarget.value = "";
  }

  function submitMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveMilestone.mutate();
  }

  const files = detail.data?.files ?? [];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(320px,420px)_1fr]">
      <form onSubmit={submitMilestone} className="space-y-3 rounded-lg border border-border bg-card/80 p-4">
        <div>
          <h2 className="text-sm font-semibold">Contenuto traguardo</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Aggiorna testo, competenze, badge e risorse del livello selezionato.
          </p>
        </div>
        <Input
          type="number"
          min={1}
          value={level}
          onChange={(event) => setLevel(Math.max(1, Number(event.target.value) || 1))}
          aria-label="Livello traguardo"
        />
        <Input
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          placeholder="Titolo traguardo"
          aria-label="Titolo traguardo"
        />
        <Textarea
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          placeholder="Descrizione traguardo"
          aria-label="Descrizione traguardo"
          className="min-h-24"
        />
        <Input
          value={skillInput}
          onChange={(event) => setSkillInput(event.target.value)}
          placeholder="Skill separate da virgola"
          aria-label="Skill traguardo"
        />
        <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
          <Input
            value={form.badgeEmoji}
            onChange={(event) => setForm((current) => ({ ...current, badgeEmoji: event.target.value }))}
            placeholder="Badge"
            aria-label="Badge traguardo"
          />
          <Input
            type="color"
            value={form.badgeColor}
            onChange={(event) => setForm((current) => ({ ...current, badgeColor: event.target.value }))}
            aria-label="Colore badge traguardo"
          />
        </div>
        <div className="rounded-md border border-dashed border-border p-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
            <Upload className="h-4 w-4" aria-hidden="true" />
            {uploadFile.isPending ? "Caricamento..." : "Carica file traguardo"}
            <input type="file" className="hidden" onChange={handleMilestoneUpload} />
          </label>
        </div>
        {(saveMilestone.isError || uploadFile.isError) && (
          <p className="text-xs text-destructive">Operazione traguardo non riuscita.</p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={saveMilestone.isPending || detail.isFetching}>
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            Salva traguardo
          </Button>
        </div>
      </form>

      <section className="overflow-hidden rounded-lg border border-border bg-card/80">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-semibold">File livello {level}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Gestisci allegati e download disponibili agli utenti.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Dimensione</TableHead>
              <TableHead>Download</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((file) => (
              <TableRow key={file.id}>
                <TableCell>
                  <div className="font-medium">{file.fileName}</div>
                  <a
                    href={file.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Apri file
                  </a>
                </TableCell>
                <TableCell>{formatAdminFileSize(file.fileSize)}</TableCell>
                <TableCell>
                  <Badge variant={file.downloadable ? "default" : "secondary"}>
                    {file.downloadable ? "Abilitato" : "Bloccato"}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      toggleDownloadable.mutate({ fileId: file.id, downloadable: !file.downloadable })
                    }
                    disabled={toggleDownloadable.isPending}
                  >
                    {file.downloadable ? "Blocca" : "Abilita"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => deleteFile.mutate(file.id)}
                    disabled={deleteFile.isPending}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {detail.isLoading && <div className="p-4 text-sm text-muted-foreground">Caricamento traguardo...</div>}
        {!detail.isLoading && files.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">Nessun file caricato per questo livello.</div>
        )}
      </section>
    </div>
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
        title={uiText("auto.ui.4f9be057f0")}
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
          title={uiText("admin.content.unavailable")}
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
          <Tabs defaultValue="inventory" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="inventory">Inventario</TabsTrigger>
              <TabsTrigger value="library">Biblioteca</TabsTrigger>
              <TabsTrigger value="milestones">Traguardi</TabsTrigger>
            </TabsList>
            <TabsContent value="inventory" className="space-y-4">
              <Alert variant={contentAction.isError ? "destructive" : "default"}>
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>{uiText("auto.ui.99ad88bfd8")}</AlertTitle>
                <AlertDescription>
                  Inserisci un motivo prima di pubblicare o ritirare un contenuto.
                  Ogni modifica viene scritta nell'audit trail.
                </AlertDescription>
              </Alert>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <Input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={uiText("auto.ui.070e39fc1a")}
                  aria-label={uiText("auto.ui.54e00a6d80")}
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
            </TabsContent>
            <TabsContent value="library">
              <AdminLibraryContentManager />
            </TabsContent>
            <TabsContent value="milestones">
              <AdminMilestonesContentManager />
            </TabsContent>
          </Tabs>
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
      {row.manualOverride && <Badge variant="outline">{uiText("auto.ui.6467ac9d18")}</Badge>}
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
  const [rowReasons, setRowReasons] = useState<Record<string, string>>({});
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
      reason: actionReason,
    }: {
      userId: string;
      plan: AdminSubscriptionPlan;
      status: AdminSubscriptionStatus;
      periodEnd: string | null;
      reason: string;
    }) =>
      updateAdminSubscription(userId, {
        plan,
        status,
        currentPeriodEnd: periodEnd,
        reason: actionReason,
      }),
    onSuccess: (_data, variables) => {
      setFormError("");
      setRowReasons((current) => {
        if (!(variables.userId in current)) return current;
        const next = { ...current };
        delete next[variables.userId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
      queryClient.invalidateQueries({ queryKey: billingQueryKey });
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

  function setRowReason(userId: string | null, value: string) {
    if (!userId) return;
    setRowReasons((current) => ({ ...current, [userId]: value }));
  }

  function reasonForRow(userId: string | null) {
    return userId ? rowReasons[userId] ?? "" : "";
  }

  function submitSubscriptionUpdate(
    userId = selectedUserId,
    plan = selectedPlan,
    status = selectedStatus,
    periodEnd: string | null = currentPeriodEnd.trim() || null,
    reasonOverride = reason,
  ) {
    const trimmedUserId = userId.trim();
    const trimmedReason = reasonOverride.trim();
    if (!trimmedUserId) {
      setFormError("Seleziona o inserisci uno userId.");
      return;
    }
    if (trimmedReason.length < 3) {
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
      reason: trimmedReason,
    });
  }

  return (
    <div className="space-y-5">
      <OperationalPageHeader
        title={uiText("auto.ui.3aab61c71b")}
        description="Gestione manuale piani Free e Pro - 7 euro con audit obbligatorio."
        onRefresh={() => subscriptions.refetch()}
        refreshing={subscriptions.isFetching}
      />
      {subscriptions.isLoading ? (
        <OperationalLoadingGrid />
      ) : subscriptions.isError ? (
        <AdminErrorState
          title={uiText("admin.subscriptions.unavailable")}
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
                placeholder={uiText("auto.ui.db36668fa9")}
                aria-label={uiText("auto.ui.285965bc52")}
              />
              <select
                value={selectedPlan}
                onChange={(event) =>
                  setSelectedPlan(event.target.value as AdminSubscriptionPlan)
                }
                className="min-h-10 rounded-md border border-input bg-background px-3 text-sm"
                aria-label={uiText("auto.ui.11d32f98cf")}
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
                aria-label={uiText("auto.ui.acf887cf83")}
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
                aria-label={uiText("auto.ui.87ac54e8c3")}
              />
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={uiText("auto.ui.227b4de3d7")}
                aria-label={uiText("auto.ui.aa8323105a")}
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
                placeholder={uiText("auto.ui.7ebdfafcb6")}
                aria-label={uiText("auto.ui.36803b1ce6")}
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
                  <TableHead>{uiText("auto.ui.cef52217ee")}</TableHead>
                  <TableHead>{uiText("auto.ui.b776b1b8f3")}</TableHead>
                  <TableHead>{uiText("auto.ui.b4d82e0125")}</TableHead>
                  <TableHead>{uiText("auto.ui.a78d223f07")}</TableHead>
                  <TableHead className="text-right">{uiText("auto.ui.2fc8d47e75")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(subscriptions.data?.subscriptions ?? []).map((row) => {
                  const rowReason = reasonForRow(row.userId);
                  const effectiveReason = rowReason || reason;
                  const rowReasonReady = effectiveReason.trim().length >= 3;

                  return (
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
                        <Input
                          value={rowReason}
                          onChange={(event) => setRowReason(row.userId, event.target.value)}
                          placeholder={uiText("auto.ui.7c3b5fbd20")}
                          className="mt-2 h-8 text-xs"
                        />
                      </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          subscriptionAction.isPending ||
                          !rowReasonReady ||
                          !row.userId
                        }
                        onClick={() =>
                          row.userId &&
                          submitSubscriptionUpdate(row.userId, "pro", "active", null, effectiveReason)
                        }
                      >
                        Upgrade Pro
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          subscriptionAction.isPending ||
                          !rowReasonReady ||
                          !row.userId
                        }
                        onClick={() =>
                          row.userId &&
                          submitSubscriptionUpdate(row.userId, "free", "active", null, effectiveReason)
                        }
                      >
                        Downgrade Free
                      </Button>
                    </TableCell>
                    </TableRow>
                  );
                })}
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
          <h1 className="text-2xl font-semibold">{uiText("admin.security.title")}</h1>
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
          placeholder={uiText("auto.ui.3650c115b4")}
        />
        <Input
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
          placeholder={uiText("auto.ui.01af999d30")}
        />
      </div>
      {audit.isError ? (
        <AdminErrorState
          title={uiText("auto.ui.87e782d865")}
          description="Il log sicurezza non e stato caricato."
        />
      ) : (
        <section className="overflow-hidden rounded-lg border border-border bg-card/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{uiText("auto.ui.f18824e55d")}</TableHead>
                <TableHead>{uiText("auto.ui.6fe7fde0da")}</TableHead>
                <TableHead>{uiText("auto.ui.61ad50a9b9")}</TableHead>
                <TableHead>{uiText("auto.ui.cbeec536b2")}</TableHead>
                <TableHead>{uiText("auto.ui.e5e429bcc9")}</TableHead>
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
