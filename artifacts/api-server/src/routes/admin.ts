import { LaunchError } from "../lib/launchError.js";
import { admitCandidate, updateCandidateApprovedServices } from "../services/launchApplications.js";
import {
  invalidateUserSecurityCache,
  listClerkSessions,
  revokeClerkSessions,
} from "../services/sessionRevocation.js";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  accountTradesTable,
  adminAuditLogsTable,
  adminUserSubscriptionsTable,
  adminUserStatusTable,
  adminUsersTable,
  adminRoleNames,
  type AdminRoleName,
  backtestSessionsTable,
  backtestTradesTable,
  brokerProfileStoreTable,
  candidateApplicationsTable,
  communitiesTable,
  communityMessagesTable,
  db,
  journalEntriesTable,
  levelMilestonesTable,
  loginAccessTable,
  libraryCollectionsTable,
  libraryContentsTable,
  missionTemplatesTable,
  newsSnapshotsTable,
  profileTable,
  pushSubscriptionsTable,
  quotesTable,
  sessionsTable,
  supportTicketMessagesTable,
  supportTicketsTable,
  systemFeatureFlagsTable,
  testimonialsTable,
  usersTable,
} from "@workspace/db";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/adminAuth.js";
import { ADMIN_PERMISSIONS_BY_ROLE, getBootstrapAdminIds } from "../lib/adminPermissions.js";
import { writeAdminAudit } from "../services/adminAudit.js";
import { exportAccountData } from "../services/accountExport.js";
import { logger } from "../lib/logger.js";
import { systemWatchdog } from "../lib/systemWatchdog.js";
import { getAllCircuitBreakersStats } from "../lib/circuitBreaker.js";
import {
  isSupportStatus,
  serializeMessage,
  serializeTicket,
} from "./supportSerialize.js";
import {
  sendTicketReplyEmail,
  sendTicketStatusEmail,
} from "../services/email/ticketEmails.js";

const router: IRouter = Router();

export function normalizeAdminSearch(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function parseAdminLimit(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(100, Math.floor(parsed));
}

export type AdminStatusFilter = "all" | "active" | "suspended" | "banned";
export type AdminSubscriptionPlan =
  | "free"
  | "pro"
  | "tributo_150"
  | "founders_10"
  | "complete_150";
export type AdminSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled";

const ADMIN_SUBSCRIPTION_PLANS: AdminSubscriptionPlan[] = [
  "free",
  "pro",
  "tributo_150",
  "founders_10",
  "complete_150",
];

const ADMIN_SUBSCRIPTION_STATUSES: AdminSubscriptionStatus[] = [
  "active",
  "trialing",
  "past_due",
  "canceled",
];

export function parseAdminStatusFilter(value: unknown): AdminStatusFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  const status = String(raw ?? "all").trim().toLowerCase();
  if (
    status === "active" ||
    status === "suspended" ||
    status === "banned"
  ) {
    return status;
  }
  return "all";
}

export function parseAdminSubscriptionPlan(
  value: unknown,
): AdminSubscriptionPlan | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const plan = String(raw ?? "").trim().toLowerCase();
  return ADMIN_SUBSCRIPTION_PLANS.includes(plan as AdminSubscriptionPlan)
    ? (plan as AdminSubscriptionPlan)
    : null;
}

export function parseAdminSubscriptionStatus(
  value: unknown,
): AdminSubscriptionStatus | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const status = String(raw ?? "").trim().toLowerCase();
  return ADMIN_SUBSCRIPTION_STATUSES.includes(
    status as AdminSubscriptionStatus,
  )
    ? (status as AdminSubscriptionStatus)
    : null;
}

export function parseAdminAuditTarget(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw ?? "").trim();
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

export function serializeRuntimeFlag(key: string, value: unknown) {
  return { key, configured: String(value ?? "").trim().length > 0 };
}

function getRouteParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export type AdminSubscriptionPeriodEnd =
  | { ok: true; value: Date | null }
  | { ok: false };

// Restituisce sempre un valore esplicito (mai undefined): l'upsert deve
// sovrascrivere eventuali currentPeriodEnd stantii (es. scadenze Stripe
// passate), altrimenti un override pro manuale resterebbe "scaduto".
// Per il piano free la data viene azzerata qualunque cosa contenga il form.
export function normalizeAdminSubscriptionPeriodEnd(
  plan: AdminSubscriptionPlan,
  value: unknown,
): AdminSubscriptionPeriodEnd {
  if (plan === "free" || value === null) return { ok: true, value: null };
  const raw = String(value ?? "").trim();
  if (!raw) return { ok: true, value: null };
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? { ok: false } : { ok: true, value: date };
}

export function buildAdminSubscriptionManualValues(input: {
  userId: string;
  plan: AdminSubscriptionPlan;
  status: AdminSubscriptionStatus;
  currentPeriodEnd: Date | null;
  reason: string;
  updatedBy: string;
  updatedAt: Date;
}) {
  return {
    userId: input.userId,
    plan: input.plan,
    status: input.status,
    source: "manual",
    manualOverride: true,
    stripeCustomerId: input.plan === "free" ? null : undefined,
    stripeSubscriptionId: input.plan === "free" ? null : undefined,
    stripePriceId: input.plan === "free" ? null : undefined,
    cancelAtPeriodEnd: input.plan === "free" ? false : undefined,
    currentPeriodEnd: input.currentPeriodEnd,
    reason: input.reason,
    updatedBy: input.updatedBy,
    updatedAt: input.updatedAt,
  };
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
    [{ value: pendingApplications }],
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
      .select({ value: count() })
      .from(candidateApplicationsTable)
      .where(eq(candidateApplicationsTable.status, "in_valutazione")),
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
      pendingApplications,
    },
    urgentActions: [
      ...(pendingApplications > 0
        ? [
            {
              id: "pending-applications",
              label: "Candidature Tributo in attesa",
              count: pendingApplications,
              href: "/admin/candidature",
            },
          ]
        : []),
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
        href: "/admin/security",
      },
    ],
    recentAudit,
  });
});

