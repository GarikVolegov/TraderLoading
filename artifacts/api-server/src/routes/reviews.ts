// Recensioni reali dell'app: router REST off-contract (come tornei/journal-recaps —
// accesso diretto via apiJSON lato client, non in openapi.yaml). Gli utenti inviano
// una recensione nel momento giusto (dopo un picco positivo), la moderazione admin la
// pubblica, e le righe pubblicate confluiscono nella landing + nel rating aggregato.

import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  testimonialsTable,
  reviewPromptStateTable,
  accountTradesTable,
  type Testimonial,
} from "@workspace/db";
import { and, count, eq, isNotNull } from "drizzle-orm";
import { getUserId, getOrCreateProfile, computeLevel } from "./profile.js";
import { evaluateReviewPrompt, type PromptSignal } from "../services/reviews/promptEligibility.js";

const router: IRouter = Router();

const MAX_TEXT = 2000;
const MAX_ROLE = 80;
const SIGNALS: readonly PromptSignal[] = ["level", "streak", "coach", "none"];

// Vista pubblica-ish per l'utente: solo la propria recensione, senza campi interni.
function myReviewDto(row: Testimonial) {
  return {
    id: row.id,
    rating: row.rating,
    text: row.text,
    role: row.role,
    status: row.status,
    published: row.published,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function countClosedTrades(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(accountTradesTable)
    .where(
      and(
        eq(accountTradesTable.userId, userId),
        eq(accountTradesTable.status, "closed"),
        isNotNull(accountTradesTable.profit),
      ),
    );
  return Number(row?.value ?? 0);
}

// Recensione "viva" = pending o approved (una withdrawn/rejected non conta come già fatta).
async function findLiveReview(userId: string): Promise<Testimonial | null> {
  const [row] = await db
    .select()
    .from(testimonialsTable)
    .where(eq(testimonialsTable.userId, userId))
    .limit(1);
  return row ?? null;
}

function parseRating(input: unknown): number | null {
  const n = Number(input);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

// ── GET /reviews/prompt-status ───────────────────────────────────────────────
// Decide se mostrare il prompt "lascia una recensione" adesso.
router.get("/reviews/prompt-status", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta." });
    return;
  }
  try {
    const signalParam = String(req.query.signal ?? "none");
    const clientSignal = (SIGNALS as readonly string[]).includes(signalParam)
      ? (signalParam as PromptSignal)
      : "none";

    const [profile, closedTrades, existing, promptState] = await Promise.all([
      getOrCreateProfile(userId),
      countClosedTrades(userId),
      findLiveReview(userId),
      db.select().from(reviewPromptStateTable).where(eq(reviewPromptStateTable.userId, userId)).limit(1),
    ]);

    const state = promptState[0] ?? null;
    const hasReviewed = existing !== null && (existing.status === "pending" || existing.status === "approved");
    const { level } = computeLevel(profile.xp);

    const result = evaluateReviewPrompt({
      closedTrades,
      level,
      streak: profile.streak,
      clientSignal,
      hasReviewed,
      optedOut: state?.optedOut ?? false,
      snoozedUntil: state?.snoozedUntil ?? null,
      now: new Date(),
    });

    if (result.shouldPrompt) {
      // Registra l'ultima visualizzazione (best-effort, non blocca la risposta).
      await db
        .insert(reviewPromptStateTable)
        .values({ userId, lastShownAt: new Date(), updatedAt: new Date() })
        .onConflictDoUpdate({
          target: reviewPromptStateTable.userId,
          set: { lastShownAt: new Date(), updatedAt: new Date() },
        });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Impossibile calcolare lo stato del prompt.", detail: String(error) });
  }
});

// ── POST /reviews/prompt-status/snooze ───────────────────────────────────────
router.post("/reviews/prompt-status/snooze", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta." });
    return;
  }
  const days = Number.isFinite(Number(req.body?.days)) ? Math.max(1, Math.min(365, Number(req.body.days))) : 30;
  const snoozedUntil = new Date(Date.now() + days * 86400000);
  await db
    .insert(reviewPromptStateTable)
    .values({ userId, snoozedUntil, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: reviewPromptStateTable.userId,
      set: { snoozedUntil, updatedAt: new Date() },
    });
  res.json({ ok: true, snoozedUntil: snoozedUntil.toISOString() });
});

