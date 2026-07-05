import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, communitiesTable, communityMembersTable, communityChannelsTable, communityMessagesTable, communityFilesTable, communityRolesTable, communityBansTable, communityMutesTable, voicePresenceTable, profileTable } from "@workspace/db";
import { eq, and, desc, asc, sql, lt, type SQL } from "drizzle-orm";
import { consumeSignals, pushSignal } from "../services/callSignaling.js";
import { resolveUploadPath } from "../lib/uploads.js";
import {
  getMemberContext,
  requirePermission,
  hasPermission,
  isMuteActive,
  sanitizePermissions,
  DEFAULT_MEMBER_PERMISSIONS,
  ADMIN_ROLE_PERMISSIONS,
} from "../services/communityPermissions.js";
import { emitSocialEvent } from "../services/socialHub/socialEvents.js";
import { deleteCommunityDeep, deleteChannelDeep } from "../services/communityDeletion.js";
import { recordModerationAction } from "../services/communityModerationLog.js";

const COMMUNITY_FILES_DIR = resolveUploadPath("community-files");
if (!fs.existsSync(COMMUNITY_FILES_DIR)) fs.mkdirSync(COMMUNITY_FILES_DIR, { recursive: true });

/** Best-effort disk cleanup for deleted community files (DB rows already gone). */
function unlinkCommunityFiles(fileUrls: string[]): void {
  for (const fileUrl of fileUrls) {
    fs.unlink(path.join(COMMUNITY_FILES_DIR, path.basename(fileUrl)), () => {});
  }
}

const communityFileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, COMMUNITY_FILES_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `cfile-${unique}${ext}`);
  },
});

const ALLOWED_FILE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
  "application/zip", "application/x-zip-compressed",
]);

const communityFileUpload = multer({
  storage: communityFileStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_FILE_TYPES.has(file.mimetype)) cb(null, true);
    else cb(new Error("Tipo file non supportato"));
  },
});

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return null; }
  return userId;
}

