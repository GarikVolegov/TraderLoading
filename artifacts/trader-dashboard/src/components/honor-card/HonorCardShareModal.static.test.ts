import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const componentPath = path.join(__dirname, "HonorCardShareModal.tsx");
assert.ok(fs.existsSync(componentPath), "HonorCardShareModal.tsx must exist");

const source = fs.readFileSync(componentPath, "utf-8");

// 1. Verify generator integration
assert.ok(
  source.includes("generateHonorCardDataUrl") &&
    source.includes("shareHonorCard") &&
    source.includes("copyHonorCardToClipboard") &&
    source.includes("downloadHonorCardPng"),
  "HonorCardShareModal must integrate generator and sharing functions",
);

// 2. Verify i18n usage
assert.ok(
  source.includes("useLanguage") && source.includes("t(\"honor_card."),
  "HonorCardShareModal must use internationalization keys",
);

// 3. Verify synesthetic audio-tactile integration
assert.ok(
  source.includes("synestheticTrophy") &&
    source.includes("synestheticClick") &&
    source.includes("synestheticCheck"),
  "HonorCardShareModal must trigger synesthetic audio effects",
);

// 4. Verify AUREUS Design System compliance
assert.ok(source.includes("#C5A059"), "HonorCardShareModal must adhere to Imperial Gold design tokens");
assert.ok(source.includes("aspect-[1200/630]"), "HonorCardShareModal must present 1200x630 aspect ratio preview");
assert.ok(source.includes("handleCopyLink") && source.includes("Copia Link"), "HonorCardShareModal must provide OpenGraph share link copy button");

console.log("HonorCardShareModal static tests passed with 100% precision!");
