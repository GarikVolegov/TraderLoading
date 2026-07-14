import { Router, type IRouter, type Request, type Response } from "express";
import {
  accountTradesTable,
  adminAuditLogsTable,
  adminUserSubscriptionsTable,
  adminUserStatusTable,
  backtestSessionsTable,
  backtestTradesTable,
  brokerProfileStoreTable,
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
  testimonialsTable,
  usersTable,
} from "@workspace/db";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/adminAuth.js";
import { ADMIN_PERMISSIONS_BY_ROLE } from "../lib/adminPermissions.js";
import { writeAdminAudit } from "../services/adminAudit.js";
import { logger } from "../lib/logger.js";
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
export type AdminSubscriptionPlan = "free" | "pro";
export type AdminSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled";

const ADMIN_SUBSCRIPTION_PLANS: AdminSubscriptionPlan[] = [
  "free",
  "pro",
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

  const [before] = await db
    .select()
    .from(libraryContentsTable)
    .where(eq(libraryContentsTable.id, itemId))
    .limit(1);

  if (!before) {
    res.status(404).json({ error: "Contenuto non trovato" });
    return;
  }

  const [after] = await db
    .update(libraryContentsTable)
    .set({ published, updatedAt: new Date() })
    .where(eq(libraryContentsTable.id, itemId))
    .returning();

  await writeAdminAudit({
    req,
    admin: req.admin!,
    action: published ? "content.publish" : "content.unpublish",
    targetType: "library_content",
    targetId: String(itemId),
    reason,
    before,
    after,
  });

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

    const [message] = await db
      .insert(supportTicketMessagesTable)
      .values({
        ticketId: id,
        authorType: "support",
        authorId: req.admin!.userId,
        body,
      })
      .returning();
    const [updated] = await db
      .update(supportTicketsTable)
      .set({ status: "pending", updatedAt: new Date() })
      .where(eq(supportTicketsTable.id, id))
      .returning();

    await writeAdminAudit({
      req,
      admin: req.admin!,
      action: "support.reply",
      targetType: "support_ticket",
      targetId: String(id),
      before: ticket,
      after: updated,
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

    const [updated] = await db
      .update(supportTicketsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(supportTicketsTable.id, id))
      .returning();

    await writeAdminAudit({
      req,
      admin: req.admin!,
      action: "support.status",
      targetType: "support_ticket",
      targetId: String(id),
      before: ticket,
      after: updated,
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

export default router;