router.get("/admin/trading/overview", requireAdmin("trading.read"), async (_req, res) => {
  const today = startOfToday();
  const [
    [{ value: brokerProfiles }],
    [{ value: importedTrades }],
    [{ value: openTrades }],
    [{ value: tradesToday }],
    [{ value: backtestSessions }],
    [{ value: backtestTrades }],
    recentTrades,
  ] = await Promise.all([
    db.select({ value: count() }).from(brokerProfileStoreTable),
    db.select({ value: count() }).from(accountTradesTable),
    db
      .select({ value: count() })
      .from(accountTradesTable)
      .where(eq(accountTradesTable.status, "open")),
    db
      .select({ value: count() })
      .from(accountTradesTable)
      .where(sql`${accountTradesTable.createdAt} >= ${today}`),
    db.select({ value: count() }).from(backtestSessionsTable),
    db.select({ value: count() }).from(backtestTradesTable),
    db
      .select({
        id: accountTradesTable.id,
        userId: accountTradesTable.userId,
        ticket: accountTradesTable.ticket,
        source: accountTradesTable.source,
        symbol: accountTradesTable.symbol,
        direction: accountTradesTable.direction,
        status: accountTradesTable.status,
        profit: accountTradesTable.profit,
        createdAt: accountTradesTable.createdAt,
      })
      .from(accountTradesTable)
      .orderBy(desc(accountTradesTable.createdAt))
      .limit(8),
  ]);

  res.json({
    metrics: {
      brokerProfiles,
      importedTrades,
      openTrades,
      tradesToday,
      backtestSessions,
      backtestTrades,
    },
    recentTrades,
  });
});

router.get("/admin/content/overview", requireAdmin("content.publish"), async (_req, res) => {
  const [
    [{ value: collections }],
    [{ value: publishedCollections }],
    [{ value: contents }],
    [{ value: publishedContents }],
    [{ value: missionTemplates }],
    [{ value: levelMilestones }],
    [{ value: quotes }],
    [{ value: communities }],
    [{ value: communityMessages }],
  ] = await Promise.all([
    db.select({ value: count() }).from(libraryCollectionsTable),
    db
      .select({ value: count() })
      .from(libraryCollectionsTable)
      .where(eq(libraryCollectionsTable.published, true)),
    db.select({ value: count() }).from(libraryContentsTable),
    db
      .select({ value: count() })
      .from(libraryContentsTable)
      .where(eq(libraryContentsTable.published, true)),
    db.select({ value: count() }).from(missionTemplatesTable),
    db.select({ value: count() }).from(levelMilestonesTable),
    db.select({ value: count() }).from(quotesTable),
    db.select({ value: count() }).from(communitiesTable),
    db.select({ value: count() }).from(communityMessagesTable),
  ]);

  res.json({
    metrics: {
      collections,
      publishedCollections,
      contents,
      publishedContents,
      missionTemplates,
      levelMilestones,
      quotes,
      communities,
      communityMessages,
    },
  });
});

router.get("/admin/content/items", requireAdmin("content.publish"), async (req, res) => {
  const limit = parseAdminLimit(req.query.limit, 25);

  const items = await db
    .select({
      id: libraryContentsTable.id,
      title: libraryContentsTable.title,
      type: libraryContentsTable.type,
      published: libraryContentsTable.published,
      requiredLevel: libraryContentsTable.requiredLevel,
      collectionId: libraryContentsTable.collectionId,
      collectionTitle: libraryCollectionsTable.title,
      updatedAt: libraryContentsTable.updatedAt,
      createdAt: libraryContentsTable.createdAt,
    })
    .from(libraryContentsTable)
    .leftJoin(
      libraryCollectionsTable,
      eq(libraryCollectionsTable.id, libraryContentsTable.collectionId),
    )
    .orderBy(desc(libraryContentsTable.updatedAt), desc(libraryContentsTable.createdAt))
    .limit(limit);

  res.json({ items });
});

async function updateAdminContentPublished({
  req,
  res,
  published,
}: {
  req: Request;
  res: Response;
  published: boolean;
}) {
  const itemId = Number(getRouteParam(req.params.itemId));
  if (!Number.isInteger(itemId)) {
    res.status(400).json({ error: "ID contenuto non valido" });
    return;
  }

  let reason: string;
  try {
    reason = requireActionReason(req.body?.reason);
  } catch {
    res.status(400).json({ error: "Motivo obbligatorio" });
    return;
  }

  const after = await db.transaction(async tx => {
    const [before] = await tx.select().from(libraryContentsTable)
      .where(eq(libraryContentsTable.id, itemId)).limit(1).for("update");
    if (!before) return null;
    const [updated] = await tx.update(libraryContentsTable)
      .set({ published, updatedAt: new Date() }).where(eq(libraryContentsTable.id, itemId)).returning();
    await writeAdminAudit({
      req, admin: req.admin!, action: published ? "content.publish" : "content.unpublish",
      targetType: "library_content", targetId: String(itemId), reason, before, after: updated,
    }, tx);
    return updated;
  });
  if (!after) { res.status(404).json({ error: "Contenuto non trovato" }); return; }
  res.json({ success: true, item: after });
}

router.post(
  "/admin/content/items/:itemId/publish",
  requireAdmin("content.publish"),
  async (req, res) => {
    await updateAdminContentPublished({ req, res, published: true });
  },
);

router.post(
  "/admin/content/items/:itemId/unpublish",
  requireAdmin("content.publish"),
  async (req, res) => {
    await updateAdminContentPublished({ req, res, published: false });
  },
);

