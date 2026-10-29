import assert from "node:assert/strict";
import {
  LIMEN_SERVICES,
  LIMEN_TIERS,
  calculateLimenServicesPricing,
  resolveLimenEntitlements,
} from "./limenServices.ts";

// 1. Verify catalog items
assert.equal(LIMEN_SERVICES.length, 4);
assert.equal(LIMEN_TIERS.length, 3);
assert.equal(LIMEN_SERVICES[0].id, "base_protocol");
assert.equal(LIMEN_SERVICES[0].isIncludedInBase, true);

// 2. Verify pricing calculation - Base Free
const baseOnly = calculateLimenServicesPricing(["base_protocol"], "monthly");
assert.equal(baseOnly.tierId, "base_free");
assert.equal(baseOnly.monthlyFeeCents, 0);
assert.equal(baseOnly.yearlyFeeCents, 0);

// 3. Verify pricing calculation - Dotazione Operativa (Founders)
// During promo (active now): 2,60 € / 14 giorni
const foundersPromoMonthly = calculateLimenServicesPricing(
  ["base_protocol", "forge_of_the_past", "financial_architecture"],
  "monthly",
);
assert.equal(foundersPromoMonthly.tierId, "founders_10");
assert.equal(foundersPromoMonthly.monthlyFeeCents, 1000);
assert.equal(foundersPromoMonthly.activeFeeCents, 260);
assert.equal(foundersPromoMonthly.promoActive, true);
assert.equal(foundersPromoMonthly.activeDisplay, "2,60 € / 14 giorni");

// After promo expiry: falls back to 10 € / mese
const foundersPostPromoMonthly = calculateLimenServicesPricing(
  ["base_protocol", "forge_of_the_past", "financial_architecture"],
  "monthly",
  new Date("2026-11-15T00:00:00.000Z"),
);
assert.equal(foundersPostPromoMonthly.tierId, "founders_10");
assert.equal(foundersPostPromoMonthly.monthlyFeeCents, 1000);
assert.equal(foundersPostPromoMonthly.activeFeeCents, 1000);
assert.equal(foundersPostPromoMonthly.promoActive, false);
assert.equal(foundersPostPromoMonthly.activeDisplay, "10 € / mese");

const foundersYearly = calculateLimenServicesPricing(
  ["base_protocol", "forge_of_the_past", "financial_architecture"],
  "yearly",
);
assert.equal(foundersYearly.tierId, "founders_10");
assert.equal(foundersYearly.yearlyFeeCents, 10000);
assert.equal(foundersYearly.activeFeeCents, 10000);
assert.equal(foundersYearly.promoActive, false);
assert.equal(foundersYearly.activeDisplay, "100 € / anno");
assert.equal(foundersYearly.yearlySavingsEur, 20);

// 4. Verify pricing calculation - Complete Project (150€ monthly / 1500€ yearly)
// Includes Base + Forge + Financial Architecture + Doctrine of Time & Finestra Operativa
const completeMonthly = calculateLimenServicesPricing(
  [
    "base_protocol",
    "forge_of_the_past",
    "financial_architecture",
    "doctrine_of_time",
  ],
  "monthly",
);
assert.equal(completeMonthly.tierId, "complete_150");
assert.equal(completeMonthly.monthlyFeeCents, 15000);
assert.equal(completeMonthly.activeFeeCents, 15000);
assert.equal(completeMonthly.activeDisplay, "150 € / mese");

const completeYearly = calculateLimenServicesPricing(
  ["base_protocol", "doctrine_of_time"],
  "yearly",
);
assert.equal(completeYearly.tierId, "complete_150");
assert.equal(completeYearly.yearlyFeeCents, 150000);
assert.equal(completeYearly.activeFeeCents, 150000);
assert.equal(completeYearly.activeDisplay, "1.500 € / anno");
assert.equal(completeYearly.yearlySavingsEur, 300);

// 5. Verify entitlements resolution
const unapproved = resolveLimenEntitlements({
  status: "in_valutazione",
  approvedServices: ["base_protocol", "forge_of_the_past", "financial_architecture"],
});
assert.equal(unapproved.varco, true);
assert.equal(unapproved.bookOfTruth, true);
assert.equal(unapproved.brotherhood, true);
assert.equal(unapproved.fiveGrades, true);
assert.equal(unapproved.quarterlyTournaments, false);
assert.equal(unapproved.forgeOfThePast, false);
assert.equal(unapproved.financialArchitecture, false);

const admittedFounders = resolveLimenEntitlements({
  status: "ammesso",
  approvedServices: ["base_protocol", "forge_of_the_past", "financial_architecture"],
});
assert.equal(admittedFounders.forgeOfThePast, true);
assert.equal(admittedFounders.financialArchitecture, true);
assert.equal(admittedFounders.doctrineOfTime, false);
assert.equal(admittedFounders.quarterlyTournaments, false);

const admittedComplete = resolveLimenEntitlements({
  status: "ammesso",
  approvedServices: ["base_protocol", "doctrine_of_time"],
});
assert.equal(admittedComplete.forgeOfThePast, true);
assert.equal(admittedComplete.financialArchitecture, true);
assert.equal(admittedComplete.doctrineOfTime, true);
assert.equal(admittedComplete.quarterlyTournaments, true);

const adminEntitlements = resolveLimenEntitlements({ isAdmin: true });
assert.equal(adminEntitlements.forgeOfThePast, true);
assert.equal(adminEntitlements.financialArchitecture, true);
assert.equal(adminEntitlements.doctrineOfTime, true);
assert.equal(adminEntitlements.quarterlyTournaments, true);

console.log("limenServices tests passed!");
