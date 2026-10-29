import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const componentPath = path.join(__dirname, "LimenCertificateModal.tsx");
assert.ok(fs.existsSync(componentPath), "LimenCertificateModal.tsx must exist");

const source = fs.readFileSync(componentPath, "utf-8");

// 1. Verify Honor Card integration
assert.ok(
  source.includes("HonorCardShareModal") && source.includes("honorCardData"),
  "LimenCertificateModal must integrate HonorCardShareModal",
);

// 2. Verify Share trigger button
assert.ok(
  source.includes("Condividi Scheda d&apos;Onore") || source.includes("Condividi Scheda d'Onore"),
  "LimenCertificateModal must provide button to trigger Honor Card modal",
);

// 3. Verify Share2 icon
assert.ok(source.includes("Share2"), "LimenCertificateModal must include Share2 icon");

console.log("LimenCertificateModal static tests passed with 100% precision!");
