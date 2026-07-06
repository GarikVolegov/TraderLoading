import { Router, type IRouter } from "express";
import { db, referralCodesTable, referralsTable, profileTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getUserId } from "./profile.js";
import {
  generateReferralCode,
  canAttributeReferral,
  shouldGrantReferralReward,
  REFERRAL_REWARD_XP,
} from "../services/referral.js";

const router: IRouter = Router();

/** The user's referral code, created (and persisted for reverse lookup) on first use. */
async function ensureReferralCode(userId: string): Promise<string> {
  const [existing] = await db
    .select({ code: referralCodesTable.code })
    .from(referralCodesTable)
    .where(eq(referralCodesTable.userId, userId))
    .limit(1);
  if (existing) return existing.code;
  const code = generateReferralCode(userId);
  await db.insert(referralCodesTable).values({ userId, code }).onConflictDoNothing();
  const [row] = await db
    .select({ code: referralCodesTable.code })
    .from(referralCodesTable)
    .where(eq(referralCodesTable.userId, userId))
    .limit(1);
  return row?.code ?? code;
}

router.get("/referral", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return; }
  const code = await ensureReferralCode(userId);
  const [count] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(referralsTable)
    .where(eq(referralsTable.referrerUserId, userId));
  res.json({ code, link: `/sign-up?ref=${code}`, referrals: count?.n ?? 0, rewardXp: REFERRAL_REWARD_XP });
});

// Attribute the current user (the invitee) to a referral code — called once at
// sign-up. Records the referral (one per invitee) and grants the referrer a one-time
// XP reward.
router.post("/referral/attribute", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: "Autenticazione richiesta" }); return; }
  const code = typeof req.body?.code === "string" ? req.body.code.trim().toUpperCase() : "";
  if (!code) { res.status(400).json({ error: "Codice mancante" }); return; }

  const [codeRow] = await db
    .select({ userId: referralCodesTable.userId })
    .from(referralCodesTable)
    .where(eq(referralCodesTable.code, code))
    .limit(1);
  if (!codeRow || !canAttributeReferral(codeRow.userId, userId)) {
    res.json({ attributed: false });
    return;
  }
  const referrerUserId = codeRow.userId;

  const [inserted] = await db
    .insert(referralsTable)
    .values({ referrerUserId, referredUserId: userId })
    .onConflictDoNothing({ target: referralsTable.referredUserId })
    .returning({ id: referralsTable.id, rewardedAt: referralsTable.rewardedAt });
  if (!inserted) {
    res.json({ attributed: false }); // invitee already referred by someone
    return;
  }

  if (shouldGrantReferralReward({ rewardedAt: inserted.rewardedAt })) {
    await db
      .update(profileTable)
      .set({ xp: sql`${profileTable.xp} + ${REFERRAL_REWARD_XP}` })
      .where(eq(profileTable.userId, referrerUserId));
    await db.update(referralsTable).set({ rewardedAt: new Date() }).where(eq(referralsTable.id, inserted.id));
  }
  res.json({ attributed: true, rewardXp: REFERRAL_REWARD_XP });
});

export default router;