// ─── List communities ──────────────────────────────────────────────────────────
router.get("/community", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const communities = await db
      .select()
      .from(communitiesTable)
      .where(eq(communitiesTable.isPublic, true))
      .orderBy(desc(communitiesTable.memberCount), desc(communitiesTable.createdAt))
      .limit(50);

    const myMemberships = await db
      .select({ communityId: communityMembersTable.communityId })
      .from(communityMembersTable)
      .where(eq(communityMembersTable.userId, userId));

    const myIds = new Set(myMemberships.map(m => m.communityId));

    res.json(communities.map(c => ({
      ...c,
      isMember: myIds.has(c.id),
      ratingAvg: c.ratingCount > 0 ? c.ratingSum / c.ratingCount : 0,
    })));
  } catch (err) {
    console.error("GET /community error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Create community ──────────────────────────────────────────────────────────
router.post("/community", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const { name, description, iconEmoji } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ error: "Nome richiesto" });
      return;
    }
    if (name.trim().length > 50) {
      res.status(400).json({ error: "Nome troppo lungo (max 50)" });
      return;
    }

    const [community] = await db
      .insert(communitiesTable)
      .values({
        name: name.trim(),
        description: (description ?? "").slice(0, 200),
        iconEmoji: iconEmoji ?? "🏛️",
        creatorId: userId,
      })
      .returning();

    // Seed the two starter roles. "Membro" is the default assigned to joiners;
    // "Admin" carries every permission. The creator stays owner (implicit, full
    // power via creatorId) and is additionally given the Admin role.
    await db.insert(communityRolesTable).values({
      communityId: community.id,
      name: "Membro",
      permissions: DEFAULT_MEMBER_PERMISSIONS,
      position: 0,
      isDefault: true,
    });
    const [adminRole] = await db
      .insert(communityRolesTable)
      .values({
        communityId: community.id,
        name: "Admin",
        permissions: ADMIN_ROLE_PERMISSIONS,
        position: 1,
        isDefault: false,
      })
      .returning({ id: communityRolesTable.id });

    await db.insert(communityMembersTable).values({
      communityId: community.id,
      userId,
      role: "owner",
      roleId: adminRole.id,
    });

    const defaultChannels = [
      { communityId: community.id, name: "generale", type: "text", position: 0 },
      { communityId: community.id, name: "analisi", type: "text", position: 1 },
      { communityId: community.id, name: "Sala Vocale", type: "voice", position: 2 },
    ];
    await db.insert(communityChannelsTable).values(defaultChannels);

    res.status(201).json({ ...community, isMember: true });
  } catch (err) {
    console.error("POST /community error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Get community detail ──────────────────────────────────────────────────────
router.get("/community/:id", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const id = parseInt(req.params.id);
    const [community] = await db.select().from(communitiesTable).where(eq(communitiesTable.id, id)).limit(1);
    if (!community) { res.status(404).json({ error: "Community non trovata" }); return; }

    const channels = await db
      .select()
      .from(communityChannelsTable)
      .where(eq(communityChannelsTable.communityId, id))
      .orderBy(asc(communityChannelsTable.position));

    const roles = await db
      .select({
        id: communityRolesTable.id,
        name: communityRolesTable.name,
        color: communityRolesTable.color,
        permissions: communityRolesTable.permissions,
        position: communityRolesTable.position,
        isDefault: communityRolesTable.isDefault,
      })
      .from(communityRolesTable)
      .where(eq(communityRolesTable.communityId, id))
      .orderBy(asc(communityRolesTable.position));

    const [membership] = await db
      .select()
      .from(communityMembersTable)
      .where(and(eq(communityMembersTable.communityId, id), eq(communityMembersTable.userId, userId)))
      .limit(1);

    const isOwner = community.creatorId === userId;
    const myRoleObj = membership?.roleId != null ? roles.find((r) => r.id === membership.roleId) : undefined;
    const myPermissions = isOwner
      ? [...ADMIN_ROLE_PERMISSIONS]
      : sanitizePermissions(myRoleObj?.permissions);

    res.json({
      ...community,
      channels,
      roles,
      isMember: !!membership || isOwner,
      isOwner,
      myRole: membership?.role ?? null,
      myRoleId: membership?.roleId ?? null,
      myPermissions,
      ratingAvg: community.ratingCount > 0 ? community.ratingSum / community.ratingCount : 0,
    });
  } catch (err) {
    console.error("GET /community/:id error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Join community ────────────────────────────────────────────────────────────
router.post("/community/:id/join", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db
      .select()
      .from(communityMembersTable)
      .where(and(eq(communityMembersTable.communityId, id), eq(communityMembersTable.userId, userId)))
      .limit(1);
    if (existing) { res.json({ ok: true, alreadyMember: true }); return; }

    // Banned users cannot rejoin.
    const [ban] = await db
      .select({ id: communityBansTable.id })
      .from(communityBansTable)
      .where(and(eq(communityBansTable.communityId, id), eq(communityBansTable.userId, userId)))
      .limit(1);
    if (ban) { res.status(403).json({ error: "Sei stato bannato da questa community" }); return; }

    const [defaultRole] = await db
      .select({ id: communityRolesTable.id })
      .from(communityRolesTable)
      .where(and(eq(communityRolesTable.communityId, id), eq(communityRolesTable.isDefault, true)))
      .limit(1);

    await db.insert(communityMembersTable).values({ communityId: id, userId, role: "member", roleId: defaultRole?.id ?? null });
    await db
      .update(communitiesTable)
      .set({ memberCount: sql`${communitiesTable.memberCount} + 1` })
      .where(eq(communitiesTable.id, id));

    res.json({ ok: true });
  } catch (err) {
    console.error("POST /community/:id/join error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Leave community ───────────────────────────────────────────────────────────
router.delete("/community/:id/leave", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const id = parseInt(req.params.id);
    await db
      .delete(communityMembersTable)
      .where(and(eq(communityMembersTable.communityId, id), eq(communityMembersTable.userId, userId)));
    await db
      .update(communitiesTable)
      .set({ memberCount: sql`GREATEST(${communitiesTable.memberCount} - 1, 0)` })
      .where(eq(communitiesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /community/:id/leave error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Create channel ────────────────────────────────────────────────────────────
router.post("/community/:id/channels", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const communityId = parseInt(req.params.id);
    const { name, type } = req.body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ error: "Nome canale richiesto" });
      return;
    }

    if (!(await requirePermission(req, res, communityId, "channels.manage"))) return;

    const existing = await db
      .select({ position: communityChannelsTable.position })
      .from(communityChannelsTable)
      .where(eq(communityChannelsTable.communityId, communityId))
      .orderBy(desc(communityChannelsTable.position))
      .limit(1);

    const position = existing.length > 0 ? existing[0].position + 1 : 0;

    const [channel] = await db
      .insert(communityChannelsTable)
      .values({ communityId, name: name.trim().slice(0, 40), type: type === "voice" ? "voice" : "text", position })
      .returning();

    res.status(201).json(channel);
  } catch (err) {
    console.error("POST /community/:id/channels error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Delete channel ────────────────────────────────────────────────────────────
router.delete("/community/channels/:channelId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const channelId = parseInt(req.params.channelId);
    const [channel] = await db.select().from(communityChannelsTable).where(eq(communityChannelsTable.id, channelId)).limit(1);
    if (!channel) { res.status(404).json({ error: "Canale non trovato" }); return; }

    if (!(await requirePermission(req, res, channel.communityId, "channels.manage"))) return;

    const orphanFiles = await deleteChannelDeep(channelId);
    unlinkCommunityFiles(orphanFiles);
    await recordModerationAction({ communityId: channel.communityId, actorUserId: userId, action: "channel.delete", targetId: channelId, metadata: { name: channel.name } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Get channel messages ──────────────────────────────────────────────────────
router.get("/community/channels/:channelId/messages", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const channelId = parseInt(req.params.channelId);
    const cursorParam = req.query.cursor as string | undefined;
    const cursor = cursorParam ? parseInt(cursorParam) : undefined;
    const limit = 60;

    const [channel] = await db.select().from(communityChannelsTable).where(eq(communityChannelsTable.id, channelId)).limit(1);
    if (!channel) { res.status(404).json({ error: "Canale non trovato" }); return; }

    const [membership] = await db
      .select()
      .from(communityMembersTable)
      .where(and(eq(communityMembersTable.communityId, channel.communityId), eq(communityMembersTable.userId, userId)))
      .limit(1);
    if (!membership) { res.status(403).json({ error: "Non sei membro di questa community" }); return; }

    const conditions: SQL[] = [eq(communityMessagesTable.channelId, channelId)];
    if (cursor && !isNaN(cursor)) conditions.push(lt(communityMessagesTable.id, cursor));

    const messages = await db
      .select()
      .from(communityMessagesTable)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(communityMessagesTable.id))
      .limit(limit);

    res.json({ messages: messages.reverse(), nextCursor: messages.length === limit ? messages[0]?.id : null });
  } catch (err) {
    console.error("GET /community/channels/:channelId/messages error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Send channel message ──────────────────────────────────────────────────────
router.post("/community/channels/:channelId/messages", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const channelId = parseInt(req.params.channelId);
    const { content, imageUrl } = req.body;
    if (!content && !imageUrl) { res.status(400).json({ error: "Contenuto richiesto" }); return; }
    if (content && content.length > 2000) { res.status(400).json({ error: "Messaggio troppo lungo" }); return; }

    const [channel] = await db.select().from(communityChannelsTable).where(eq(communityChannelsTable.id, channelId)).limit(1);
    if (!channel || channel.type !== "text") { res.status(400).json({ error: "Canale non valido" }); return; }

    const [membership] = await db
      .select()
      .from(communityMembersTable)
      .where(and(eq(communityMembersTable.communityId, channel.communityId), eq(communityMembersTable.userId, userId)))
      .limit(1);
    if (!membership) { res.status(403).json({ error: "Non sei membro" }); return; }

    // Muted members cannot post.
    const [mute] = await db
      .select({ until: communityMutesTable.until })
      .from(communityMutesTable)
      .where(and(eq(communityMutesTable.communityId, channel.communityId), eq(communityMutesTable.userId, userId)))
      .limit(1);
    if (isMuteActive(mute ? { until: mute.until ?? null } : null, new Date())) {
      res.status(403).json({ error: "Sei stato silenziato in questa community" });
      return;
    }

    const [profile] = await db
      .select({ name: profileTable.name, avatarUrl: profileTable.avatarUrl })
      .from(profileTable)
      .where(eq(profileTable.userId, userId))
      .limit(1);

    const [message] = await db
      .insert(communityMessagesTable)
      .values({
        channelId,
        userId,
        userName: profile?.name ?? "Trader",
        avatarUrl: profile?.avatarUrl ?? null,
        content: content?.trim() ?? "",
        imageUrl: imageUrl ?? null,
      })
      .returning();

    // Push to subscribed channel members so their UI refreshes without polling.
    // Best-effort: a bus failure must never fail the write that already happened.
    try {
      emitSocialEvent({ type: "community:message", channelId });
    } catch (emitErr) {
      console.warn("[community] social emit failed:", emitErr);
    }

    res.status(201).json(message);
  } catch (err) {
    console.error("POST /community/channels/:channelId/messages error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Voice presence: join ─────────────────────────────────────────────────────
router.post("/community/voice/:channelId/join", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const channelId = parseInt(req.params.channelId);

    const [channel] = await db.select().from(communityChannelsTable).where(eq(communityChannelsTable.id, channelId)).limit(1);
    if (!channel || channel.type !== "voice") { res.status(400).json({ error: "Non è un canale vocale" }); return; }

    const [membership] = await db
      .select()
      .from(communityMembersTable)
      .where(and(eq(communityMembersTable.communityId, channel.communityId), eq(communityMembersTable.userId, userId)))
      .limit(1);
    if (!membership) { res.status(403).json({ error: "Non sei membro" }); return; }

    const [profile] = await db
      .select({ name: profileTable.name, avatarUrl: profileTable.avatarUrl })
      .from(profileTable)
      .where(eq(profileTable.userId, userId))
      .limit(1);

    await db
      .insert(voicePresenceTable)
      .values({
        channelId,
        userId,
        userName: profile?.name ?? "Trader",
        avatarUrl: profile?.avatarUrl ?? null,
      })
      .onConflictDoUpdate({
        target: [voicePresenceTable.channelId, voicePresenceTable.userId],
        set: { lastPing: sql`now()`, userName: profile?.name ?? "Trader", avatarUrl: profile?.avatarUrl ?? null },
      });

    res.json({ ok: true });
  } catch (err) {
    console.error("POST /community/voice/:channelId/join error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Voice presence: ping (keepalive) ────────────────────────────────────────
router.post("/community/voice/:channelId/ping", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const channelId = parseInt(req.params.channelId);
    await db
      .update(voicePresenceTable)
      .set({ lastPing: sql`now()` })
      .where(and(eq(voicePresenceTable.channelId, channelId), eq(voicePresenceTable.userId, userId)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Voice presence: leave ────────────────────────────────────────────────────
router.delete("/community/voice/:channelId/leave", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const channelId = parseInt(req.params.channelId);
    await db
      .delete(voicePresenceTable)
      .where(and(eq(voicePresenceTable.channelId, channelId), eq(voicePresenceTable.userId, userId)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Voice presence: list participants ───────────────────────────────────────
router.get("/community/voice/:channelId/presence", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const channelId = parseInt(req.params.channelId);
    const cutoff = new Date(Date.now() - 15_000);
    const participants = await db
      .select()
      .from(voicePresenceTable)
      .where(and(
        eq(voicePresenceTable.channelId, channelId),
        sql`${voicePresenceTable.lastPing} > ${cutoff.toISOString()}`
      ))
      .orderBy(asc(voicePresenceTable.joinedAt));
    res.json(participants);
  } catch (err) {
    console.error("GET /community/voice/:channelId/presence error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Voice signaling (WebRTC SDP/ICE exchange, Postgres-backed) ───────────────
// DB-backed (see services/callSignaling) so signaling survives across the
// serverless instances that a sender and a polling recipient may land on.

router.post("/community/voice/:channelId/signal", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const { to, type, data } = req.body;
    if (!to || !type) { res.status(400).json({ error: "Parametri mancanti" }); return; }
    await pushSignal({ scope: `voice:${req.params.channelId}`, to, from: userId, type, data: data ?? "" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/community/voice/:channelId/signals", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const signals = await consumeSignals(`voice:${req.params.channelId}`, userId);
    res.json({ signals });
  } catch (err) {
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Upload file to channel ───────────────────────────────────────────────────
router.post("/community/channels/:channelId/files", (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return; }
  communityFileUpload.single("file")(req, res, async (err) => {
    if (err) { res.status(400).json({ error: err.message ?? "Upload fallito" }); return; }
    if (!req.file) { res.status(400).json({ error: "Nessun file caricato" }); return; }
    try {
      const channelId = parseInt(String(req.params.channelId));
      const [channel] = await db.select().from(communityChannelsTable).where(eq(communityChannelsTable.id, channelId)).limit(1);
      if (!channel || channel.type !== "text") { res.status(400).json({ error: "Canale non valido" }); return; }

      const [membership] = await db
        .select()
        .from(communityMembersTable)
        .where(and(eq(communityMembersTable.communityId, channel.communityId), eq(communityMembersTable.userId, userId)))
        .limit(1);
      if (!membership) { res.status(403).json({ error: "Non sei membro" }); return; }

      const ctx = await getMemberContext(channel.communityId, userId);
      const canManageFiles = hasPermission(ctx, "files.manage");
      const downloadable = canManageFiles
        ? (req.body.downloadable !== "false" && req.body.downloadable !== false)
        : true;

      const [profile] = await db.select({ name: profileTable.name, avatarUrl: profileTable.avatarUrl }).from(profileTable).where(eq(profileTable.userId, userId)).limit(1);
      const fileUrl = `/api/uploads/community-files/${req.file.filename}`;
      const [fileRow] = await db.insert(communityFilesTable).values({
        channelId,
        communityId: channel.communityId,
        userId,
        userName: profile?.name ?? "Trader",
        avatarUrl: profile?.avatarUrl ?? null,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        fileUrl,
        downloadable,
      }).returning();
      res.status(201).json(fileRow);
    } catch (e) {
      console.error("POST /community/channels/:channelId/files error:", e);
      res.status(500).json({ error: "Errore interno" });
    }
  });
});

// ─── List files in channel ────────────────────────────────────────────────────
router.get("/community/channels/:channelId/files", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const channelId = parseInt(req.params.channelId);
    const [channel] = await db.select().from(communityChannelsTable).where(eq(communityChannelsTable.id, channelId)).limit(1);
    if (!channel) { res.status(404).json({ error: "Canale non trovato" }); return; }

    const [membership] = await db
      .select()
      .from(communityMembersTable)
      .where(and(eq(communityMembersTable.communityId, channel.communityId), eq(communityMembersTable.userId, userId)))
      .limit(1);
    if (!membership) { res.status(403).json({ error: "Non sei membro" }); return; }

    const files = await db
      .select()
      .from(communityFilesTable)
      .where(eq(communityFilesTable.channelId, channelId))
      .orderBy(desc(communityFilesTable.createdAt))
      .limit(50);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Toggle downloadable (owner/admin only) ───────────────────────────────────
router.patch("/community/files/:fileId/downloadable", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const fileId = parseInt(req.params.fileId);
    const [file] = await db.select().from(communityFilesTable).where(eq(communityFilesTable.id, fileId)).limit(1);
    if (!file) { res.status(404).json({ error: "File non trovato" }); return; }

    if (!(await requirePermission(req, res, file.communityId, "files.manage"))) return;

    const { downloadable } = req.body;
    const [updated] = await db
      .update(communityFilesTable)
      .set({ downloadable: !!downloadable })
      .where(eq(communityFilesTable.id, fileId))
      .returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Delete file ──────────────────────────────────────────────────────────────
router.delete("/community/files/:fileId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const fileId = parseInt(req.params.fileId);
    const [file] = await db.select().from(communityFilesTable).where(eq(communityFilesTable.id, fileId)).limit(1);
    if (!file) { res.status(404).json({ error: "File non trovato" }); return; }

    const ctx = await getMemberContext(file.communityId, userId);
    if (file.userId !== userId && !hasPermission(ctx, "files.manage")) {
      res.status(403).json({ error: "Non autorizzato" }); return;
    }

    const filePath = path.join(COMMUNITY_FILES_DIR, path.basename(file.fileUrl));
    fs.unlink(filePath, () => {});
    await db.delete(communityFilesTable).where(eq(communityFilesTable.id, fileId));
    // Deleting your own file isn't moderation; deleting another member's (via
    // files.manage) is, and gets audited.
    if (file.userId !== userId) {
      await recordModerationAction({ communityId: file.communityId, actorUserId: userId, action: "file.delete", targetUserId: file.userId, targetId: fileId, metadata: { channelId: file.channelId } });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Serve community files (with downloadable check) ─────────────────────────
router.get("/uploads/community-files/:filename", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Non autorizzato" }); return; }
  try {
    const filename = req.params.filename;
    const [file] = await db
      .select()
      .from(communityFilesTable)
      .where(eq(communityFilesTable.fileUrl, `/api/uploads/community-files/${filename}`))
      .limit(1);

    if (!file) { res.status(404).json({ error: "File non trovato" }); return; }

    const ctx = await getMemberContext(file.communityId, userId);
    if (!ctx.isMember && !ctx.isOwner) { res.status(403).json({ error: "Non sei membro della community" }); return; }

    const filePath = path.join(COMMUNITY_FILES_DIR, filename);
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: "File non trovato sul server" }); return; }

    const canDownload = file.downloadable || hasPermission(ctx, "files.manage");
    if (canDownload) {
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.fileName)}"`);
    } else {
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.fileName)}"`);
    }
    res.setHeader("Content-Type", file.mimeType);
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Delete community (owner only) ────────────────────────────────────────────
router.delete("/community/:id", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const id = parseInt(req.params.id);
    const [community] = await db.select().from(communitiesTable).where(eq(communitiesTable.id, id)).limit(1);
    if (!community) { res.status(404).json({ error: "Non trovata" }); return; }
    if (community.creatorId !== userId) { res.status(403).json({ error: "Solo il creatore può eliminare la community" }); return; }

    const orphanFiles = await deleteCommunityDeep(id);
    unlinkCommunityFiles(orphanFiles);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Errore interno" });
  }
});

export default router;
