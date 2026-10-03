import { Router, type IRouter } from "express";
import { db, missionTemplatesTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { getUserId } from "./profile.js";
import { clampMissionXpReward } from "../lib/missionXp.js";

const XP_REWARD_ERROR = "xpReward must be a number between 1 and 100";

const router: IRouter = Router();

router.get("/mission-templates", async (req, res) => {
  const userId = getUserId(req);
  const userFilter = userId ? eq(missionTemplatesTable.userId, userId) : isNull(missionTemplatesTable.userId);
  const templates = await db.select().from(missionTemplatesTable).where(userFilter);
  res.json(
    templates.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      xpReward: t.xpReward,
      createdAt: t.createdAt?.toISOString(),
    }))
  );
});

router.post("/mission-templates", async (req, res) => {
  const userId = getUserId(req);
  const { title, description, xpReward } = req.body;

  if (!title || !description || xpReward == null) {
    res.status(400).json({ error: "title, description, and xpReward are required" });
    return;
  }

  const clampedXp = clampMissionXpReward(xpReward);
  if (clampedXp == null) {
    res.status(400).json({ error: XP_REWARD_ERROR });
    return;
  }

  const [created] = await db
    .insert(missionTemplatesTable)
    .values({ title, description, xpReward: clampedXp, userId })
    .returning();

  res.status(201).json({
    id: created.id,
    title: created.title,
    description: created.description,
    xpReward: created.xpReward,
    createdAt: created.createdAt?.toISOString(),
  });
});

router.put("/mission-templates/:id", async (req, res) => {
  const userId = getUserId(req);
  const id = Number(req.params.id);
  const { title, description, xpReward } = req.body;
  const userFilter = userId ? eq(missionTemplatesTable.userId, userId) : isNull(missionTemplatesTable.userId);

  const [existing] = await db
    .select()
    .from(missionTemplatesTable)
    .where(and(eq(missionTemplatesTable.id, id), userFilter));

  if (!existing) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  let nextXpReward = existing.xpReward;
  if (xpReward != null) {
    const clampedXp = clampMissionXpReward(xpReward);
    if (clampedXp == null) {
      res.status(400).json({ error: XP_REWARD_ERROR });
      return;
    }
    nextXpReward = clampedXp;
  }

  const [updated] = await db
    .update(missionTemplatesTable)
    .set({
      title: title ?? existing.title,
      description: description ?? existing.description,
      xpReward: nextXpReward,
    })
    .where(eq(missionTemplatesTable.id, id))
    .returning();

  res.json({
    id: updated.id,
    title: updated.title,
    description: updated.description,
    xpReward: updated.xpReward,
    createdAt: updated.createdAt?.toISOString(),
  });
});

router.delete("/mission-templates/:id", async (req, res) => {
  const userId = getUserId(req);
  const id = Number(req.params.id);
  const userFilter = userId ? eq(missionTemplatesTable.userId, userId) : isNull(missionTemplatesTable.userId);

  const [existing] = await db
    .select()
    .from(missionTemplatesTable)
    .where(and(eq(missionTemplatesTable.id, id), userFilter));

  if (!existing) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  await db.delete(missionTemplatesTable).where(eq(missionTemplatesTable.id, id));
  res.json({ success: true });
});

export default router;
