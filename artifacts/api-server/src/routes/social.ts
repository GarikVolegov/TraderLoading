import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, followsTable, postsTable, postLikesTable, postCommentsTable, profileTable, userPublicKeysTable, chatFileAccessTable } from "@workspace/db";
import { eq, and, or, desc, asc, sql, inArray, gt, isNull, lt } from "drizzle-orm";
import { areMutualFollowers } from "./chat.js";
import { getUserNotificationLanguage, sendPushToUser } from "./push.js";
import { getServerNotificationCopy } from "../services/notifications/notificationCopy.js";
import { consumeSignals, pushSignal } from "../services/callSignaling.js";
import { resolveUploadPath } from "../lib/uploads.js";
import { parseFeedPagination, nextFeedCursor } from "../services/feedPagination.js";

const POST_IMAGES_DIR = resolveUploadPath("post-images");
const CHAT_FILES_DIR = resolveUploadPath("chat-files");
if (!fs.existsSync(POST_IMAGES_DIR)) fs.mkdirSync(POST_IMAGES_DIR, { recursive: true });
if (!fs.existsSync(CHAT_FILES_DIR)) fs.mkdirSync(CHAT_FILES_DIR, { recursive: true });

const postImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, POST_IMAGES_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `post-${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const postImageUpload = multer({
  storage: postImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_TYPES.has(file.mimetype) && ALLOWED_EXT.has(ext)) cb(null, true);
    else cb(new Error("Solo immagini JPG, PNG, WebP e GIF"));
  },
});

const BLOCKED_CHAT_FILE_EXT = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".scr",
  ".ps1",
  ".sh",
  ".js",
  ".mjs",
  ".html",
  ".htm",
  ".svg",
]);

const chatFileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CHAT_FILES_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `chat-${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const chatFileUpload = multer({
  storage: chatFileStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_CHAT_FILE_EXT.has(ext)) cb(new Error("Tipo file non consentito"));
    else cb(null, true);
  },
});

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return null;
  }
  return userId;
}

async function isMutualFollow(userA: string, userB: string): Promise<boolean> {
  const [aFollowsB, bFollowsA] = await Promise.all([
    db.select({ id: followsTable.id }).from(followsTable)
      .where(and(eq(followsTable.followerId, userA), eq(followsTable.followingId, userB))).limit(1),
    db.select({ id: followsTable.id }).from(followsTable)
      .where(and(eq(followsTable.followerId, userB), eq(followsTable.followingId, userA))).limit(1),
  ]);
  return aFollowsB.length > 0 && bFollowsA.length > 0;
}

async function getProfile(userId: string) {
  const [profile] = await db
    .select({ name: profileTable.name, avatarUrl: profileTable.avatarUrl })
    .from(profileTable)
    .where(eq(profileTable.userId, userId))
    .limit(1);
  return profile;
}

async function sendSocialPush(targetUserId: string | null, actorName: string, body: string, tag: string) {
  if (!targetUserId) return;
  await sendPushToUser(
    targetUserId,
    {
      title: actorName,
      body,
      tag,
      data: { url: "/chat" },
    },
    "social",
  ).catch(() => {});
}

