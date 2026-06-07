import { Router, type IRouter } from "express";
import { db, friendshipsTable, profileTable } from "@workspace/db";
import { eq, or, and, sql, ilike } from "drizzle-orm";

const router: IRouter = Router();

function requireAuth(req: any, res: any): string | null {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return null;
  }
  return userId;
}

router.get("/friends/search", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) {
      res.json([]);
      return;
    }

    const results = await db
      .select({
        id: profileTable.id,
        name: profileTable.name,
        avatarUrl: profileTable.avatarUrl,
        userId: profileTable.userId,
      })
      .from(profileTable)
      .where(
        and(
          ilike(profileTable.name, `%${q}%`),
          sql`${profileTable.userId} IS NOT NULL`,
          sql`${profileTable.userId} != ${userId}`
        )
      )
      .limit(20);

    res.json(results);
  } catch (err) {
    console.error("friends/search error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.post("/friends/request", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const { friendUserId } = req.body;
    if (!friendUserId || typeof friendUserId !== "string" || friendUserId === userId) {
      res.status(400).json({ error: "ID amico non valido" });
      return;
    }

    const existing = await db
      .select()
      .from(friendshipsTable)
      .where(
        or(
          and(eq(friendshipsTable.userId, userId), eq(friendshipsTable.friendId, friendUserId)),
          and(eq(friendshipsTable.userId, friendUserId), eq(friendshipsTable.friendId, userId))
        )
      )
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "Richiesta già esistente" });
      return;
    }

    const [friendship] = await db
      .insert(friendshipsTable)
      .values({ userId, friendId: friendUserId, status: "pending" })
      .returning();

    res.status(201).json(friendship);
  } catch (err) {
    console.error("friends/request error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/friends/requests", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const requests = await db
      .select({
        id: friendshipsTable.id,
        userId: friendshipsTable.userId,
        friendId: friendshipsTable.friendId,
        status: friendshipsTable.status,
        createdAt: friendshipsTable.createdAt,
        senderName: profileTable.name,
        senderAvatar: profileTable.avatarUrl,
      })
      .from(friendshipsTable)
      .leftJoin(profileTable, eq(profileTable.userId, friendshipsTable.userId))
      .where(
        and(
          eq(friendshipsTable.friendId, userId),
          eq(friendshipsTable.status, "pending")
        )
      );

    res.json(requests);
  } catch (err) {
    console.error("friends/requests error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.patch("/friends/requests/:id", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID non valido" });
      return;
    }

    const { action } = req.body;
    if (!["accept", "reject"].includes(action)) {
      res.status(400).json({ error: "Azione non valida" });
      return;
    }

    const [request] = await db
      .select()
      .from(friendshipsTable)
      .where(and(eq(friendshipsTable.id, id), eq(friendshipsTable.friendId, userId)))
      .limit(1);

    if (!request) {
      res.status(404).json({ error: "Richiesta non trovata" });
      return;
    }

    if (action === "reject") {
      await db.delete(friendshipsTable).where(eq(friendshipsTable.id, id));
      res.json({ success: true });
      return;
    }

    const [updated] = await db
      .update(friendshipsTable)
      .set({ status: "accepted" })
      .where(eq(friendshipsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error("friends/requests/:id error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/friends", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const friends = await db
      .select({
        friendshipId: friendshipsTable.id,
        oderId: friendshipsTable.userId,
        friendId: friendshipsTable.friendId,
        status: friendshipsTable.status,
        createdAt: friendshipsTable.createdAt,
      })
      .from(friendshipsTable)
      .where(
        and(
          or(
            eq(friendshipsTable.userId, userId),
            eq(friendshipsTable.friendId, userId)
          ),
          eq(friendshipsTable.status, "accepted")
        )
      );

    const friendUserIds = friends.map((f) =>
      f.oderId === userId ? f.friendId : f.oderId
    );

    if (friendUserIds.length === 0) {
      res.json([]);
      return;
    }

    const profiles = await db
      .select({
        id: profileTable.id,
        name: profileTable.name,
        avatarUrl: profileTable.avatarUrl,
        userId: profileTable.userId,
      })
      .from(profileTable)
      .where(sql`${profileTable.userId} IN (${sql.join(friendUserIds.map(id => sql`${id}`), sql`, `)})`);

    const result = friends.map((f) => {
      const friendUserId = f.oderId === userId ? f.friendId : f.oderId;
      const profile = profiles.find((p) => p.userId === friendUserId);
      return {
        friendshipId: f.friendshipId,
        friendUserId,
        name: profile?.name ?? "Unknown",
        avatarUrl: profile?.avatarUrl ?? null,
        online: false,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("friends error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.delete("/friends/:id", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID non valido" });
      return;
    }

    await db
      .delete(friendshipsTable)
      .where(
        and(
          eq(friendshipsTable.id, id),
          or(
            eq(friendshipsTable.userId, userId),
            eq(friendshipsTable.friendId, userId)
          )
        )
      );

    res.json({ success: true });
  } catch (err) {
    console.error("friends/:id delete error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

export default router;
