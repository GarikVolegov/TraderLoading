import { Router, type IRouter } from "express";
import { db, ideasTable } from "@workspace/db";
import { eq, desc, and, isNull } from "drizzle-orm";
import { getUserId } from "./profile.js";

const router: IRouter = Router();

function userFilter(userId: string | null) {
  return userId ? eq(ideasTable.userId, userId) : isNull(ideasTable.userId);
}

router.get("/ideas", async (req, res) => {
  const userId = getUserId(req);
  const ideas = await db.select().from(ideasTable).where(userFilter(userId)).orderBy(desc(ideasTable.createdAt));
  res.json(ideas);
});

router.post("/ideas", async (req, res) => {
  const userId = getUserId(req);
  const { type, content, deadlineDate, importance } = req.body;
  if (!type || !content) {
    res.status(400).json({ error: "type and content are required" });
    return;
  }
  const insertValues: typeof ideasTable.$inferInsert = {
    type,
    content,
    userId,
    ...(deadlineDate ? { deadlineDate: String(deadlineDate) } : {}),
    ...(importance   ? { importance:   String(importance)   } : {}),
  };
  const [idea] = await db.insert(ideasTable).values(insertValues).returning();
  res.status(201).json(idea);
});

router.put("/ideas/:id", async (req, res) => {
  const userId = getUserId(req);
  const id = parseInt(req.params.id);
  const { content, completed, reminderTime, cadence, recurrence } = req.body;
  const updates: Record<string, unknown> = {};
  if (content !== undefined) updates.content = content;
  if (completed !== undefined) updates.completed = completed;
  if (reminderTime !== undefined) updates.reminderTime = reminderTime;
  if (cadence !== undefined) updates.cadence = cadence;
  if (recurrence !== undefined) updates.recurrence = recurrence;
  const [idea] = await db.update(ideasTable)
    .set(updates)
    .where(and(eq(ideasTable.id, id), userFilter(userId)))
    .returning();
  if (!idea) { res.status(404).json({ error: "Not found" }); return; }
  res.json(idea);
});

router.delete("/ideas/:id", async (req, res) => {
  const userId = getUserId(req);
  const id = parseInt(req.params.id);
  await db.delete(ideasTable).where(and(eq(ideasTable.id, id), userFilter(userId)));
  res.json({ success: true });
});

export default router;
