# TraderLoadings Admin Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first secure admin foundation for TraderLoadings: admin RBAC, audit logging, admin API routes, `/admin` shell, dashboard overview, user search/detail, and safe user actions.

**Architecture:** Add admin-only tables and helpers in `@workspace/db` and `@workspace/api-server`, then expose a dedicated `/api/admin/*` route namespace guarded by server-side admin permissions. Add a self-contained React admin area under `/admin` that does not use the mobile app navigation and consumes handwritten admin API helpers.

**Tech Stack:** Express 5, Drizzle ORM, PostgreSQL, React, Wouter, TanStack Query, shadcn/ui components already present in `artifacts/trader-dashboard`, static Node tests, TypeScript.

---

## Scope

This plan implements the first vertical slice from the admin panel spec:

- Admin identity and permission gate.
- Append-only audit logs.
- Admin dashboard summary.
- User list and user detail read views.
- Safe user actions: revoke sessions, suspend, reactivate.
- Admin shell under `/admin`.

This plan does not implement moderation, content management, broker diagnostics, support tickets, feature flags, or billing. Those become separate plans after this foundation lands.

## File Structure

- Create `lib/db/src/schema/admin.ts`: admin users, user status, and audit log tables.
- Modify `lib/db/src/schema/index.ts`: export admin schema.
- Create `lib/db/src/schema/admin.static.test.ts`: static schema guard for expected table names and indexes.
- Modify generated Drizzle migrations by running `pnpm db:generate`; review the new migration file before committing.
- Create `artifacts/api-server/src/lib/adminPermissions.ts`: roles, permission matrix, and permission helpers.
- Create `artifacts/api-server/src/lib/adminAuth.ts`: Express guard for `/api/admin/*`.
- Create `artifacts/api-server/src/services/adminAudit.ts`: append-only audit writer and redaction helper.
- Create `artifacts/api-server/src/routes/admin.ts`: admin API endpoints.
- Create `artifacts/api-server/src/routes/admin.test.ts`: pure helper tests for admin API query/action logic.
- Modify `artifacts/api-server/src/routes/index.ts`: mount the admin router.
- Create `artifacts/trader-dashboard/src/lib/adminApi.ts`: typed admin API fetch helpers.
- Create `artifacts/trader-dashboard/src/lib/adminApi.static.test.ts`: static guard for admin endpoints.
- Create `artifacts/trader-dashboard/src/components/admin/AdminShell.tsx`: desktop admin layout with sidebar and top bar.
- Create `artifacts/trader-dashboard/src/components/admin/AdminMetricCard.tsx`: compact metric card.
- Create `artifacts/trader-dashboard/src/pages/Admin.tsx`: admin route switch and pages.
- Create `artifacts/trader-dashboard/src/pages/Admin.static.test.ts`: static guard for admin shell, routes, tabs, and actions.
- Modify `artifacts/trader-dashboard/src/App.tsx`: lazy-load `/admin` and bypass mobile app overlays/nav for admin routes.

## Environment Assumption

Use `ADMIN_BOOTSTRAP_USER_IDS` as a comma-separated allowlist for the first Super Admin accounts. Example:

```bash
ADMIN_BOOTSTRAP_USER_IDS=user_123,user_456
```

If a signed-in user ID is in that env var, they are treated as `super_admin` even before a row exists in `admin_users`. This prevents a chicken-and-egg admin setup.

---

### Task 1: Admin Database Schema

**Files:**
- Create: `lib/db/src/schema/admin.ts`
- Modify: `lib/db/src/schema/index.ts`
- Create: `lib/db/src/schema/admin.static.test.ts`
- Generate: `lib/db/drizzle/<next_migration>.sql`

- [ ] **Step 1: Write the failing schema static test**

Create `lib/db/src/schema/admin.static.test.ts`:

```ts
import assert from "node:assert/strict";
import fs from "node:fs";

const adminSchema = fs.readFileSync("src/schema/admin.ts", "utf8");
const schemaIndex = fs.readFileSync("src/schema/index.ts", "utf8");

assert.match(adminSchema, /pgTable\("admin_users"/);
assert.match(adminSchema, /pgTable\("admin_user_status"/);
assert.match(adminSchema, /pgTable\("admin_audit_logs"/);
assert.match(adminSchema, /admin_users_user_idx/);
assert.match(adminSchema, /admin_user_status_user_unique/);
assert.match(adminSchema, /admin_audit_logs_actor_idx/);
assert.match(adminSchema, /admin_audit_logs_target_idx/);
assert.match(adminSchema, /admin_audit_logs_created_idx/);
assert.match(adminSchema, /super_admin/);
assert.match(adminSchema, /support_agent/);
assert.match(schemaIndex, /export \* from "\.\/admin";/);

console.log("admin schema static checks passed");
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter ./scripts exec tsx local/run-tests.ts
```

Expected: FAIL because `src/schema/admin.ts` does not exist.

- [ ] **Step 3: Create the admin schema**

Create `lib/db/src/schema/admin.ts`:

```ts
import { index, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const adminUsersTable = pgTable(
  "admin_users",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    role: text("role").notNull().default("support_agent"),
    status: text("status").notNull().default("active"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("admin_users_user_idx").on(table.userId),
    index("admin_users_role_idx").on(table.role),
    index("admin_users_status_idx").on(table.status),
  ],
);

export const adminUserStatusTable = pgTable(
  "admin_user_status",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    status: text("status").notNull().default("active"),
    reason: text("reason"),
    updatedBy: text("updated_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("admin_user_status_user_unique").on(table.userId),
    index("admin_user_status_status_idx").on(table.status),
  ],
);

export const adminAuditLogsTable = pgTable(
  "admin_audit_logs",
  {
    id: serial("id").primaryKey(),
    actorUserId: text("actor_user_id").notNull(),
    actorRole: text("actor_role").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason"),
    before: jsonb("before"),
    after: jsonb("after"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    requestId: text("request_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("admin_audit_logs_actor_idx").on(table.actorUserId, table.createdAt),
    index("admin_audit_logs_target_idx").on(table.targetType, table.targetId, table.createdAt),
    index("admin_audit_logs_created_idx").on(table.createdAt),
  ],
);

export const insertAdminUserSchema = createInsertSchema(adminUsersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminUserStatusSchema = createInsertSchema(adminUserStatusTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminAuditLogSchema = createInsertSchema(adminAuditLogsTable).omit({
  id: true,
  createdAt: true,
});

export type AdminUser = typeof adminUsersTable.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUserStatus = typeof adminUserStatusTable.$inferSelect;
export type InsertAdminUserStatus = z.infer<typeof insertAdminUserStatusSchema>;
export type AdminAuditLog = typeof adminAuditLogsTable.$inferSelect;
export type InsertAdminAuditLog = z.infer<typeof insertAdminAuditLogSchema>;
```

