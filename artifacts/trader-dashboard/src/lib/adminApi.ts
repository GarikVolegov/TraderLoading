import { apiJSON, apiRequest } from "./apiFetch";

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

export type AdminSubscriptionPlan = "free" | "pro";
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

export type AdminLibraryContentType = "document" | "mindmap" | "video";

export interface AdminLibraryUploadResult {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface AdminLibraryContent {
  id: number;
  collectionId: number | null;
  type: AdminLibraryContentType;
  title: string;
  description: string;
  bodyMarkdown: string;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number;
  mimeType: string | null;
  embedUrl: string | null;
  mindmap: unknown | null;
  tags: string;
  requiredLevel: number;
  orderIndex: number;
  published: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminLibraryContentPayload {
  collectionId?: number | null;
  type: AdminLibraryContentType;
  title: string;
  description: string;
  bodyMarkdown?: string;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number;
  mimeType?: string | null;
  embedUrl?: string | null;
  tags?: string[];
  requiredLevel: number;
  orderIndex: number;
  published: boolean;
}

export interface AdminMilestone {
  id: number;
  level: number;
  title: string;
  description: string;
  skills: string;
  badgeEmoji: string;
  badgeColor: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminMilestoneFile {
  id: number;
  level: number;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  downloadable: boolean;
  createdAt: string;
}

export interface AdminMilestoneDetail {
  milestone: AdminMilestone | null;
  files: AdminMilestoneFile[];
}

export interface AdminMilestonePayload {
  title: string;
  description: string;
  skills: string[];
  badgeEmoji: string;
  badgeColor: string;
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

export function getAdminSupportOverview() {
  return apiJSON<AdminSupportOverview>("/admin/support/overview");
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

async function parseUploadResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = (await response.json().catch(() => ({ error: response.statusText }))) as { error?: string };
    throw new Error(error.error ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getAdminLibraryContents() {
  return apiJSON<AdminLibraryContent[]>("library/contents");
}

export function createAdminLibraryContent(payload: AdminLibraryContentPayload) {
  return apiJSON<AdminLibraryContent>("library/contents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateAdminLibraryContent(id: number, payload: AdminLibraryContentPayload) {
  return apiJSON<AdminLibraryContent>(`library/contents/${encodeURIComponent(String(id))}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function deleteAdminLibraryContent(id: number) {
  return apiJSON<{ success: true }>(`library/contents/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
  });
}

export async function uploadAdminLibraryFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return parseUploadResponse<AdminLibraryUploadResult>(
    await apiRequest("library/upload", { method: "POST", body: formData }),
  );
}

export function getAdminMilestoneDetail(level: number) {
  return apiJSON<AdminMilestoneDetail>(`milestones/${encodeURIComponent(String(level))}`);
}

export function updateAdminMilestone(level: number, payload: AdminMilestonePayload) {
  return apiJSON<AdminMilestone>(`milestones/${encodeURIComponent(String(level))}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function uploadAdminMilestoneFile(level: number, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return parseUploadResponse<AdminMilestoneFile>(
    await apiRequest(`milestones/${encodeURIComponent(String(level))}/files`, { method: "POST", body: formData }),
  );
}

export function toggleAdminMilestoneFileDownloadable(fileId: number, downloadable: boolean) {
  return apiJSON<AdminMilestoneFile>(`milestones/files/${encodeURIComponent(String(fileId))}/downloadable`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ downloadable }),
  });
}

export function deleteAdminMilestoneFile(fileId: number) {
  return apiJSON<{ ok: true }>(`milestones/files/${encodeURIComponent(String(fileId))}`, {
    method: "DELETE",
  });
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
