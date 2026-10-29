import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isHapticSupported,
  hapticLight,
  hapticMedium,
  hapticSuccess,
  hapticWarning,
  hapticSovereign,
} from "./haptics.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const hapticsFile = path.join(__dirname, "haptics.ts");

assert.ok(fs.existsSync(hapticsFile), "haptics.ts must exist");

// In Node.js / SSR environment, navigator is either missing or has no vibrate.
// Verify all functions return safely (no uncaught exceptions or crashes).
assert.equal(isHapticSupported(), false, "isHapticSupported should return false in Node test environment");
assert.equal(hapticLight(), false, "hapticLight should safely return false without crashing");
assert.equal(hapticMedium(), false, "hapticMedium should safely return false without crashing");
assert.equal(hapticSuccess(), false, "hapticSuccess should safely return false without crashing");
assert.equal(hapticWarning(), false, "hapticWarning should safely return false without crashing");
assert.equal(hapticSovereign(), false, "hapticSovereign should safely return false without crashing");

// Verify mock browser behavior
let lastVibratePattern: number | number[] | null = null;
const fakeNavigator = {
  vibrate(pattern: number | number[]) {
    lastVibratePattern = pattern;
    return true;
  },
};

// Temporarily attach mock
const originalNavigator = globalThis.navigator;
Object.defineProperty(globalThis, "navigator", {
  value: fakeNavigator,
  configurable: true,
  writable: true,
});

try {
  assert.equal(isHapticSupported(), true, "isHapticSupported should return true when navigator.vibrate is defined");

  assert.equal(hapticLight(), true);
  assert.equal(lastVibratePattern, 10, "hapticLight should trigger 10ms pulse");

  assert.equal(hapticMedium(), true);
  assert.equal(lastVibratePattern, 20, "hapticMedium should trigger 20ms pulse");

  assert.equal(hapticSuccess(), true);
  assert.deepEqual(lastVibratePattern, [20, 30, 20], "hapticSuccess should trigger affirmative vibration sequence");

  assert.equal(hapticWarning(), true);
  assert.deepEqual(lastVibratePattern, [40, 40, 40], "hapticWarning should trigger alert sequence");

  assert.equal(hapticSovereign(), true);
  assert.deepEqual(lastVibratePattern, [40, 30, 40, 30, 60], "hapticSovereign should trigger imperial sequence");
} finally {
  Object.defineProperty(globalThis, "navigator", {
    value: originalNavigator,
    configurable: true,
    writable: true,
  });
}

console.log("Haptics engine tests passed with 100% pattern verification!");
