import { Router, type IRouter } from "express";
import { db, checklistItemsTable } from "@workspace/db";
import { eq, asc, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { getUserId } from "./profile.js";

const router: IRouter = Router();
const itemText = z.string().trim().min(1).max(2000);
const itemId = z.coerce.number().int().positive();
const updateItem = z.object({ text: itemText.optional(), completed: z.boolean().optional() })
  .refine(value => Object.keys(value).length > 0, "At least one field is required");

function userFilter(userId: string | null) {
  return userId ? eq(checklistItemsTable.userId, userId) : isNull(checklistItemsTable.userId);
}

router.get("/checklist", async (req, res) => {
  const userId = getUserId(req);
  const items = await db.select().from(checklistItemsTable).where(userFilter(userId)).orderBy(asc(checklistItemsTable.order), asc(checklistItemsTable.createdAt));
  res.json(items);
});

router.post("/checklist", async (req, res) => {
  const userId = getUserId(req);
  const { text } = z.object({ text: itemText }).parse(req.body);
  if (!text) { res.status(400).json({ error: "text is required" }); return; }
  const all = await db.select().from(checklistItemsTable).where(userFilter(userId));
  const maxOrder = all.length > 0 ? Math.max(...all.map(i => i.order)) : -1;
  const [item] = await db.insert(checklistItemsTable).values({ text, order: maxOrder + 1, userId }).returning();
  res.status(201).json(item);
});

router.put("/checklist/:id", async (req, res) => {
  const userId = getUserId(req);
  const id = itemId.parse(req.params.id);
  const { text, completed } = updateItem.parse(req.body);
  const updateData: Partial<{ text: string; completed: boolean }> = {};
  if (text !== undefined) updateData.text = text;
  if (completed !== undefined) updateData.completed = completed;
  const [item] = await db.update(checklistItemsTable)
    .set(updateData)
    .where(and(eq(checklistItemsTable.id, id), userFilter(userId)))
    .returning();
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json(item);
});

router.delete("/checklist/:id", async (req, res) => {
  const userId = getUserId(req);
  const id = itemId.parse(req.params.id);
  await db.delete(checklistItemsTable).where(and(eq(checklistItemsTable.id, id), userFilter(userId)));
  res.json({ success: true });
});

export default router;
