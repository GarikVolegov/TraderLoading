import { Router, type IRouter } from "express";
import {
  db,
  communitiesTable,
  communityMembersTable,
  communityBansTable,
  communityMutesTable,
  communityMessagesTable,
  communityChannelsTable,
  communityMessageReportsTable,
  communityJoinRequestsTable,
  communityRolesTable,
  profileTable,
} from "@workspace/db";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import {
  requirePermission,
  getMemberContext,
  getMemberRank,
  memberRank,
  outranks,
} from "../services/communityPermissions.js";
import { recordModerationAction } from "../services/communityModerationLog.js";
import { normalizeReportReason, sanitizeReportDetails } from "../services/messageReports.js";

const router: IRouter = Router();

// ─── Ban a member ────────────────────────────────────────────────────────────
router.post("/community/:id/members/:userId/ban", async (req, res) => {
  const communityId = parseInt(req.params.id);
  const ctx = await requirePermission(req, res, communityId, "members.ban");
  if (!ctx) return;
  try {
    const targetUserId = req.params.userId;
    // Can't ban a member who ranks at or above you (owner included).
    if (!outranks(memberRank(ctx), await getMemberRank(communityId, targetUserId))) {
      res.status(403).json({ error: "Non puoi bannare un membro di livello pari o superiore al tuo" });
      return;
    }

    const reason = typeof req.body.reason === "string" ? req.body.reason.slice(0, 300) : null;
    await db
      .insert(communityBansTable)
      .values({ communityId, userId: targetUserId, bannedBy: ctx.userId, reason })
      .onConflictDoUpdate({
        target: [communityBansTable.communityId, communityBansTable.userId],
        set: { bannedBy: ctx.userId, reason },
      });

    // Remove the member (and any stale mute) so the ban takes effect immediately.
    const deleted = await db
      .delete(communityMembersTable)
      .where(and(eq(communityMembersTable.communityId, communityId), eq(communityMembersTable.userId, targetUserId)))
      .returning({ id: communityMembersTable.id });
    await db
      .delete(communityMutesTable)
      .where(and(eq(communityMutesTable.communityId, communityId), eq(communityMutesTable.userId, targetUserId)));
    if (deleted.length > 0) {
      await db
        .update(communitiesTable)
        .set({ memberCount: sql`GREATEST(${communitiesTable.memberCount} - 1, 0)` })
        .where(eq(communitiesTable.id, communityId));
    }
    await recordModerationAction({ communityId, actorUserId: ctx.userId, action: "member.ban", targetUserId, metadata: { reason } });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /community/:id/members/:userId/ban error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Unban ───────────────────────────────────────────────────────────────────
router.delete("/community/:id/bans/:userId", async (req, res) => {
  const communityId = parseInt(req.params.id);
  const ctx = await requirePermission(req, res, communityId, "members.ban");
  if (!ctx) return;
  try {
    await db
      .delete(communityBansTable)
      .where(and(eq(communityBansTable.communityId, communityId), eq(communityBansTable.userId, req.params.userId)));
    await recordModerationAction({ communityId, actorUserId: ctx.userId, action: "member.unban", targetUserId: req.params.userId });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /community/:id/bans/:userId error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── List bans ───────────────────────────────────────────────────────────────
router.get("/community/:id/bans", async (req, res) => {
  const communityId = parseInt(req.params.id);
  if (!(await requirePermission(req, res, communityId, "members.ban"))) return;
  try {
    const rows = await db
      .select({
        userId: communityBansTable.userId,
        reason: communityBansTable.reason,
        bannedBy: communityBansTable.bannedBy,
        createdAt: communityBansTable.createdAt,
        name: profileTable.name,
        avatarUrl: profileTable.avatarUrl,
      })
      .from(communityBansTable)
      .leftJoin(profileTable, eq(profileTable.userId, communityBansTable.userId))
      .where(eq(communityBansTable.communityId, communityId))
      .orderBy(asc(communityBansTable.createdAt));
    res.json(rows.map((b) => ({ ...b, name: b.name ?? "Trader" })));
  } catch (err) {
    console.error("GET /community/:id/bans error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Mute a member ───────────────────────────────────────────────────────────
router.post("/community/:id/members/:userId/mute", async (req, res) => {
  const communityId = parseInt(req.params.id);
  const ctx = await requirePermission(req, res, communityId, "members.mute");
  if (!ctx) return;
  try {
    const targetUserId = req.params.userId;
    // Can't mute a member who ranks at or above you (owner included).
    if (!outranks(memberRank(ctx), await getMemberRank(communityId, targetUserId))) {
      res.status(403).json({ error: "Non puoi silenziare un membro di livello pari o superiore al tuo" });
      return;
    }

    // minutes > 0 → timed mute; missing/0 → indefinite (until = null).
    const minutes = Number(req.body.minutes);
    const until = Number.isFinite(minutes) && minutes > 0 ? new Date(Date.now() + minutes * 60_000) : null;
    const reason = typeof req.body.reason === "string" ? req.body.reason.slice(0, 300) : null;

    await db
      .insert(communityMutesTable)
      .values({ communityId, userId: targetUserId, mutedBy: ctx.userId, until, reason })
      .onConflictDoUpdate({
        target: [communityMutesTable.communityId, communityMutesTable.userId],
        set: { mutedBy: ctx.userId, until, reason, createdAt: sql`now()` },
      });
    await recordModerationAction({ communityId, actorUserId: ctx.userId, action: "member.mute", targetUserId, metadata: { until, reason } });
    res.json({ ok: true, until });
  } catch (err) {
    console.error("POST /community/:id/members/:userId/mute error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Unmute ──────────────────────────────────────────────────────────────────
router.delete("/community/:id/members/:userId/mute", async (req, res) => {
  const communityId = parseInt(req.params.id);
  const ctx = await requirePermission(req, res, communityId, "members.mute");
  if (!ctx) return;
  try {
    await db
      .delete(communityMutesTable)
      .where(and(eq(communityMutesTable.communityId, communityId), eq(communityMutesTable.userId, req.params.userId)));
    await recordModerationAction({ communityId, actorUserId: ctx.userId, action: "member.unmute", targetUserId: req.params.userId });
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /community/:id/members/:userId/mute error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Delete a message (own message, or messages.moderate) ────────────────────
router.delete("/community/messages/:messageId", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return; }
  try {
    const messageId = parseInt(req.params.messageId);
    const [message] = await db
      .select()
      .from(communityMessagesTable)
      .where(eq(communityMessagesTable.id, messageId))
      .limit(1);
    if (!message) { res.status(404).json({ error: "Messaggio non trovato" }); return; }

    // Deleting your own message isn't moderation; deleting someone else's (via
    // messages.moderate) is, and gets audited.
    let moderationCommunityId: number | null = null;
    if (message.userId !== userId) {
      const [channel] = await db
        .select({ communityId: communityChannelsTable.communityId })
        .from(communityChannelsTable)
        .where(eq(communityChannelsTable.id, message.channelId))
        .limit(1);
      if (!channel) { res.status(404).json({ error: "Canale non trovato" }); return; }
      if (!(await requirePermission(req, res, channel.communityId, "messages.moderate"))) return;
      moderationCommunityId = channel.communityId;
    }

    await db.delete(communityMessagesTable).where(eq(communityMessagesTable.id, messageId));
    if (moderationCommunityId !== null) {
      await recordModerationAction({
        communityId: moderationCommunityId,
        actorUserId: userId,
        action: "message.delete",
        targetUserId: message.userId,
        targetId: messageId,
        metadata: { channelId: message.channelId },
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /community/messages/:messageId error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Report a message (any member of the community) ──────────────────────────
router.post("/community/messages/:messageId/report", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return; }
  try {
    const messageId = parseInt(req.params.messageId);
    const [message] = await db
      .select({ id: communityMessagesTable.id, channelId: communityMessagesTable.channelId, userId: communityMessagesTable.userId })
      .from(communityMessagesTable)
      .where(eq(communityMessagesTable.id, messageId))
      .limit(1);
    if (!message) { res.status(404).json({ error: "Messaggio non trovato" }); return; }
    if (message.userId === userId) { res.status(400).json({ error: "Non puoi segnalare il tuo messaggio" }); return; }

    const [channel] = await db
      .select({ communityId: communityChannelsTable.communityId })
      .from(communityChannelsTable)
      .where(eq(communityChannelsTable.id, message.channelId))
      .limit(1);
    if (!channel) { res.status(404).json({ error: "Canale non trovato" }); return; }

    // Only members can report, and not while banned.
    const ctx = await getMemberContext(channel.communityId, userId);
    if (!ctx.isMember || ctx.isBanned) { res.status(403).json({ error: "Non autorizzato" }); return; }

    await db
      .insert(communityMessageReportsTable)
      .values({
        communityId: channel.communityId,
        messageId,
        reporterUserId: userId,
        reason: normalizeReportReason(req.body?.reason),
        details: sanitizeReportDetails(req.body?.details),
      })
      .onConflictDoNothing({
        target: [communityMessageReportsTable.messageId, communityMessageReportsTable.reporterUserId],
      });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /community/messages/:messageId/report error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Moderator queue: pending message reports ────────────────────────────────
router.get("/community/:id/message-reports", async (req, res) => {
  const communityId = parseInt(req.params.id);
  if (!(await requirePermission(req, res, communityId, "messages.moderate"))) return;
  try {
    const rows = await db
      .select({
        id: communityMessageReportsTable.id,
        messageId: communityMessageReportsTable.messageId,
        reporterUserId: communityMessageReportsTable.reporterUserId,
        reason: communityMessageReportsTable.reason,
        details: communityMessageReportsTable.details,
        status: communityMessageReportsTable.status,
        createdAt: communityMessageReportsTable.createdAt,
        messageContent: communityMessagesTable.content,
        messageAuthorId: communityMessagesTable.userId,
        channelId: communityMessagesTable.channelId,
      })
      .from(communityMessageReportsTable)
      .leftJoin(communityMessagesTable, eq(communityMessagesTable.id, communityMessageReportsTable.messageId))
      .where(
        and(
          eq(communityMessageReportsTable.communityId, communityId),
          eq(communityMessageReportsTable.status, "pending"),
        ),
      )
      .orderBy(desc(communityMessageReportsTable.createdAt));
    res.json({ reports: rows });
  } catch (err) {
    console.error("GET /community/:id/message-reports error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Resolve a report (moderator) ────────────────────────────────────────────
router.post("/community/message-reports/:reportId/resolve", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return; }
  try {
    const reportId = parseInt(req.params.reportId);
    const [report] = await db
      .select({
        id: communityMessageReportsTable.id,
        communityId: communityMessageReportsTable.communityId,
        messageId: communityMessageReportsTable.messageId,
      })
      .from(communityMessageReportsTable)
      .where(eq(communityMessageReportsTable.id, reportId))
      .limit(1);
    if (!report) { res.status(404).json({ error: "Segnalazione non trovata" }); return; }
    if (!(await requirePermission(req, res, report.communityId, "messages.moderate"))) return;

    // Resolve every pending report on the same message in one go.
    await db
      .update(communityMessageReportsTable)
      .set({ status: "resolved", resolvedAt: new Date(), resolvedBy: userId })
      .where(
        and(
          eq(communityMessageReportsTable.messageId, report.messageId),
          eq(communityMessageReportsTable.status, "pending"),
        ),
      );
    await recordModerationAction({
      communityId: report.communityId,
      actorUserId: userId,
      action: "report.resolve",
      targetId: report.messageId,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /community/message-reports/:reportId/resolve error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Private-community join requests (audit 0.5b) ────────────────────────────
router.get("/community/:id/join-requests", async (req, res) => {
  const communityId = parseInt(req.params.id);
  const ctx = await requirePermission(req, res, communityId, "members.kick");
  if (!ctx) return;
  try {
    const rows = await db
      .select({
        id: communityJoinRequestsTable.id,
        userId: communityJoinRequestsTable.userId,
        message: communityJoinRequestsTable.message,
        createdAt: communityJoinRequestsTable.createdAt,
        userName: profileTable.name,
        avatarUrl: profileTable.avatarUrl,
      })
      .from(communityJoinRequestsTable)
      .leftJoin(profileTable, eq(profileTable.userId, communityJoinRequestsTable.userId))
      .where(and(
        eq(communityJoinRequestsTable.communityId, communityId),
        eq(communityJoinRequestsTable.status, "pending"),
      ))
      .orderBy(desc(communityJoinRequestsTable.createdAt));
    res.json({ requests: rows });
  } catch (err) {
    console.error("GET /community/:id/join-requests error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.post("/community/:id/join-requests/:requestId/resolve", async (req, res) => {
  const communityId = parseInt(req.params.id);
  const ctx = await requirePermission(req, res, communityId, "members.kick");
  if (!ctx) return;
  try {
    const requestId = parseInt(req.params.requestId);
    const decision = req.body?.decision;
    if (decision !== "approve" && decision !== "reject") {
      res.status(400).json({ error: "Decisione non valida" }); return;
    }
    const [request] = await db
      .select()
      .from(communityJoinRequestsTable)
      .where(and(
        eq(communityJoinRequestsTable.id, requestId),
        eq(communityJoinRequestsTable.communityId, communityId),
      ))
      .limit(1);
    if (!request) { res.status(404).json({ error: "Richiesta non trovata" }); return; }
    if (request.status !== "pending") { res.status(409).json({ error: "Richiesta gia' gestita" }); return; }

    await db.transaction(async (tx) => {
      await tx
        .update(communityJoinRequestsTable)
        .set({ status: decision === "approve" ? "approved" : "rejected", decidedByUserId: ctx.userId, decidedAt: new Date() })
        .where(eq(communityJoinRequestsTable.id, requestId));

      if (decision === "approve") {
        const [defaultRole] = await tx
          .select({ id: communityRolesTable.id })
          .from(communityRolesTable)
          .where(and(eq(communityRolesTable.communityId, communityId), eq(communityRolesTable.isDefault, true)))
          .limit(1);
        const inserted = await tx
          .insert(communityMembersTable)
          .values({ communityId, userId: request.userId, role: "member", roleId: defaultRole?.id ?? null })
          .onConflictDoNothing({ target: [communityMembersTable.communityId, communityMembersTable.userId] })
          .returning({ id: communityMembersTable.id });
        if (inserted.length > 0) {
          await tx
            .update(communitiesTable)
            .set({ memberCount: sql`${communitiesTable.memberCount} + 1` })
            .where(eq(communitiesTable.id, communityId));
        }
      }
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /community/:id/join-requests/:requestId/resolve error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

export default router;
