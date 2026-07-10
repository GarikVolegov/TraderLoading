import { Router, type IRouter } from "express";
import { count, countDistinct, isNotNull, eq, asc } from "drizzle-orm";
import { db, profileTable, accountTradesTable, testimonialsTable } from "@workspace/db";
import { PAIR_CATALOG } from "@workspace/pair-catalog";
import logger from "../lib/logger.js";
import { summarizeRatings } from "../services/publicStats.js";

const router: IRouter = Router();

// Public, unauthenticated marketing data for the landing page. The `/public`
// prefix is intentionally NOT in ANONYMOUS_FALLBACK_PREFIXES, so it stays
// reachable for signed-out visitors in production. No user-scoped data is read.

router.get("/public/stats", async (_req, res) => {
  try {
    const [traderRows, tradeRows, ratingRows] = await Promise.all([
      // Real users are tracked by `profile` (one row per Clerk userId, created
      // on onboarding), not the abandoned Replit-Auth `users` table.
      db
        .select({ value: countDistinct(profileTable.userId) })
        .from(profileTable)
        .where(isNotNull(profileTable.userId)),
      db.select({ value: count() }).from(accountTradesTable),
      db
        .select({ rating: testimonialsTable.rating })
        .from(testimonialsTable)
        .where(eq(testimonialsTable.published, true)),
    ]);
    res.json({
      traders: Number(traderRows[0]?.value ?? 0),
      trades: Number(tradeRows[0]?.value ?? 0),
      pairs: PAIR_CATALOG.length,
      rating: summarizeRatings(ratingRows.map((row) => Number(row.rating))),
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
