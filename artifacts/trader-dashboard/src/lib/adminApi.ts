import { apiJSON } from "./apiFetch";

export type AdminRole =
  | "super_admin"
  | "admin_operator"
  | "support_agent"
  | "moderator"
  | "content_manager"
  | "developer_ops"
  | "read_only_auditor";

export interface AdminMe {
  userId: string;
  role: AdminRole;
  permissions: string[];
  source: "bootstrap" | "database";
}

export interface AdminDashboard {
  metrics: {
    totalProfiles: number;
    activeToday: number;
    tradesToday: number;
    journalToday: number;
    backtestsToday: number;
    suspendedUsers: number;
  };
  urgentActions: Array<{
    id: string;
    label: string;
    count: number;
    href: string;
  }>;
  recentAudit: Array<{
    id: number;
    actorUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    createdAt: string;
  }>;
}

export interface AdminUserRow {
  profileId: number;
  userId: string | null;
  name: string;
  avatarUrl: string | null;
  xp: number;
  level: number;
  streak: number;
  email: string | null;
  status: string;
  statusReason: string | null;
}

export interface AdminUserDetail {
  user: AdminUserRow & {
    firstName: string | null;
    lastName: string | null;
    yearsExperience: number | null;
    counters: {
      trades: number;
      journalEntries: number;
      backtests: number;
    };
  };
  loginAccess: Array<{
    id: number;
    ipAddress: string;
    userAgent: string | null;
    createdAt: string;
  }>;
  audit: Array<{
    id: number;
    actorUserId: string;
    actorRole: string;
    action: string;
    reason: string | null;
    createdAt: string;
  }>;
}

export function getAdminMe() {
  return apiJSON<AdminMe>("/admin/me");
}

export function getAdminDashboard() {
  return apiJSON<AdminDashboard>("/admin/dashboard");
}

export function getAdminUsers(
  params: { q?: string; status?: string; limit?: number } = {},
) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.limit) search.set("limit", String(params.limit));

  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiJSON<{ users: AdminUserRow[] }>(`/admin/users${suffix}`);
}

export function getAdminUserDetail(userId: string) {
  return apiJSON<AdminUserDetail>(
    `/admin/users/${encodeURIComponent(userId)}`,
  );
}

function postAdminUserAction<T>(path: string, reason: string) {
  return apiJSON<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

export function revokeAdminUserSessions(userId: string, reason: string) {
  return postAdminUserAction<{ success: true; revokedSessions: number }>(
    `/admin/users/${encodeURIComponent(userId)}/revoke-sessions`,
    reason,
  );
}

export function suspendAdminUser(userId: string, reason: string) {
  return postAdminUserAction<{ success: true }>(
    `/admin/users/${encodeURIComponent(userId)}/suspend`,
    reason,
  );
}

export function reactivateAdminUser(userId: string, reason: string) {
  return postAdminUserAction<{ success: true }>(
    `/admin/users/${encodeURIComponent(userId)}/reactivate`,
    reason,
  );
}
