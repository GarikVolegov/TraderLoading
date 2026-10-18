import assert from "node:assert/strict";
import {
  calculateNetR,
  computeProcessProgress,
  economicallyComplete,
  processDay,
} from "./traderProcess";
import type {
  ProcessMethod,
  ProcessEvidence,
  ProcessSession,
} from "../../../../contracts/trader-process";

const now = new Date("2026-10-11T12:00:00Z");
const method: ProcessMethod = {
  id: "method",
  methodId: "family",
  version: 1,
  name: "Test",
  active: true,
  phase: "verify",
  createdAt: "2026-10-01T10:00:00Z",
  phaseStartedAt: "2026-10-01T11:00:00Z",
  verificationStartedAt: "2026-10-01T11:00:00Z",
  applicationStartedAt: null,
  riskConfirmedAt: "2026-10-01T10:00:00Z",
  rules: {
    markets: ["EURUSD"],
    windows: "Europe",
    setup: "Setup",
    entry: "Entry",
    exit: "Exit",
    invalidation: "Invalid",
    waitConditions: "No setup",
    riskPerTrade: 10,
    maxDailyLoss: 20,
    maxDailyTrades: 2,
    currency: "EUR",
    checklist: ["Rule"],
  },
  protocol: {
    minSamples: 2,
    periodStart: "2026-10-01",
    periodEnd: "2026-10-10",
    minExpectancyR: 0,
    maxDrawdownR: 2,
    observationDays: 1,
    minAdherencePct: 100,
  },
};
const evidence = (
  id: string,
  netPnl: number,
  overrides: Partial<ProcessEvidence> = {},
): ProcessEvidence => ({
  id,
  methodVersionId: "method",
  purpose: "validation",
  source: "external",
  initialRisk: 10,
  netPnl,
  netR: netPnl / 10,
  costsStatus: "included",
  currency: "EUR",
  account: "test",
  observedAt: "2026-10-03T10:00:00Z",
  createdAt: "2026-10-03T10:00:00Z",
  adherence: "unknown",
  provenance: "declared",
  note: "",
  accountTradeId: null,
  backtestTradeId: null,
  sessionId: null,
  ...overrides,
  executionEnvironment: overrides.executionEnvironment ?? (overrides.purpose === "live" ? "real" : "simulation"),
});
assert.equal(calculateNetR(15, 10), 1.5);
assert.equal(calculateNetR(-12, 10), -1.2);
assert.equal(calculateNetR(2, 0), null);
assert.equal(calculateNetR(null, 10), null);
assert.equal(calculateNetR(2, Infinity), null);
assert.equal(calculateNetR(1e300, 1e-300), null);
const good = [evidence("1", 20), evidence("2", -10, { observedAt: "2026-10-04T10:00:00Z" })];
const report = computeProcessProgress(method, good, [], [], null, now);
assert.equal(report.canAdvance, true);
assert.equal(report.report.expectancyR, 0.5);
assert.equal(report.report.drawdownR, 1);
assert.equal(report.nextAction, "review_verification");
for (const overrides of [
  { costsStatus: "unknown" as const },
  { initialRisk: null },
  { currency: null },
  { account: null },
  { provenance: "estimated" as const },
  { netR: 100 },
])
  assert.equal(economicallyComplete(evidence("bad", 20, overrides)), false);
