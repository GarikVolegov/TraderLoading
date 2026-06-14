import { Router, type IRouter, type Request, type Response } from "express";
import { db, chatMessagesTable, userPublicKeysTable, userE2eeKeyBackupsTable, friendshipsTable, globalChatMessagesTable, profileTable, followsTable } from "@workspace/db";
import { eq, or, and, desc, sql, lt } from "drizzle-orm";
import { getUserNotificationLanguage, sendPushToUser } from "./push.js";
import { getServerNotificationCopy } from "../services/notifications/notificationCopy.js";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return null;
  }
  return userId;
}

async function areMutualFollowers(userId: string, friendId: string): Promise<boolean> {
  const [aFollowsB, bFollowsA] = await Promise.all([
    db.select({ id: followsTable.id }).from(followsTable)
      .where(and(eq(followsTable.followerId, userId), eq(followsTable.followingId, friendId))).limit(1),
    db.select({ id: followsTable.id }).from(followsTable)
      .where(and(eq(followsTable.followerId, friendId), eq(followsTable.followingId, userId))).limit(1),
  ]);
  if (aFollowsB.length > 0 && bFollowsA.length > 0) return true;
  const legacy = await db
    .select({ id: friendshipsTable.id })
    .from(friendshipsTable)
    .where(
      and(
        or(
          and(eq(friendshipsTable.userId, userId), eq(friendshipsTable.friendId, friendId)),
          and(eq(friendshipsTable.userId, friendId), eq(friendshipsTable.friendId, userId))
        ),
        eq(friendshipsTable.status, "accepted")
      )
    )
    .limit(1);
  return legacy.length > 0;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function isValidAccountKeyBackupBody(body: unknown): body is {
  publicKeyJwk: Record<string, unknown>;
  privateKeyJwk: Record<string, unknown>;
} {
  if (!isJsonObject(body)) return false;
  return isJsonObject(body.publicKeyJwk) && isJsonObject(body.privateKeyJwk);
}

export function serializeAccountKeyBackup(
  userId: string,
  backup: { publicKeyJwk: string; privateKeyJwk: string } | null,
) {
  if (!backup) {
    return {
      userId,
      hasBackup: false,
      publicKeyJwk: null,
      privateKeyJwk: null,
    };
  }

  return {
    userId,
    hasBackup: true,
    publicKeyJwk: JSON.parse(backup.publicKeyJwk),
    privateKeyJwk: JSON.parse(backup.privateKeyJwk),
  };
}

async function upsertPublicKey(userId: string, publicKeyJwk: Record<string, unknown>) {
  const existing = await db
    .select()
    .from(userPublicKeysTable)
    .where(eq(userPublicKeysTable.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    return db
      .update(userPublicKeysTable)
      .set({ publicKeyJwk: JSON.stringify(publicKeyJwk) })
      .where(eq(userPublicKeysTable.userId, userId))
      .returning();
  }

  return db
    .insert(userPublicKeysTable)
    .values({ userId, publicKeyJwk: JSON.stringify(publicKeyJwk) })
    .returning();
}

router.get("/chat/key-backup", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const [backup] = await db
      .select({
        publicKeyJwk: userE2eeKeyBackupsTable.publicKeyJwk,
        privateKeyJwk: userE2eeKeyBackupsTable.privateKeyJwk,
      })
      .from(userE2eeKeyBackupsTable)
      .where(eq(userE2eeKeyBackupsTable.userId, userId))
      .limit(1);

    res.json(serializeAccountKeyBackup(userId, backup ?? null));
  } catch (err) {
    console.error("chat/key-backup GET error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.put("/chat/key-backup", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    if (!isValidAccountKeyBackupBody(req.body)) {
      res.status(400).json({ error: "publicKeyJwk e privateKeyJwk richiesti" });
      return;
    }

    const publicKeyJwk = JSON.stringify(req.body.publicKeyJwk);
    const privateKeyJwk = JSON.stringify(req.body.privateKeyJwk);

    const existing = await db
      .select()
      .from(userE2eeKeyBackupsTable)
      .where(eq(userE2eeKeyBackupsTable.userId, userId))
      .limit(1);

    let saved: { publicKeyJwk: string; privateKeyJwk: string };
    if (existing.length > 0) {
      const [updated] = await db
        .update(userE2eeKeyBackupsTable)
        .set({
          publicKeyJwk,
          privateKeyJwk,
          updatedAt: new Date(),
        })
        .where(eq(userE2eeKeyBackupsTable.userId, userId))
        .returning({
          publicKeyJwk: userE2eeKeyBackupsTable.publicKeyJwk,
          privateKeyJwk: userE2eeKeyBackupsTable.privateKeyJwk,
        });
      saved = updated;
    } else {
      const [created] = await db
        .insert(userE2eeKeyBackupsTable)
        .values({ userId, publicKeyJwk, privateKeyJwk })
        .returning({
          publicKeyJwk: userE2eeKeyBackupsTable.publicKeyJwk,
          privateKeyJwk: userE2eeKeyBackupsTable.privateKeyJwk,
        });
      saved = created;
    }

    await upsertPublicKey(userId, req.body.publicKeyJwk);
    res.json(serializeAccountKeyBackup(userId, saved));
  } catch (err) {
    console.error("chat/key-backup PUT error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.post("/chat/keys", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const { publicKeyJwk } = req.body;
    if (!publicKeyJwk || typeof publicKeyJwk !== "object") {
      res.status(400).json({ error: "publicKeyJwk richiesto" });
      return;
    }

    const existing = await db
      .select()
      .from(userPublicKeysTable)
      .where(eq(userPublicKeysTable.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(userPublicKeysTable)
        .set({ publicKeyJwk: JSON.stringify(publicKeyJwk) })
        .where(eq(userPublicKeysTable.userId, userId))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db
        .insert(userPublicKeysTable)
        .values({ userId, publicKeyJwk: JSON.stringify(publicKeyJwk) })
        .returning();
      res.json(created);
    }
  } catch (err) {
    console.error("chat/keys POST error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/chat/keys/:userId", async (req, res) => {
  const currentUserId = requireAuth(req, res);
  if (!currentUserId) return;

  try {
    const targetUserId = req.params.userId;

    const friends = await areMutualFollowers(currentUserId, targetUserId);
    if (!friends) {
      res.status(403).json({ error: "Non sei amico di questo utente" });
      return;
    }

    const [key] = await db
      .select()
      .from(userPublicKeysTable)
      .where(eq(userPublicKeysTable.userId, targetUserId))
      .limit(1);

    if (!key) {
      res.status(404).json({ error: "Chiave pubblica non trovata" });
      return;
    }

    res.json({ userId: key.userId, publicKeyJwk: JSON.parse(key.publicKeyJwk) });
  } catch (err) {
    console.error("chat/keys GET error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.post("/chat/messages", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const { receiverId, ciphertext, iv } = req.body;
    if (!receiverId || typeof receiverId !== "string" || !ciphertext || typeof ciphertext !== "string" || !iv || typeof iv !== "string") {
      res.status(400).json({ error: "Campi mancanti" });
      return;
    }

    const friends = await areMutualFollowers(userId, receiverId);
    if (!friends) {
      res.status(403).json({ error: "Non sei amico di questo utente" });
      return;
    }

    const [message] = await db
      .insert(chatMessagesTable)
      .values({ senderId: userId, receiverId, ciphertext, iv })
      .returning();

    res.status(201).json(message);

    const [senderProfile] = await db.select({ name: profileTable.name })
      .from(profileTable).where(eq(profileTable.userId, userId)).limit(1);
    const senderName = senderProfile?.name ?? "Qualcuno";
    const language = await getUserNotificationLanguage(receiverId);
    const copy = getServerNotificationCopy(language);

    sendPushToUser(
      receiverId,
      {
        title: senderName,
        body: copy.chatBody,
        tag: `chat-${userId}`,
        data: { url: `${process.env.REPLIT_DEV_DOMAIN || ""}/chat` },
      },
      "messages"
    ).catch(() => {});
  } catch (err) {
    console.error("chat/messages POST error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/chat/messages/:friendId", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const friendId = req.params.friendId;
    const cursorParam = req.query.cursor as string | undefined;
    const cursor = cursorParam ? parseInt(cursorParam) : undefined;
    const limit = 50;

    const conditions = [
      or(
        and(eq(chatMessagesTable.senderId, userId), eq(chatMessagesTable.receiverId, friendId)),
        and(eq(chatMessagesTable.senderId, friendId), eq(chatMessagesTable.receiverId, userId))
      ),
    ];

    if (cursor && !isNaN(cursor)) {
      conditions.push(lt(chatMessagesTable.id, cursor));
    }

    const messages = await db
      .select()
      .from(chatMessagesTable)
      .where(and(...conditions))
      .orderBy(desc(chatMessagesTable.id))
      .limit(limit);

    await db
      .update(chatMessagesTable)
      .set({ read: "true" })
      .where(
        and(
          eq(chatMessagesTable.senderId, friendId),
          eq(chatMessagesTable.receiverId, userId),
          eq(chatMessagesTable.read, "false")
        )
      );

    res.json({
      messages: messages.reverse(),
      nextCursor: messages.length === limit ? messages[0]?.id : null,
    });
  } catch (err) {
    console.error("chat/messages GET error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/chat/unread", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatMessagesTable)
      .where(
        and(
          eq(chatMessagesTable.receiverId, userId),
          eq(chatMessagesTable.read, "false")
        )
      );

    res.json({ count: result[0]?.count ?? 0 });
  } catch (err) {
    console.error("chat/unread error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/chat/global", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const cursorParam = req.query.cursor as string | undefined;
    const cursor = cursorParam ? parseInt(cursorParam) : undefined;
    const limit = 60;

    const conditions = [];
    if (cursor && !isNaN(cursor)) {
      conditions.push(lt(globalChatMessagesTable.id, cursor));
    }

    const messages = await db
      .select()
      .from(globalChatMessagesTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(globalChatMessagesTable.id))
      .limit(limit);

    res.json({
      messages: messages.reverse(),
      nextCursor: messages.length === limit ? messages[0]?.id : null,
    });
  } catch (err) {
    console.error("chat/global GET error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.post("/chat/global", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const { message } = req.body;
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      res.status(400).json({ error: "Messaggio vuoto" });
      return;
    }
    if (message.trim().length > 1000) {
      res.status(400).json({ error: "Messaggio troppo lungo" });
      return;
    }

    const [profile] = await db
      .select({ name: profileTable.name, avatarUrl: profileTable.avatarUrl })
      .from(profileTable)
      .where(eq(profileTable.userId, userId))
      .limit(1);

    const [created] = await db
      .insert(globalChatMessagesTable)
      .values({
        userId,
        userName: profile?.name ?? "Trader",
        avatarUrl: profile?.avatarUrl ?? null,
        message: message.trim(),
      })
      .returning();

    res.status(201).json(created);
  } catch (err) {
    console.error("chat/global POST error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

export default router;