- [ ] **Step 4: Export admin schema**

Append this line to `lib/db/src/schema/index.ts`:

```ts
export * from "./admin";
```

- [ ] **Step 5: Run schema checks**

Run:

```bash
pnpm --filter ./scripts exec tsx local/run-tests.ts
pnpm --filter @workspace/db run check
```

Expected: the static test passes and Drizzle check completes without schema errors.

- [ ] **Step 6: Generate the migration**

Run:

```bash
pnpm db:generate
```

Expected: a new migration file appears under `lib/db/drizzle/`.

- [ ] **Step 7: Review the migration**

Run:

```bash
git diff -- lib/db/src/schema/admin.ts lib/db/src/schema/index.ts lib/db/src/schema/admin.static.test.ts lib/db/drizzle
```

Expected: the diff creates only `admin_users`, `admin_user_status`, `admin_audit_logs`, their indexes, and Drizzle metadata updates.

- [ ] **Step 8: Commit**

```bash
git add lib/db/src/schema/admin.ts lib/db/src/schema/index.ts lib/db/src/schema/admin.static.test.ts lib/db/drizzle
git commit -m "feat: add admin database schema"
```

---

### Task 2: Admin Permissions and Guard

**Files:**
- Create: `artifacts/api-server/src/lib/adminPermissions.ts`
- Create: `artifacts/api-server/src/lib/adminAuth.ts`
- Create: `artifacts/api-server/src/lib/adminAuth.test.ts`

- [ ] **Step 1: Write the failing permission tests**

Create `artifacts/api-server/src/lib/adminAuth.test.ts`:

```ts
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const {
  ADMIN_PERMISSIONS_BY_ROLE,
  getBootstrapAdminIds,
  hasAdminPermission,
  resolveAdminPrincipal,
} = await import("./adminPermissions.js");

assert.equal(hasAdminPermission("super_admin", "security.roles.write"), true);
assert.equal(hasAdminPermission("support_agent", "users.read"), true);
assert.equal(hasAdminPermission("support_agent", "users.suspend"), false);
assert.equal(hasAdminPermission("moderator", "moderation.resolve"), true);
assert.equal(hasAdminPermission("moderator", "trading.read"), false);
assert.ok(ADMIN_PERMISSIONS_BY_ROLE.super_admin.includes("system.feature_flags.write"));

assert.deepEqual(getBootstrapAdminIds("user_a, user_b ,, "), new Set(["user_a", "user_b"]));
assert.deepEqual(resolveAdminPrincipal("user_a", null, new Set(["user_a"])), {
  userId: "user_a",
  role: "super_admin",
  source: "bootstrap",
});
assert.deepEqual(resolveAdminPrincipal("user_b", { role: "support_agent", status: "active" }, new Set()), {
  userId: "user_b",
  role: "support_agent",
  source: "database",
});
assert.equal(resolveAdminPrincipal("user_c", { role: "support_agent", status: "disabled" }, new Set()), null);

console.log("admin auth helper checks passed");
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter ./scripts exec tsx local/run-tests.ts
```

Expected: FAIL because `adminPermissions.js` does not exist.

- [ ] **Step 3: Add permission helpers**

Create `artifacts/api-server/src/lib/adminPermissions.ts`:

```ts
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
  moderator: ["admin.access", "dashboard.read", "users.read", "moderation.resolve"],
  content_manager: ["admin.access", "dashboard.read", "content.publish"],
  developer_ops: [
    "admin.access",
    "dashboard.read",
    "trading.read",
    "trading.retry_sync",
    "system.feature_flags.write",
    "security.audit.read",
  ],
  read_only_auditor: ["admin.access", "dashboard.read", "users.read", "security.audit.read"],
};

export function isAdminRole(value: string): value is AdminRole {
  return value in ADMIN_PERMISSIONS_BY_ROLE;
}

export function hasAdminPermission(role: AdminRole, permission: AdminPermission): boolean {
  return ADMIN_PERMISSIONS_BY_ROLE[role].includes(permission);
}

export function getBootstrapAdminIds(raw = process.env.ADMIN_BOOTSTRAP_USER_IDS ?? ""): Set<string> {
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
```

- [ ] **Step 4: Add the Express guard**

Create `artifacts/api-server/src/lib/adminAuth.ts`:

```ts
import { db, adminUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import {
  hasAdminPermission,
  resolveAdminPrincipal,
  type AdminPermission,
  type AdminPrincipal,
} from "./adminPermissions.js";

declare global {
  namespace Express {
    interface Request {
      admin?: AdminPrincipal;
    }
  }
}

export async function getAdminPrincipalForUser(userId: string): Promise<AdminPrincipal | null> {
  const [adminUser] = await db
    .select({ role: adminUsersTable.role, status: adminUsersTable.status })
    .from(adminUsersTable)
    .where(eq(adminUsersTable.userId, userId))
    .limit(1);
  return resolveAdminPrincipal(userId, adminUser ?? null);
}

export function requireAdmin(permission: AdminPermission) {
  return async function adminGuard(req: Request, res: Response, next: NextFunction) {
    if (!req.user?.id) {
      res.status(401).json({ error: "Non autenticato" });
      return;
    }

    const principal = await getAdminPrincipalForUser(req.user.id);
    if (!principal || !hasAdminPermission(principal.role, permission)) {
      res.status(403).json({ error: "Permesso admin insufficiente" });
      return;
    }

    req.admin = principal;
    next();
  };
}
```