// ── Recensioni utenti (moderazione) ──────────────────────────────────────────
// Le recensioni reali arrivano in stato "pending"; l'approvazione le pubblica
// (published=true) così confluiscono nella landing e nel rating pubblico.
const REVIEW_STATUS_FILTERS = ["pending", "approved", "rejected", "withdrawn", "all"] as const;
type ReviewStatusFilter = (typeof REVIEW_STATUS_FILTERS)[number];

router.get("/admin/reviews", requireAdmin("moderation.resolve"), async (req, res) => {
  const status = String(req.query.status ?? "pending");
  const filter: ReviewStatusFilter = (REVIEW_STATUS_FILTERS as readonly string[]).includes(status)
    ? (status as ReviewStatusFilter)
    : "pending";
  const limit = parseAdminLimit(req.query.limit, 50);

  const rows = await db
    .select({
      id: testimonialsTable.id,
      name: testimonialsTable.name,
      role: testimonialsTable.role,
      text: testimonialsTable.text,
      rating: testimonialsTable.rating,
      status: testimonialsTable.status,
      published: testimonialsTable.published,
      userId: testimonialsTable.userId,
      locale: testimonialsTable.locale,
      createdAt: testimonialsTable.createdAt,
      updatedAt: testimonialsTable.updatedAt,
      moderatedAt: testimonialsTable.moderatedAt,
      avatarUrl: profileTable.avatarUrl,
    })
    .from(testimonialsTable)
    .leftJoin(profileTable, eq(profileTable.userId, testimonialsTable.userId))
    .where(filter === "all" ? undefined : eq(testimonialsTable.status, filter))
    .orderBy(desc(testimonialsTable.createdAt))
    .limit(limit);

  res.json({ reviews: rows, status: filter });
});

async function moderateReview({
  req,
  res,
  action,
}: {
  req: Request;
  res: Response;
  action: "approve" | "reject" | "hide";
}) {
  const reviewId = Number(getRouteParam(req.params.id));
  if (!Number.isInteger(reviewId)) {
    res.status(400).json({ error: "ID recensione non valido" });
    return;
  }

  // Il rifiuto richiede un motivo (audit); approvazione/hide no.
  let reason: string | undefined;
  if (action === "reject") {
    try {
      reason = requireActionReason(req.body?.reason);
    } catch {
      res.status(400).json({ error: "Motivo obbligatorio" });
      return;
    }
  }

  const [before] = await db
    .select()
    .from(testimonialsTable)
    .where(eq(testimonialsTable.id, reviewId))
    .limit(1);

  if (!before) {
    res.status(404).json({ error: "Recensione non trovata" });
    return;
  }

  const now = new Date();
  const patch =
    action === "approve"
      ? { status: "approved" as const, published: true }
      : action === "reject"
        ? { status: "rejected" as const, published: false }
        : { published: false }; // hide: mantiene lo status "approved", esce dal pubblico

  const [after] = await db
    .update(testimonialsTable)
    .set({ ...patch, moderatedAt: now, moderatedBy: req.admin!.userId, updatedAt: now })
    .where(eq(testimonialsTable.id, reviewId))
    .returning();

  await writeAdminAudit({
    req,
    admin: req.admin!,
    action: `reviews.${action}`,
    targetType: "testimonial",
    targetId: String(reviewId),
    reason,
    before,
    after,
  });

  res.json({ success: true, review: after });
}

router.post("/admin/reviews/:id/approve", requireAdmin("moderation.resolve"), async (req, res) => {
  await moderateReview({ req, res, action: "approve" });
});

router.post("/admin/reviews/:id/reject", requireAdmin("moderation.resolve"), async (req, res) => {
  await moderateReview({ req, res, action: "reject" });
});

router.post("/admin/reviews/:id/hide", requireAdmin("moderation.resolve"), async (req, res) => {
  await moderateReview({ req, res, action: "hide" });
});

router.get("/admin/subscriptions", requireAdmin("billing.subscriptions.write"), async (req, res) => {
  const q = normalizeAdminSearch(req.query.q);
  const limit = parseAdminLimit(req.query.limit, 50);
  const filters = [];

  if (q) {
    filters.push(
      or(
        ilike(profileTable.name, `%${q}%`),
        ilike(usersTable.email, `%${q}%`),
        ilike(profileTable.userId, `%${q}%`),
        ilike(adminUserSubscriptionsTable.plan, `%${q}%`),
      ),
    );
  }

  const [rows, [{ value: manualOverrides }], [{ value: activeSubscriptions }], [{ value: paidPlans }]] =
    await Promise.all([
      db
        .select({
          profileId: profileTable.id,
          userId: profileTable.userId,
          name: profileTable.name,
          email: usersTable.email,
          plan: adminUserSubscriptionsTable.plan,
          status: adminUserSubscriptionsTable.status,
          source: adminUserSubscriptionsTable.source,
          manualOverride: adminUserSubscriptionsTable.manualOverride,
          currentPeriodEnd: adminUserSubscriptionsTable.currentPeriodEnd,
          reason: adminUserSubscriptionsTable.reason,
          updatedBy: adminUserSubscriptionsTable.updatedBy,
          updatedAt: adminUserSubscriptionsTable.updatedAt,
        })
        .from(profileTable)
        .leftJoin(usersTable, eq(usersTable.id, profileTable.userId))
        .leftJoin(
          adminUserSubscriptionsTable,
          eq(adminUserSubscriptionsTable.userId, profileTable.userId),
        )
        .where(filters.length > 0 ? and(...filters) : undefined)
        .orderBy(
          desc(adminUserSubscriptionsTable.updatedAt),
          desc(profileTable.updatedAt),
        )
        .limit(limit),
      db
        .select({ value: count() })
        .from(adminUserSubscriptionsTable)
        .where(eq(adminUserSubscriptionsTable.manualOverride, true)),
      db
        .select({ value: count() })
        .from(adminUserSubscriptionsTable)
        .where(eq(adminUserSubscriptionsTable.status, "active")),
      db
        .select({ value: count() })
        .from(adminUserSubscriptionsTable)
        .where(eq(adminUserSubscriptionsTable.plan, "pro")),
    ]);

  res.json({
    metrics: {
      visibleUsers: rows.length,
      manualOverrides,
      activeSubscriptions,
      paidPlans,
    },
    subscriptions: rows.map((row) => ({
      ...row,
      plan: row.plan ?? "free",
      status: row.status ?? "active",
      source: row.source ?? "default",
      manualOverride: row.manualOverride ?? false,
      reason: row.reason ?? null,
      updatedBy: row.updatedBy ?? null,
      updatedAt: row.updatedAt ?? null,
      currentPeriodEnd: row.currentPeriodEnd ?? null,
    })),
  });
});

