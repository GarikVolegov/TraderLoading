import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import accountRouter from "./account.js";
import profileRouter from "./profile.js";
import missionsRouter from "./missions.js";
import missionTemplatesRouter from "./mission-templates.js";
import quotesRouter from "./quotes.js";
import journalRouter from "./journal.js";
import ideasRouter from "./ideas.js";
import checklistRouter from "./checklist.js";
import newsRouter from "./news.js";
import settingsRouter from "./settings.js";
import friendsRouter from "./friends.js";
import chatRouter from "./chat.js";
import calendarRouter from "./calendar.js";
import backtestRouter from "./backtest.js";
import candlesRouter from "./candles.js";
import checkinsRouter from "./checkins.js";
import toolsRouter from "./tools.js";
import socialRouter from "./social.js";
import pushRouter from "./push.js";
import loginAccessRouter from "./login-access.js";
import communityRouter from "./community.js";
import communityRolesRouter from "./communityRoles.js";
import communityModerationRouter from "./communityModeration.js";
import communityChannelsRouter from "./communityChannels.js";
import communitySettingsRouter from "./communitySettings.js";
import communityReviewsRouter from "./communityReviews.js";
import referralRouter from "./referral.js";
import payoutRouter from "./payout.js";
import milestonesRouter from "./milestones.js";
import accountBridgeRouter from "./account-bridge.js";
import brokersRouter from "./brokers.js";
import routinesRouter from "./routines.js";
import libraryRouter from "./library.js";
import wikiRouter from "./wiki.js";
import adminRouter from "./admin.js";
import billingRouter from "./billing.js";
import publicRouter from "./public.js";
import supportRouter from "./support.js";
import torneiRouter from "./tornei.js";
import reviewsRouter from "./reviews.js";
import {
  ANONYMOUS_FALLBACK_PREFIXES,
  createProductionAuthGate,
} from "../middlewares/productionAuthGate.js";

const router: IRouter = Router();

// In produzione le rotte col fallback anonimo richiedono il login: senza gate
// il bucket userId IS NULL sarebbe condiviso fra tutti i visitatori.
router.use(ANONYMOUS_FALLBACK_PREFIXES, createProductionAuthGate());

router.use(healthRouter);
router.use(publicRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(billingRouter);
router.use(supportRouter);
router.use(accountRouter);
router.use(profileRouter);
router.use(missionsRouter);
router.use(missionTemplatesRouter);
router.use(quotesRouter);
router.use(journalRouter);
router.use(ideasRouter);
router.use(checklistRouter);
router.use(newsRouter);
router.use(settingsRouter);
router.use(friendsRouter);
router.use(chatRouter);
router.use(calendarRouter);
router.use(backtestRouter);
router.use(candlesRouter);
router.use(checkinsRouter);
router.use(toolsRouter);
router.use(socialRouter);
router.use(pushRouter);
router.use(loginAccessRouter);
router.use(communityRouter);
router.use(communityRolesRouter);
router.use(communityModerationRouter);
router.use(communityChannelsRouter);
router.use(communitySettingsRouter);
router.use(communityReviewsRouter);
router.use(referralRouter);
router.use(payoutRouter);
router.use(torneiRouter);
router.use(reviewsRouter);
router.use(milestonesRouter);
router.use(accountBridgeRouter);
router.use(brokersRouter);
router.use(routinesRouter);
router.use(libraryRouter);
router.use(wikiRouter);

export default router;