- [ ] **Step 5: Run permission checks**

Run:

```bash
pnpm --filter ./scripts exec tsx local/run-tests.ts
pnpm --filter @workspace/api-server run typecheck
```

Expected: tests and API typecheck complete successfully.

- [ ] **Step 6: Commit**

```bash
git add artifacts/api-server/src/lib/adminPermissions.ts artifacts/api-server/src/lib/adminAuth.ts artifacts/api-server/src/lib/adminAuth.test.ts
git commit -m "feat: add admin permission guard"
```

---

### Task 3: Admin Audit Service

**Files:**
- Create: `artifacts/api-server/src/services/adminAudit.ts`
- Create: `artifacts/api-server/src/services/adminAudit.test.ts`

- [ ] **Step 1: Write the failing audit helper test**

Create `artifacts/api-server/src/services/adminAudit.test.ts`:

```ts
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const { redactAdminSnapshot, normalizeAuditReason } = await import("./adminAudit.js");

assert.equal(normalizeAuditReason("  revoke stale sessions  "), "revoke stale sessions");
assert.equal(normalizeAuditReason(""), null);
assert.equal(normalizeAuditReason("   "), null);

assert.deepEqual(redactAdminSnapshot({
  email: "user@example.com",
  access_token: "secret",
  refreshToken: "secret",
  brokerSecret: "secret",
  nested: {
    private_key_jwk: "secret",
    ok: true,
  },
}), {
  email: "user@example.com",
  access_token: "[redacted]",
  refreshToken: "[redacted]",
  brokerSecret: "[redacted]",
  nested: {
    private_key_jwk: "[redacted]",
    ok: true,
  },
});

console.log("admin audit helper checks passed");
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter ./scripts exec tsx local/run-tests.ts
```

Expected: FAIL because `adminAudit.js` does not exist.

- [ ] **Step 3: Create the audit service**

Create `artifacts/api-server/src/services/adminAudit.ts`:

```ts
import { db, adminAuditLogsTable } from "@workspace/db";
import type { Request } from "express";
import type { AdminPrincipal } from "../lib/adminPermissions.js";

const SENSITIVE_KEY_PATTERN = /(token|secret|password|private|credential|auth|p256dh|brokerSecret|jwk)/i;

export function normalizeAuditReason(reason: string | null | undefined): string | null {
  const trimmed = reason?.trim();
  return trimmed ? trimmed : null;
}

export function redactAdminSnapshot(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactAdminSnapshot(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : redactAdminSnapshot(nested),
      ]),
    );
  }
  return value;
}

export interface WriteAdminAuditInput {
  req: Request;
  admin: AdminPrincipal;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
}

export async function writeAdminAudit(input: WriteAdminAuditInput): Promise<void> {
  await db.insert(adminAuditLogsTable).values({
    actorUserId: input.admin.userId,
    actorRole: input.admin.role,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: normalizeAuditReason(input.reason),
    before: input.before == null ? null : redactAdminSnapshot(input.before),
    after: input.after == null ? null : redactAdminSnapshot(input.after),
    ipAddress: input.req.ip ?? input.req.socket?.remoteAddress ?? null,
    userAgent: input.req.headers["user-agent"] ?? null,
    requestId: input.req.headers["x-request-id"]?.toString() ?? null,
  });
}
```

- [ ] **Step 4: Run audit checks**

Run:

```bash
pnpm --filter ./scripts exec tsx local/run-tests.ts
pnpm --filter @workspace/api-server run typecheck
```

Expected: tests and API typecheck complete successfully.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/services/adminAudit.ts artifacts/api-server/src/services/adminAudit.test.ts
git commit -m "feat: add admin audit service"
```

---

### Task 4: Admin API Routes

**Files:**
- Create: `artifacts/api-server/src/routes/admin.ts`
- Create: `artifacts/api-server/src/routes/admin.test.ts`
- Modify: `artifacts/api-server/src/routes/index.ts`

- [ ] **Step 1: Write the failing route helper test**

Create `artifacts/api-server/src/routes/admin.test.ts`:

```ts
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const {
  normalizeAdminSearch,
  parseAdminLimit,
  serializeAdminUserStatus,
  requireActionReason,
} = await import("./admin.js");

assert.equal(normalizeAdminSearch("  Osman@example.COM "), "osman@example.com");
assert.equal(normalizeAdminSearch("   "), "");
assert.equal(parseAdminLimit("5", 50), 5);
assert.equal(parseAdminLimit("999", 50), 100);
assert.equal(parseAdminLimit("bad", 50), 50);
assert.equal(serializeAdminUserStatus(null), "active");
assert.equal(serializeAdminUserStatus({ status: "suspended" }), "suspended");
assert.equal(requireActionReason("  manual review  "), "manual review");
assert.throws(() => requireActionReason(""), /reason_required/);

console.log("admin route helper checks passed");
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter ./scripts exec tsx local/run-tests.ts
```

Expected: FAIL because `routes/admin.js` does not exist.

- [ ] **Step 3: Create admin route helpers and router skeleton**

Create `artifacts/api-server/src/routes/admin.ts` with imports, helpers, and router:

```ts
import { Router, type IRouter } from "express";
import {
  accountTradesTable,
  adminAuditLogsTable,
  adminUserStatusTable,
  backtestSessionsTable,
  db,
  journalEntriesTable,
  loginAccessTable,
  profileTable,
  sessionsTable,
  usersTable,
} from "@workspace/db";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/adminAuth.js";
import { ADMIN_PERMISSIONS_BY_ROLE } from "../lib/adminPermissions.js";
import { writeAdminAudit } from "../services/adminAudit.js";

const router: IRouter = Router();

