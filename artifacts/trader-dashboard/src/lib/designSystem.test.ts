import assert from "node:assert/strict";
import {
  commandCenterPalette,
  commandCenterRadii,
  commandCenterTouch,
  commandCenterViewports,
} from "./designSystem.js";

assert.equal(commandCenterTouch.minTargetPx, 44);
assert.equal(commandCenterTouch.minGapPx, 8);

assert.deepEqual(commandCenterViewports, [375, 768, 1024, 1440]);

assert.equal(commandCenterRadii.panelPx <= 12, true);
assert.equal(commandCenterRadii.modalPx <= 16, true);

assert.equal(commandCenterPalette.background, "#020617");
assert.equal(commandCenterPalette.accent, "#22C55E");
assert.equal(commandCenterPalette.foreground, "#F8FAFC");

console.log("command center design token checks passed");