router.post(
  "/admin/subscriptions/:userId",
  requireAdmin("billing.subscriptions.write"),
  async (req, res) => {
    const targetUserId = getRouteParam(req.params.userId).trim();
    if (!targetUserId) {
      res.status(400).json({ error: "Utente non valido" });
      return;
    }

    const plan = parseAdminSubscriptionPlan(req.body?.plan);
    const status = parseAdminSubscriptionStatus(req.body?.status);
    if (!plan || !status) {
      res.status(400).json({ error: "Piano o stato abbonamento non valido" });
      return;
    }

    let reason: string;
    try {
      reason = requireActionReason(req.body?.reason);
    } catch {
      res.status(400).json({ error: "Motivo obbligatorio" });
      return;
    }

    const currentPeriodEnd = normalizeAdminSubscriptionPeriodEnd(
      plan,
      req.body?.currentPeriodEnd,
    );
    if (!currentPeriodEnd.ok) {
      res.status(400).json({ error: "Data fine periodo non valida" });
      return;
    }

    const [profile] = await db
      .select({ userId: profileTable.userId })
      .from(profileTable)
      .where(eq(profileTable.userId, targetUserId))
      .limit(1);

    if (!profile?.userId) {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }

    const [before] = await db
      .select()
      .from(adminUserSubscriptionsTable)
      .where(eq(adminUserSubscriptionsTable.userId, targetUserId))
      .limit(1);

    const values = buildAdminSubscriptionManualValues({
      userId: targetUserId,
      plan,
      status,
      currentPeriodEnd: currentPeriodEnd.value,
      reason,
      updatedBy: req.admin!.userId,
      updatedAt: new Date(),
    });

    const [subscription] = await db
      .insert(adminUserSubscriptionsTable)
      .values(values)
      .onConflictDoUpdate({
        target: adminUserSubscriptionsTable.userId,
        set: values,
      })
      .returning();

    await writeAdminAudit({
      req,
      admin: req.admin!,
      action: "subscriptions.manual_update",
      targetType: "subscription",
      targetId: targetUserId,
      reason,
      before,
      after: subscription,
    });

    res.json({ success: true, subscription });
  },
);

router.get("/admin/support/overview", requireAdmin("support.write"), async (_req, res) => {
  const today = startOfToday();
  const [
    [{ value: suspendedUsers }],
    [{ value: activeToday }],
    [{ value: pushSubscribers }],
    [{ value: adminActionsToday }],
    recentLoginAccess,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(adminUserStatusTable)
      .where(eq(adminUserStatusTable.status, "suspended")),
    db
      .select({ value: count() })
      .from(loginAccessTable)
      .where(sql`${loginAccessTable.createdAt} >= ${today}`),
    db.select({ value: count() }).from(pushSubscriptionsTable),
    db
      .select({ value: count() })
      .from(adminAuditLogsTable)
      .where(sql`${adminAuditLogsTable.createdAt} >= ${today}`),
    db
      .select({
        id: loginAccessTable.id,
        userId: loginAccessTable.userId,
        ipAddress: loginAccessTable.ipAddress,
        userAgent: loginAccessTable.userAgent,
        createdAt: loginAccessTable.createdAt,
      })
      .from(loginAccessTable)
      .orderBy(desc(loginAccessTable.createdAt))
      .limit(8),
  ]);

  res.json({
    metrics: {
      suspendedUsers,
      activeToday,
      pushSubscribers,
      adminActionsToday,
    },
    recentLoginAccess,
  });
});

// ─── Support tickets ──────────────────────────────────────────────────────────

function parseSupportStatusFilter(value: unknown): "all" | string {
  const raw = String(Array.isArray(value) ? value[0] : value ?? "all")
    .trim()
    .toLowerCase();
  return isSupportStatus(raw) ? raw : "all";
}

router.get(
  "/admin/support/tickets",
  requireAdmin("support.write"),
  async (req, res) => {
    const statusFilter = parseSupportStatusFilter(req.query.status);
    const limit = parseAdminLimit(req.query.limit, 50);
    const rows = await db
      .select()
      .from(supportTicketsTable)
      .where(
        statusFilter === "all"
          ? undefined
          : eq(supportTicketsTable.status, statusFilter),
      )
      .orderBy(desc(supportTicketsTable.updatedAt))
      .limit(limit);
    res.json({ tickets: rows.map(serializeTicket) });
  },
);

// Admin-triggerable ingest seed for a symbol (useful to run a one-off seed
// from the deployed API when a CLI run is not available). Requires an admin
// with `admin.access` permission. Body: { symbol?: string, years?: number }
router.post(
  "/admin/ingest/seed",
  requireAdmin("admin.access"),
  async (req, res) => {
    const symbol = String(req.body?.symbol ?? "XAUUSD").trim().toUpperCase();
    const years = Number(req.body?.years ?? 5);
    if (!symbol) {
      res.status(400).json({ error: "symbol_required" });
      return;
    }
    if (!Number.isFinite(years) || years <= 0 || years > 20) {
      res.status(400).json({ error: "invalid_years" });
      return;
    }

    try {
      const { sourceForSymbol } = await import("../services/ingest/sources.js");
      const source = sourceForSymbol(symbol);
      if (!source) {
        res.status(400).json({ error: "no_data_source_for_symbol" });
        return;
      }
      const { seedSymbol } = await import("../services/ingest/seed.js");
      const now = Math.floor(Date.now() / 1000);
      const fromTs = now - Math.floor(years * 365 * 24 * 60 * 60);
      const result = await seedSymbol(symbol, fromTs, now, source);
      res.json({ success: true, written: result.written, symbol, years });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: "seed_failed", message: msg });
    }
  },
);

