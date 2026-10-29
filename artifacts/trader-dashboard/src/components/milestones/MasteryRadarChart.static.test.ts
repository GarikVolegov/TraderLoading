import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_PILLARS } from "./MasteryRadarChart.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const componentFile = path.join(__dirname, "MasteryRadarChart.tsx");

assert.ok(fs.existsSync(componentFile), "MasteryRadarChart.tsx must exist");
const src = fs.readFileSync(componentFile, "utf8");

// 1. Lore & Geometria dei 5 Pilastri
assert.equal(DEFAULT_PILLARS.length, 5, "Must define exactly 5 sovereign pillars of mastery");
const expectedIds = ["patience", "risk", "technique", "composure", "integrity"];
for (const id of expectedIds) {
  assert.ok(DEFAULT_PILLARS.some((p) => p.id === id), `Missing pillar ID: ${id}`);
}

// 2. Geometria SVG e Accessibilità
assert.ok(src.includes('viewBox="0 0 300 280"'), "SVG must declare standard viewBox");
assert.ok(src.includes('id="mastery-radar-gradient"'), "Must define mastery radial gold gradient");
assert.ok(src.includes('id="gold-glow"'), "Must define golden glow filter");
assert.ok(src.includes('role="region"'), "Must be an accessible region");
assert.ok(src.includes('aria-label="Pentagramma della Maestria AUREUS"'), "Must have accessible label");

// 3. Design System AUREUS (Colori Sovrani & Monospace)
assert.ok(src.includes("#C5A059"), "Must use imperial gold base");
assert.ok(src.includes("#E8C56A"), "Must use imperial gold glow");
assert.ok(src.includes("#07080b"), "Must use deep obsidian panel background");
assert.ok(src.includes("font-mono"), "Metrics must be rendered in monospace");

// 4. Calcolo Punteggio Medio
const sum = DEFAULT_PILLARS.reduce((acc, p) => acc + p.score, 0);
const avg = Math.round(sum / DEFAULT_PILLARS.length);
assert.ok(avg >= 80 && avg <= 100, "Average score must be realistic and high-standard");

console.log("MasteryRadarChart static tests passed with 100% precision!");