export function normalizeAdminSearch(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function parseAdminLimit(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(100, Math.floor(parsed));
}

export function serializeAdminUserStatus(row: { status: string } | null | undefined): string {
  return row?.status ?? "active";
}

export function requireActionReason(value: unknown): string {
  const reason = String(value ?? "").trim();
  if (!reason) throw new Error("reason_required");
  return reason;
}
```

- [ ] **Step 4: Add `/admin/me` and `/admin/dashboard`**

Append to `artifacts/api-server/src/routes/admin.ts`:

```ts
router.get("/admin/me", requireAdmin("admin.access"), (req, res) => {
  res.json({
    userId: req.admin!.userId,
    role: req.admin!.role,
    permissions: ADMIN_PERMISSIONS_BY_ROLE[req.admin!.role],
    source: req.admin!.source,
  });
});

router.get("/admin/dashboard", requireAdmin("dashboard.read"), async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    [{ value: totalProfiles }],
    [{ value: activeToday }],
    [{ value: tradesToday }],
    [{ value: journalToday }],
    [{ value: backtestsToday }],
    [{ value: suspendedUsers }],
    recentAudit,
  ] = await Promise.all([
    db.select({ value: count() }).from(profileTable),
    db.select({ value: count() }).from(loginAccessTable).where(sql`${loginAccessTable.createdAt} >= ${today}`),
    db.select({ value: count() }).from(accountTradesTable).where(sql`${accountTradesTable.createdAt} >= ${today}`),
    db.select({ value: count() }).from(journalEntriesTable).where(sql`${journalEntriesTable.createdAt} >= ${today}`),
    db.select({ value: count() }).from(backtestSessionsTable).where(sql`${backtestSessionsTable.createdAt} >= ${today}`),
    db.select({ value: count() }).from(adminUserStatusTable).where(eq(adminUserStatusTable.status, "suspended")),
    db
      .select({
        id: adminAuditLogsTable.id,
        actorUserId: adminAuditLogsTable.actorUserId,
        action: adminAuditLogsTable.action,
        targetType: adminAuditLogsTable.targetType,
        targetId: adminAuditLogsTable.targetId,
        createdAt: adminAuditLogsTable.createdAt,
      })
      .from(adminAuditLogsTable)
      .orderBy(desc(adminAuditLogsTable.createdAt))
      .limit(8),
  ]);

  res.json({
    metrics: {
      totalProfiles,
      activeToday,
      tradesToday,
      journalToday,
      backtestsToday,
      suspendedUsers,
    },
    urgentActions: [
      { id: "suspended-users", label: "Utenti sospesi", count: suspendedUsers, href: "/admin/users?status=suspended" },
      { id: "recent-audit", label: "Azioni admin recenti", count: recentAudit.length, href: "/admin/audit" },
    ],
    recentAudit,
  });
});
```

- [ ] **Step 5: Add user list and user detail endpoints**

Append to `artifacts/api-server/src/routes/admin.ts`:

```ts
router.get("/admin/users", requireAdmin("users.read"), async (req, res) => {
  const q = normalizeAdminSearch(req.query.q);
  const limit = parseAdminLimit(req.query.limit, 50);
  const status = String(req.query.status ?? "all");

  const statusFilter =
    status === "all" ? undefined : eq(adminUserStatusTable.status, status);
  const searchFilter = q
    ? or(
        ilike(profileTable.name, `%${q}%`),
        ilike(usersTable.email, `%${q}%`),
        ilike(profileTable.userId, `%${q}%`),
      )
    : undefined;

  const rows = await db
    .select({
      profileId: profileTable.id,
      userId: profileTable.userId,
      name: profileTable.name,
      avatarUrl: profileTable.avatarUrl,
      xp: profileTable.xp,
      level: profileTable.level,
      streak: profileTable.streak,
      updatedAt: profileTable.updatedAt,
      email: usersTable.email,
      status: adminUserStatusTable.status,
      statusReason: adminUserStatusTable.reason,
    })
    .from(profileTable)
    .leftJoin(usersTable, eq(usersTable.id, profileTable.userId))
    .leftJoin(adminUserStatusTable, eq(adminUserStatusTable.userId, profileTable.userId))
    .where(and(searchFilter, statusFilter))
    .orderBy(desc(profileTable.updatedAt))
    .limit(limit);

  res.json({
    users: rows.map((row) => ({
      ...row,
      status: serializeAdminUserStatus(row.status ? { status: row.status } : null),
    })),
  });
});

