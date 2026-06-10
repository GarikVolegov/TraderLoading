export type AdminRole =
  | "super_admin"
  | "admin_operator"
  | "support_agent"
  | "moderator"
  | "content_manager"
  | "developer_ops"
  | "read_only_auditor";

export type AdminPermission =
  | "admin.access"
  | "dashboard.read"
  | "users.read"
  | "users.suspend"
  | "users.revoke_sessions"
  | "users.export_data"
  | "support.write"
  | "moderation.resolve"
  | "content.publish"
  | "trading.read"
  | "trading.retry_sync"
  | "system.feature_flags.write"
  | "security.audit.read"
  | "security.roles.write";

export interface AdminPrincipal {
  userId: string;
  role: AdminRole;
  source: "bootstrap" | "database";
}

export const ADMIN_PERMISSIONS_BY_ROLE: Record<AdminRole, AdminPermission[]> = {
  super_admin: [
    "admin.access",
    "dashboard.read",
    "users.read",
    "users.suspend",
    "users.revoke_sessions",
    "users.export_data",
    "support.write",
    "moderation.resolve",
    "content.publish",
    "trading.read",
    "trading.retry_sync",
    "system.feature_flags.write",
    "security.audit.read",
    "security.roles.write",
  ],
  admin_operator: [
    "admin.access",
    "dashboard.read",
    "users.read",
    "users.suspend",
    "users.revoke_sessions",
    "support.write",
    "moderation.resolve",
    "content.publish",
    "trading.read",
    "trading.retry_sync",
    "security.audit.read",
  ],
  support_agent: [
    "admin.access",
    "dashboard.read",
    "users.read",
    "users.revoke_sessions",
    "support.write",
    "trading.read",
  ],
  moderator: [
    "admin.access",
    "dashboard.read",
    "users.read",
    "moderation.resolve",
  ],
  content_manager: ["admin.access", "dashboard.read", "content.publish"],
  developer_ops: [
    "admin.access",
    "dashboard.read",
    "trading.read",
    "trading.retry_sync",
    "system.feature_flags.write",
    "security.audit.read",
  ],
  read_only_auditor: [
    "admin.access",
    "dashboard.read",
    "users.read",
    "security.audit.read",
  ],
};

export function isAdminRole(value: string): value is AdminRole {
  return value in ADMIN_PERMISSIONS_BY_ROLE;
}

export function hasAdminPermission(
  role: AdminRole,
  permission: AdminPermission,
): boolean {
  return ADMIN_PERMISSIONS_BY_ROLE[role].includes(permission);
}

export function getBootstrapAdminIds(
  raw = process.env.ADMIN_BOOTSTRAP_USER_IDS ?? "",
): Set<string> {
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function resolveAdminPrincipal(
  userId: string,
  dbAdmin: { role: string; status: string } | null | undefined,
  bootstrapIds = getBootstrapAdminIds(),
): AdminPrincipal | null {
  if (bootstrapIds.has(userId)) {
    return { userId, role: "super_admin", source: "bootstrap" };
  }
  if (!dbAdmin || dbAdmin.status !== "active" || !isAdminRole(dbAdmin.role)) {
    return null;
  }
  return { userId, role: dbAdmin.role, source: "database" };
}
