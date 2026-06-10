import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Database,
  FileText,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { Route, Switch, useLocation, useRoute } from "wouter";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getAdminDashboard,
  getAdminMe,
  getAdminUserDetail,
  getAdminUsers,
  reactivateAdminUser,
  revokeAdminUserSessions,
  suspendAdminUser,
  type AdminUserRow,
} from "@/lib/adminApi";

function useAdminMe() {
  return useQuery({ queryKey: ["admin", "me"], queryFn: getAdminMe });
}

function AdminAccessBoundary({ children }: { children: ReactNode }) {
  const me = useAdminMe();

  if (me.isLoading) {
    return <div className="min-h-dvh bg-background" />;
  }

  const role = me.data?.role;
  if (me.isError || !role) {
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

  return <AdminShell role={role}>{children}</AdminShell>;
}

function AdminDashboardPage() {
  const dashboard = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: getAdminDashboard,
  });
  const metrics = dashboard.data?.metrics;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Vista operativa su utenti, trading data e attivita admin.
        </p>
      </div>
      {dashboard.isLoading ? (
        <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
          Caricamento metriche...
        </div>
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
          <section className="rounded-lg border border-border bg-card/80 p-4">
            <h2 className="text-sm font-semibold">Azioni urgenti</h2>
            <div className="mt-3 space-y-2">
              {(dashboard.data?.urgentActions ?? []).map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-muted"
                >
                  <span>{item.label}</span>
                  <span className="font-semibold tabular-nums">
                    {item.count}
                  </span>
                </a>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [, setLocation] = useLocation();
  const users = useQuery({
    queryKey: ["admin", "users", query, status],
    queryFn: () => getAdminUsers({ q: query, status, limit: 50 }),
  });
  const rows = users.data?.users ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Utenti</h1>
        <p className="text-sm text-muted-foreground">
          Cerca, filtra e apri i profili operativi.
        </p>
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
          onChange={(event) => setStatus(event.target.value)}
          className="min-h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="all">Tutti gli stati</option>
          <option value="active">Attivi</option>
          <option value="suspended">Sospesi</option>
        </select>
      </div>
      <section className="rounded-lg border border-border bg-card/80">
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
            {rows.map((user: AdminUserRow) => (
              <TableRow key={user.profileId}>
                <TableCell>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {user.userId ?? "guest"}
                  </div>
                </TableCell>
                <TableCell>{user.email ?? "-"}</TableCell>
                <TableCell>{user.status}</TableCell>
                <TableCell>{user.level}</TableCell>
                <TableCell>{user.xp}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!user.userId}
                    onClick={() =>
                      user.userId && setLocation(`/admin/users/${user.userId}`)
                    }
                  >
                    Apri
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">
            Nessun utente trovato.
          </div>
        )}
      </section>
    </div>
  );
}

function useAdminUserIdFromRoute() {
  const [, params] = useRoute("/admin/users/:userId");
  return params?.userId ?? "";
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
  };
  const revokeSessions = useMutation({
    mutationFn: () => revokeAdminUserSessions(userId, reason),
    onSuccess: invalidate,
  });
  const suspend = useMutation({
    mutationFn: () => suspendAdminUser(userId, reason),
    onSuccess: invalidate,
  });
  const reactivate = useMutation({
    mutationFn: () => reactivateAdminUser(userId, reason),
    onSuccess: invalidate,
  });
  const disabled =
    reason.trim().length === 0 ||
    revokeSessions.isPending ||
    suspend.isPending ||
    reactivate.isPending;
  const counters = detail.data?.user.counters;
  const audit = useMemo(() => detail.data?.audit ?? [], [detail.data]);

  if (detail.isLoading) {
    return (
      <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
        Caricamento utente...
      </div>
    );
  }

  if (detail.isError || !detail.data) {
    return (
      <div className="rounded-lg border border-border p-6 text-sm text-destructive">
        Utente non trovato.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/80 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{detail.data.user.name}</h1>
          <p className="text-sm text-muted-foreground">
            {detail.data.user.email ?? detail.data.user.userId}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Stato: {detail.data.user.status}
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
      <div className="grid gap-3 md:grid-cols-3">
        <AdminMetricCard
          label="Trade"
          value={counters?.trades ?? 0}
          detail="Account trades importati"
          icon={Database}
        />
        <AdminMetricCard
          label="Journal"
          value={counters?.journalEntries ?? 0}
          detail="Entry salvate"
          icon={FileText}
        />
        <AdminMetricCard
          label="Backtest"
          value={counters?.backtests ?? 0}
          detail="Sessioni create"
          icon={BookOpen}
        />
      </div>
      <section className="rounded-lg border border-border bg-card/80 p-4">
        <h2 className="text-sm font-semibold">Ultimi login</h2>
        <div className="mt-3 space-y-2">
          {detail.data.loginAccess.map((item) => (
            <div key={item.id} className="rounded-md border border-border p-3 text-sm">
              <div className="font-medium">{item.ipAddress}</div>
              <div className="text-xs text-muted-foreground">{item.createdAt}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-border bg-card/80 p-4">
        <h2 className="text-sm font-semibold">Audit utente</h2>
        <div className="mt-3 space-y-2">
          {audit.map((item) => (
            <div key={item.id} className="rounded-md border border-border p-3 text-sm">
              <div className="font-medium">{item.action}</div>
              <div className="text-xs text-muted-foreground">
                {item.actorUserId} - {item.createdAt}
              </div>
              {item.reason && <div className="mt-1 text-xs">{item.reason}</div>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AdminComingSoon({ title }: { title: string }) {
  return (
    <section className="rounded-lg border border-border bg-card/80 p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Questa sezione arriva in una fase successiva sopra la base admin.
      </p>
    </section>
  );
}

export default function AdminPage() {
  return (
    <AdminAccessBoundary>
      <Switch>
        <Route path="/admin/users/:userId" component={AdminUserDetailPage} />
        <Route path="/admin/users" component={AdminUsersPage} />
        <Route path="/admin/trading">
          {() => <AdminComingSoon title="Trading" />}
        </Route>
        <Route path="/admin/content">
          {() => <AdminComingSoon title="Content" />}
        </Route>
        <Route path="/admin/support">
          {() => <AdminComingSoon title="Supporto" />}
        </Route>
        <Route path="/admin/system">
          {() => <AdminComingSoon title="Sistema" />}
        </Route>
        <Route path="/admin/security">
          {() => <AdminComingSoon title="Sicurezza" />}
        </Route>
        <Route path="/admin" component={AdminDashboardPage} />
      </Switch>
    </AdminAccessBoundary>
  );
}
