import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const settingsPath = path.join(__dirname, "SoundFxSettings.tsx");
assert.ok(fs.existsSync(settingsPath), "SoundFxSettings.tsx must exist");

const source = fs.readFileSync(settingsPath, "utf-8");

// 1. Verify core sound controls and volume
assert.ok(
  source.includes("isSoundEnabled") && source.includes("setSoundEnabled"),
  "Must import sound state controls from soundFx"
);
assert.ok(
  source.includes("getSoundVolume") && source.includes("setSoundVolume"),
  "Must import volume controls from soundFx"
);
assert.ok(
  source.includes('type="range"') && source.includes("handleVolumeChange"),
  "Must render master volume range slider"
);

// 2. Verify all 5 high-craft acoustic profiles
assert.ok(
  source.includes("synestheticClick") &&
    source.includes("synestheticCheck") &&
    source.includes("synestheticConfirm") &&
    source.includes("synestheticAlert") &&
    source.includes("synestheticTrophy"),
  "Must include all 5 synesthetic audio-haptic profiles"
);

// 3. Verify relaxing, focus-inducing frequency references
assert.ok(source.includes("528Hz") || source.includes("528 Hz"), "Must feature 528 Hz Solfeggio frequency");
assert.ok(source.includes("432Hz") || source.includes("432 Hz"), "Must feature 432 Hz golden chord frequency");
assert.ok(source.includes("108Hz") || source.includes("108 Hz"), "Must feature 108 Hz grounding gong frequency");
assert.ok(source.includes("Alpha"), "Must mention Alpha brainwave entrainment");

// 4. Verify Deep Work Continuous Ambience
assert.ok(
  source.includes("isDeepWorkAmbienceActive") && source.includes("toggleDeepWorkAmbience"),
  "Must import deep work ambience controls from soundFx"
);
assert.ok(
  source.includes("Atmosfera Acustica Deep Work"),
  "Must render Deep Work Ambience card"
);

// 5. Verify Bio-Telemetry & Replay Psychoacoustics Deck
assert.ok(
  source.includes("getHeartbeatVolume") && source.includes("setHeartbeatVolume"),
  "Must import heartbeat volume controls"
);
assert.ok(
  source.includes("getStopLossProximityThreshold") && source.includes("setStopLossProximityThreshold"),
  "Must import SL proximity threshold controls"
);
assert.ok(
  source.includes("isVignetteOverlayEnabled") && source.includes("setVignetteOverlayEnabled"),
  "Must import vignette overlay controls"
);
assert.ok(
  source.includes("Bio-Telemetria Cardiaca"),
  "Must render Bio-Telemetry & Replay deck"
);
assert.ok(
  source.includes("Guadagno Sub-Bass Ventricolare") &&
    source.includes("Soglia Trigger di Tensione") &&
    source.includes("Aura Ottica di Confine"),
  "Must render sub-bass slider, tension threshold selector, and optical vignette toggle"
);
assert.ok(
  source.includes("Test Calma (60 BPM)") && source.includes("Test Allerta Stop (98 BPM)"),
  "Must provide test triggers for physiological calibration"
);

// 6. Verify design system compliance (obsidian & gold, no forbidden words)
assert.ok(
  source.includes("#C5A059") && source.includes("#0d0f14"),
  "Must use imperial obsidian and gold palette"
);
assert.ok(!source.includes("scommessa"), "Must not contain betting/gambling terminology");
assert.ok(!source.includes("gioco"), "Must not contain arcade gaming terminology");

console.log("SoundFxSettings static and design compliance tests passed successfully!");
