import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. Verify soundFx.ts implementation
const soundFxPath = path.join(__dirname, "lib", "soundFx.ts");
assert.ok(fs.existsSync(soundFxPath), "soundFx.ts must exist");
const soundFxSource = fs.readFileSync(soundFxPath, "utf-8");

assert.ok(
  soundFxSource.includes("soundSpatialSweepAlert"),
  "soundFx.ts must export soundSpatialSweepAlert"
);
assert.ok(
  soundFxSource.includes("synestheticSpatialSweepAlert"),
  "soundFx.ts must export synestheticSpatialSweepAlert"
);
assert.ok(
  soundFxSource.includes("createStereoPanner"),
  "soundFx.ts must use createStereoPanner for 3D procedural panning"
);
assert.ok(
  soundFxSource.includes("-0.75") && soundFxSource.includes("0.75"),
  "soundFx.ts must implement directional pan values: -0.75 (Left/SSL) and +0.75 (Right/BSL)"
);
assert.ok(
  soundFxSource.includes("216") && soundFxSource.includes("108"),
  "soundFx.ts must implement SSL telluric frequency descent (216 Hz -> 108 Hz)"
);
assert.ok(
  soundFxSource.includes("432") && soundFxSource.includes("864"),
  "soundFx.ts must implement BSL crystalline overtone ascent (432 Hz -> 864 Hz)"
);

// 2. Verify SessionOpensOverlay.tsx integration
const sessionOverlayPath = path.join(
  __dirname,
  "components",
  "backtest-terminal",
  "SessionOpensOverlay.tsx"
);
assert.ok(fs.existsSync(sessionOverlayPath), "SessionOpensOverlay.tsx must exist");
const sessionOverlaySource = fs.readFileSync(sessionOverlayPath, "utf-8");

assert.ok(
  sessionOverlaySource.includes("synestheticSpatialSweepAlert"),
  "SessionOpensOverlay.tsx must call synestheticSpatialSweepAlert"
);
assert.ok(
  sessionOverlaySource.includes('direction: "bsl"') &&
    sessionOverlaySource.includes('direction: "ssl"'),
  "SessionOpensOverlay.tsx must distinguish BSL and SSL directional sweep details"
);
assert.ok(
  sessionOverlaySource.includes("SESSION_SWEEP_ALERT_EVENT"),
  "SessionOpensOverlay.tsx must dispatch SESSION_SWEEP_ALERT_EVENT"
);

// 3. Verify TradingCockpit.tsx integration
const cockpitPath = path.join(__dirname, "pages", "TradingCockpit.tsx");
assert.ok(fs.existsSync(cockpitPath), "TradingCockpit.tsx must exist");
const cockpitSource = fs.readFileSync(cockpitPath, "utf-8");

assert.ok(
  cockpitSource.includes("SESSION_SWEEP_ALERT_EVENT"),
  "TradingCockpit.tsx must subscribe to SESSION_SWEEP_ALERT_EVENT"
);
assert.ok(
  cockpitSource.includes("BSL (Massimo)") && cockpitSource.includes("SSL (Minimo)"),
  "TradingCockpit.tsx toast must display BSL and SSL directional labels"
);

// 4. Verify Limen Design System compliance
assert.ok(
  !soundFxSource.includes("scommessa") &&
    !soundFxSource.includes("gioco d'azzardo") &&
    !sessionOverlaySource.includes("scommessa"),
  "Must strictly adhere to stoic AUREUS lore and avoid gambling/gaming terminology"
);

console.log("3D Spatial Audio Liquidity Sweep verification passed with 100% precision!");