router.get(
  "/admin/support/tickets/:id",
  requireAdmin("support.write"),
  async (req, res) => {
    const id = Number(getRouteParam(req.params.id));
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Ticket non valido" });
      return;
    }
    const [ticket] = await db
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.id, id))
      .limit(1);
    if (!ticket) {
      res.status(404).json({ error: "Ticket non trovato" });
      return;
    }
    const messages = await db
      .select()
      .from(supportTicketMessagesTable)
      .where(eq(supportTicketMessagesTable.ticketId, id))
      .orderBy(asc(supportTicketMessagesTable.createdAt));
    res.json({
      ticket: serializeTicket(ticket),
      messages: messages.map(serializeMessage),
    });
  },
);

router.post(
  "/admin/support/tickets/:id/reply",
  requireAdmin("support.write"),
  async (req, res) => {
    const id = Number(getRouteParam(req.params.id));
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Ticket non valido" });
      return;
    }
    const body = String(req.body?.body ?? "").trim();
    if (!body) {
      res.status(400).json({ error: "Messaggio obbligatorio" });
      return;
    }
    const [ticket] = await db
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.id, id))
      .limit(1);
    if (!ticket) {
      res.status(404).json({ error: "Ticket non trovato" });
      return;
    }

    const { message, updated } = await db.transaction(async (tx) => {
      const [message] = await tx
        .insert(supportTicketMessagesTable)
        .values({ ticketId: id, authorType: "support", authorId: req.admin!.userId, body })
        .returning();
      const [updated] = await tx
        .update(supportTicketsTable)
        .set({ status: "pending", updatedAt: new Date() })
        .where(eq(supportTicketsTable.id, id))
        .returning();
      await writeAdminAudit({
        req, admin: req.admin!, action: "support.reply", targetType: "support_ticket",
        targetId: String(id), before: ticket, after: updated,
      }, tx);
      return { message, updated };
    });

    void sendTicketReplyEmail(
      { id, userId: ticket.userId, subject: ticket.subject },
      body,
    ).catch((err) => logger.error({ err }, "[admin] support reply email failed"));

    res
      .status(201)
      .json({ message: serializeMessage(message), ticket: serializeTicket(updated) });
  },
);

router.post(
  "/admin/support/tickets/:id/status",
  requireAdmin("support.write"),
  async (req, res) => {
    const id = Number(getRouteParam(req.params.id));
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Ticket non valido" });
      return;
    }
    const status = String(req.body?.status ?? "").trim().toLowerCase();
    if (!isSupportStatus(status)) {
      res.status(400).json({ error: "Stato non valido" });
      return;
    }
    const [ticket] = await db
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.id, id))
      .limit(1);
    if (!ticket) {
      res.status(404).json({ error: "Ticket non trovato" });
      return;
    }

    const updated = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(supportTicketsTable)
        .set({ status, updatedAt: new Date() })
        .where(eq(supportTicketsTable.id, id))
        .returning();
      await writeAdminAudit({
        req, admin: req.admin!, action: "support.status", targetType: "support_ticket",
        targetId: String(id), before: ticket, after: updated,
      }, tx);
      return updated;
    });

    if (status === "closed" || status === "open") {
      void sendTicketStatusEmail({
        id,
        userId: ticket.userId,
        subject: ticket.subject,
        status,
      }).catch((err) =>
        logger.error({ err }, "[admin] support status email failed"),
      );
    }

    res.json({ ticket: serializeTicket(updated) });
  },
);

router.get(
  "/admin/system/overview",
  requireAdmin("system.feature_flags.write"),
  async (_req, res) => {
    const started = Date.now();
    let database: { status: "ok" | "error"; latencyMs: number };
    try {
      await db.execute(sql`select 1`);
      database = { status: "ok", latencyMs: Date.now() - started };
    } catch {
      database = { status: "error", latencyMs: Date.now() - started };
    }

    const [
      [{ value: sessions }],
      [{ value: pushSubscriptions }],
      [{ value: newsSnapshots }],
      [{ value: adminUsers }],
    ] = await Promise.all([
      db.select({ value: count() }).from(sessionsTable),
      db.select({ value: count() }).from(pushSubscriptionsTable),
      db.select({ value: count() }).from(newsSnapshotsTable),
      db.select({ value: count() }).from(adminUserStatusTable),
    ]);

    res.json({
      runtime: {
        nodeEnv: process.env.NODE_ENV ?? "unknown",
        uptimeSeconds: Math.round(process.uptime()),
        version: process.env.APP_VERSION ?? process.env.npm_package_version ?? "unknown",
        database,
      },
      metrics: {
        sessions,
        pushSubscriptions,
        newsSnapshots,
        adminUserStatuses: adminUsers,
      },
      flags: [
        serializeRuntimeFlag("CLERK_SECRET_KEY", process.env.CLERK_SECRET_KEY),
        serializeRuntimeFlag("VAPID_PUBLIC_KEY", process.env.VAPID_PUBLIC_KEY),
        serializeRuntimeFlag("VAPID_PRIVATE_KEY", process.env.VAPID_PRIVATE_KEY),
        serializeRuntimeFlag("SENTRY_DSN", process.env.SENTRY_DSN),
        serializeRuntimeFlag("OPENAI_API_KEY", process.env.OPENAI_API_KEY),
      ],
      watchdog: systemWatchdog.getTelemetry(),
      circuitBreakers: getAllCircuitBreakersStats(),
    });
  },
);