router.post("/social/follow/:targetId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const { targetId } = req.params;
  if (targetId === userId) { res.status(400).json({ error: "Non puoi seguire te stesso" }); return; }
  try {
    const existing = await db.select().from(followsTable)
      .where(and(eq(followsTable.followerId, userId), eq(followsTable.followingId, targetId))).limit(1);
    if (existing.length > 0) { res.status(409).json({ error: "Già seguito" }); return; }
    const [row] = await db.insert(followsTable).values({ followerId: userId, followingId: targetId }).returning();
    res.status(201).json(row);
    const profile = await getProfile(userId);
    const actorName = profile?.name ?? "Trader";
    const copy = getServerNotificationCopy(await getUserNotificationLanguage(targetId));
    await sendSocialPush(targetId, actorName, copy.socialFollowBody(actorName), `follow-${userId}`);
  } catch (err) {
    console.error("follow error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.delete("/social/follow/:targetId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const { targetId } = req.params;
  try {
    await db.delete(followsTable).where(and(eq(followsTable.followerId, userId), eq(followsTable.followingId, targetId)));
    res.json({ success: true });
  } catch (err) {
    console.error("unfollow error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/social/follow-status/:targetId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const { targetId } = req.params;
  try {
    const [isFollowing, isMutual] = await Promise.all([
      db.select({ id: followsTable.id }).from(followsTable)
        .where(and(eq(followsTable.followerId, userId), eq(followsTable.followingId, targetId))).limit(1),
      isMutualFollow(userId, targetId),
    ]);
    res.json({ isFollowing: isFollowing.length > 0, isMutual });
  } catch (err) {
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/social/followers", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const rows = await db.select({ followerId: followsTable.followerId })
      .from(followsTable).where(eq(followsTable.followingId, userId));
    const ids = rows.map(r => r.followerId);
    if (ids.length === 0) { res.json([]); return; }
    const profiles = await db.select({ userId: profileTable.userId, name: profileTable.name, avatarUrl: profileTable.avatarUrl, level: profileTable.level, xp: profileTable.xp })
      .from(profileTable).where(inArray(profileTable.userId, ids));
    const mutuals = await Promise.all(profiles.map(async p => ({ ...p, isMutual: await isMutualFollow(userId, p.userId!) })));
    res.json(mutuals);
  } catch (err) {
    console.error("followers error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/social/following", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const rows = await db.select({ followingId: followsTable.followingId })
      .from(followsTable).where(eq(followsTable.followerId, userId));
    const ids = rows.map(r => r.followingId);
    if (ids.length === 0) { res.json([]); return; }
    const profiles = await db.select({ userId: profileTable.userId, name: profileTable.name, avatarUrl: profileTable.avatarUrl, level: profileTable.level, xp: profileTable.xp })
      .from(profileTable).where(inArray(profileTable.userId, ids));
    const mutuals = await Promise.all(profiles.map(async p => ({ ...p, isMutual: await isMutualFollow(userId, p.userId!) })));
    res.json(mutuals);
  } catch (err) {
    console.error("following error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/social/search", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const q = String(req.query.q || "").trim();
  if (q.length < 2) { res.json([]); return; }
  try {
    const results = await db.select({
      userId: profileTable.userId,
      name: profileTable.name,
      avatarUrl: profileTable.avatarUrl,
      level: profileTable.level,
      xp: profileTable.xp,
    }).from(profileTable)
      .where(and(sql`${profileTable.name} ILIKE ${`%${q}%`}`, sql`${profileTable.userId} IS NOT NULL`, sql`${profileTable.userId} != ${userId}`))
      .limit(20);
    const enriched = await Promise.all(results.map(async r => ({
      ...r,
      isFollowing: (await db.select().from(followsTable).where(and(eq(followsTable.followerId, userId), eq(followsTable.followingId, r.userId!))).limit(1)).length > 0,
      isMutual: await isMutualFollow(userId, r.userId!),
    })));
    res.json(enriched);
  } catch (err) {
    console.error("search error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.post("/social/upload-image", (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return; }
  postImageUpload.single("image")(req, res, (err) => {
    if (err) { res.status(400).json({ error: err.message ?? "Upload fallito" }); return; }
    if (!req.file) { res.status(400).json({ error: "Nessun file caricato" }); return; }
    const imageUrl = `/api/uploads/post-images/${req.file.filename}`;
    res.json({ imageUrl });
  });
});

router.post("/social/upload-file", (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return; }
  chatFileUpload.single("file")(req, res, async (err) => {
    if (err) { res.status(400).json({ error: err.message ?? "Upload fallito" }); return; }
    if (!req.file) { res.status(400).json({ error: "Nessun file caricato" }); return; }
    try {
      // Record who may later download this DM attachment. Only mutual followers
      // can DM, so the same gate applies here; the two participants are the only
      // ones the authenticated serving route will let read the file.
      const toUserId = typeof req.body?.toUserId === "string" ? req.body.toUserId : "";
      if (!toUserId || !(await areMutualFollowers(userId, toUserId))) {
        res.status(400).json({ error: "Destinatario non valido" }); return;
      }
      await db
        .insert(chatFileAccessTable)
        .values({ fileKey: req.file.filename, ownerUserId: userId, peerUserId: toUserId })
        .onConflictDoNothing({ target: chatFileAccessTable.fileKey });
      res.json({
        fileUrl: `/api/uploads/chat-files/${req.file.filename}`,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype || "application/octet-stream",
        size: req.file.size,
      });
    } catch {
      res.status(500).json({ error: "Errore interno" });
    }
  });
});

// Serve a DM file attachment only to the two conversation participants. These
// files are no longer exposed by the public /api/uploads static handler (see
// lib/security.ts): access is gated on chat_file_access. Not-found and
// not-a-participant both return 404 (no existence signal).
router.get("/uploads/chat-files/:filename", async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return; }
  try {
    const filename = String(req.params.filename);
    const [row] = await db
      .select()
      .from(chatFileAccessTable)
      .where(eq(chatFileAccessTable.fileKey, filename))
      .limit(1);
    if (!row || (row.ownerUserId !== userId && row.peerUserId !== userId)) {
      res.status(404).json({ error: "File non trovato" }); return;
    }
    const filePath = path.join(CHAT_FILES_DIR, filename);
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: "File non trovato" }); return; }
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.sendFile(filePath);
  } catch {
    res.status(500).json({ error: "Errore interno" });
  }
});

router.post("/social/posts", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const { content, imageUrl, isStory } = req.body;
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      res.status(400).json({ error: "Contenuto vuoto" });
      return;
    }
    if (content.trim().length > 2000) {
      res.status(400).json({ error: "Contenuto troppo lungo (max 2000 caratteri)" });
      return;
    }
    const profile = await getProfile(userId);
    const expiresAt = isStory ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;
    const [post] = await db.insert(postsTable).values({
      userId,
      userName: profile?.name ?? "Trader",
      avatarUrl: profile?.avatarUrl ?? null,
      content: content.trim(),
      imageUrl: imageUrl ?? null,
      isStory: !!isStory,
      expiresAt,
    }).returning();
    res.status(201).json(post);
  } catch (err) {
    console.error("post create error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.delete("/social/posts/:id", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
    const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id)).limit(1);
    if (!post) { res.status(404).json({ error: "Post non trovato" }); return; }
    if (post.userId !== userId) { res.status(403).json({ error: "Non autorizzato" }); return; }
    await db.delete(postsTable).where(eq(postsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error("post delete error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.post("/social/posts/:id/like", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
    const existing = await db.select().from(postLikesTable)
      .where(and(eq(postLikesTable.postId, id), eq(postLikesTable.userId, userId))).limit(1);
    if (existing.length > 0) {
      await db.delete(postLikesTable).where(and(eq(postLikesTable.postId, id), eq(postLikesTable.userId, userId)));
      await db.update(postsTable).set({ likesCount: sql`GREATEST(0, ${postsTable.likesCount} - 1)` }).where(eq(postsTable.id, id));
      res.json({ liked: false });
    } else {
      await db.insert(postLikesTable).values({ postId: id, userId });
      await db.update(postsTable).set({ likesCount: sql`${postsTable.likesCount} + 1` }).where(eq(postsTable.id, id));
      res.json({ liked: true });
      const [post] = await db.select({ userId: postsTable.userId }).from(postsTable).where(eq(postsTable.id, id)).limit(1);
      if (post?.userId && post.userId !== userId) {
        const profile = await getProfile(userId);
        const actorName = profile?.name ?? "Trader";
        const copy = getServerNotificationCopy(await getUserNotificationLanguage(post.userId));
        await sendSocialPush(post.userId, actorName, copy.socialLikeBody(actorName), `post-like-${id}-${userId}`);
      }
    }
  } catch (err) {
    console.error("like error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/social/feed", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const followingRows = await db.select({ followingId: followsTable.followingId })
      .from(followsTable).where(eq(followsTable.followerId, userId));
    const followingIds = [...followingRows.map(r => r.followingId), userId];

    const now = new Date();
    // Keyset pagination over post id (desc): the newest page has no cursor, "load
    // older" passes the last id it saw as `cursor` so the feed scrolls past 50.
    const { limit, cursor } = parseFeedPagination(req.query);
    const posts = await db.select().from(postsTable)
      .where(and(
        inArray(postsTable.userId, followingIds),
        eq(postsTable.isStory, false),
        or(isNull(postsTable.expiresAt), gt(postsTable.expiresAt, now)),
        ...(cursor !== null ? [lt(postsTable.id, cursor)] : []),
      ))
      .orderBy(desc(postsTable.id))
      .limit(limit);

    const likedRows = posts.length > 0
      ? await db.select({ postId: postLikesTable.postId }).from(postLikesTable)
          .where(and(inArray(postLikesTable.postId, posts.map(p => p.id)), eq(postLikesTable.userId, userId)))
      : [];
    const likedSet = new Set(likedRows.map(r => r.postId));

    const items = posts.map(p => ({ ...p, likedByMe: likedSet.has(p.id), isOwnPost: p.userId === userId }));
    res.json({ items, nextCursor: nextFeedCursor(items, limit) });
  } catch (err) {
    console.error("feed error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/social/stories", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const followingRows = await db.select({ followingId: followsTable.followingId })
      .from(followsTable).where(eq(followsTable.followerId, userId));
    const followingIds = [...followingRows.map(r => r.followingId), userId];

    const now = new Date();
    const stories = await db.select().from(postsTable)
      .where(and(
        inArray(postsTable.userId, followingIds),
        eq(postsTable.isStory, true),
        gt(postsTable.expiresAt, now)
      ))
      .orderBy(desc(postsTable.createdAt))
      .limit(50);

    const grouped: Record<string, typeof stories> = {};
    for (const s of stories) {
      if (!grouped[s.userId]) grouped[s.userId] = [];
      grouped[s.userId].push(s);
    }

    const result = Object.entries(grouped).map(([uid, userStories]) => ({
      userId: uid,
      userName: userStories[0].userName,
      avatarUrl: userStories[0].avatarUrl,
      stories: userStories,
      isOwn: uid === userId,
    }));

    const sorted = result.sort((a, b) => (a.isOwn ? -1 : 1));
    res.json(sorted);
  } catch (err) {
    console.error("stories error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/social/profile/:targetUserId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const { targetUserId } = req.params;
  try {
    const [profile] = await db.select().from(profileTable)
      .where(eq(profileTable.userId, targetUserId)).limit(1);
    if (!profile) { res.status(404).json({ error: "Profilo non trovato" }); return; }

    const [posts, followersCount, followingCount, isFollowing, mutual] = await Promise.all([
      db.select().from(postsTable)
        .where(and(eq(postsTable.userId, targetUserId), eq(postsTable.isStory, false)))
        .orderBy(desc(postsTable.createdAt)).limit(30),
      db.select({ count: sql<number>`count(*)::int` }).from(followsTable).where(eq(followsTable.followingId, targetUserId)),
      db.select({ count: sql<number>`count(*)::int` }).from(followsTable).where(eq(followsTable.followerId, targetUserId)),
      db.select().from(followsTable).where(and(eq(followsTable.followerId, userId), eq(followsTable.followingId, targetUserId))).limit(1),
      isMutualFollow(userId, targetUserId),
    ]);

    res.json({
      profile,
      posts,
      followersCount: followersCount[0]?.count ?? 0,
      followingCount: followingCount[0]?.count ?? 0,
      isFollowing: isFollowing.length > 0,
      isMutual: mutual,
      isOwnProfile: targetUserId === userId,
    });
  } catch (err) {
    console.error("profile error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/social/mutual-followers", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const following = await db.select({ followingId: followsTable.followingId })
      .from(followsTable).where(eq(followsTable.followerId, userId));
    const followingIds = following.map(r => r.followingId);
    if (followingIds.length === 0) { res.json([]); return; }

    // Mutuals = people I follow who also follow me back. One set query, not one
    // per followed id (was N round-trips for a user following N people).
    const backFollows = await db.select({ followerId: followsTable.followerId })
      .from(followsTable)
      .where(and(inArray(followsTable.followerId, followingIds), eq(followsTable.followingId, userId)));
    const mutuals = backFollows.map(r => r.followerId);
    if (mutuals.length === 0) { res.json([]); return; }

    const profiles = await db.select({
      userId: profileTable.userId,
      name: profileTable.name,
      avatarUrl: profileTable.avatarUrl,
    }).from(profileTable).where(inArray(profileTable.userId, mutuals));

    // Which mutuals have an E2EE public key — one set query, not one per profile.
    const keyRows = await db.select({ userId: userPublicKeysTable.userId })
      .from(userPublicKeysTable)
      .where(inArray(userPublicKeysTable.userId, mutuals));
    const withKey = new Set(keyRows.map(r => r.userId));

    res.json(profiles.map(p => ({ ...p, hasKey: p.userId ? withKey.has(p.userId) : false })));
  } catch (err) {
    console.error("mutual-followers error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Voice Upload ─────────────────────────────────────────────────────────────
const VOICE_DIR = resolveUploadPath("voice");
if (!fs.existsSync(VOICE_DIR)) fs.mkdirSync(VOICE_DIR, { recursive: true });

const voiceStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, VOICE_DIR),
  filename: (_req, _file, cb) => cb(null, `voice-${Date.now()}-${Math.round(Math.random() * 1e9)}.webm`),
});
const voiceUpload = multer({ storage: voiceStorage, limits: { fileSize: 20 * 1024 * 1024 } });

router.post("/social/upload-voice", (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return; }
  voiceUpload.single("audio")(req, res, (err) => {
    if (err || !req.file) { res.status(400).json({ error: "Upload fallito" }); return; }
    res.json({ audioUrl: `/api/uploads/voice/${req.file.filename}` });
  });
});

// ─── Post Comments ────────────────────────────────────────────────────────────

router.get("/social/posts/:id/comments", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
    const comments = await db
      .select()
      .from(postCommentsTable)
      .where(eq(postCommentsTable.postId, id))
      .orderBy(asc(postCommentsTable.createdAt))
      .limit(100);
    res.json(comments);
  } catch (err) {
    console.error("GET comments error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.post("/social/posts/:id/comments", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
    const { content } = req.body;
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      res.status(400).json({ error: "Contenuto vuoto" }); return;
    }
    if (content.trim().length > 1000) {
      res.status(400).json({ error: "Commento troppo lungo (max 1000 caratteri)" }); return;
    }
    const [post] = await db.select({ id: postsTable.id }).from(postsTable).where(eq(postsTable.id, id)).limit(1);
    if (!post) { res.status(404).json({ error: "Post non trovato" }); return; }
    const profile = await getProfile(userId);
    const [comment] = await db.insert(postCommentsTable).values({
      postId: id,
      userId,
      userName: profile?.name ?? "Trader",
      avatarUrl: profile?.avatarUrl ?? null,
      content: content.trim(),
    }).returning();
    res.status(201).json(comment);
    const [postOwner] = await db.select({ userId: postsTable.userId }).from(postsTable).where(eq(postsTable.id, id)).limit(1);
    if (postOwner?.userId && postOwner.userId !== userId) {
      const actorName = profile?.name ?? "Trader";
      const copy = getServerNotificationCopy(await getUserNotificationLanguage(postOwner.userId));
      await sendSocialPush(postOwner.userId, actorName, copy.socialCommentBody(actorName), `post-comment-${id}-${userId}`);
    }
  } catch (err) {
    console.error("POST comment error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.delete("/social/posts/:postId/comments/:commentId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const commentId = parseInt(req.params.commentId);
    if (isNaN(commentId)) { res.status(400).json({ error: "ID non valido" }); return; }
    const [comment] = await db.select().from(postCommentsTable).where(eq(postCommentsTable.id, commentId)).limit(1);
    if (!comment) { res.status(404).json({ error: "Commento non trovato" }); return; }
    if (comment.userId !== userId) { res.status(403).json({ error: "Non autorizzato" }); return; }
    await db.delete(postCommentsTable).where(eq(postCommentsTable.id, commentId));
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE comment error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Story Replies ────────────────────────────────────────────────────────────
interface StoryReply { from: string; type: string; content: string; createdAt: string; }
const storyReplies = new Map<string, StoryReply[]>();

router.post("/social/story-reply/:storyId", (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Non autorizzato" }); return; }
  const { content, type = "text" } = req.body;
  if (!content?.trim()) { res.status(400).json({ error: "Contenuto mancante" }); return; }
  const storyId = String(req.params.storyId);
  const arr = storyReplies.get(storyId) ?? [];
  arr.push({ from: userId, type, content: content.trim(), createdAt: new Date().toISOString() });
  storyReplies.set(storyId, arr);
  res.json({ ok: true });
});

// ─── WebRTC Signaling (HTTP polling, Postgres-backed) ────────────────────────
// Stored in the DB so the sender and the polling recipient can be served by
// different serverless instances and still exchange offers/answers/ICE.

// WebRTC signaling allowlist + payload cap (audit 0.4): only these SDP/ICE
// message types are relayed, and `data` is bounded so the channel can't be
// abused as a covert bulk transport.
const CALL_SIGNAL_TYPES = new Set(["offer", "answer", "ice", "hangup"]);
const MAX_SIGNAL_DATA = 64 * 1024; // SDP/ICE payloads are a few KB at most

router.post("/social/calls/signal", async (req: Request, res: Response) => {
  const from = req.user?.id;
  if (!from) { res.status(401).json({ error: "Non autorizzato" }); return; }
  const { to, type, data, callId } = req.body;
  if (!to || typeof to !== "string" || !type) { res.status(400).json({ error: "Parametri mancanti" }); return; }
  if (!CALL_SIGNAL_TYPES.has(type)) { res.status(400).json({ error: "Tipo segnale non valido" }); return; }
  const payload = data ?? "";
  if (typeof payload !== "string" || payload.length > MAX_SIGNAL_DATA) {
    res.status(413).json({ error: "Payload segnale troppo grande" }); return;
  }
  // Only mutual followers may signal each other — the same gate DMs use — so
  // calls can't spam arbitrary users or open a covert channel to a non-friend.
  if (from === to || !(await areMutualFollowers(from, to))) {
    res.status(403).json({ error: "Destinatario non consentito" }); return;
  }
  const safeCallId = typeof callId === "string" && callId.length <= 128 ? callId : `call-${Date.now()}`;
  try {
    await pushSignal({ scope: "call", to, from, type, data: payload, callId: safeCallId });
    res.json({ ok: true });
  } catch (err) {
    console.error("social/calls/signal error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/social/calls/signals", async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Non autorizzato" }); return; }
  try {
    const signals = await consumeSignals("call", userId);
    res.json({ signals });
  } catch (err) {
    console.error("social/calls/signals error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

export default router;
