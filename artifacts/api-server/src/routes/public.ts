import { Router, type IRouter } from "express";
import { count, eq, asc } from "drizzle-orm";
import { db, usersTable, accountTradesTable, testimonialsTable } from "@workspace/db";
import { PAIR_CATALOG } from "@workspace/pair-catalog";
import logger from "../lib/logger.js";

const router: IRouter = Router();

// Public, unauthenticated marketing data for the landing page. The `/public`
// prefix is intentionally NOT in ANONYMOUS_FALLBACK_PREFIXES, so it stays
// reachable for signed-out visitors in production. No user-scoped data is read.

router.get("/public/stats", async (_req, res) => {
  try {
    const [traderRows, tradeRows] = await Promise.all([
      db.select({ value: count() }).from(usersTable),
      db.select({ value: count() }).from(accountTradesTable),
    ]);
    res.json({
      traders: Number(traderRows[0]?.value ?? 0),
      trades: Number(tradeRows[0]?.value ?? 0),
      pairs: PAIR_CATALOG.length,
    });
  } catch (error) {
    logger.warn({ err: error }, "public stats unavailable");
    res.status(503).json({ error: "stats unavailable" });
  }
});

router.get("/public/testimonials", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: testimonialsTable.id,
        name: testimonialsTable.name,
        role: testimonialsTable.role,
        text: testimonialsTable.text,
        rating: testimonialsTable.rating,
      })
      .from(testimonialsTable)
      .where(eq(testimonialsTable.published, true))
      .orderBy(asc(testimonialsTable.sortOrder), asc(testimonialsTable.id));
    res.json({ testimonials: rows });
  } catch (error) {
    logger.warn({ err: error }, "public testimonials unavailable");
    res.status(503).json({ error: "testimonials unavailable" });
  }
});

export default router;