assert.equal(
  computeProcessProgress(
    method,
    [good[0], evidence("missing", 20, { costsStatus: "unknown" })],
    [],
    [],
    null,
    now,
  ).canAdvance,
  false,
);
assert.equal(
  computeProcessProgress(
    method,
    [
      ...good,
      evidence("different", 1000, { methodVersionId: "different" }),
      evidence("development", 1000, { purpose: "development" }),
      evidence("old", 1000, { observedAt: "2026-09-30T12:00:00Z" }),
    ],
    [],
    [],
    null,
    now,
  ).report.eligibleSamples,
  2,
);
assert.equal(
  computeProcessProgress(method, good, [], [], null, new Date("2026-10-10T12:00:00Z")).canAdvance,
  false,
  "Test must finish before confirmation",
);
const amounts = computeProcessProgress(
  method,
  [good[0], evidence("usd", 20, { currency: "USD", account: "other" })],
  [],
  [],
  null,
  now,
).report.amounts;
assert.equal(amounts.length, 2, "Never sum cash across accounts/currencies");
const applied = {
  ...method,
  phase: "apply" as const,
  applicationStartedAt: "2026-10-09T10:00:00Z",
  phaseStartedAt: "2026-10-09T10:00:00Z",
};
const session: ProcessSession = {
  draft: null,
  revision: 0,
  id: "session",
  day: "2026-10-10",
  methodVersionId: "method",
  rulesSnapshot: method.rules,
  state: "closed",
  checklist: [true],
  mood: "Ready",
  focus: "Rule",
  plan: { decision: "wait", waitReason: "No setup" },
  closure: { notes: "Wait", violations: [], reconciled: true, noTrades: true },
  improvementId: null,
  createdAt: "2026-10-10T08:00:00Z",
  preparedAt: "2026-10-10T08:01:00Z",
  closedAt: "2026-10-10T10:00:00Z",
  updatedAt: "2026-10-10T10:00:00Z",
};
const noTrade = computeProcessProgress(applied, [], [session], [], session, now);
assert.equal(noTrade.report.adherencePct, 100);
assert.equal(noTrade.report.eligibleSamples, 0);
assert.equal(noTrade.canAdvance, false, "No trade documents discipline, not economic evidence");
const live = [
  evidence("live1", 20, {
    purpose: "live",
    sessionId: "session",
    adherence: "conforming",
    observedAt: "2026-10-10T09:00:00Z",
  }),
  evidence("live2", -10, {
    purpose: "live",
    sessionId: "session",
    adherence: "unknown",
    observedAt: "2026-10-10T09:30:00Z",
  }),
];
const trading = {
  ...session,
  plan: { decision: "trade" as const },
  closure: { ...session.closure!, noTrades: false },
};
assert.equal(
  computeProcessProgress(applied, live, [trading], [], trading, now).report.adherencePct,
  50,
  "Unknown adherence stays in the denominator",
);
assert.equal(
  computeProcessProgress(
    applied,
    [
      ...live,
      evidence("unprepared", 20, {
        purpose: "live",
        observedAt: "2026-10-10T11:00:00Z",
        adherence: "conforming",
      }),
    ],
    [trading],
    [],
    trading,
    now,
  ).report.adherencePct,
  100 / 3,
  "Unprepared live evidence cannot manufacture adherence and stays in the denominator",
);
assert.equal(
  computeProcessProgress({ ...method, phase: "define", protocol: null }, [], [], [], null, now)
    .canAdvance,
  false,
);
const practice = { ...trading, mode: "practice" as const };
assert.equal(
  computeProcessProgress(applied, live, [practice], [], practice, now).report.eligibleSamples,
  0,
);
assert.equal(
  computeProcessProgress(applied, live, [practice], [], practice, now).report.closedSessions,
  0,
);
assert.equal(
  computeProcessProgress(
    method,
    good.map((e) => ({ ...e, sessionId: practice.id })),
    [practice],
    [],
    practice,
    now,
  ).report.eligibleSamples,
  0,
);
for (const assessment of ["unknown", "deviation"] as const) {
  const reviewed = { ...session, closure: { ...session.closure!, assessment } };
  assert.equal(
    computeProcessProgress(applied, [], [reviewed], [], reviewed, now).report.adherencePct,
    0,
  );
}
const violated = {
  ...trading,
  closure: { ...trading.closure, assessment: "conforming" as const, violations: ["Risk exceeded"] },
};
assert.equal(
  computeProcessProgress(applied, live, [violated], [], violated, now).report.adherencePct,
  0,
  "A positive recap cannot erase documented violations",
);
const consolidated = {
  ...applied,
  phase: "consolidate" as const,
  phaseStartedAt: "2026-10-11T10:00:00Z",
};
assert.equal(
  computeProcessProgress(consolidated, live, [trading], [], trading, now).report.eligibleSamples,
  2,
  "Consolidation retains the application baseline",
);
assert.equal(processDay(new Date("2026-10-10T22:30:00Z")), "2026-10-11");
assert.equal(processDay(new Date("2026-01-10T23:30:00Z")), "2026-01-11");
console.log(
  "trader process: economics, evidence gates, no-trade adherence and version isolation passed",
);