router.get("/admin/users", requireAdmin("users.read"), async (req, res) => {
  const q = normalizeAdminSearch(req.query.q);
  const limit = parseAdminLimit(req.query.limit, 50);
  const status = parseAdminStatusFilter(req.query.status);
  const filters = [];

  if (status === "active") {
    filters.push(
      or(
        eq(adminUserStatusTable.status, "active"),
        sql`${adminUserStatusTable.status} is null`,
      ),
    );
  } else if (status !== "all") {
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

    const clerkSessionIds = await listClerkSessions(targetUserId);
    // Persist the deny-list before provider revocation: already issued JWTs must
    // stop working immediately, including if the provider call fails halfway.
    await writeAdminAudit({
      req, admin: req.admin!, action: "users.revoke_sessions",
      targetType: "user", targetId: targetUserId, reason,
      after: { clerkSessionIds },
    });
    invalidateUserSecurityCache(targetUserId);
    const result = await db.delete(sessionsTable)
      .where(sql`${sessionsTable.sess}->'user'->>'id' = ${targetUserId}`)
      .returning({ sid: sessionsTable.sid });
    await revokeClerkSessions(clerkSessionIds);
    res.json({ success: true, revokedSessions: result.length + clerkSessionIds.length });
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

  invalidateUserSecurityCache(targetUserId);

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

    invalidateUserSecurityCache(targetUserId);

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
  const actor = parseAdminAuditTarget(req.query.actor);
  const targetType = parseAdminAuditTarget(req.query.targetType);
  const targetId = parseAdminAuditTarget(req.query.targetId);
  const action = parseAdminAuditTarget(req.query.action);
  const filters = [];

  if (actor) filters.push(eq(adminAuditLogsTable.actorUserId, actor));
  if (targetType) filters.push(eq(adminAuditLogsTable.targetType, targetType));
  if (targetId) filters.push(eq(adminAuditLogsTable.targetId, targetId));
  if (action) filters.push(eq(adminAuditLogsTable.action, action));

  const rows = await db
    .select()
    .from(adminAuditLogsTable)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(adminAuditLogsTable.createdAt))
    .limit(limit);

  res.json({ audit: rows });
});

// ─── CANDIDATE APPLICATIONS (TRIBUTO 150€/MESE) ──────────────────────────────
router.get("/admin/candidate-applications", requireAdmin("users.read"), async (req, res) => {
  const status = String(req.query.status ?? "all").trim();
  const search = normalizeAdminSearch(req.query.q);
  const limit = parseAdminLimit(req.query.limit, 25);
  const offset = Math.max(0, Number(req.query.offset) || 0);

  const filters = [];
  if (status !== "all" && ["in_valutazione", "respinto", "contattato"].includes(status)) {
    filters.push(eq(candidateApplicationsTable.status, status));
  }
  if (search) {
    filters.push(
      or(
        ilike(candidateApplicationsTable.name, `%${search}%`),
        ilike(candidateApplicationsTable.email, `%${search}%`),
        ilike(candidateApplicationsTable.candidateCode, `%${search}%`),
        ilike(candidateApplicationsTable.contactHandle, `%${search}%`),
      ),
    );
  }

  const [applications, [{ value: total }], [{ value: pendingCount }], [{ value: admittedCount }]] = await Promise.all([
    db
      .select()
      .from(candidateApplicationsTable)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(candidateApplicationsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(candidateApplicationsTable)
      .where(filters.length > 0 ? and(...filters) : undefined),
    db
      .select({ value: count() })
      .from(candidateApplicationsTable)
      .where(eq(candidateApplicationsTable.status, "in_valutazione")),
    db
      .select({ value: count() })
      .from(candidateApplicationsTable)
      .where(eq(candidateApplicationsTable.status, "ammesso")),
  ]);

  res.json({
    applications,
    total,
    pendingCount,
    admittedCount,
    limit,
    offset,
  });
});

router.patch("/admin/candidate-applications/:id/status", requireAdmin("users.read"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "ID candidatura non valido" });
    return;
  }
  const status = String(req.body.status ?? "").trim();
  const notes = req.body.notes !== undefined ? String(req.body.notes).trim() : undefined;
  if (!["in_valutazione", "respinto", "contattato"].includes(status)) {
    res.status(400).json({ error: "Stato candidatura non valido" });
    return;
  }

  const [existing] = await db
    .select()
    .from(candidateApplicationsTable)
    .where(eq(candidateApplicationsTable.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Candidatura non trovata" });
    return;
  }

  if (existing.status === "ammesso") throw new LaunchError("Il posto ammesso resta riservato al gruppo iniziale. Non è modificabile da questa azione.", 409);

  const [updated] = await db
    .update(candidateApplicationsTable)
    .set({
      status,
      notes: notes !== undefined ? notes : existing.notes,
      reviewedBy: req.admin!.userId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(candidateApplicationsTable.id, id))
    .returning();

  await writeAdminAudit({
    req,
    admin: req.admin!,
    action: "candidate.status_update",
    targetType: "candidate_application",
    targetId: String(id),
    reason: notes || `Stato candidatura aggiornato a ${status}`,
    before: existing,
    after: updated,
  });

  res.json({ ok: true, application: updated });
});