router.get("/admin/users/:userId", requireAdmin("users.read"), async (req, res) => {
  const targetUserId = req.params.userId;

  const [profile] = await db
    .select({
      profileId: profileTable.id,
      userId: profileTable.userId,
      name: profileTable.name,
      avatarUrl: profileTable.avatarUrl,
      xp: profileTable.xp,
      level: profileTable.level,
      streak: profileTable.streak,
      yearsExperience: profileTable.yearsExperience,
      updatedAt: profileTable.updatedAt,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      createdAt: usersTable.createdAt,
      status: adminUserStatusTable.status,
      statusReason: adminUserStatusTable.reason,
    })
    .from(profileTable)
    .leftJoin(usersTable, eq(usersTable.id, profileTable.userId))
    .leftJoin(adminUserStatusTable, eq(adminUserStatusTable.userId, profileTable.userId))
    .where(eq(profileTable.userId, targetUserId))
    .limit(1);

  if (!profile) {
    res.status(404).json({ error: "Utente non trovato" });
    return;
  }

  const [tradeCount, journalCount, backtestCount, loginAccess, audit] = await Promise.all([
    db.select({ value: count() }).from(accountTradesTable).where(eq(accountTradesTable.userId, targetUserId)),
    db.select({ value: count() }).from(journalEntriesTable).where(eq(journalEntriesTable.userId, targetUserId)),
    db.select({ value: count() }).from(backtestSessionsTable).where(eq(backtestSessionsTable.userId, targetUserId)),
    db
      .select({
        id: loginAccessTable.id,
        ipAddress: loginAccessTable.ipAddress,
        userAgent: loginAccessTable.userAgent,
        createdAt: loginAccessTable.createdAt,
      })
      .from(loginAccessTable)
      .where(eq(loginAccessTable.userId, targetUserId))
      .orderBy(desc(loginAccessTable.createdAt))
      .limit(10),
    db
      .select({
        id: adminAuditLogsTable.id,
        actorUserId: adminAuditLogsTable.actorUserId,
        actorRole: adminAuditLogsTable.actorRole,
        action: adminAuditLogsTable.action,
        reason: adminAuditLogsTable.reason,
        createdAt: adminAuditLogsTable.createdAt,
      })
      .from(adminAuditLogsTable)
      .where(and(eq(adminAuditLogsTable.targetType, "user"), eq(adminAuditLogsTable.targetId, targetUserId)))
      .orderBy(desc(adminAuditLogsTable.createdAt))
      .limit(20),
  ]);

  res.json({
    user: {
      ...profile,
      status: serializeAdminUserStatus(profile.status ? { status: profile.status } : null),
      counters: {
        trades: tradeCount[0]?.value ?? 0,
        journalEntries: journalCount[0]?.value ?? 0,
        backtests: backtestCount[0]?.value ?? 0,
      },
    },
    loginAccess,
    audit,
  });
});
```

- [ ] **Step 6: Add safe user action endpoints**

Append to `artifacts/api-server/src/routes/admin.ts`:

```ts
router.post("/admin/users/:userId/revoke-sessions", requireAdmin("users.revoke_sessions"), async (req, res) => {
  const targetUserId = req.params.userId;
  let reason: string;
  try {
    reason = requireActionReason(req.body?.reason);
  } catch {
    res.status(400).json({ error: "Motivo obbligatorio" });
    return;
  }

  const result = await db
    .delete(sessionsTable)
    .where(sql`${sessionsTable.sess}->'user'->>'id' = ${targetUserId}`)
    .returning({ sid: sessionsTable.sid });

  await writeAdminAudit({
    req,
    admin: req.admin!,
    action: "users.revoke_sessions",
    targetType: "user",
    targetId: targetUserId,
    reason,
    after: { revokedSessions: result.length },
  });

  res.json({ success: true, revokedSessions: result.length });
});

router.post("/admin/users/:userId/suspend", requireAdmin("users.suspend"), async (req, res) => {
  const targetUserId = req.params.userId;
  let reason: string;
  try {
    reason = requireActionReason(req.body?.reason);
  } catch {
    res.status(400).json({ error: "Motivo obbligatorio" });
    return;
  }

  const [before] = await db
    .select()
    .from(adminUserStatusTable)
    .where(eq(adminUserStatusTable.userId, targetUserId))
    .limit(1);

  const [status] = await db
    .insert(adminUserStatusTable)
    .values({
      userId: targetUserId,
      status: "suspended",
      reason,
      updatedBy: req.admin!.userId,
    })
    .onConflictDoUpdate({
      target: adminUserStatusTable.userId,
      set: {
        status: "suspended",
        reason,
        updatedBy: req.admin!.userId,
        updatedAt: new Date(),
      },
    })
    .returning();

  await writeAdminAudit({
    req,
    admin: req.admin!,
    action: "users.suspend",
    targetType: "user",
    targetId: targetUserId,
    reason,
    before,
    after: status,
  });

  res.json({ success: true, status });
});

router.post("/admin/users/:userId/reactivate", requireAdmin("users.suspend"), async (req, res) => {
  const targetUserId = req.params.userId;
  let reason: string;
  try {
    reason = requireActionReason(req.body?.reason);
  } catch {
    res.status(400).json({ error: "Motivo obbligatorio" });
    return;
  }

  const [before] = await db
    .select()
    .from(adminUserStatusTable)
    .where(eq(adminUserStatusTable.userId, targetUserId))
    .limit(1);

  const [status] = await db
    .insert(adminUserStatusTable)
    .values({
      userId: targetUserId,
      status: "active",
      reason,
      updatedBy: req.admin!.userId,
    })
    .onConflictDoUpdate({
      target: adminUserStatusTable.userId,
      set: {
        status: "active",
        reason,
        updatedBy: req.admin!.userId,
        updatedAt: new Date(),
      },
    })
    .returning();

  await writeAdminAudit({
    req,
    admin: req.admin!,
    action: "users.reactivate",
    targetType: "user",
    targetId: targetUserId,
    reason,
    before,
    after: status,
  });

  res.json({ success: true, status });
});

router.get("/admin/audit", requireAdmin("security.audit.read"), async (req, res) => {
  const limit = parseAdminLimit(req.query.limit, 50);
  const rows = await db
    .select()
    .from(adminAuditLogsTable)
    .orderBy(desc(adminAuditLogsTable.createdAt))
    .limit(limit);
  res.json({ audit: rows });
});

export default router;
```

- [ ] **Step 7: Mount the admin router**

In `artifacts/api-server/src/routes/index.ts`, add the import:

```ts
import adminRouter from "./admin.js";
```

Then mount it before user-facing routers:

```ts
router.use(adminRouter);
```

- [ ] **Step 8: Run backend checks**

Run:

```bash
pnpm --filter ./scripts exec tsx local/run-tests.ts
pnpm --filter @workspace/api-server run typecheck
```

Expected: tests and API typecheck complete successfully.

- [ ] **Step 9: Commit**

```bash
git add artifacts/api-server/src/routes/admin.ts artifacts/api-server/src/routes/admin.test.ts artifacts/api-server/src/routes/index.ts
git commit -m "feat: add admin API routes"
```

---

### Task 5: Frontend Admin API Client

**Files:**
- Create: `artifacts/trader-dashboard/src/lib/adminApi.ts`
- Create: `artifacts/trader-dashboard/src/lib/adminApi.static.test.ts`

- [ ] **Step 1: Write the failing static API test**

Create `artifacts/trader-dashboard/src/lib/adminApi.static.test.ts`:

```ts
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/lib/adminApi.ts", "utf8");

