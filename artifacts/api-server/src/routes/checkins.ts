import { Router, type IRouter } from "express";
import { db, checkinsTable } from "@workspace/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { tradingDay } from "../lib/tradingTime.js";
import { getUserId } from "./profile.js";
import { z } from "zod";

const router: IRouter = Router();
const checkinInput = z.object({
  mood: z.string().trim().min(1).max(64),
  sessionName: z.string().trim().min(1).max(200),
  note: z.string().trim().max(4000).nullable().optional(),
});

function userFilter(userId: string | null) {
  return userId ? eq(checkinsTable.userId, userId) : isNull(checkinsTable.userId);
}

function todayLocalKey(): string { return tradingDay(new Date())!; }

router.get("/checkins/today", async (req, res) => {
  const userId = getUserId(req);
  const today = todayLocalKey();
  const [checkin] = await db.select().from(checkinsTable)
    .where(and(userFilter(userId), eq(checkinsTable.date, today)))
    .orderBy(desc(checkinsTable.createdAt), desc(checkinsTable.id))
    .limit(1);
  res.json(checkin || null);
});

router.get("/checkins", async (req, res) => {
  const userId = getUserId(req);
  const checkins = await db.select().from(checkinsTable)
    .where(userFilter(userId))
    .orderBy(desc(checkinsTable.date), desc(checkinsTable.id))
    .limit(365);
  res.json(checkins);
});

router.post("/checkins", async (req, res) => {
  const userId = getUserId(req);
  const { mood, sessionName, note } = checkinInput.parse(req.body);
  if (!mood || !sessionName) {
    res.status(400).json({ error: "mood and sessionName are required" });
    return;
  }
  const today = todayLocalKey();
  const [checkin] = await db.insert(checkinsTable)
    .values({ mood, sessionName, note: note || null, userId, date: today })
    .returning();
  res.status(201).json(checkin);
});

export default router;
