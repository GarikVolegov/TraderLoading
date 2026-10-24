import assert from "node:assert/strict";
import {
  LIMEN_SERVICES,
  calculateLimenServicesPricing,
  resolveLimenEntitlements,
} from "./limenServices.js";

// Verify service catalog structure and official prices
const base = LIMEN_SERVICES.find((s) => s.id === "base_protocol");
assert.ok(base, "Base protocol must exist");
assert.equal(base.priceAmountEur, 0);
assert.equal(base.isIncludedInBase, true);

const forge = LIMEN_SERVICES.find((s) => s.id === "forge_of_the_past");
assert.ok(forge, "Forge of the past must exist");
assert.equal(forge.priceAmountEur, 10);
assert.equal(forge.priceType, "monthly");

const arch = LIMEN_SERVICES.find((s) => s.id === "financial_architecture");
assert.ok(arch, "Financial architecture must exist");
assert.equal(arch.priceAmountEur, 10);
assert.equal(arch.priceType, "monthly");

const doctrine = LIMEN_SERVICES.find((s) => s.id === "doctrine_of_time");
assert.ok(doctrine, "Doctrine of time must exist");
assert.equal(doctrine.priceAmountEur, 170);
assert.equal(doctrine.priceType, "one_time");

// Test pricing calculation
const basePricing = calculateLimenServicesPricing([]);
assert.equal(basePricing.monthlyFeeCents, 0);
assert.equal(basePricing.oneTimeFeeCents, 0);

const forgePricing = calculateLimenServicesPricing(["forge_of_the_past"]);
assert.equal(forgePricing.monthlyFeeCents, 1000); // 10 EUR
assert.equal(forgePricing.oneTimeFeeCents, 0);
assert.equal(forgePricing.monthlyDisplay, "10 €/mese");

const comboPricing = calculateLimenServicesPricing([
  "forge_of_the_past",
  "financial_architecture",
  "doctrine_of_time",
]);
assert.equal(comboPricing.monthlyFeeCents, 2000); // 10 + 10 = 20 EUR
assert.equal(comboPricing.oneTimeFeeCents, 17000); // 170 EUR
assert.equal(comboPricing.monthlyDisplay, "20 €/mese");
assert.equal(comboPricing.oneTimeDisplay, "170 €");

// Test entitlement resolution
// 1. Pending candidate
const pendingEntitlements = resolveLimenEntitlements({
  status: "in_valutazione",
  approvedServices: ["forge_of_the_past"],
});
assert.equal(pendingEntitlements.varco, true);
assert.equal(pendingEntitlements.bookOfTruth, true);
assert.equal(pendingEntitlements.brotherhood, true);
assert.equal(pendingEntitlements.fiveGrades, true);
assert.equal(pendingEntitlements.quarterlyTournaments, false); // Locked in base!
assert.equal(pendingEntitlements.forgeOfThePast, false); // Pending approval

// 2. Admitted candidate with approved forge & architecture
const admittedEntitlements = resolveLimenEntitlements({
  status: "ammesso",
  approvedServices: ["base_protocol", "forge_of_the_past", "financial_architecture"],
});
assert.equal(admittedEntitlements.varco, true);
assert.equal(admittedEntitlements.bookOfTruth, true);
assert.equal(admittedEntitlements.brotherhood, true);
assert.equal(admittedEntitlements.fiveGrades, true);
assert.equal(admittedEntitlements.quarterlyTournaments, false);
assert.equal(admittedEntitlements.forgeOfThePast, true);
assert.equal(admittedEntitlements.financialArchitecture, true);
assert.equal(admittedEntitlements.doctrineOfTime, false);

// 3. Admin override
const adminEntitlements = resolveLimenEntitlements({ isAdmin: true });
assert.equal(adminEntitlements.quarterlyTournaments, true);
assert.equal(adminEntitlements.forgeOfThePast, true);
assert.equal(adminEntitlements.financialArchitecture, true);
assert.equal(adminEntitlements.doctrineOfTime, true);

console.log("limenServices contracts tests passed successfully!");
