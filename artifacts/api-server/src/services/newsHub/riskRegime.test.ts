import assert from "node:assert/strict";
import { computeRiskRegime } from "./riskRegime.js";

// Gold rising is a flight-to-safety signal → RISK-OFF (the core fix; the old
// naive bull/bear count wrongly treated this as risk-on).
const goldUp = computeRiskRegime([
  { title: "Gold jumps to record high", summary: "Bullion rallies", impactScore: 8, impactDirection: "bullish", freshnessTier: "fresh", primaryAssets: ["XAU"] },
]);
assert.equal(goldUp.regime, "risk-off");
assert.equal(goldUp.intensity, "forte");

// A risk asset (AUD) strengthening = risk appetite → RISK-ON.
const audUp = computeRiskRegime([
  { title: "Aussie dollar surges on risk appetite", summary: "AUD rallies", impactScore: 7, impactDirection: "bullish", freshnessTier: "fresh", primaryAssets: ["AUD"] },
]);
assert.equal(audUp.regime, "risk-on");

// War / geopolitics theme → RISK-OFF regardless of a per-asset direction.
const war = computeRiskRegime([
  { title: "War escalates, safe-haven demand jumps", summary: "Conflict spreads", impactScore: 9, freshnessTier: "live" },
]);
assert.equal(war.regime, "risk-off");

// No directional signal → NEUTRALE.
const neutral = computeRiskRegime([
  { title: "Quarterly report released", summary: "Routine update", impactScore: 3 },
]);
assert.equal(neutral.regime, "neutrale");
assert.equal(neutral.intensity, null);

// Opposing safe-haven vs risk-asset signals of equal weight cancel → NEUTRALE.
const balanced = computeRiskRegime([
  { title: "Gold rises", summary: "", impactScore: 6, impactDirection: "bullish", freshnessTier: "fresh", primaryAssets: ["XAU"] },
  { title: "Aussie rises", summary: "", impactScore: 6, impactDirection: "bullish", freshnessTier: "fresh", primaryAssets: ["AUD"] },
]);
assert.equal(balanced.regime, "neutrale");

// Hot US inflation/CPI reprices rates higher and usually tightens financial
// conditions: for XAU/USD traders this is a risk-OFF macro driver, not a
// generic risk-on signal.
const hotCpi = computeRiskRegime([
  {
    title: "Anteprima CPI USA di maggio: inflazione sopra attese",
    summary: "Il dato puo' spingere rendimenti Treasury e dollaro piu' in alto, mettendo pressione su oro e azioni.",
    impactScore: 8,
    impactDirection: "bearish",
    freshnessTier: "fresh",
    primaryAssets: ["XAU", "USD"],
  },
]);
assert.equal(hotCpi.regime, "risk-off");
assert.equal(hotCpi.intensity, "forte");

console.log("risk regime checks passed");
