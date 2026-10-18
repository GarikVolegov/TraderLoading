import { Router, type IRouter, type Request, type Response } from "express";
import { timingSafeEqual, webcrypto } from "node:crypto";
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

export async function areMutualFollowers(userId: string, friendId: string): Promise<boolean> {
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

function isP256Coordinate(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value)
    && Buffer.from(value, "base64url").length === 32
    && Buffer.from(value, "base64url").toString("base64url") === value;
}

function isValidChatJwk(value: unknown, privateKey: boolean): value is Record<string, unknown> {
  if (!isJsonObject(value) || value.kty !== "EC" || value.crv !== "P-256"
    || !isP256Coordinate(value.x) || !isP256Coordinate(value.y)) return false;
  if (privateKey ? !isP256Coordinate(value.d) : "d" in value) return false;
  if (value.ext !== undefined && typeof value.ext !== "boolean") return false;
  if (value.alg !== undefined && typeof value.alg !== "string") return false;
  if (value.key_ops !== undefined) {
    if (!Array.isArray(value.key_ops) || new Set(value.key_ops).size !== value.key_ops.length) return false;
    if (privateKey) {
      if (!value.key_ops.includes("deriveBits") || !value.key_ops.every(op => op === "deriveBits" || op === "deriveKey")) return false;
    } else if (value.key_ops.length !== 0) return false;
  }
  return true;
}

function samePublicKey(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return ["kty", "crv", "x", "y"].every(field => a[field] === b[field]);
}

export function isValidAccountKeyBackupBody(body: unknown): body is {
  publicKeyJwk: Record<string, unknown>;
  privateKeyJwk: Record<string, unknown>;
} {
  return isJsonObject(body) && isValidChatJwk(body.publicKeyJwk, false)
    && isValidChatJwk(body.privateKeyJwk, true)
    && samePublicKey(body.publicKeyJwk, body.privateKeyJwk);
}

let validationPair: Promise<webcrypto.CryptoKeyPair> | undefined;
function getValidationPair() {
  validationPair ??= webcrypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  return validationPair;
}

export async function validateChatPublicKey(value: unknown): Promise<boolean> {
  if (!isValidChatJwk(value, false)) return false;
  try {
    const publicKey = await webcrypto.subtle.importKey("jwk", value, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const probe = await getValidationPair();
    await webcrypto.subtle.deriveBits({ name: "ECDH", public: publicKey }, probe.privateKey, 256);
    return true;
  } catch { return false; }
}

export async function validateAccountKeyBackup(body: unknown): Promise<boolean> {
  if (!isValidAccountKeyBackupBody(body)) return false;
  try {
    const [publicKey, privateKey, probe] = await Promise.all([
      webcrypto.subtle.importKey("jwk", body.publicKeyJwk, { name: "ECDH", namedCurve: "P-256" }, false, []),
      webcrypto.subtle.importKey("jwk", body.privateKeyJwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]),
      getValidationPair(),
    ]);
    // Importing a JWK alone is not a proof that its public coordinates belong
    // to d. Both sides must derive the same secret against an independent key.
    const [privateSecret, publicSecret] = await Promise.all([
      webcrypto.subtle.deriveBits({ name: "ECDH", public: probe.publicKey }, privateKey, 256),
      webcrypto.subtle.deriveBits({ name: "ECDH", public: publicKey }, probe.privateKey, 256),
    ]);
    return timingSafeEqual(Buffer.from(privateSecret), Buffer.from(publicSecret));
  } catch { return false; }
}

export function parseChatCursor(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) return null;
  const cursor = Number(value);
  return Number.isSafeInteger(cursor) && cursor > 0 && cursor <= 2_147_483_647 ? cursor : null;
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

type ChatKeyTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function lockAccountKeys(tx: ChatKeyTransaction, userId: string) {
  // The same lock also covers first use, when neither table has a row to lock.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`chat-account-keys:${userId}`}, 0))`);
}

async function upsertPublicKey(tx: ChatKeyTransaction, userId: string, publicKeyJwk: Record<string, unknown>) {
  return tx.insert(userPublicKeysTable)
    .values({ userId, publicKeyJwk: JSON.stringify(publicKeyJwk) })
    .onConflictDoUpdate({ target: userPublicKeysTable.userId, set: { publicKeyJwk: JSON.stringify(publicKeyJwk) } })
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
  } catch {
    console.error("chat/key-backup GET failed");
    res.status(500).json({ error: "Errore interno" });
  }
});

