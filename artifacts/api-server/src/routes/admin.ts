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

export function serializeAdminUserStatus(
  row: { status: string } | null | undefined,
): string {
  return row?.status ?? "active";
}

export function requireActionReason(value: unknown): string {
  const reason = String(value ?? "").trim();
  if (!reason) throw new Error("reason_required");
  return reason;
}

function getRouteParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

router.get("/admin/me", requireAdmin("admin.access"), (req, res) => {
  res.json({
    userId: req.admin!.userId,
    role: req.admin!.role,
    permissions: ADMIN_PERMISSIONS_BY_ROLE[req.admin!.role],
    source: req.admin!.source,
  });
});

router.get("/admin/dashboard", requireAdmin("dashboard.read"), async (_req, res) => {
  const today = startOfToday();

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
    db
      .select({ value: count() })
      .from(loginAccessTable)
      .where(sql`${loginAccessTable.createdAt} >= ${today}`),
    db
      .select({ value: count() })
      .from(accountTradesTable)
      .where(sql`${accountTradesTable.createdAt} >= ${today}`),
    db
      .select({ value: count() })
      .from(journalEntriesTable)
      .where(sql`${journalEntriesTable.createdAt} >= ${today}`),
    db
      .select({ value: count() })
      .from(backtestSessionsTable)
      .where(sql`${backtestSessionsTable.createdAt} >= ${today}`),
    db
      .select({ value: count() })
      .from(adminUserStatusTable)
      .where(eq(adminUserStatusTable.status, "suspended")),
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
      {
        id: "suspended-users",
        label: "Utenti sospesi",
        count: suspendedUsers,
        href: "/admin/users?status=suspended",
      },
      {
        id: "recent-audit",
        label: "Azioni admin recenti",
        count: recentAudit.length,
        href: "/admin/audit",
      },
    ],
    recentAudit,
  });
});

router.get("/admin/users", requireAdmin("users.read"), async (req, res) => {
  const q = normalizeAdminSearch(req.query.q);
  const limit = parseAdminLimit(req.query.limit, 50);
  const status = String(req.query.status ?? "all");
  const filters = [];

  if (status !== "all") {
    filters.push(eq(adminUserStatusTable.status, status));
  }

  if (q) {
    filters.push(
      or(
        ilike(profileTable.name, `%${q}%`),
        ilike(usersTable.email, `%${q}%`),
        ilike(profileTable.userId, `%${q}%`),
      ),
    );
  }

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
    .leftJoin(
      adminUserStatusTable,
      eq(adminUserStatusTable.userId, profileTable.userId),
    )
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(profileTable.updatedAt))
    .limit(limit);

  res.json({
    users: rows.map((row) => ({
      ...row,
      status: serializeAdminUserStatus(
        row.status ? { status: row.status } : null,
      ),
    })),
  });
});

router.get("/admin/users/:userId", requireAdmin("users.read"), async (req, res) => {
  const targetUserId = getRouteParam(req.params.userId);

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
    .leftJoin(
      adminUserStatusTable,
      eq(adminUserStatusTable.userId, profileTable.userId),
    )
    .where(eq(profileTable.userId, targetUserId))
    .limit(1);

  if (!profile) {
    res.status(404).json({ error: "Utente non trovato" });
    return;
  }

  const [tradeCount, journalCount, backtestCount, loginAccess, audit] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(accountTradesTable)
        .where(eq(accountTradesTable.userId, targetUserId)),
      db
        .select({ value: count() })
        .from(journalEntriesTable)
        .where(eq(journalEntriesTable.userId, targetUserId)),
      db
        .select({ value: count() })
        .from(backtestSessionsTable)
        .where(eq(backtestSessionsTable.userId, targetUserId)),
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
        .where(
          and(
            eq(adminAuditLogsTable.targetType, "user"),
            eq(adminAuditLogsTable.targetId, targetUserId),
          ),
        )
        .orderBy(desc(adminAuditLogsTable.createdAt))
        .limit(20),
    ]);

  res.json({
    user: {
      ...profile,
      status: serializeAdminUserStatus(
        profile.status ? { status: profile.status } : null,
      ),
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

router.post(
  "/admin/users/:userId/revoke-sessions",
  requireAdmin("users.revoke_sessions"),
  async (req, res) => {
    const targetUserId = getRouteParam(req.params.userId);
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
  },
);

router.post("/admin/users/:userId/suspend", requireAdmin("users.suspend"), async (req, res) => {
  const targetUserId = getRouteParam(req.params.userId);
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

  const [statusRow] = await db
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
    after: statusRow,
  });

  res.json({ success: true, status: statusRow });
});

router.post(
  "/admin/users/:userId/reactivate",
  requireAdmin("users.suspend"),
  async (req, res) => {
    const targetUserId = getRouteParam(req.params.userId);
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

    const [statusRow] = await db
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
      after: statusRow,
    });

    res.json({ success: true, status: statusRow });
  },
);

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
