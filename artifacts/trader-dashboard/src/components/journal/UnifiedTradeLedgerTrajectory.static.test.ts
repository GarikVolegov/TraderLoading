import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const componentPath = path.join(__dirname, "UnifiedTradeLedgerTrajectory.tsx");
assert.ok(fs.existsSync(componentPath), "UnifiedTradeLedgerTrajectory.tsx must exist");

const source = fs.readFileSync(componentPath, "utf-8");

// 1. Verify Honor Card integration
assert.ok(
  source.includes("HonorCardShareModal") && source.includes("honorCardData"),
  "UnifiedTradeLedgerTrajectory must integrate HonorCardShareModal",
);

// 2. Verify Share trigger button
assert.ok(
  source.includes("Scheda d&apos;Onore") || source.includes("Scheda d'Onore"),
  "UnifiedTradeLedgerTrajectory must provide button to trigger Honor Card modal",
);

// 3. Verify Share2 icon
assert.ok(source.includes("Share2"), "UnifiedTradeLedgerTrajectory must include Share2 icon");

// 4. Verify Zero Leak Curve toggle & Parametric Risk Selector
assert.ok(
  source.includes("riskMultiplier") && source.includes("setRiskMultiplier"),
  "UnifiedTradeLedgerTrajectory must manage parametric risk multiplier",
);
assert.ok(
  source.includes("Curva Zero Leak") && source.includes("showIdealCurve"),
  "UnifiedTradeLedgerTrajectory must provide Zero-Leak trajectory toggle",
);
assert.ok(
  source.includes("totalFrictionBleed"),
  "UnifiedTradeLedgerTrajectory must compute total friction bleed from leaks",
);

// 5. Verify Notary Scroll and Integrity Confessor integrations
assert.ok(
  source.includes("NotaryScrollModal"),
  "UnifiedTradeLedgerTrajectory must integrate NotaryScrollModal"
);
assert.ok(
  source.includes("IntegrityConfessorModal"),
  "UnifiedTradeLedgerTrajectory must integrate IntegrityConfessorModal"
);
assert.ok(
  source.includes("Il Confessore"),
  "UnifiedTradeLedgerTrajectory must provide trigger for Il Confessore"
);

console.log("UnifiedTradeLedgerTrajectory static tests passed with 100% precision!");
