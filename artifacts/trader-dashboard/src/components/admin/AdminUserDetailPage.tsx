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
import {
  getAdminUserDetail,
  reactivateAdminUser,
  revokeAdminUserSessions,
  suspendAdminUser,
  updateAdminSubscription,
  updateAdminUserProfile,
  exportAdminUserData,
  assignAdminRole,
  revokeAdminRole,
  type AdminUserDetail,
  type AdminSubscriptionPlan,
  type AdminRole,
} from "@/lib/adminApi";
import { BookOpen, Database, Download, FileText, Shield, Sparkles } from "lucide-react";
import { formatAdminDate, statusVariant, AdminErrorState, AuditPreviewList } from "./shared";

function useAdminUserIdFromRoute() {
  const [, params] = useRoute("/admin/users/:userId");
  return params?.userId ?? "";
}

function AdminUserDetailTabs({ detail, onInvalidate }: { detail: AdminUserDetail; onInvalidate?: () => void }) {
  const user = detail.user;
  const counters = user.counters;
  const qc = useQueryClient();

  const [editXp, setEditXp] = useState(String(user.xp));
  const [editLevel, setEditLevel] = useState(String(user.level));
  const [editStreak, setEditStreak] = useState(String(user.streak));
  const [selectedPlan, setSelectedPlan] = useState<AdminSubscriptionPlan>("free");
  const [planReason, setPlanReason] = useState("Modifica manuale da console admin");
  const [staffRole, setStaffRole] = useState<AdminRole>("support_agent");
  const [governanceMsg, setGovernanceMsg] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
    qc.invalidateQueries({ queryKey: ["admin", "subscriptions"] });
    qc.invalidateQueries({ queryKey: ["admin", "roles"] });
    if (onInvalidate) onInvalidate();
  };

  const updateProfileMutation = useMutation({
    mutationFn: () =>
      updateAdminUserProfile(user.userId ?? "", {
        xp: Number(editXp),
        level: Number(editLevel),
        streak: Number(editStreak),
        reason: "Aggiornamento manuale progressione",
      }),
    onSuccess: () => {
      setGovernanceMsg("Progressione utente salvata.");
      invalidate();
    },
  });

  const updateSubMutation = useMutation({
    mutationFn: () =>
      updateAdminSubscription(user.userId ?? "", {
        plan: selectedPlan,
        status: "active",
        reason: planReason,
      }),
    onSuccess: () => {
      setGovernanceMsg(`Piano impostato a ${selectedPlan}.`);
      invalidate();
    },
  });

  const assignRoleMutation = useMutation({
    mutationFn: () => assignAdminRole(user.userId ?? "", staffRole),
    onSuccess: () => {
      setGovernanceMsg(`Ruolo ${staffRole} assegnato.`);
      invalidate();
    },
  });

  const revokeRoleMutation = useMutation({
    mutationFn: () => revokeAdminRole(user.userId ?? "", "Revoca da scheda utente"),
    onSuccess: () => {
      setGovernanceMsg("Ruolo staff rimosso.");
      invalidate();
    },
  });

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview">{uiText("auto.ui.0efc2e6be4")}</TabsTrigger>
        <TabsTrigger value="governance">Governance & Piano</TabsTrigger>
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
      <TabsContent value="governance" className="space-y-4">
        {governanceMsg && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
            {governanceMsg}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* OVERRIDE PIANO ABBONAMENTO */}
          <section className="rounded-lg border border-border bg-card/80 p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Override Piano Abbonamento
            </h3>
            <p className="text-xs text-muted-foreground">
              Assegna manualmente il piano di accesso: Free, Pro o Tributo (€150/mese).
            </p>
            <div className="space-y-2">
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value as AdminSubscriptionPlan)}
                className="w-full min-h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="free">Free (Base)</option>
                <option value="pro">Pro (Accesso Standard)</option>
                <option value="tributo_150">Tributo (€150/mese) - Protocollo Completo</option>
              </select>
              <Input
                value={planReason}
                onChange={(e) => setPlanReason(e.target.value)}
                placeholder="Motivo dell'assegnazione o note interne..."
                className="text-xs"
              />
              <Button
                size="sm"
                className="w-full"
                disabled={updateSubMutation.isPending || !user.userId}
                onClick={() => updateSubMutation.mutate()}
              >
                Aggiorna Piano Utente
              </Button>
            </div>
          </section>

          {/* PROGRESSIONE XP / LIVELLO */}
          <section className="rounded-lg border border-border bg-card/80 p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" /> Modifica XP & Livello
            </h3>
            <p className="text-xs text-muted-foreground">
              Riallinea manualmente la progressione e la continuità operativa.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground">XP</label>
                <Input
                  type="number"
                  value={editXp}
                  onChange={(e) => setEditXp(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Livello</label>
                <Input
                  type="number"
                  value={editLevel}
                  onChange={(e) => setEditLevel(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Streak</label>
                <Input
                  type="number"
                  value={editStreak}
                  onChange={(e) => setEditStreak(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={updateProfileMutation.isPending || !user.userId}
              onClick={() => updateProfileMutation.mutate()}
            >
              Salva Progressione
            </Button>
          </section>

          {/* RUOLO STAFF ADMIN */}
          <section className="rounded-lg border border-border bg-card/80 p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> Ruolo Amministrativo (Staff)
            </h3>
            <p className="text-xs text-muted-foreground">
              Nomina questo utente operatore o amministratore della piattaforma.
            </p>
            <div className="space-y-2">
              <select
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value as AdminRole)}
                className="w-full min-h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="support_agent">support_agent (Supporto & Ticket)</option>
                <option value="moderator">moderator (Moderatore Community/Recensioni)</option>
                <option value="admin_operator">admin_operator (Operatore Gestionale)</option>
                <option value="content_manager">content_manager (Gestione Contenuti)</option>
                <option value="developer_ops">developer_ops (DevOps & Diagnostica)</option>
                <option value="super_admin">super_admin (Accesso Completo Illimitato)</option>
              </select>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={assignRoleMutation.isPending || !user.userId}
                  onClick={() => assignRoleMutation.mutate()}
                >
                  Assegna Ruolo
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-rose-400"
                  disabled={revokeRoleMutation.isPending || !user.userId}
                  onClick={() => revokeRoleMutation.mutate()}
                >
                  Revoca
                </Button>
              </div>
            </div>
          </section>

          {/* EXPORT GDPR */}
          <section className="rounded-lg border border-border bg-card/80 p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" /> Esportazione Dati Account (GDPR)
            </h3>
            <p className="text-xs text-muted-foreground">
              Scarica il pacchetto JSON completo dei dati dell'utente (profilo, trade, journal, impostazioni).
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={!user.userId}
              onClick={() => {
                if (user.userId) {
                  exportAdminUserData(user.userId).catch((err) => {
                    setGovernanceMsg(`Errore export: ${err.message}`);
                  });
                }
              }}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Esporta Dati JSON
            </Button>
          </section>
        </div>
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
      <AdminUserDetailTabs detail={detail.data} onInvalidate={invalidate} />
    </div>
  );
}
