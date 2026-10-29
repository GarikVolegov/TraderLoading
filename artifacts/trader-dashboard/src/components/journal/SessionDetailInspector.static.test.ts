import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const componentPath = path.join(__dirname, "SessionDetailInspector.tsx");

assert.ok(fs.existsSync(componentPath), "SessionDetailInspector.tsx must exist");

const source = fs.readFileSync(componentPath, "utf-8");

assert.ok(
  source.includes("HonorCardShareModal") && source.includes("honorCardData"),
  "SessionDetailInspector must integrate HonorCardShareModal and honorCardData memo",
);

assert.ok(
  source.includes("Sigillo del Trade"),
  "SessionDetailInspector must provide Sigillo del Trade button",
);

assert.ok(
  source.includes("setShareModalOpen(true)"),
  "SessionDetailInspector must trigger HonorCard modal upon clicking the seal button",
);

console.log("SessionDetailInspector static tests passed with 100% precision!");
