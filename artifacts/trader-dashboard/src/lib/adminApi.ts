import { apiJSON } from "./apiFetch";
import type {
  SupportTicket,
  SupportTicketMessage,
} from "@workspace/api-client-react";

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
    pendingApplications?: number;
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

export interface AdminAuditRecord {
  id: number;
  actorUserId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
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

export interface AdminTradingOverview {
  metrics: {
    brokerProfiles: number;
    importedTrades: number;
    openTrades: number;
    tradesToday: number;
    backtestSessions: number;
    backtestTrades: number;
  };
  recentTrades: Array<{
    id: number;
    userId: string;
    ticket: string;
    source: string;
    symbol: string;
    direction: string;
    status: string;
    profit: string | null;
    createdAt: string;
  }>;
}

export interface AdminContentOverview {
  metrics: {
    collections: number;
    publishedCollections: number;
    contents: number;
    publishedContents: number;
    missionTemplates: number;
    levelMilestones: number;
    quotes: number;
    communities: number;
    communityMessages: number;
  };
}

export interface AdminContentItem {
  id: number;
  title: string;
  type: string;
  published: boolean;
  requiredLevel: number;
  collectionId: number | null;
  collectionTitle: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface AdminSupportOverview {
  metrics: {
    suspendedUsers: number;
    activeToday: number;
    pushSubscribers: number;
    adminActionsToday: number;
  };
  recentLoginAccess: Array<{
    id: number;
    userId: string;
    ipAddress: string;
    userAgent: string | null;
    createdAt: string;
  }>;
}

export interface AdminSystemOverview {
  runtime: {
    nodeEnv: string;
    uptimeSeconds: number;
    version: string;
    database: {
      status: "ok" | "error";
      latencyMs: number;
    };
  };
  metrics: {
    sessions: number;
    pushSubscriptions: number;
    newsSnapshots: number;
    adminUserStatuses: number;
  };
  flags: Array<{
    key: string;
    configured: boolean;
  }>;
}

export type AdminSubscriptionPlan = "free" | "pro" | "tributo_150";
export type AdminSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled";

export interface AdminSubscriptionRow {
  profileId: number;
  userId: string | null;
  name: string;
  email: string | null;
  plan: AdminSubscriptionPlan;
  status: AdminSubscriptionStatus;
  source: string;
  manualOverride: boolean;
  currentPeriodEnd: string | null;
  reason: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface AdminSubscriptionsOverview {
  metrics: {
    visibleUsers: number;
    manualOverrides: number;
    activeSubscriptions: number;
    paidPlans: number;
  };
  subscriptions: AdminSubscriptionRow[];
}

export function getAdminMe() {
  return apiJSON<AdminMe>("/admin/me");
}

export function getAdminDashboard() {
  return apiJSON<AdminDashboard>("/admin/dashboard");
}

export function getAdminAudit(
  params: {
    actor?: string;
    targetType?: string;
    targetId?: string;
    action?: string;
    limit?: number;
  } = {},
) {
  const search = new URLSearchParams();
  if (params.actor) search.set("actor", params.actor);
  if (params.targetType) search.set("targetType", params.targetType);
  if (params.targetId) search.set("targetId", params.targetId);
  if (params.action) search.set("action", params.action);
  if (params.limit) search.set("limit", String(params.limit));

  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiJSON<{ audit: AdminAuditRecord[] }>(`/admin/audit${suffix}`);
}

export function getAdminTradingOverview() {
  return apiJSON<AdminTradingOverview>("/admin/trading/overview");
}

export function getAdminContentOverview() {
  return apiJSON<AdminContentOverview>("/admin/content/overview");
}

export function getAdminContentItems(params: { limit?: number } = {}) {
  const search = new URLSearchParams();
  if (params.limit) search.set("limit", String(params.limit));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiJSON<{ items: AdminContentItem[] }>(
    `/admin/content/items${suffix}`,
  );
}

function postAdminContentAction(itemId: number, action: string, reason: string) {
  return apiJSON<{ success: true; item: AdminContentItem }>(
    `/admin/content/items/${encodeURIComponent(String(itemId))}/${action}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );
}

export function publishAdminContentItem(itemId: number, reason: string) {
  return postAdminContentAction(itemId, "publish", reason);
}

export function unpublishAdminContentItem(itemId: number, reason: string) {
  return postAdminContentAction(itemId, "unpublish", reason);
}

export type AdminReviewStatus = "pending" | "approved" | "rejected" | "withdrawn";

export interface AdminReviewRow {
  id: number;
  name: string;
  role: string | null;
  text: string;
  rating: number;
  status: AdminReviewStatus;
  published: boolean;
  userId: string | null;
  locale: string | null;
  createdAt: string;
  updatedAt: string;
  moderatedAt: string | null;
  avatarUrl: string | null;
}

export function getAdminReviews(params: { status?: string; limit?: number } = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.limit) search.set("limit", String(params.limit));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiJSON<{ reviews: AdminReviewRow[]; status: string }>(`/admin/reviews${suffix}`);
}

function postAdminReviewAction(id: number, action: string, reason?: string) {
  return apiJSON<{ success: true; review: AdminReviewRow }>(
    `/admin/reviews/${encodeURIComponent(String(id))}/${action}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );
}

export function approveAdminReview(id: number) {
  return postAdminReviewAction(id, "approve");
}

export function rejectAdminReview(id: number, reason: string) {
  return postAdminReviewAction(id, "reject", reason);
}

export function hideAdminReview(id: number) {
  return postAdminReviewAction(id, "hide");
}

export function getAdminSupportOverview() {
  return apiJSON<AdminSupportOverview>("/admin/support/overview");
}

export function getAdminSupportTickets(params: { status?: string; limit?: number } = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.limit) search.set("limit", String(params.limit));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiJSON<{ tickets: SupportTicket[] }>(`/admin/support/tickets${suffix}`);
}

export function getAdminSupportTicketThread(id: number) {
  return apiJSON<{ ticket: SupportTicket; messages: SupportTicketMessage[] }>(
    `/admin/support/tickets/${id}`,
  );
}

export function replyAdminSupportTicket(id: number, body: string) {
  return apiJSON<{ message: SupportTicketMessage; ticket: SupportTicket }>(
    `/admin/support/tickets/${id}/reply`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
}

export function setAdminSupportTicketStatus(id: number, status: string) {
  return apiJSON<{ ticket: SupportTicket }>(
    `/admin/support/tickets/${id}/status`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
  );
}

export function getAdminSystemOverview() {
  return apiJSON<AdminSystemOverview>("/admin/system/overview");
}

export function getAdminSubscriptions(
  params: { q?: string; limit?: number } = {},
) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.limit) search.set("limit", String(params.limit));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiJSON<AdminSubscriptionsOverview>(`/admin/subscriptions${suffix}`);
}

export function updateAdminSubscription(
  userId: string,
  payload: {
    plan: AdminSubscriptionPlan;
    status: AdminSubscriptionStatus;
    currentPeriodEnd?: string | null;
    reason: string;
  },
) {
  return apiJSON<{ success: true; subscription: AdminSubscriptionRow }>(
    `/admin/subscriptions/${encodeURIComponent(userId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
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

// ─── CANDIDATE APPLICATIONS (TRIBUTO 150€/MESE) ──────────────────────────────
export interface CandidateApplicationItem {
  id: number;
  candidateCode: string;
  name: string;
  email: string;
  contactType: "whatsapp" | "telegram";
  contactHandle: string;
  situation: string | null;
  horizon: string | null;
  obstacle: string | null;
  commitment: string | null;
  planChosen: string;
  selectedServices?: string[] | null;
  approvedServices?: string[] | null;
  monthlyFeeCents?: number | null;
  oneTimeFeeCents?: number | null;
  currency?: string | null;
  referredBy: string | null;
  status: "in_valutazione" | "ammesso" | "respinto" | "contattato";
  notes: string | null;
  userId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCandidateApplicationsResponse {
  applications: CandidateApplicationItem[];
  total: number;
  pendingCount: number;
  admittedCount: number;
  limit: number;
  offset: number;
}

export function getAdminCandidateApplications(
  params: { status?: string; q?: string; limit?: number; offset?: number } = {},
) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.q) search.set("q", params.q);
  if (params.limit) search.set("limit", String(params.limit));
  if (params.offset) search.set("offset", String(params.offset));

  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiJSON<AdminCandidateApplicationsResponse>(
    `/admin/candidate-applications${suffix}`,
  );
}

export function updateAdminCandidateStatus(
  id: number,
  status: "in_valutazione" | "ammesso" | "respinto" | "contattato",
  notes?: string,
) {
  return apiJSON<{ ok: true; application: CandidateApplicationItem }>(
    `/admin/candidate-applications/${encodeURIComponent(String(id))}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes }),
    },
  );
}