assert.match(source, /getAdminMe/);
assert.match(source, /getAdminDashboard/);
assert.match(source, /getAdminUsers/);
assert.match(source, /getAdminUserDetail/);
assert.match(source, /revokeAdminUserSessions/);
assert.match(source, /suspendAdminUser/);
assert.match(source, /reactivateAdminUser/);
assert.match(source, /\/admin\/users\/\$\{encodeURIComponent\(userId\)\}\/suspend/);

console.log("admin api static checks passed");
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter ./scripts exec tsx local/run-tests.ts
```

Expected: FAIL because `src/lib/adminApi.ts` does not exist.

- [ ] **Step 3: Create typed admin API helpers**

Create `artifacts/trader-dashboard/src/lib/adminApi.ts`:

```ts
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
  urgentActions: Array<{ id: string; label: string; count: number; href: string }>;
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

export function getAdminUsers(params: { q?: string; status?: string; limit?: number } = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.limit) search.set("limit", String(params.limit));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiJSON<{ users: AdminUserRow[] }>(`/admin/users${suffix}`);
}

export function getAdminUserDetail(userId: string) {
  return apiJSON<AdminUserDetail>(`/admin/users/${encodeURIComponent(userId)}`);
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
```

- [ ] **Step 4: Run frontend helper checks**

Run:

```bash
pnpm --filter ./scripts exec tsx local/run-tests.ts
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: tests and dashboard typecheck complete successfully.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/lib/adminApi.ts artifacts/trader-dashboard/src/lib/adminApi.static.test.ts
git commit -m "feat: add admin frontend API client"
```

---

### Task 6: Admin Shell and Route

**Files:**
- Create: `artifacts/trader-dashboard/src/components/admin/AdminShell.tsx`
- Create: `artifacts/trader-dashboard/src/components/admin/AdminMetricCard.tsx`
- Create: `artifacts/trader-dashboard/src/pages/Admin.tsx`
- Create: `artifacts/trader-dashboard/src/pages/Admin.static.test.ts`
- Modify: `artifacts/trader-dashboard/src/App.tsx`

- [ ] **Step 1: Write the failing admin UI static test**

Create `artifacts/trader-dashboard/src/pages/Admin.static.test.ts`:

```ts
import assert from "node:assert/strict";
import fs from "node:fs";

const adminPage = fs.readFileSync("src/pages/Admin.tsx", "utf8");
const shell = fs.readFileSync("src/components/admin/AdminShell.tsx", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");

assert.match(adminPage, /getAdminDashboard/);
assert.match(adminPage, /getAdminUsers/);
assert.match(adminPage, /getAdminUserDetail/);
assert.match(adminPage, /revokeAdminUserSessions/);
assert.match(adminPage, /suspendAdminUser/);
assert.match(adminPage, /reactivateAdminUser/);
assert.match(shell, /Dashboard/);
assert.match(shell, /Utenti/);
assert.match(shell, /Sicurezza/);
assert.match(app, /const Admin = lazy\(\(\) => import\("\.\/pages\/Admin"\)\)/);
assert.match(app, /location\.startsWith\("\/admin"\)/);

console.log("admin page static checks passed");
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter ./scripts exec tsx local/run-tests.ts
```

Expected: FAIL because the admin page and shell do not exist.

- [ ] **Step 3: Create the metric card**

Create `artifacts/trader-dashboard/src/components/admin/AdminMetricCard.tsx`:

```tsx
import { type LucideIcon } from "lucide-react";

interface AdminMetricCardProps {
  label: string;
  value: number | string;
  detail: string;
  icon: LucideIcon;
}

export function AdminMetricCard({ label, value, detail, icon: Icon }: AdminMetricCardProps) {
  return (
    <section className="rounded-lg border border-border bg-card/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background">
          <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Create the admin shell**

Create `artifacts/trader-dashboard/src/components/admin/AdminShell.tsx`:

```tsx
import { BarChart3, BookOpen, LifeBuoy, LockKeyhole, Settings, Shield, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/users", label: "Utenti", icon: Users },
  { href: "/admin/trading", label: "Trading", icon: Shield },
  { href: "/admin/content", label: "Content", icon: BookOpen },
  { href: "/admin/support", label: "Supporto", icon: LifeBuoy },
  { href: "/admin/system", label: "Sistema", icon: Settings },
  { href: "/admin/security", label: "Sicurezza", icon: LockKeyhole },
];

interface AdminShellProps {
  children: ReactNode;
  role?: string;
}

export function AdminShell({ children, role }: AdminShellProps) {
  const [location] = useLocation();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-card/95 lg:block">
        <div className="flex h-16 items-center border-b border-border px-5">
          <div>
            <p className="text-sm font-semibold">TraderLoadings</p>
            <p className="text-xs text-muted-foreground">Admin Console</p>
          </div>
        </div>
        <nav className="space-y-1 p-3" aria-label="Admin navigation">
          {navItems.map((item) => {
            const active = item.href === "/admin" ? location === "/admin" : location.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="lg:pl-64">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur lg:px-6">
          <div>
            <p className="text-sm font-semibold">Admin</p>
            <p className="text-xs text-muted-foreground">Ruolo: {role ?? "verifica in corso"}</p>
          </div>
          <Link href="/" className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
            Torna all'app
          </Link>
        </header>
        <div className="mx-auto max-w-[1440px] space-y-5 p-4 lg:p-6">{children}</div>
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Create the admin page route switch**

Create `artifacts/trader-dashboard/src/pages/Admin.tsx` with a dashboard page, users page, user detail page, and placeholder pages for out-of-scope nav targets:

```tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Activity, BookOpen, Database, FileText, Search, ShieldCheck, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Route, Switch, useLocation, useRoute } from "wouter";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

function AdminAccessBoundary({ children }: { children: React.ReactNode }) {
  const me = useAdminMe();
  if (me.isLoading) return <div className="min-h-dvh bg-background" />;
  if (me.isError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-6">
        <section className="max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold">Accesso admin non disponibile</h1>
          <p className="mt-2 text-sm text-muted-foreground">Il tuo account non ha permessi per la console admin.</p>
        </section>
      </div>
    );
  }
  return <AdminShell role={me.data.role}>{children}</AdminShell>;
}

function AdminDashboardPage() {
  const dashboard = useQuery({ queryKey: ["admin", "dashboard"], queryFn: getAdminDashboard });
  const metrics = dashboard.data?.metrics;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Vista operativa su utenti, trading data e attivita admin.</p>
      </div>
      {dashboard.isLoading ? (
        <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">Caricamento metriche...</div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <AdminMetricCard label="Profili" value={metrics?.totalProfiles ?? 0} detail="Utenti con profilo" icon={Users} />
            <AdminMetricCard label="Attivi oggi" value={metrics?.activeToday ?? 0} detail="Login access registrati" icon={Activity} />
            <AdminMetricCard label="Trade oggi" value={metrics?.tradesToday ?? 0} detail="Import account trades" icon={Database} />
            <AdminMetricCard label="Journal oggi" value={metrics?.journalToday ?? 0} detail="Entry create oggi" icon={FileText} />
            <AdminMetricCard label="Backtest oggi" value={metrics?.backtestsToday ?? 0} detail="Sessioni create oggi" icon={BookOpen} />
            <AdminMetricCard label="Sospesi" value={metrics?.suspendedUsers ?? 0} detail="Account con blocco admin" icon={AlertTriangle} />
          </div>
          <section className="rounded-lg border border-border bg-card/80 p-4">
            <h2 className="text-sm font-semibold">Azioni urgenti</h2>
            <div className="mt-3 space-y-2">
              {(dashboard.data?.urgentActions ?? []).map((item) => (
                <a key={item.id} href={item.href} className="flex items-center justify-between rounded-md border border-border p-3 text-sm hover:bg-muted">
                  <span>{item.label}</span>
                  <span className="font-semibold tabular-nums">{item.count}</span>
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
        <p className="text-sm text-muted-foreground">Cerca, filtra e apri i profili operativi.</p>
      </div>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/80 p-4 md:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Cerca email, nome o user id" />
        </div>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-10 rounded-md border border-border bg-background px-3 text-sm">
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
                  <div className="text-xs text-muted-foreground">{user.userId ?? "guest"}</div>
                </TableCell>
                <TableCell>{user.email ?? "-"}</TableCell>
                <TableCell>{user.status}</TableCell>
                <TableCell>{user.level}</TableCell>
                <TableCell>{user.xp}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" disabled={!user.userId} onClick={() => user.userId && setLocation(`/admin/users/${user.userId}`)}>
                    Apri
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length === 0 && <div className="p-6 text-sm text-muted-foreground">Nessun utente trovato.</div>}
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

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "users", userId] });
  const revokeSessions = useMutation({ mutationFn: () => revokeAdminUserSessions(userId, reason), onSuccess: invalidate });
  const suspend = useMutation({ mutationFn: () => suspendAdminUser(userId, reason), onSuccess: invalidate });
  const reactivate = useMutation({ mutationFn: () => reactivateAdminUser(userId, reason), onSuccess: invalidate });
  const disabled = reason.trim().length === 0 || revokeSessions.isPending || suspend.isPending || reactivate.isPending;

  const counters = detail.data?.user.counters;
  const audit = useMemo(() => detail.data?.audit ?? [], [detail.data]);

  if (detail.isLoading) return <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">Caricamento utente...</div>;
  if (detail.isError || !detail.data) return <div className="rounded-lg border border-border p-6 text-sm text-destructive">Utente non trovato.</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/80 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{detail.data.user.name}</h1>
          <p className="text-sm text-muted-foreground">{detail.data.user.email ?? detail.data.user.userId}</p>
          <p className="mt-1 text-xs text-muted-foreground">Stato: {detail.data.user.status}</p>
        </div>
        <div className="flex flex-col gap-2 md:min-w-[360px]">
          <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo obbligatorio per azioni admin" />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={disabled} onClick={() => revokeSessions.mutate()}>Revoca sessioni</Button>
            <Button variant="destructive" disabled={disabled} onClick={() => suspend.mutate()}>Sospendi</Button>
            <Button variant="outline" disabled={disabled} onClick={() => reactivate.mutate()}>Riattiva</Button>
          </div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <AdminMetricCard label="Trade" value={counters?.trades ?? 0} detail="Account trades importati" icon={Database} />
        <AdminMetricCard label="Journal" value={counters?.journalEntries ?? 0} detail="Entry salvate" icon={FileText} />
        <AdminMetricCard label="Backtest" value={counters?.backtests ?? 0} detail="Sessioni create" icon={BookOpen} />
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
              <div className="text-xs text-muted-foreground">{item.actorUserId} - {item.createdAt}</div>
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
      <p className="mt-2 text-sm text-muted-foreground">Questa sezione arriva in una fase successiva sopra la base admin.</p>
    </section>
  );
}

export default function AdminPage() {
  return (
    <AdminAccessBoundary>
      <Switch>
        <Route path="/admin" component={AdminDashboardPage} />
        <Route path="/admin/users" component={AdminUsersPage} />
        <Route path="/admin/users/:userId" component={AdminUserDetailPage} />
        <Route path="/admin/trading">{() => <AdminComingSoon title="Trading" />}</Route>
        <Route path="/admin/content">{() => <AdminComingSoon title="Content" />}</Route>
        <Route path="/admin/support">{() => <AdminComingSoon title="Supporto" />}</Route>
        <Route path="/admin/system">{() => <AdminComingSoon title="Sistema" />}</Route>
        <Route path="/admin/security">{() => <AdminComingSoon title="Sicurezza" />}</Route>
      </Switch>
    </AdminAccessBoundary>
  );
}
```

- [ ] **Step 6: Wire `/admin` in `App.tsx`**

Add the lazy import near the other page imports:

```ts
const Admin = lazy(() => import("./pages/Admin"));
```

In `AuthenticatedShell`, add a location guard before the existing return. First import `useLocation` is already present, so add inside the component:

```tsx
function AuthenticatedShell() {
  const [location] = useLocation();

  if (location.startsWith("/admin")) {
    return (
      <Suspense fallback={<PageFallback />}>
        <Admin />
      </Suspense>
    );
  }

  return (
```

- [ ] **Step 7: Run frontend checks**

Run:

```bash
pnpm --filter ./scripts exec tsx local/run-tests.ts
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: tests and dashboard typecheck complete successfully.

- [ ] **Step 8: Commit**

```bash
git add artifacts/trader-dashboard/src/components/admin/AdminShell.tsx artifacts/trader-dashboard/src/components/admin/AdminMetricCard.tsx artifacts/trader-dashboard/src/pages/Admin.tsx artifacts/trader-dashboard/src/pages/Admin.static.test.ts artifacts/trader-dashboard/src/App.tsx
git commit -m "feat: add admin console shell"
```

---

### Task 7: Admin Enforcement in User-Facing Auth Flow

**Files:**
- Modify: `artifacts/api-server/src/middlewares/authMiddleware.ts`
- Create: `artifacts/api-server/src/middlewares/authMiddleware.admin-status.test.ts`

- [ ] **Step 1: Write the failing suspended-user helper test**

Create `artifacts/api-server/src/middlewares/authMiddleware.admin-status.test.ts`:

```ts
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const { isAccountAllowedByAdminStatus } = await import("./authMiddleware.js");

assert.equal(isAccountAllowedByAdminStatus(null), true);
assert.equal(isAccountAllowedByAdminStatus({ status: "active" }), true);
assert.equal(isAccountAllowedByAdminStatus({ status: "suspended" }), false);
assert.equal(isAccountAllowedByAdminStatus({ status: "banned" }), false);

console.log("auth middleware admin status checks passed");
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter ./scripts exec tsx local/run-tests.ts
```

Expected: FAIL because `isAccountAllowedByAdminStatus` is not exported.

- [ ] **Step 3: Add the helper and DB check**

In `artifacts/api-server/src/middlewares/authMiddleware.ts`, update imports:

```ts
import { db, loginAccessTable, adminUserStatusTable } from "@workspace/db";
```

Add this helper near the access dedup helpers:

```ts
export function isAccountAllowedByAdminStatus(status: { status: string } | null | undefined): boolean {
  return !status || status.status === "active";
}
```

Inside `authMiddleware`, after `if (req.user) {` and before recording login access, add:

```ts
      const [adminStatus] = await db
        .select({ status: adminUserStatusTable.status })
        .from(adminUserStatusTable)
        .where(eq(adminUserStatusTable.userId, req.user.id))
        .limit(1);

      if (!isAccountAllowedByAdminStatus(adminStatus ?? null)) {
        req.user = undefined;
        next();
        return;
      }
```

- [ ] **Step 4: Run backend checks**

Run:

```bash
pnpm --filter ./scripts exec tsx local/run-tests.ts
pnpm --filter @workspace/api-server run typecheck
```

Expected: tests and API typecheck complete successfully.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/middlewares/authMiddleware.ts artifacts/api-server/src/middlewares/authMiddleware.admin-status.test.ts
git commit -m "feat: enforce suspended user status"
```

---

### Task 8: Final Verification

**Files:**
- Review all files changed by Tasks 1-7.
- Review: `docs/superpowers/specs/2026-06-10-traderloadings-admin-panel-design.md`

- [ ] **Step 1: Run full verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/trader-dashboard run build
```

Expected: all commands complete successfully.

- [ ] **Step 2: Inspect commit range**

Run:

```bash
git log --oneline -8
git diff --stat HEAD~7..HEAD
git status --short
```

Expected: the seven admin implementation commits are visible. Pre-existing unrelated worktree changes may remain and must not be reverted.

- [ ] **Step 3: Manual smoke test**

Start the local stack:

```bash
pnpm start:local
```

Open `/admin` while signed in as a user listed in `ADMIN_BOOTSTRAP_USER_IDS`.

Expected:

- `/admin` renders the admin dashboard.
- `/admin/users` shows the users table.
- Opening a user detail shows counters, login access, and audit sections.
- Revoke sessions refuses an empty reason.
- Suspend/reactivate refuse an empty reason.
- Suspend/reactivate with a reason updates the user status and creates audit rows.
- A signed-in user not listed in `ADMIN_BOOTSTRAP_USER_IDS` sees the admin access-denied state.

- [ ] **Step 4: Commit verification fixes only if needed**

If verification required follow-up edits, commit only those edits:

```bash
git add lib/db/src/schema/admin.ts lib/db/src/schema/index.ts artifacts/api-server/src/lib/adminPermissions.ts artifacts/api-server/src/lib/adminAuth.ts artifacts/api-server/src/services/adminAudit.ts artifacts/api-server/src/routes/admin.ts artifacts/api-server/src/routes/index.ts artifacts/api-server/src/middlewares/authMiddleware.ts artifacts/trader-dashboard/src/lib/adminApi.ts artifacts/trader-dashboard/src/components/admin/AdminShell.tsx artifacts/trader-dashboard/src/components/admin/AdminMetricCard.tsx artifacts/trader-dashboard/src/pages/Admin.tsx artifacts/trader-dashboard/src/App.tsx
git commit -m "fix: verify admin foundation"
```

Expected: no commit is created when no verification edits were necessary.

---

## Self-Review

- Spec coverage: this plan covers the foundation, RBAC, audit logs, dashboard, user list, user detail, safe session revoke, suspend/reactivate, and a dedicated admin UI shell.
- Intentional gaps: moderation queue, support tickets, content CRUD, broker diagnostics, feature flags, billing, and DevOps views are excluded from this Phase 1 foundation and should be separate follow-up plans.
- Red-flag scan: the plan contains no deferred implementation gaps and no empty "fill this in" steps.
- Type consistency: backend role and permission names match frontend admin role strings; admin API paths match frontend helpers; audit action names match user action endpoints.
- Risk notes: Task 7 changes auth behavior for suspended users. Keep it after admin status tables and user actions are in place, and verify it does not block bootstrap Super Admin access unless that account is intentionally suspended.
