import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useRoute } from "wouter";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { uiText } from "@/contexts/LanguageContext";
import { getAdminUserDetail, reactivateAdminUser, revokeAdminUserSessions, suspendAdminUser, type AdminUserDetail } from "@/lib/adminApi";
import { BookOpen, Database, FileText } from "lucide-react";
import { formatAdminDate, statusVariant, AdminErrorState, AuditPreviewList } from "./shared";

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

export function AdminUserDetailPage() {
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
