// Paid-channel pricing (in real currency), Stripe-Connect checkout and per-viewer access
// state (marketplace model). Off-contract. Entitlements are granted on the webhook.
import { Router, type IRouter, type Request, type Response } from "express";
import { db, communityChannelsTable, communityChannelEntitlementsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  getMemberContext,
  requirePermission,
  hasPermission,
} from "../services/communityPermissions.js";
import { canAccessChannel } from "../services/community/channelAccess.js";
import { isChannelFree, validateChannelPrice } from "../services/community/channelPricing.js";
import {
  createChannelCheckout,
  ChannelNotFoundError,
  ChannelFreeError,
  AlreadyOwnedError,
  OwnerCannotBuyError,
  NotMemberError,
  BannedError,
  CreatorNotOnboardedError,
} from "../services/community/channelCheckout.js";
import { getStripeBillingConfig, createStripeClient } from "../lib/billing.js";
import { createMoneyRateLimiter } from "../lib/moneyRateLimit.js";

const router: IRouter = Router();

// Cap checkout-session creation per user (each hits Stripe).
const checkoutLimiter = createMoneyRateLimiter({ windowMs: 60_000, limit: 20 });

function requireAuth(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return null; }
  return userId;
}

// ─── Set / clear a channel's price (creator or channels.manage) ──────────────
router.patch("/community/channels/:channelId/pricing", async (req, res) => {
  try {
    const channelId = parseInt(String(req.params.channelId));
    if (isNaN(channelId)) { res.status(400).json({ error: "Canale non valido" }); return; }

    const [channel] = await db
      .select({ communityId: communityChannelsTable.communityId })
      .from(communityChannelsTable)
      .where(eq(communityChannelsTable.id, channelId))
      .limit(1);
    if (!channel) { res.status(404).json({ error: "Canale non trovato" }); return; }

    if (!(await requirePermission(req, res, channel.communityId, "channels.manage"))) return;

    const result = validateChannelPrice({
      priceCents: req.body?.priceCents ?? null,
      accessModel: req.body?.accessModel ?? null,
      subInterval: req.body?.subInterval ?? null,
    });
    if (!result.ok) { res.status(400).json({ error: result.reason }); return; }

    // Changing price/model invalidates any cached Stripe Price for a subscription channel.
    await db
      .update(communityChannelsTable)
      .set({
        priceCents: result.normalized.priceCents,
        accessModel: result.normalized.accessModel,
        subInterval: result.normalized.subInterval,
        stripePriceId: null,
      })
      .where(eq(communityChannelsTable.id, channelId));

    res.json({ ...result.normalized });
  } catch (err) {
    console.error("PATCH /community/channels/:channelId/pricing error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Start a Stripe Checkout to unlock a paid channel ─────────────────────────
router.post("/community/channels/:channelId/checkout", checkoutLimiter, async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  const billing = getStripeBillingConfig();
  if (!billing.secretKey) { res.status(402).json({ error: "Pagamenti non disponibili", code: "unconfigured" }); return; }
  try {
    const channelId = parseInt(String(req.params.channelId));
    if (isNaN(channelId)) { res.status(400).json({ error: "Canale non valido" }); return; }

    const url = await createChannelCheckout(userId, channelId, createStripeClient(billing.secretKey), billing.appBaseUrl);
    res.json({ url });
  } catch (err) {
    if (err instanceof ChannelNotFoundError) { res.status(404).json({ error: "Canale non trovato" }); return; }
    if (err instanceof ChannelFreeError) { res.status(400).json({ error: "Canale gratuito", code: "free" }); return; }
    if (err instanceof OwnerCannotBuyError) { res.status(400).json({ error: "Hai già accesso", code: "already_access" }); return; }
    if (err instanceof NotMemberError) { res.status(403).json({ error: "Non sei membro", code: "not_member" }); return; }
    if (err instanceof BannedError) { res.status(403).json({ error: "Sei stato bannato", code: "banned" }); return; }
    if (err instanceof AlreadyOwnedError) { res.status(409).json({ error: "Accesso già attivo", code: "already_owned" }); return; }
    if (err instanceof CreatorNotOnboardedError) { res.status(409).json({ error: "Il creatore non può ancora ricevere pagamenti", code: "creator_not_onboarded" }); return; }
    console.error("POST /community/channels/:channelId/checkout error:", err);
    res.status(502).json({ error: "Checkout non disponibile" });
  }
});

// ─── Per-viewer access state for a channel ───────────────────────────────────
router.get("/community/channels/:channelId/access", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const channelId = parseInt(String(req.params.channelId));
    if (isNaN(channelId)) { res.status(400).json({ error: "Canale non valido" }); return; }

    const [channel] = await db
      .select()
      .from(communityChannelsTable)
      .where(eq(communityChannelsTable.id, channelId))
      .limit(1);
    if (!channel) { res.status(404).json({ error: "Canale non trovato" }); return; }

    const ctx = await getMemberContext(channel.communityId, userId);
    const [entitlement] = await db
      .select({ expiresAt: communityChannelEntitlementsTable.expiresAt })
      .from(communityChannelEntitlementsTable)
      .where(and(eq(communityChannelEntitlementsTable.channelId, channelId), eq(communityChannelEntitlementsTable.userId, userId)))
      .limit(1);

    const isFree = isChannelFree(channel);
    const locked = !canAccessChannel({
      isFree,
      isOwner: ctx.isOwner,
      canManage: hasPermission(ctx, "channels.manage"),
      entitlement: entitlement ?? null,
      now: new Date(),
    });

    res.json({
      isFree,
      priceCents: channel.priceCents ?? null,
      accessModel: channel.accessModel ?? null,
      subInterval: channel.subInterval ?? null,
      currency: channel.currency,
      locked,
      entitlement: entitlement ? { expiresAt: entitlement.expiresAt } : null,
    });
  } catch (err) {
    console.error("GET /community/channels/:channelId/access error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

export default router;
