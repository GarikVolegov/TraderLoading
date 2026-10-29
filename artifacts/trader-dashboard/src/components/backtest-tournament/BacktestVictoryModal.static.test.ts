import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const componentPath = path.join(__dirname, "BacktestVictoryModal.tsx");
assert.ok(fs.existsSync(componentPath), "BacktestVictoryModal.tsx must exist");

const source = fs.readFileSync(componentPath, "utf-8");

// 1. Verify Honor Card integration
assert.ok(
  source.includes("HonorCardShareModal") && source.includes("honorCardData"),
  "BacktestVictoryModal must integrate HonorCardShareModal",
);

// 2. Verify Share trigger button
assert.ok(
  source.includes("Condividi Scheda d&apos;Onore") || source.includes("Condividi Scheda d'Onore"),
  "BacktestVictoryModal must provide an action button to share the Honor Card",
);

// 3. Verify Share icon
assert.ok(source.includes("Share2"), "BacktestVictoryModal must include Share2 icon");

console.log("BacktestVictoryModal static tests passed with 100% precision!");
