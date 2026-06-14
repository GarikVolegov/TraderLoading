import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { billingQueryKey } from "@/lib/billingApi";
import { uiText } from "@/contexts/LanguageContext";
import { getAdminSubscriptions, updateAdminSubscription, type AdminSubscriptionPlan, type AdminSubscriptionRow, type AdminSubscriptionStatus } from "@/lib/adminApi";
import { CheckCircle2, CreditCard, RefreshCw, Search, ShieldCheck, Users } from "lucide-react";
import { OperationalPageHeader, OperationalLoadingGrid } from "./operational";
import { ADMIN_SUBSCRIPTION_PLANS, ADMIN_SUBSCRIPTION_STATUSES, formatAdminDate, statusVariant, AdminErrorState } from "./shared";

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

export function AdminSubscriptionsPage() {
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