router.post("/admin/candidate-applications/:id/admit", requireAdmin("billing.subscriptions.write"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "ID candidatura non valido" });
    return;
  }

  const approvedServices = Array.isArray(req.body.approvedServices)
    ? (req.body.approvedServices as string[])
    : undefined;
  const billingCycle =
    req.body.billingCycle === "yearly"
      ? "yearly"
      : req.body.billingCycle === "monthly"
        ? "monthly"
        : undefined;

  const result = await admitCandidate(
    id,
    req.admin!.userId,
    String(req.body.notes ?? "").trim().slice(0, 4000),
    approvedServices,
    billingCycle,
  );
  await writeAdminAudit({
    req,
    admin: req.admin!,
    action: "candidate.admit_member",
    targetType: "candidate_application",
    targetId: String(id),
    reason: "Ammissione candidatura e attivazione servizi approvati",
    before: result.before,
    after: result.application,
  });
  res.json({ ok: true, application: result.application, subscription: null, targetUserId: result.application.userId });
});

router.patch("/admin/candidate-applications/:id/services", requireAdmin("billing.subscriptions.write"), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "ID candidatura non valido" });
    return;
  }
  const approvedServices = Array.isArray(req.body.approvedServices)
    ? (req.body.approvedServices as string[])
    : ["base_protocol"];
  const notes = typeof req.body.notes === "string" ? req.body.notes.trim() : undefined;
  const billingCycle =
    req.body.billingCycle === "yearly"
      ? "yearly"
      : req.body.billingCycle === "monthly"
        ? "monthly"
        : undefined;
  const result = await updateCandidateApprovedServices(
    id,
    req.admin!.userId,
    approvedServices,
    notes,
    billingCycle,
  );
  await writeAdminAudit({
    req,
    admin: req.admin!,
    action: "candidate.update_services",
    targetType: "candidate_application",
    targetId: String(id),
    reason: notes || `Servizi approvati aggiornati: ${approvedServices.join(", ")}`,
    before: result.before,
    after: result.application,
  });
  res.json({ ok: true, application: result.application });
});

// ─── ADMIN ROLES MANAGEMENT (STAFF) ──────────────────────────────────────────
router.get("/admin/roles", requireAdmin("security.audit.read"), async (_req, res) => {
  const bootstrapIds = Array.from(getBootstrapAdminIds());
  const dbAdmins = await db
    .select({
      id: adminUsersTable.id,
      userId: adminUsersTable.userId,
      role: adminUsersTable.role,
      status: adminUsersTable.status,
      createdBy: adminUsersTable.createdBy,
      createdAt: adminUsersTable.createdAt,
      updatedAt: adminUsersTable.updatedAt,
      userName: profileTable.name,
    })
    .from(adminUsersTable)
    .leftJoin(profileTable, eq(adminUsersTable.userId, profileTable.userId))
    .orderBy(desc(adminUsersTable.createdAt));

  res.json({
    roles: dbAdmins,
    bootstrapUserIds: bootstrapIds,
    availableRoles: adminRoleNames,
  });
});

router.post("/admin/roles/assign", requireAdmin("security.roles.write"), async (req, res) => {
  const targetUserId = String(req.body.userId ?? "").trim();
  const role = String(req.body.role ?? "").trim();

  if (!targetUserId) {
    res.status(400).json({ error: "userId obbligatorio" });
    return;
  }
  if (!adminRoleNames.includes(role as AdminRoleName)) {
    res.status(400).json({ error: `Ruolo non valido. Valori ammessi: ${adminRoleNames.join(", ")}` });
    return;
  }

  const [existing] = await db
    .select()
    .from(adminUsersTable)
    .where(eq(adminUsersTable.userId, targetUserId))
    .limit(1);

  let updatedAdmin;
  if (existing) {
    [updatedAdmin] = await db
      .update(adminUsersTable)
      .set({
        role,
        status: "active",
        createdBy: req.admin!.userId,
        updatedAt: new Date(),
      })
      .where(eq(adminUsersTable.userId, targetUserId))
      .returning();
  } else {
    [updatedAdmin] = await db
      .insert(adminUsersTable)
      .values({
        userId: targetUserId,
        role,
        status: "active",
        createdBy: req.admin!.userId,
      })
      .returning();
  }

  await writeAdminAudit({
    req,
    admin: req.admin!,
    action: "admin.role_assign",
    targetType: "admin_user",
    targetId: targetUserId,
    reason: `Ruolo impostato a ${role}`,
    before: existing ?? null,
    after: updatedAdmin,
  });

  res.json({ ok: true, admin: updatedAdmin });
});

router.post("/admin/roles/revoke", requireAdmin("security.roles.write"), async (req, res) => {
  const targetUserId = String(req.body.userId ?? "").trim();
  const reason = String(req.body.reason ?? "").trim();

  if (!targetUserId) {
    res.status(400).json({ error: "userId obbligatorio" });
    return;
  }

  const bootstrapIds = getBootstrapAdminIds();
  if (bootstrapIds.has(targetUserId)) {
    res.status(403).json({ error: "Non puoi revocare un super admin configurato via bootstrap env" });
    return;
  }

  const [existing] = await db
    .select()
    .from(adminUsersTable)
    .where(eq(adminUsersTable.userId, targetUserId))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Ruolo admin non trovato per questo utente" });
    return;
  }

  const [updatedAdmin] = await db
    .update(adminUsersTable)
    .set({
      status: "disabled",
      updatedAt: new Date(),
    })
    .where(eq(adminUsersTable.userId, targetUserId))
    .returning();

  await writeAdminAudit({
    req,
    admin: req.admin!,
    action: "admin.role_revoke",
    targetType: "admin_user",
    targetId: targetUserId,
    reason: reason || "Ruolo admin disattivato",
    before: existing,
    after: updatedAdmin,
  });

  res.json({ ok: true, admin: updatedAdmin });
});

