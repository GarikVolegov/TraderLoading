import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { ProcessMethod, ProcessSession, ProcessState, ProcessReview } from "../../contracts/trader-process.js";

type Call = (path: string, user?: string, body?: unknown, method?: string) => Promise<{ status: number; data: unknown }>;
export async function verifyGuidedPolicy({ pool, call, methodBody, today, check }: {
  pool: Pool; call: Call; methodBody: () => Record<string, unknown>; today: string; check: (name: string) => void;
}) {
  const user = "guided-policy";
  const initial = (await call("process", user)).data as ProcessState;
  assert.equal(initial.guidance?.action, "define_method");
  const created = await call("process/methods", user, methodBody());
  assert.equal(created.status, 201);
  const method = created.data as ProcessMethod;
  assert.equal((await call("process", user)).status, 200);
  await call(`process/methods/${method.id}/advance`, user, { expectedPhase: "define", review: "Synthetic protocol confirmed" });
  const draft = (await call("process/sessions", user, {})).data as ProcessSession;
  assert.equal(draft.mode, "validation");
  assert.equal(((await call("process", user)).data as ProcessState).guidance?.action, "check_in");
  assert.equal((await call(`process/sessions/${draft.id}?expectedRevision=${draft.revision + 1}`, user, undefined, "DELETE")).status, 409);
  assert.equal((await call(`process/sessions/${draft.id}?expectedRevision=${draft.revision}`, "stranger", undefined, "DELETE")).status, 204);
  assert.ok(((await call("process", user)).data as ProcessState).session);
  assert.equal((await call(`process/sessions/${draft.id}?expectedRevision=${draft.revision}`, user, undefined, "DELETE")).status, 204);
  assert.equal((await call(`process/sessions/${draft.id}?expectedRevision=${draft.revision}`, user, undefined, "DELETE")).status, 204);
  assert.equal(((await call("process", user)).data as ProcessState).session, null);
  check("Validation sessions are server-selected; unstarted drafts discard with ownership and optimistic revision without fake completion");

  const start = new Date(`${today}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 35);
  const basis = start.toISOString();
  await pool.query("UPDATE process_methods SET phase='apply',application_started_at=$2,phase_started_at=$2,review_policy_started_at=$2,protocol=jsonb_set(jsonb_set(protocol,'{minAdherencePct}','0'::jsonb),'{observationDays}','100'::jsonb) WHERE id=$1", [method.id, basis]);
  for (let n = 0; n < 2; n++) {
    const instant = new Date(start);
    instant.setUTCDate(instant.getUTCDate() + n);
    const response = await call("process/evidence", user, {
      requestId: randomUUID(), methodVersionId: method.id, purpose: "live", source: "manual", executionEnvironment: "real",
      initialRisk: 10, netPnl: 20, costsStatus: "included", currency: "EUR", account: "synthetic-real",
      observedAt: instant.toISOString(), adherence: "unknown", provenance: "declared",
    });
    assert.equal(response.status, 201, JSON.stringify(response.data));
  }
  const dueState = (await call("process", user)).data as ProcessState;
  assert.equal(dueState.guidance?.action, "review_period");
  assert.ok(dueState.pendingReviews?.length);
  assert.equal((await call("process/sessions", user, {})).status, 409);
  const period = dueState.pendingReviews![0];
  const reviewInput = { methodVersionId: method.id, kind: period.kind, periodStart: period.periodStart, periodEnd: period.periodEnd,
    judgment: "Synthetic cumulative evidence meets the personal protocol", action: "Use the predefined level", criterion: "No unplanned entries", requestId: randomUUID() };
  const retries = await Promise.all([call("process/reviews", user, reviewInput), call("process/reviews", user, reviewInput)]);
  assert.deepEqual(retries.map(r => r.status), [201, 201]);
  const review = retries[0].data as ProcessReview;
  assert.equal(review.id, (retries[1].data as ProcessReview).id);
  assert.equal(review.decision, "continue");
  assert.ok(review.reviewedAt.startsWith(today));
  assert.equal((await call("process/reviews", "stranger", reviewInput)).status, 404);
  assert.equal((await call("process/reviews", user, { ...reviewInput, criterion: "Changed silently" })).status, 409);
  assert.equal((await call("process/improvements", user, { methodVersionId: method.id, recapId: review.recapId,
    action: "Changed silently", criterion: "Changed", requestId: randomUUID() })).status, 409);
  check("Overdue active periods are recoverable atomically; retries coalesce, historical timestamps stay honest and review criteria are immutable");

  const { withProcessOrderAuthorization } = await import("../../artifacts/api-server/src/services/processAuthorization.js");
  let submissions = 0;
  await assert.rejects(() => withProcessOrderAuthorization(user, { symbol: "EURUSD", environment: "real", side: "buy", stopLoss: 1, currency: "EUR" }, async () => { submissions++; }), /preparazione|sessione/i);
  const session = (await call("process/sessions", user, {})).data as ProcessSession;
  const prepared = await call(`process/sessions/${session.id}`, user, {
    action: "check_in", preparation: { checklist: method.rules.checklist.map(() => true) },
    plan: { decision: "trade", market: "EURUSD", setup: "Synthetic", entry: "Synthetic", stop: "1.05", invalidation: "Synthetic invalidation", initialRisk: 10 },
  }, "PATCH");
  assert.equal(prepared.status, 200, JSON.stringify(prepared.data));
  await withProcessOrderAuthorization(user, { symbol: "EURUSD", environment: "real", side: "buy", stopLoss: 1.05, currency: "EUR" }, async () => { submissions++; });
  assert.equal(submissions, 1);
  await assert.rejects(() => withProcessOrderAuthorization(user, { symbol: "GBPUSD", environment: "real", side: "buy", stopLoss: 1.05, currency: "EUR" }, async () => { submissions++; }), /mercato/i);
  await assert.rejects(() => withProcessOrderAuthorization(user, { symbol: "EURUSD", environment: "unknown", side: "buy", stopLoss: 1.05, currency: "EUR" }, async () => { submissions++; }), /Ambiente/);
  assert.equal(submissions, 1);
  check("Actual broker-opening policy allows only prepared applicable plans; wrong markets and unknown environments never reach the synthetic submission callback");

  const closed = await call(`process/sessions/${session.id}`, user, { action: "close", closure: { notes: "No opportunity", violations: [], reconciled: true, noTrades: true, assessment: "conforming" } }, "PATCH");
  assert.equal(closed.status, 200);
  assert.equal(((await call("process", user)).data as ProcessState).guidance?.action, "done");
  const lastWeek = new Date(`${today}T12:00:00Z`);
  lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);
  await call("process/evidence", user, { requestId: randomUUID(), methodVersionId: method.id, purpose: "live", source: "external", executionEnvironment: "real",
    initialRisk: 10, netPnl: -200, costsStatus: "included", currency: "EUR", account: "synthetic-real", observedAt: lastWeek.toISOString(), adherence: "unknown", provenance: "declared" });
  const nextState = (await call("process", user)).data as ProcessState;
  const next = nextState.pendingReviews![0];
  assert.ok(next);
  const held = await call("process/reviews", user, { ...reviewInput, kind: next.kind, periodStart: next.periodStart, periodEnd: next.periodEnd,
    previousImprovementOutcome: "not_met", previousImprovementNote: "The predefined rule was not followed", requestId: randomUUID() });
  assert.equal(held.status, 201, JSON.stringify(held.data));
  assert.equal((held.data as ProcessReview).decision, "reverify");
  const heldState = (await call("process", user)).data as ProcessState;
  assert.equal(heldState.guidance?.action, "revise_method");
  assert.equal(heldState.activeMethod?.phase, "apply", "Suspension must not rewrite the historical phase");
  await assert.rejects(() => withProcessOrderAuthorization(user, { symbol: "EURUSD", environment: "real", side: "buy", stopLoss: 1.05, currency: "EUR" }, async () => { submissions++; }), /verifica/);
  assert.equal(submissions, 1);
  assert.equal((await call(`process/methods/${method.id}/advance`, user, { expectedPhase: "apply", review: "Try bypass" })).status, 409);
  await pool.query("UPDATE process_methods SET active=false WHERE id=$1", [method.id]);
  assert.equal((await call(`process/methods/${method.id}/activate`, user, {})).status, 409, "A suspended historical version cannot be reactivated to bypass review");
  await pool.query("UPDATE process_methods SET active=true WHERE id=$1", [method.id]);
  const fact = await call("journal", user, { title: "Real fact outside the suspended process", content: "", tradeDate: today, result: "none" });
  assert.equal(fact.status, 201);
  check("Deterioration persists a suspension and improvement outcome without changing historical phase; new openings and advancement are blocked while factual journal remains writable");
}
