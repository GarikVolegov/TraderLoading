import assert from "node:assert/strict";
import { assessProcessReview, hasApplicationHold, pendingProcessReviews, resolveProcessGuidance } from "./processPolicy.js";
import { computeProcessProgress } from "./traderProcess.js";
import type { ProcessEvidence, ProcessMethod, ProcessReview, ProcessSession } from "../../../../contracts/trader-process.js";

const now = new Date("2026-10-13T12:00:00Z");
const method: ProcessMethod = {
  id: "version", methodId: "family", version: 1, name: "Synthetic", active: true, phase: "apply",
  createdAt: "2026-09-01T12:00:00Z", phaseStartedAt: "2026-09-01T12:00:00Z",
  verificationStartedAt: "2026-09-01T12:00:00Z", applicationStartedAt: "2026-09-01T12:00:00Z",
  riskConfirmedAt: "2026-09-01T12:00:00Z", reviewPolicyStartedAt: "2026-09-01T12:00:00Z",
  rules: { markets: ["EURUSD"], windows: "Test", setup: "Test", entry: "Test", exit: "Test",
    invalidation: "Test", waitConditions: "Test", currency: "EUR", riskPerTrade: 10,
    maxDailyLoss: 20, maxDailyTrades: 2, checklist: ["Check"] },
  protocol: { minSamples: 2, periodStart: "2026-09-01", periodEnd: "2026-09-02",
    minExpectancyR: 0, maxDrawdownR: 2, observationDays: 7, minAdherencePct: 90 },
};
function evidence(id: string, day: string, pnl: number): ProcessEvidence {
  return { id, methodVersionId: method.id, purpose: "live", source: "manual", executionEnvironment: "real",
    initialRisk: 10, netPnl: pnl, netR: pnl / 10, costsStatus: "included", currency: "EUR", account: "test",
    observedAt: `${day}T12:00:00Z`, createdAt: `${day}T12:00:00Z`, adherence: "unknown",
    provenance: "declared", note: "", accountTradeId: null, backtestTradeId: null, sessionId: null };
}
const rows = [evidence("a", "2026-09-15", 15), evidence("b", "2026-10-02", -5)];
const pending = pendingProcessReviews(method, [], rows, [], now);
assert.equal(pending.length, 2);
assert.equal(pending[0].kind, "four_week");
assert.equal(pending[0].coveredPeriods.length, 2, "A completed four-week review also covers its due active week");
assert.equal(pending[1].kind, "weekly");
assert.deepEqual(pendingProcessReviews({ ...method, reviewPolicyStartedAt: "2026-10-13T00:00:00Z" }, [], rows, [], now), [], "Migration creates no retroactive obligations");
assert.deepEqual(pendingProcessReviews(method, [], [], [], now), [], "Inactive periods need no invented reviews");
const confirmed = { methodVersionId: method.id, decision: "continue", coveredPeriods: pending[0].coveredPeriods } as ProcessReview;
assert.equal(pendingProcessReviews(method, [], rows, [confirmed], now).length, 1, "All covered periods are satisfied together");
const progress = computeProcessProgress(method, rows, [], [], null, now, pending);
const guidance = (session: ProcessSession | null, reviews: ProcessReview[] = []) => resolveProcessGuidance({ method, session, progress, pendingReviews: pending, reviews, now });
assert.equal(guidance(null).action, "review_period");
const held = { ...confirmed, decision: "reverify" } as ProcessReview;
assert.equal(guidance(null, [held]).action, "revise_method");
assert.equal(hasApplicationHold(method.id, [held, confirmed]), true, "A later continue record cannot silently remove suspension");
const session = { id: "session", day: "2026-10-12", methodVersionId: method.id, state: "operation", mode: "application", preparedAt: "2026-10-12T12:00:00Z" } as ProcessSession;
assert.equal(guidance(session, [held]).action, "resume_session", "An open session stays documentable before a hold or overdue review");
assert.equal(assessProcessReview({ ...method, protocol: { ...method.protocol!, minAdherencePct: 0 } }, [rows[0]], [], now).decision, "continue", "An immature economic sample is neither success nor economic failure");
assert.equal(assessProcessReview(method, [evidence("x", "2026-10-01", -10), evidence("y", "2026-10-02", -20)], [], now).decision, "reverify");
const verifying = { ...method, phase: "verify", protocol: { ...method.protocol!, periodStart: "2026-10-13", periodEnd: "2026-10-16" } } as ProcessMethod;
const validationDraft = { ...session, preparedAt: null, day: "2026-10-13", mode: "validation", state: "preparation" } as ProcessSession;
assert.equal(resolveProcessGuidance({ method: verifying, session: validationDraft, progress, pendingReviews: [], reviews: [], now }).action, "check_in");
console.log("Process priority, recurring reviews, grouped periods, migration compatibility and sticky suspension checks passed");