// ── POST /reviews/prompt-status/opt-out ──────────────────────────────────────
router.post("/reviews/prompt-status/opt-out", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta." });
    return;
  }
  await db
    .insert(reviewPromptStateTable)
    .values({ userId, optedOut: true, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: reviewPromptStateTable.userId,
      set: { optedOut: true, updatedAt: new Date() },
    });
  res.json({ ok: true });
});

// ── GET /reviews/me ──────────────────────────────────────────────────────────
router.get("/reviews/me", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta." });
    return;
  }
  const existing = await findLiveReview(userId);
  res.json({ review: existing ? myReviewDto(existing) : null });
});

// ── POST /reviews ────────────────────────────────────────────────────────────
// Invio (o re-invio) di una recensione: arriva sempre in stato "pending".
router.post("/reviews", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta." });
    return;
  }
  const rating = parseRating(req.body?.rating);
  if (rating === null) {
    res.status(400).json({ error: "Il punteggio deve essere un intero tra 1 e 5." });
    return;
  }
  const text = String(req.body?.text ?? "").trim().slice(0, MAX_TEXT);
  if (text.length === 0) {
    res.status(400).json({ error: "Il testo della recensione è obbligatorio." });
    return;
  }
  if (req.body?.consent !== true) {
    res.status(400).json({ error: "È necessario acconsentire alla pubblicazione del nome." });
    return;
  }
  const role = req.body?.role ? String(req.body.role).trim().slice(0, MAX_ROLE) || null : null;
  const locale = req.body?.locale ? String(req.body.locale).slice(0, 8) : null;

  const profile = await getOrCreateProfile(userId);
  const now = new Date();

  const existing = await findLiveReview(userId);
  if (existing) {
    const [updated] = await db
      .update(testimonialsTable)
      .set({
        name: profile.name,
        role,
        text,
        rating,
        locale,
        status: "pending",
        published: false,
        moderatedAt: null,
        moderatedBy: null,
        updatedAt: now,
      })
      .where(eq(testimonialsTable.userId, userId))
      .returning();
    res.status(200).json({ review: myReviewDto(updated) });
    return;
  }

  const [created] = await db
    .insert(testimonialsTable)
    .values({
      name: profile.name,
      role,
      text,
      rating,
      locale,
      userId,
      status: "pending",
      published: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  res.status(201).json({ review: myReviewDto(created) });
});

// ── PATCH /reviews/me ────────────────────────────────────────────────────────
// Modifica della propria recensione: torna in coda di moderazione ("pending").
router.patch("/reviews/me", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta." });
    return;
  }
  const existing = await findLiveReview(userId);
  if (!existing) {
    res.status(404).json({ error: "Nessuna recensione da modificare." });
    return;
  }
  const set: Partial<typeof testimonialsTable.$inferInsert> = {
    status: "pending",
    published: false,
    moderatedAt: null,
    moderatedBy: null,
    updatedAt: new Date(),
  };
  if (req.body?.rating !== undefined) {
    const rating = parseRating(req.body.rating);
    if (rating === null) {
      res.status(400).json({ error: "Il punteggio deve essere un intero tra 1 e 5." });
      return;
    }
    set.rating = rating;
  }
  if (req.body?.text !== undefined) {
    const text = String(req.body.text).trim().slice(0, MAX_TEXT);
    if (text.length === 0) {
      res.status(400).json({ error: "Il testo della recensione è obbligatorio." });
      return;
    }
    set.text = text;
  }
  if (req.body?.role !== undefined) {
    set.role = req.body.role ? String(req.body.role).trim().slice(0, MAX_ROLE) || null : null;
  }
  const [updated] = await db
    .update(testimonialsTable)
    .set(set)
    .where(eq(testimonialsTable.userId, userId))
    .returning();
  res.json({ review: myReviewDto(updated) });
});

// ── DELETE /reviews/me ───────────────────────────────────────────────────────
// Ritiro morbido: la riga resta (unique index/audit) ma esce dal pubblico.
router.delete("/reviews/me", async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta." });
    return;
  }
  await db
    .update(testimonialsTable)
    .set({ status: "withdrawn", published: false, updatedAt: new Date() })
    .where(eq(testimonialsTable.userId, userId));
  res.json({ ok: true });
});

export default router;
