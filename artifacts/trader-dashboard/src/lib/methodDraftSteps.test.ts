import assert from "node:assert/strict";
import { methodDraftStep } from "./methodDraftSteps";
const rules = Object.fromEntries(
  ["name", "markets", "windows", "setup", "entry", "exit", "invalidation", "waitConditions"].map(
    (key) => [key, "Documented rule"],
  ),
);
assert.equal(methodDraftStep({}, 2), 0);
assert.equal(methodDraftStep(rules, 2), 1);
const risk = {
  ...rules,
  currency: "EUR",
  riskPerTrade: "10",
  maxDailyLoss: "20",
  maxDailyTrades: "2",
  checklist: "Check risk",
};
assert.equal(methodDraftStep(risk, 2), 2);
assert.equal(methodDraftStep({ ...risk, maxDailyTrades: "1.5" }, 2), 1);
assert.equal(methodDraftStep({ ...risk, checklist: " \n " }, 2), 1);
assert.equal(methodDraftStep({ ...risk, setup: "" }, 2), 0);
assert.equal(methodDraftStep(risk, 0), 0);
assert.equal(
  methodDraftStep({ ...risk, riskConfirmed: false }, 2),
  2,
  "Resume does not imply financial confirmation",
);
console.log("Method draft resumes the saved step without skipping incomplete rules or risk");
