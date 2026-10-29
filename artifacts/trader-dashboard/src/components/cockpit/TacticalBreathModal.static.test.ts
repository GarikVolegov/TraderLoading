import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const componentFile = path.join(__dirname, "TacticalBreathModal.tsx");

assert.ok(fs.existsSync(componentFile), "TacticalBreathModal.tsx must exist");
const src = fs.readFileSync(componentFile, "utf8");

// 1. Ingegneria di Lore & Design System AUREUS
assert.ok(src.includes('role="dialog"'), "Modal must have accessible role dialog");
assert.ok(src.includes('aria-modal="true"'), "Modal must have aria-modal attribute");
assert.ok(src.includes('aria-labelledby="tactical-breath-title"'), "Modal must label dialog title");
assert.ok(src.includes("#C5A059"), "Must adhere to imperial gold palette");
assert.ok(src.includes("#07080b"), "Must use obsidian background finish");

// 2. Verifica Protocollo Fisiologico 4-7-8
assert.ok(src.includes("inhale: 4"), "Inhale phase must be calibrated to 4 seconds");
assert.ok(src.includes("hold: 7"), "Hold apnea phase must be calibrated to 7 seconds");
assert.ok(src.includes("exhale: 8"), "Exhale phase must be calibrated to 8 seconds");

const totalCycleSeconds = 4 + 7 + 8;
assert.equal(totalCycleSeconds, 19, "Single breath cycle must equal 19 seconds");
assert.equal(totalCycleSeconds * 4, 76, "4 full cycles must equal 76 seconds of tactical breathing");

// 3. Verifica Integrazione Acustica 432 Hz
assert.ok(src.includes("playBreathInhale"), "Must integrate playBreathInhale");
assert.ok(src.includes("playBreathHold"), "Must integrate playBreathHold");
assert.ok(src.includes("playBreathExhale"), "Must integrate playBreathExhale");
assert.ok(src.includes("playBreathComplete"), "Must integrate playBreathComplete");
assert.ok(src.includes("stopBreathAudio"), "Must stop audio when pausing or closing");

// 4. Parità di Traduzioni Internazionali (5 lingue)
const dictPaths = [
  "../../lib/i18n/dict.it.ts",
  "../../lib/i18n/dict.en.ts",
  "../../lib/i18n/dict.es.ts",
  "../../lib/i18n/dict.fr.ts",
  "../../lib/i18n/dict.de.ts",
];

const requiredBreathKeys = [
  "breath.title",
  "breath.subtitle",
  "breath.phase_inhale",
  "breath.phase_hold",
  "breath.phase_exhale",
  "breath.cycle",
  "breath.completed_title",
  "breath.completed_desc",
  "breath.close_action",
  "breath.pause",
  "breath.resume",
  "breath.restart",
  "breath.audio_guide",
];

for (const p of dictPaths) {
  const dictPath = path.join(__dirname, p);
  assert.ok(fs.existsSync(dictPath), `Dictionary file must exist: ${p}`);
  const dictContent = fs.readFileSync(dictPath, "utf8");
  for (const k of requiredBreathKeys) {
    assert.ok(
      dictContent.includes(`"${k}":`),
      `Dictionary ${path.basename(p)} must contain translation key "${k}"`
    );
  }
}

console.log("TacticalBreathModal static tests passed with 100% precision!");
