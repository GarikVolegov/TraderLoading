import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import {
  db,
  marketDecisionsTable,
  marketSnapshotsTable,
  marketOutcomesTable,
  journalEntriesTable,
} from "@workspace/db";
import { and, or, eq, desc, lt } from "drizzle-orm";
import { getUserId } from "./profile.js";

const router = Router();
const bodySchema = z.object({
  snapshotId: z.string().regex(/^[a-f0-9]{64}$/),
  choice: z.enum(["trade", "wait"]),
  note: z.string().trim().max(4000).default(""),
  journalEntryId: z.number().int().positive().optional(),
});
router.post("/market-decisions", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const body = bodySchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid decision" });
    return;
  }
  const [snapshot] = await db
    .select()
    .from(marketSnapshotsTable)
    .where(
      and(
        eq(marketSnapshotsTable.id, body.data.snapshotId),
        eq(marketSnapshotsTable.kind, "context"),
      ),
    )
    .limit(1);
  if (!snapshot) {
    res.status(404).json({ error: "Snapshot not found" });
    return;
  }
  // Recording an already expired context as a new contemporaneous decision is misleading.
  if (+snapshot.createdAt > Date.now() || Date.now() - +snapshot.createdAt > 10 * 60000) {
    res.status(409).json({ error: "Refresh the context before recording a decision" });
    return;
  }
  if (body.data.journalEntryId) {
    const [entry] = await db
      .select({ id: journalEntriesTable.id })
      .from(journalEntriesTable)
      .where(
        and(
          eq(journalEntriesTable.id, body.data.journalEntryId),
          eq(journalEntriesTable.userId, userId),
        ),
      );
    if (!entry) {
      res.status(404).json({ error: "Journal entry not found" });
      return;
    }
  }
  const result = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(marketDecisionsTable)
      .values({
        id: randomUUID(),
        userId,
        snapshotId: snapshot.id,
        choice: body.data.choice,
        note: body.data.note,
        journalEntryId: body.data.journalEntryId,
      })
      .onConflictDoNothing()
      .returning();
    if (created) return created;
    const [existing] = await tx
      .select()
      .from(marketDecisionsTable)
      .where(
        and(
          eq(marketDecisionsTable.userId, userId),
          eq(marketDecisionsTable.snapshotId, snapshot.id),
          eq(marketDecisionsTable.choice, body.data.choice),
        ),
      );
    return existing;
  });
  res.status(201).json({
    ...result,
    createdAt: result.createdAt.toISOString(),
    snapshot: snapshot.payload,
    outcome: null,
  });
});
router.get("/market-decisions/:id", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!z.string().uuid().safeParse(req.params.id).success) {
    res.status(400).json({ error: "Invalid decision" });
    return;
  }
  const [row] = await db
    .select({
      decision: marketDecisionsTable,
      snapshot: marketSnapshotsTable.payload,
      outcome: marketOutcomesTable.payload,
    })
    .from(marketDecisionsTable)
    .innerJoin(marketSnapshotsTable, eq(marketSnapshotsTable.id, marketDecisionsTable.snapshotId))
    .leftJoin(marketOutcomesTable, eq(marketOutcomesTable.snapshotId, marketSnapshotsTable.id))
    .where(
      and(eq(marketDecisionsTable.userId, userId), eq(marketDecisionsTable.id, req.params.id)),
    );
  if (!row) {
    res.status(404).json({ error: "Decision not found" });
    return;
  }
  res.setHeader("Cache-Control", "private, no-store");
  res.json({
    ...row.decision,
    createdAt: row.decision.createdAt.toISOString(),
    snapshot: row.snapshot,
    outcome: row.outcome,
  });
});
router.get("/market-decisions", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const limit = Number(req.query.limit ?? 25),
    cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
  const [cursorTime, cursorId] = (cursor ?? "").split("|");
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    (cursor &&
      (!Number.isFinite(Date.parse(cursorTime)) || !z.string().uuid().safeParse(cursorId).success))
  ) {
    res.status(400).json({ error: "Invalid pagination" });
    return;
  }
  const rows = await db
    .select({
      decision: marketDecisionsTable,
      snapshot: marketSnapshotsTable.payload,
      outcome: marketOutcomesTable.payload,
    })
    .from(marketDecisionsTable)
    .innerJoin(marketSnapshotsTable, eq(marketSnapshotsTable.id, marketDecisionsTable.snapshotId))
    .leftJoin(marketOutcomesTable, eq(marketOutcomesTable.snapshotId, marketSnapshotsTable.id))
    .where(
      and(
        eq(marketDecisionsTable.userId, userId),
        cursor
          ? or(
              lt(marketDecisionsTable.createdAt, new Date(cursorTime)),
              and(
                eq(marketDecisionsTable.createdAt, new Date(cursorTime)),
                lt(marketDecisionsTable.id, cursorId),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(marketDecisionsTable.createdAt), desc(marketDecisionsTable.id))
    .limit(limit + 1);
  res.setHeader("Cache-Control", "private, no-store");
  res.json({
    items: rows.slice(0, limit).map((r) => ({
      ...r.decision,
      createdAt: r.decision.createdAt.toISOString(),
      snapshot: r.snapshot,
      outcome: r.outcome,
    })),
    nextCursor:
      rows.length > limit
        ? `${rows[limit - 1].decision.createdAt.toISOString()}|${rows[limit - 1].decision.id}`
        : null,
  });
});
export default router;
