import { Router, type IRouter, type Request, type Response } from "express";
import { db, friendshipsTable, profileTable } from "@workspace/db";
import { eq, or, and, sql, ilike, inArray } from "drizzle-orm";
import { tradingDay } from "../lib/tradingTime.js";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return null;
  }
  return userId;
}

function todayKey() {
  return tradingDay(new Date()) ?? "";
}

export function parseFriendshipId(value: string): number | null {
  if (!/^[0-9]+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

export function isFriendActiveToday(lastActiveDate: string | null | undefined, referenceDate = todayKey()): boolean {
  return lastActiveDate === referenceDate;
}

export type FriendRelationshipStatus = "none" | "pending_sent" | "pending_received" | "accepted";

export function getFriendRelationshipStatus(
  currentUserId: string,
  targetUserId: string,
  friendship: { userId: string; friendId: string; status: string } | null | undefined,
): FriendRelationshipStatus {
  if (!friendship) return "none";
  if (friendship.status === "accepted") return "accepted";
  if (friendship.status === "pending" && friendship.userId === currentUserId && friendship.friendId === targetUserId) {
    return "pending_sent";
  }
  if (friendship.status === "pending" && friendship.userId === targetUserId && friendship.friendId === currentUserId) {
    return "pending_received";
  }
  return "none";
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
        lastActiveDate: profileTable.lastActiveDate,
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

    const resultUserIds = results.map((result) => result.userId).filter((id): id is string => !!id);
    const relationships = resultUserIds.length === 0
      ? []
      : await db
          .select({
            userId: friendshipsTable.userId,
            friendId: friendshipsTable.friendId,
            status: friendshipsTable.status,
          })
          .from(friendshipsTable)
          .where(
            or(
              and(eq(friendshipsTable.userId, userId), inArray(friendshipsTable.friendId, resultUserIds)),
              and(eq(friendshipsTable.friendId, userId), inArray(friendshipsTable.userId, resultUserIds))
            )
          );

    res.json(results.map((result) => ({
      ...result,
      relationshipStatus: getFriendRelationshipStatus(
        userId,
        result.userId ?? "",
        relationships.find((relationship) =>
          (relationship.userId === userId && relationship.friendId === result.userId) ||
          (relationship.friendId === userId && relationship.userId === result.userId)
        ),
      ),
    })));
  } catch (err) {
    console.error("friends/search error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

router.post("/friends/request", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const friendUserId = req.body?.friendUserId;
    if (typeof friendUserId !== "string" || !friendUserId.trim() || friendUserId === userId) {
      res.status(400).json({ error: "ID amico non valido" });
      return;
    }

    const result = await db.transaction(async (tx) => {
      // The existing unique index is directional. A pair lock covers both
      // directions and every API process without changing the database schema.
      const pairKey = JSON.stringify([userId, friendUserId].sort());
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`friendship:${pairKey}`}, 0))`);
      const [target] = await tx.select({ id: profileTable.id }).from(profileTable)
        .where(eq(profileTable.userId, friendUserId)).limit(1);
      if (!target) return { kind: "missing" } as const;
      const [existing] = await tx.select({ id: friendshipsTable.id }).from(friendshipsTable)
        .where(or(
          and(eq(friendshipsTable.userId, userId), eq(friendshipsTable.friendId, friendUserId)),
          and(eq(friendshipsTable.userId, friendUserId), eq(friendshipsTable.friendId, userId)),
        )).limit(1);
      if (existing) return { kind: "duplicate" } as const;
      const [friendship] = await tx.insert(friendshipsTable)
        .values({ userId, friendId: friendUserId, status: "pending" }).returning();
      return { kind: "created", friendship } as const;
    });
    if (result.kind === "missing") {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }
    if (result.kind === "duplicate") {
      res.status(409).json({ error: "Richiesta già esistente" });
      return;
    }
    res.status(201).json(result.friendship);
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
    const id = parseFriendshipId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "ID non valido" });
      return;
    }

    const action = req.body?.action;
    if (!["accept", "reject"].includes(action)) {
      res.status(400).json({ error: "Azione non valida" });
      return;
    }

    const result = await db.transaction(async (tx) => {
      // Serialize accept/reject with another recipient update or a deletion.
      // The recipient predicate is applied before any mutation, including retry.
      const [request] = await tx.select().from(friendshipsTable)
        .where(and(eq(friendshipsTable.id, id), eq(friendshipsTable.friendId, userId)))
        .limit(1).for("update");
      if (!request) return null;
      if (action === "reject") {
        await tx.delete(friendshipsTable).where(eq(friendshipsTable.id, id));
        return { success: true };
      }
      const [updated] = await tx.update(friendshipsTable).set({ status: "accepted" })
        .where(eq(friendshipsTable.id, id)).returning();
      return updated;
    });
    if (!result) {
      res.status(404).json({ error: "Richiesta non trovata" });
      return;
    }
    res.json(result);
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
        lastActiveDate: profileTable.lastActiveDate,
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
        online: isFriendActiveToday(profile?.lastActiveDate),
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
    const id = parseFriendshipId(req.params.id);
    if (id === null) {
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
