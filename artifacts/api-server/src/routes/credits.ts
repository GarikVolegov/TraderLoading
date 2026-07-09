// Credit wallet + purchase (sub-project B, off-contract). Credits are bought via
// Stripe Checkout (mode=payment) and granted only on the webhook (see billing.ts
// processStripeEventOnce), never on the client redirect. Balance/packs are reads.
import { Router, type IRouter } from "express";
import { db, creditTransactionsTable } from "@workspace/db";
import { and, desc, eq, lt } from "drizzle-orm";
import { createStripeClient, getStripeBillingConfig } from "../lib/billing.js";
import { getBalance } from "../services/credits/wallet.js";
import { CREDIT_PACKS, creditPackFor, packPriceId } from "../services/credits/packs.js";
import { createMoneyRateLimiter } from "../lib/moneyRateLimit.js";
import logger from "../lib/logger.js";

const router: IRouter = Router();

// Cap how often a user can spin up Stripe Checkout sessions.
const checkoutLimiter = createMoneyRateLimiter({ windowMs: 60_000, limit: 10 });

router.get("/credits/wallet", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return; }
  try {
    res.json({ balance: await getBalance(userId) });
  } catch (err) {
    logger.error({ err }, "[credits] wallet read failed");
    res.status(500).json({ error: "Errore interno" });
  }
});

// The user's own credit ledger (transparency): keyset-paginated, newest first. Only
// the movement + reason is exposed — not the Stripe event/payment-intent ids.
router.get("/credits/transactions", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return; }
  try {
    const cursor = req.query.cursor ? parseInt(String(req.query.cursor)) : undefined;
    const limit = 50;
    const conditions = [eq(creditTransactionsTable.userId, userId)];
    if (cursor && !isNaN(cursor)) conditions.push(lt(creditTransactionsTable.id, cursor));
    const rows = await db
      .select({
        id: creditTransactionsTable.id,
        delta: creditTransactionsTable.delta,
        reason: creditTransactionsTable.reason,
        refId: creditTransactionsTable.refId,
        balanceAfter: creditTransactionsTable.balanceAfter,
        createdAt: creditTransactionsTable.createdAt,
      })
      .from(creditTransactionsTable)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(creditTransactionsTable.id))
      .limit(limit);
    res.json({ transactions: rows, nextCursor: rows.length === limit ? rows[rows.length - 1].id : null });
  } catch (err) {
    logger.error({ err }, "[credits] transactions read failed");
    res.status(500).json({ error: "Errore interno" });
  }
});

router.get("/credits/packs", (_req, res) => {
  res.json({
    packs: CREDIT_PACKS.map((p) => ({
      id: p.id,
      credits: p.credits,
      // The UI hides packs whose Stripe Price isn't configured (feature ships dark).
      priceConfigured: packPriceId(p) !== null,
    })),
  });
});

router.post("/credits/checkout", checkoutLimiter, async (req, res) => {
  const user = req.user;
  if (!user?.id) { res.status(401).json({ error: "Autenticazione richiesta" }); return; }
  const pack = creditPackFor(req.body?.packId);
  if (!pack) { res.status(400).json({ error: "Pacchetto non valido" }); return; }

  const config = getStripeBillingConfig();
  const priceId = packPriceId(pack);
  if (!config.configured || !config.secretKey || !priceId) {
    res.status(402).json({ error: "Acquisto crediti non disponibile" }); return;
  }
  try {
    const stripe = createStripeClient(config.secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${config.appBaseUrl}/?credits=success`,
      cancel_url: `${config.appBaseUrl}/?credits=cancel`,
      client_reference_id: user.id,
      // The webhook grants credits idempotently from this metadata.
      metadata: { type: "credit_purchase", userId: user.id, packId: pack.id },
    });
    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "[credits] checkout failed");
    res.status(500).json({ error: "Errore interno" });
  }
});

export default router;