// NOTE: this stores the user's private key so the chat can be recovered on a new
// device. Messages are AES-GCM encrypted at rest, but the key is escrowed by the
// server — this is at-rest encryption, NOT end-to-end encryption. UI copy must
// not claim E2EE (see i18n/no-e2ee-claim.static.test.ts).
router.put("/chat/key-backup", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    if (!isValidAccountKeyBackupBody(req.body) || !(await validateAccountKeyBackup(req.body))) {
      res.status(400).json({ error: "Coppia di chiavi chat non valida" });
      return;
    }
    const { publicKeyJwk: publicJwk, privateKeyJwk: privateJwk } = req.body;
    const publicKeyJwk = JSON.stringify(publicJwk);
    const privateKeyJwk = JSON.stringify(privateJwk);
    const saved = await db.transaction(async tx => {
      await lockAccountKeys(tx, userId);
      const [backup] = await tx.insert(userE2eeKeyBackupsTable)
        .values({ userId, publicKeyJwk, privateKeyJwk })
        .onConflictDoUpdate({ target: userE2eeKeyBackupsTable.userId, set: { publicKeyJwk, privateKeyJwk, updatedAt: new Date() } })
        .returning({ publicKeyJwk: userE2eeKeyBackupsTable.publicKeyJwk, privateKeyJwk: userE2eeKeyBackupsTable.privateKeyJwk });
      await upsertPublicKey(tx, userId, publicJwk);
      return backup;
    });
    res.json(serializeAccountKeyBackup(userId, saved));
  } catch {
    // Drizzle errors include query parameters; never log the escrowed key.
    console.error("chat/key-backup PUT failed");
    res.status(500).json({ error: "Errore interno" });
  }
});

router.post("/chat/keys", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const publicKeyJwk: unknown = req.body?.publicKeyJwk;
    if (!isValidChatJwk(publicKeyJwk, false) || !(await validateChatPublicKey(publicKeyJwk))) {
      res.status(400).json({ error: "Chiave pubblica chat non valida" });
      return;
    }
    const saved = await db.transaction(async tx => {
      await lockAccountKeys(tx, userId);
      const [backup] = await tx.select({ publicKeyJwk: userE2eeKeyBackupsTable.publicKeyJwk })
        .from(userE2eeKeyBackupsTable).where(eq(userE2eeKeyBackupsTable.userId, userId)).limit(1);
      if (backup && !samePublicKey(JSON.parse(backup.publicKeyJwk), publicKeyJwk)) return null;
      const [key] = await upsertPublicKey(tx, userId, publicKeyJwk);
      return key;
    });
    if (!saved) {
      res.status(409).json({ error: "Chiavi chat non sincronizzate; riapri i messaggi" });
      return;
    }
    res.json(saved);
  } catch {
    console.error("chat/keys POST failed");
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
  } catch {
    console.error("chat/keys GET failed");
    res.status(500).json({ error: "Errore interno" });
  }
});

router.post("/chat/messages", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const { receiverId, ciphertext, iv } = req.body ?? {};
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

    // The message is already persisted and its 201 response committed. Keep
    // every notification lookup inside an independent best-effort task so a
    // later DB/push failure cannot try to send a second HTTP response.
    void (async () => {
      const [senderProfile] = await db.select({ name: profileTable.name })
        .from(profileTable).where(eq(profileTable.userId, userId)).limit(1);
      const language = await getUserNotificationLanguage(receiverId);
      const copy = getServerNotificationCopy(language);
      await sendPushToUser(receiverId, {
        title: senderProfile?.name ?? "Qualcuno",
        body: copy.chatBody,
        tag: `chat-${userId}`,
        data: { url: `/chat?t=conversazioni&peer=${encodeURIComponent(userId)}` },
      }, "messages");
    })().catch(() => { console.error("chat/messages notification failed after message persistence"); });
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
    const cursor = parseChatCursor(req.query.cursor);
    if (cursor === null) {
      res.status(400).json({ error: "Cursore non valido" });
      return;
    }
    const limit = 50;

    const conditions = [
      or(
        and(eq(chatMessagesTable.senderId, userId), eq(chatMessagesTable.receiverId, friendId)),
        and(eq(chatMessagesTable.senderId, friendId), eq(chatMessagesTable.receiverId, userId))
      ),
    ];

    if (cursor !== undefined) {
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
    const cursor = parseChatCursor(req.query.cursor);
    if (cursor === null) {
      res.status(400).json({ error: "Cursore non valido" });
      return;
    }
    const limit = 60;

    const conditions = [];
    if (cursor !== undefined) {
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
    const message: unknown = req.body?.message;
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