export function admitAdminCandidate(
  id: number,
  payload: { userId?: string; notes?: string; approvedServices?: string[] } = {},
) {
  return apiJSON<{
    ok: true;
    application: CandidateApplicationItem;
    subscription: AdminSubscriptionRow | null;
    targetUserId: string | null;
  }>(
    `/admin/candidate-applications/${encodeURIComponent(String(id))}/admit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

export function updateAdminCandidateServices(
  id: number,
  approvedServices: string[],
  notes?: string,
) {
  return apiJSON<{
    ok: true;
    application: CandidateApplicationItem;
  }>(
    `/admin/candidate-applications/${encodeURIComponent(String(id))}/services`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvedServices, notes }),
    },
  );
}

// ─── ADMIN STAFF ROLES ───────────────────────────────────────────────────────
export interface AdminRoleItem {
  id: number;
  userId: string;
  role: AdminRole;
  status: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  userName: string | null;
}

export function getAdminRoles() {
  return apiJSON<{
    roles: AdminRoleItem[];
    bootstrapUserIds: string[];
    availableRoles: AdminRole[];
  }>("/admin/roles");
}

export function assignAdminRole(userId: string, role: AdminRole) {
  return apiJSON<{ ok: true; admin: AdminRoleItem }>("/admin/roles/assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, role }),
  });
}

export function revokeAdminRole(userId: string, reason?: string) {
  return apiJSON<{ ok: true; admin: AdminRoleItem }>("/admin/roles/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, reason }),
  });
}

// ─── USER PROFILE GOVERNANCE & GDPR ──────────────────────────────────────────
export function updateAdminUserProfile(
  userId: string,
  updates: { xp?: number; level?: number; streak?: number; name?: string; reason?: string },
) {
  return apiJSON<{ ok: true; profile: unknown }>(
    `/admin/users/${encodeURIComponent(userId)}/profile`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    },
  );
}

export async function exportAdminUserData(userId: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/export`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Errore export: ${res.statusText}`);
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `export-user-${userId}.json`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// ─── SYSTEM FEATURE FLAGS ────────────────────────────────────────────────────
export interface AdminSystemFlag {
  key: string;
  enabled: boolean;
  description: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

export function getAdminSystemFlags() {
  return apiJSON<{ flags: AdminSystemFlag[] }>("/admin/system/flags");
}

export function toggleAdminSystemFlag(key: string, enabled?: boolean) {
  return apiJSON<{ ok: true; flag: AdminSystemFlag }>(
    `/admin/system/flags/${encodeURIComponent(key)}/toggle`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enabled !== undefined ? { enabled } : {}),
    },
  );
}

// ─── TRADING & BROKER DIAGNOSTICS & SYNC ─────────────────────────────────────
export interface AdminTradingDiagnostics {
  profiles: Array<Record<string, unknown>>;
  recentTrades: Array<{
    id: number;
    ticket: string;
    source: string;
    symbol: string;
    status: string;
    userId: string;
    createdAt: string;
  }>;
  totalProfiles: number;
}

export function getAdminTradingDiagnostics() {
  return apiJSON<AdminTradingDiagnostics>("/admin/trading/diagnostics");
}

export function retryAdminTradingSync(profileId?: string, userId?: string) {
  return apiJSON<{ ok: true; message: string; profileId?: string; targetUserId?: string }>(
    "/admin/trading/retry-sync",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, userId }),
    },
  );
}
