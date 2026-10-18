import assert from "node:assert/strict";
import { completeProcessResult, dailyProcessRisk, methodGuidance } from "./processGuidance";
import type {
  ProcessEvidence,
  ProcessMethod,
  ProcessProgress,
  ProcessSession,
} from "../../../../contracts/trader-process";

const rules = {
  markets: ["EURUSD"],
  windows: "Documented window",
  setup: "Setup",
  entry: "Entry",
  exit: "Exit",
  invalidation: "Invalidation",
  waitConditions: "Wait",
  currency: "EUR",
  riskPerTrade: 10,
  maxDailyLoss: 100,
  maxDailyTrades: 10,
  checklist: ["Check"],
};
const session: ProcessSession = {
  id: "session",
  methodVersionId: "method",
  day: "2026-10-12",
  rulesSnapshot: rules,
  mode: "application",
  state: "operation",
  draft: null,
  revision: 1,
  checklist: [true],
  mood: "",
  focus: "",
  plan: null,
  closure: null,
  improvementId: null,
  createdAt: "2026-10-12T08:00:00Z",
  updatedAt: "2026-10-12T08:00:00Z",
  preparedAt: "2026-10-12T08:00:00Z",
  closedAt: null,
};
const evidence = (
  id: string,
  netPnl: number,
  changes: Partial<ProcessEvidence> = {},
): ProcessEvidence => ({
  id,
  methodVersionId: "method",
  purpose: "live",
  source: "manual",
  netR: netPnl / 10,
  initialRisk: 10,
  netPnl,
  costsStatus: "included",
  currency: "EUR",
  account: "A",
  observedAt: "2026-10-12T09:00:00Z",
  createdAt: "2026-10-12T09:00:00Z",
  adherence: "conforming",
  provenance: "declared",
  note: "",
  accountTradeId: null,
  backtestTradeId: null,
  sessionId: "session",
  ...changes,
});

const separated = dailyProcessRisk(session, [
  evidence("loss", -100),
  evidence("gain", 100, { account: "B" }),
]);
assert.equal(separated.pause, true, "Another account's gain cannot hide a reached loss limit");
assert.deepEqual(
  separated.losses.map((amount) => amount.account),
  ["A"],
);
assert.equal(separated.amounts.length, 2);
assert.equal(
  dailyProcessRisk(session, [evidence("loss", -90), evidence("gain", 50)]).pause,
  false,
  "Same-account net outcomes use the confirmed personal limit",
);
const currencies = dailyProcessRisk(session, [evidence("usd", -200, { currency: "USD" })]);
assert.equal(currencies.pause, false, "No implicit currency conversion");
assert.equal(currencies.otherCurrencies, true);
for (const changes of [
  { costsStatus: "unknown" as const },
  { costsStatus: "excluded" as const },
  { provenance: "estimated" as const },
]) {
  const result = dailyProcessRisk(session, [evidence("incomplete", -200, changes)]);
  assert.equal(result.pause, false);
  assert.equal(result.incomplete.length, 1);
  assert.equal(result.amounts.length, 0);
}
assert.equal(
  dailyProcessRisk(session, [
    evidence("loss", -100, { account: null }),
    evidence("gain", 100, { account: null }),
  ]).pause,
  true,
  "Unidentified accounts must not be merged to offset losses",
);
const canonical = evidence("canonical", 20, { source: "account_trade", accountTradeId: 1 });
assert.equal(
  dailyProcessRisk({ ...session, rulesSnapshot: { ...rules, maxDailyTrades: 2 } }, [
    canonical,
    { ...canonical, id: "duplicate" },
  ]).pause,
  false,
  "Canonical trades are counted once",
);
assert.equal(
  dailyProcessRisk({ ...session, rulesSnapshot: { ...rules, maxDailyTrades: 1 } }, [canonical])
    .tradeLimit,
  true,
);
assert.equal(
  dailyProcessRisk(session, [
    evidence("older", -200, { observedAt: "2026-10-11T09:00:00Z" }),
    evidence("version", -200, { methodVersionId: "new" }),
    evidence("unlinked-test", -200, { purpose: "development", sessionId: null }),
  ]).rows.length,
  0,
);
assert.equal(
  dailyProcessRisk({ ...session, mode: "practice" }, [
    evidence("practice", -100, { purpose: "development" }),
  ]).pause,
  true,
  "Practice still honors the session's personal risk rules",
);
for (const changes of [
  { initialRisk: null },
  { netR: 99 },
  { account: null },
  { currency: null },
  { source: "account_trade" as const, accountTradeId: null },
])
  assert.equal(completeProcessResult(evidence("missing", 20, changes)), false);
assert.equal(completeProcessResult(canonical), true);

const method: ProcessMethod = {
  id: "method",
  methodId: "family",
  version: 1,
  name: "Method",
  rules,
  protocol: null,
  phase: "verify",
  active: true,
  createdAt: "2026-10-12T08:00:00Z",
  phaseStartedAt: "2026-10-12T08:00:00Z",
  riskConfirmedAt: "2026-10-12T08:00:00Z",
  verificationStartedAt: null,
  applicationStartedAt: null,
};
const progress = (keys: string[], canAdvance = false): ProcessProgress => ({
  phase: method.phase,
  checks: keys.map((key) => ({ key, label: key, met: false, detail: key })),
  canAdvance,
  nextAction: "collect_evidence",
  report: {
    eligibleSamples: 0,
    incompleteSamples: 0,
    expectancyR: null,
    drawdownR: null,
    adherencePct: null,
    closedSessions: 0,
    amounts: [],
  },
});
assert.equal(methodGuidance(method, progress(["period"])).kind, "wait");
assert.equal(methodGuidance(method, progress(["period", "samples"])).requirement?.key, "samples");
assert.equal(methodGuidance(method, progress(["samples"])).kind, "evidence");
assert.equal(methodGuidance(method, progress([], true)).kind, "advance");
assert.equal(
  methodGuidance(
    {
      ...method,
      phase: "define",
      protocol: {
        minSamples: 2,
        periodStart: "2026-10-01",
        periodEnd: "2026-10-11",
        minExpectancyR: 0,
        maxDrawdownR: 3,
        observationDays: 1,
        minAdherencePct: 100,
      },
    },
    progress([]),
    new Date("2026-10-12T12:00:00Z"),
  ).kind,
  "expired",
);
assert.equal(
  methodGuidance(
    { ...method, phase: "apply" },
    progress(["observation", "samples", "weekly_review"]),
  ).requirement?.key,
  "weekly_review",
);
assert.equal(
  methodGuidance(
    { ...method, phase: "apply" },
    progress(["observation", "period_review"]),
    new Date("2026-10-25T12:00:00Z"),
  ).kind,
  "review",
);
assert.equal(
  methodGuidance(
    { ...method, phase: "apply" },
    progress(["weekly_review"]),
    new Date("2026-10-18T12:00:00Z"),
  ).kind,
  "review",
);
const scheduled = methodGuidance(
  { ...method, phase: "apply" },
  progress(["weekly_review"]),
  new Date("2026-10-12T12:00:00Z"),
);
assert.equal(scheduled.kind, "scheduled_review");
assert.ok("reviewWindow" in scheduled);
assert.equal(scheduled.reviewWindow.editWindowStart, "2026-10-17");
assert.equal(methodGuidance({ ...method, phase: "consolidate" }, progress([])).requirement, null);
assert.equal(methodGuidance({ ...method, phase: "consolidate" }, progress([])).kind, "continue");
console.log(
  "Process guidance prioritizes useful work and risk checks preserve account, currency and version boundaries",
);