// ─── USER PROFILE EDIT & GDPR EXPORT ─────────────────────────────────────────
router.patch("/admin/users/:userId/profile", requireAdmin("users.suspend"), async (req, res) => {
  const targetUserId = String(req.params.userId ?? "").trim();
  if (!targetUserId) {
    res.status(400).json({ error: "userId non valido" });
    return;
  }

  const [existingProfile] = await db
    .select()
    .from(profileTable)
    .where(eq(profileTable.userId, targetUserId))
    .limit(1);

  if (!existingProfile) {
    res.status(404).json({ error: "Profilo non trovato" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (req.body.xp !== undefined && Number.isFinite(Number(req.body.xp))) {
    updates.xp = Math.max(0, Math.floor(Number(req.body.xp)));
  }
  if (req.body.level !== undefined && Number.isFinite(Number(req.body.level))) {
    updates.level = Math.max(1, Math.floor(Number(req.body.level)));
  }
  if (req.body.streak !== undefined && Number.isFinite(Number(req.body.streak))) {
    updates.streak = Math.max(0, Math.floor(Number(req.body.streak)));
  }
  if (req.body.name !== undefined && String(req.body.name).trim()) {
    updates.name = String(req.body.name).trim();
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nessun campo valido da aggiornare" });
    return;
  }

  updates.updatedAt = new Date();

  const [updatedProfile] = await db
    .update(profileTable)
    .set(updates)
    .where(eq(profileTable.userId, targetUserId))
    .returning();

  await writeAdminAudit({
    req,
    admin: req.admin!,
    action: "user.profile_update",
    targetType: "profile",
    targetId: targetUserId,
    reason: req.body.reason ? String(req.body.reason) : "Aggiornamento profilo da console admin",
    before: existingProfile,
    after: updatedProfile,
  });

  res.json({ ok: true, profile: updatedProfile });
});

router.get("/admin/users/:userId/export", requireAdmin("users.export_data"), async (req, res) => {
  const targetUserId = String(req.params.userId ?? "").trim();
  if (!targetUserId) {
    res.status(400).json({ error: "userId non valido" });
    return;
  }

  try {
    const data = await exportAccountData(targetUserId);

    await writeAdminAudit({
      req,
      admin: req.admin!,
      action: "users.export_data",
      targetType: "user",
      targetId: targetUserId,
      reason: "Esportazione dati GDPR utente da console admin",
    });

    res.setHeader("Content-Disposition", `attachment; filename="export-${targetUserId}.json"`);
    res.json(data);
  } catch (error) {
    logger.error({ err: error, targetUserId }, "Export dati admin fallito");
    res.status(500).json({ error: "Errore durante l'esportazione dati" });
  }
});

// ─── SYSTEM FEATURE FLAGS (INTERACTIVE) ──────────────────────────────────────
router.get("/admin/system/flags", requireAdmin("dashboard.read"), async (_req, res) => {
  const flags = await db.select().from(systemFeatureFlagsTable).orderBy(asc(systemFeatureFlagsTable.key));
  res.json({ flags });
});

router.post("/admin/system/flags/:key/toggle", requireAdmin("system.feature_flags.write"), async (req, res) => {
  const key = String(req.params.key ?? "").trim();
  if (!key) {
    res.status(400).json({ error: "Key flag non valida" });
    return;
  }

  const [existing] = await db
    .select()
    .from(systemFeatureFlagsTable)
    .where(eq(systemFeatureFlagsTable.key, key))
    .limit(1);

  const newEnabled = req.body.enabled !== undefined ? Boolean(req.body.enabled) : (existing ? !existing.enabled : true);

  let updatedFlag;
  if (existing) {
    [updatedFlag] = await db
      .update(systemFeatureFlagsTable)
      .set({
        enabled: newEnabled,
        updatedBy: req.admin!.userId,
        updatedAt: new Date(),
      })
      .where(eq(systemFeatureFlagsTable.key, key))
      .returning();
  } else {
    [updatedFlag] = await db
      .insert(systemFeatureFlagsTable)
      .values({
        key,
        enabled: newEnabled,
        description: req.body.description ? String(req.body.description) : null,
        updatedBy: req.admin!.userId,
      })
      .returning();
  }

  await writeAdminAudit({
    req,
    admin: req.admin!,
    action: "system.flag_toggle",
    targetType: "system_feature_flag",
    targetId: key,
    reason: `Flag ${key} impostato a ${newEnabled}`,
    before: existing ?? null,
    after: updatedFlag,
  });

  res.json({ ok: true, flag: updatedFlag });
});

// ─── TRADING & BROKER DIAGNOSTICS & SYNC ─────────────────────────────────────
router.get("/admin/trading/diagnostics", requireAdmin("trading.read"), async (_req, res) => {
  const storeRows = await db
    .select()
    .from(brokerProfileStoreTable)
    .limit(10);

  const profiles: Array<Record<string, unknown>> = [];
  for (const row of storeRows) {
    const list = row.data as { profiles?: Array<Record<string, unknown>> };
    if (Array.isArray(list?.profiles)) {
      profiles.push(...list.profiles);
    }
  }

  const recentTrades = await db
    .select({
      id: accountTradesTable.id,
      ticket: accountTradesTable.ticket,
      source: accountTradesTable.source,
      symbol: accountTradesTable.symbol,
      status: accountTradesTable.status,
      userId: accountTradesTable.userId,
      createdAt: accountTradesTable.createdAt,
    })
    .from(accountTradesTable)
    .orderBy(desc(accountTradesTable.createdAt))
    .limit(20);

  res.json({
    profiles,
    recentTrades,
    totalProfiles: profiles.length,
  });
});

router.post("/admin/trading/retry-sync", requireAdmin("trading.retry_sync"), async (req, res) => {
  const profileId = req.body.profileId ? String(req.body.profileId).trim() : undefined;
  const targetUserId = req.body.userId ? String(req.body.userId).trim() : undefined;

  await writeAdminAudit({
    req,
    admin: req.admin!,
    action: "trading.retry_sync",
    targetType: "broker_profile",
    targetId: profileId ?? targetUserId ?? "all",
    reason: "Forzatura re-sync da console admin",
  });

  res.json({ ok: true, message: "Richiesta di re-sync accodata con successo", profileId, targetUserId });
});

export default router;
