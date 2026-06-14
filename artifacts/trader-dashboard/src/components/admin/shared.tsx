import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { AdminShell } from "@/components/admin/AdminShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdminMe, type AdminSubscriptionPlan, type AdminSubscriptionStatus } from "@/lib/adminApi";
import { ShieldAlert, ShieldCheck } from "lucide-react";

export type AdminUserStatusFilter = "all" | "active" | "suspended" | "banned";

export type AdminAuditPreview = {
  id: number;
  actorUserId: string;
  actorRole?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  reason?: string | null;
  createdAt: string;
};

export const ADMIN_USER_STATUS_FILTERS: AdminUserStatusFilter[] = [
  "all",
  "active",
  "suspended",
  "banned",
];
export const ADMIN_SUBSCRIPTION_PLANS: AdminSubscriptionPlan[] = [
  "free",
  "pro",
];
export const ADMIN_SUBSCRIPTION_STATUSES: AdminSubscriptionStatus[] = [
  "active",
  "trialing",
  "past_due",
  "canceled",
];

export function useAdminMe() {
  return useQuery({ queryKey: ["admin", "me"], queryFn: getAdminMe });
}

export function getSearchParam(name: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) ?? "";
}

export function getInitialAdminUserStatus(): AdminUserStatusFilter {
  const status = getSearchParam("status");
  return ADMIN_USER_STATUS_FILTERS.includes(status as AdminUserStatusFilter)
    ? (status as AdminUserStatusFilter)
    : "all";
}

export function getInitialAdminUserQuery(): string {
  return getSearchParam("q");
}

export function syncAdminUserFiltersToUrl(
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

export function formatAdminDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "suspended" || status === "banned") return "destructive";
  return "secondary";
}

export function AdminPageSkeleton() {
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

export function AdminErrorState({
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

export function AdminAccessBoundary({ children }: { children: ReactNode }) {
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

export function AuditPreviewList({ audit }: { audit: AdminAuditPreview[] }) {
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
