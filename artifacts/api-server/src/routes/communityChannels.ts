// Paid-channel pricing, unlock (purchase/renew) and per-viewer access state
// (sub-project C). Off-contract (direct JSON, like the rest of the community API).
import { Router, type IRouter, type Request, type Response } from "express";
import { db, communityChannelsTable, communityChannelEntitlementsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  getMemberContext,
  requirePermission,
  hasPermission,
} from "../services/communityPermissions.js";
import {
  isChannelFree,
  canAccessChannel,
  validateChannelPricing,
} from "../services/community/channelAccess.js";
import {
  unlockChannel,
  ChannelNotFoundError,
  ChannelFreeError,
  AlreadyOwnedError,
  OwnerCannotBuyError,
  NotMemberError,
  BannedError,
  PriceChangedError,
} from "../services/community/channelUnlock.js";
import { InsufficientCreditsError } from "../services/credits/wallet.js";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return null; }
  return userId;
}

// ─── Set / clear a channel's price (creator or channels.manage) ──────────────
router.patch("/community/channels/:channelId/pricing", async (req, res) => {
  try {
    const channelId = parseInt(req.params.channelId);
    if (isNaN(channelId)) { res.status(400).json({ error: "Canale non valido" }); return; }

    const [channel] = await db
      .select({ communityId: communityChannelsTable.communityId })
      .from(communityChannelsTable)
      .where(eq(communityChannelsTable.id, channelId))
      .limit(1);
    if (!channel) { res.status(404).json({ error: "Canale non trovato" }); return; }

    if (!(await requirePermission(req, res, channel.communityId, "channels.manage"))) return;

    const result = validateChannelPricing({
      priceCredits: req.body?.priceCredits ?? null,
      accessModel: req.body?.accessModel ?? null,
      subscriptionPeriodDays: req.body?.subscriptionPeriodDays ?? null,
    });
    if (!result.ok) { res.status(400).json({ error: result.error }); return; }

    await db
      .update(communityChannelsTable)
      .set({
        priceCredits: result.normalized.priceCredits,
        accessModel: result.normalized.accessModel,
        subscriptionPeriodDays: result.normalized.subscriptionPeriodDays,
      })
      .where(eq(communityChannelsTable.id, channelId));

    res.json({ ...result.normalized });
  } catch (err) {
    console.error("PATCH /community/channels/:channelId/pricing error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Unlock (purchase / renew) a paid channel ────────────────────────────────
router.post("/community/channels/:channelId/unlock", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const channelId = parseInt(req.params.channelId);
    if (isNaN(channelId)) { res.status(400).json({ error: "Canale non valido" }); return; }

    const rawExpected = req.body?.expectedPriceCredits;
    const expectedPriceCredits = typeof rawExpected === "number" && Number.isInteger(rawExpected) ? rawExpected : undefined;

    const result = await unlockChannel(userId, channelId, expectedPriceCredits);
    res.json(result);
  } catch (err) {
    if (err instanceof ChannelNotFoundError) { res.status(404).json({ error: "Canale non trovato" }); return; }
    if (err instanceof ChannelFreeError) { res.status(400).json({ error: "Canale gratuito", code: "free" }); return; }
    if (err instanceof PriceChangedError) { res.status(409).json({ error: "Prezzo cambiato", code: "price_changed", priceCredits: err.currentPrice }); return; }
    if (err instanceof OwnerCannotBuyError) { res.status(400).json({ error: "Hai già accesso", code: "already_access" }); return; }
    if (err instanceof NotMemberError) { res.status(403).json({ error: "Non sei membro", code: "not_member" }); return; }
    if (err instanceof BannedError) { res.status(403).json({ error: "Sei stato bannato", code: "banned" }); return; }
    if (err instanceof AlreadyOwnedError) { res.status(409).json({ error: "Accesso già attivo", code: "already_owned" }); return; }
    if (err instanceof InsufficientCreditsError) { res.status(402).json({ error: "Crediti insufficienti", code: "insufficient_credits" }); return; }
    console.error("POST /community/channels/:channelId/unlock error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

// ─── Per-viewer access state for a channel ───────────────────────────────────
router.get("/community/channels/:channelId/access", async (req, res) => {
  const userId = requireAuth(req, res);
  if (!userId) return;
  try {
    const channelId = parseInt(req.params.channelId);
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
      .where(
        and(
          eq(communityChannelEntitlementsTable.channelId, channelId),
          eq(communityChannelEntitlementsTable.userId, userId),
        ),
      )
      .limit(1);

    const now = new Date();
    const isFree = isChannelFree(channel);
    const canManage = hasPermission(ctx, "channels.manage");
    const locked = !canAccessChannel({
      isFree,
      isOwner: ctx.isOwner,
      canManage,
      entitlement: entitlement ?? null,
      now,
    });

    res.json({
      isFree,
      priceCredits: channel.priceCredits ?? null,
      accessModel: channel.accessModel ?? null,
      subscriptionPeriodDays: channel.subscriptionPeriodDays ?? null,
      locked,
      entitlement: entitlement ? { expiresAt: entitlement.expiresAt } : null,
    });
  } catch (err) {
    console.error("GET /community/channels/:channelId/access error:", err);
    res.status(500).json({ error: "Errore interno" });
  }
});

export default router;
