import { Router, type IRouter } from "express";
import {
  db,
  communitiesTable,
  communityReviewsTable,
  communityReviewReportsTable,
  profileTable,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { getMemberContext, requirePermission, hasPermission } from "../services/communityPermissions.js";

const router: IRouter = Router();

/** Recompute denormalized rating aggregates from non-hidden reviews. */
async function recomputeRating(communityId: number): Promise<void> {
  const [agg] = await db
    .select({
      sum: sql<number>`coalesce(sum(${communityReviewsTable.rating}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(communityReviewsTable)
    .where(and(eq(communityReviewsTable.communityId, communityId), eq(communityReviewsTable.hidden, false)));
  await db
    .update(communitiesTable)
    .set({ ratingSum: Number(agg?.sum ?? 0), ratingCount: Number(agg?.count ?? 0) })
    .where(eq(communitiesTable.id, communityId));
}

// ─── List reviews (any authenticated user — visible before joining) ───────────
router.get("/community/:id/reviews", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return; }
  const communityId = parseInt(req.params.id);
  try {
    const ctx = await getMemberContext(communityId, userId);
    if (!ctx.communityExists) { res.status(404).json({ error: "Community non trovata" }); return; }
    const canModerate = hasPermission(ctx, "reviews.moderate");

    const conditions = [eq(communityReviewsTable.communityId, communityId)];
    if (!canModerate) conditions.push(eq(communityReviewsTable.hidden, false));

    const rows = await db
      .select({
        id: communityReviewsTable.id,
        userId: communityReviewsTable.userId,
        rating: communityReviewsTable.rating,
        text: communityReviewsTable.text,
        ownerResponse: communityReviewsTable.ownerResponse,
        ownerResponseAt: communityReviewsTable.ownerResponseAt,
        hidden: communityReviewsTable.hidden,
        createdAt: communityReviewsTable.createdAt,
        name: profileTable.name,
        avatarUrl: profileTable.avatarUrl,
      })
      .from(communityReviewsTable)
      .leftJoin(profileTable, eq(profileTable.userId, communityReviewsTable.userId))
      .where(and(...conditions))
      .orderBy(desc(communityReviewsTable.createdAt));

    const reviews = rows.map((r) => ({ ...r, name: r.name ?? "Trader" }));
    const myReview = reviews.find((r) => r.userId === userId) ?? null;

    const [community] = await db
      .select({ ratingSum: communitiesTable.ratingSum, ratingCount: communitiesTable.ratingCount })
      .from(communitiesTable)
      .where(eq(communitiesTable.id, communityId))
      .limit(1);
    const ratingCount = community?.ratingCount ?? 0;
    const ratingAvg = ratingCount > 0 ? (community?.ratingSum ?? 0) / ratingCount : 0;

    res.json({
      reviews,
      myReview,
      ratingAvg,
      ratingCount,
      isMember: ctx.isMember || ctx.isOwner,
      canRespond: hasPermission(ctx, "reviews.respond"),
      canModerate,
    });
  } catch (err) {
    console.error("GET /community/:id/reviews error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Create / update my review (members only) ─────────────────────────────────
router.post("/community/:id/reviews", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return; }
  const communityId = parseInt(req.params.id);
  try {
    const ctx = await getMemberContext(communityId, userId);
    if (!ctx.communityExists) { res.status(404).json({ error: "Community non trovata" }); return; }
    if (!ctx.isMember && !ctx.isOwner) {
      res.status(403).json({ error: "Solo i membri possono recensire" });
      return;
    }

    const rating = Math.round(Number(req.body.rating));
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: "Valutazione non valida (1-5)" });
      return;
    }
    const text = typeof req.body.text === "string" ? req.body.text.slice(0, 2000) : "";

    await db
      .insert(communityReviewsTable)
      .values({ communityId, userId, rating, text })
      .onConflictDoUpdate({
        target: [communityReviewsTable.communityId, communityReviewsTable.userId],
        set: { rating, text, hidden: false, updatedAt: sql`now()` },
      });
    await recomputeRating(communityId);
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("POST /community/:id/reviews error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Delete my review ─────────────────────────────────────────────────────────
router.delete("/community/:id/reviews/mine", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return; }
  const communityId = parseInt(req.params.id);
  try {
    await db
      .delete(communityReviewsTable)
      .where(and(eq(communityReviewsTable.communityId, communityId), eq(communityReviewsTable.userId, userId)));
    await recomputeRating(communityId);
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /community/:id/reviews/mine error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Owner public response (reviews.respond) ──────────────────────────────────
router.post("/community/reviews/:reviewId/response", async (req, res) => {
  const reviewId = parseInt(req.params.reviewId);
  try {
    const [review] = await db.select().from(communityReviewsTable).where(eq(communityReviewsTable.id, reviewId)).limit(1);
    if (!review) { res.status(404).json({ error: "Recensione non trovata" }); return; }
    if (!(await requirePermission(req, res, review.communityId, "reviews.respond"))) return;

    const response = typeof req.body.response === "string" ? req.body.response.slice(0, 2000) : "";
    const [updated] = await db
      .update(communityReviewsTable)
      .set({ ownerResponse: response || null, ownerResponseAt: response ? new Date() : null })
      .where(eq(communityReviewsTable.id, reviewId))
      .returning();
    res.json(updated);
  } catch (err) {
    console.error("POST /community/reviews/:reviewId/response error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Report a review (any member) ─────────────────────────────────────────────
router.post("/community/reviews/:reviewId/report", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return; }
  const reviewId = parseInt(req.params.reviewId);
  try {
    const [review] = await db.select().from(communityReviewsTable).where(eq(communityReviewsTable.id, reviewId)).limit(1);
    if (!review) { res.status(404).json({ error: "Recensione non trovata" }); return; }

    const ctx = await getMemberContext(review.communityId, userId);
    if (!ctx.isMember && !ctx.isOwner) { res.status(403).json({ error: "Non sei membro" }); return; }

    const reason = typeof req.body.reason === "string" ? req.body.reason.slice(0, 300) : null;
    await db
      .insert(communityReviewReportsTable)
      .values({ reviewId, reporterUserId: userId, reason })
      .onConflictDoNothing({ target: [communityReviewReportsTable.reviewId, communityReviewReportsTable.reporterUserId] });
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /community/reviews/:reviewId/report error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Hide / unhide a review (reviews.moderate) ────────────────────────────────
router.patch("/community/reviews/:reviewId/hide", async (req, res) => {
  const reviewId = parseInt(req.params.reviewId);
  try {
    const [review] = await db.select().from(communityReviewsTable).where(eq(communityReviewsTable.id, reviewId)).limit(1);
    if (!review) { res.status(404).json({ error: "Recensione non trovata" }); return; }
    if (!(await requirePermission(req, res, review.communityId, "reviews.moderate"))) return;

    const hidden = req.body.hidden !== false;
    await db.update(communityReviewsTable).set({ hidden }).where(eq(communityReviewsTable.id, reviewId));
    await recomputeRating(review.communityId);
    res.json({ ok: true, hidden });
  } catch (err) {
    console.error("PATCH /community/reviews/:reviewId/hide error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── List reports (reviews.moderate) ──────────────────────────────────────────
router.get("/community/:id/reviews/reports", async (req, res) => {
  const communityId = parseInt(req.params.id);
  if (!(await requirePermission(req, res, communityId, "reviews.moderate"))) return;
  try {
    const rows = await db
      .select({
        reviewId: communityReviewReportsTable.reviewId,
        reporterUserId: communityReviewReportsTable.reporterUserId,
        reason: communityReviewReportsTable.reason,
        createdAt: communityReviewReportsTable.createdAt,
        reviewText: communityReviewsTable.text,
        reviewRating: communityReviewsTable.rating,
        reviewUserId: communityReviewsTable.userId,
        hidden: communityReviewsTable.hidden,
      })
      .from(communityReviewReportsTable)
      .innerJoin(communityReviewsTable, eq(communityReviewsTable.id, communityReviewReportsTable.reviewId))
      .where(eq(communityReviewsTable.communityId, communityId))
      .orderBy(desc(communityReviewReportsTable.createdAt));
    res.json(rows);
  } catch (err) {
    console.error("GET /community/:id/reviews/reports error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

export default router;
