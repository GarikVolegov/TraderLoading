import { Router, type IRouter } from "express";
import {
  db,
  communitiesTable,
  communityMembersTable,
  communityBansTable,
  communityMutesTable,
  communityMessagesTable,
  communityChannelsTable,
  profileTable,
} from "@workspace/db";
import { eq, and, asc, sql } from "drizzle-orm";
import {
  requirePermission,
  getMemberRank,
  memberRank,
  outranks,
} from "../services/communityPermissions.js";
import { recordModerationAction } from "../services/communityModerationLog.js";

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

export default router;
