import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./PinLockScreen.tsx", import.meta.url), "utf8");

// The PIN must be enterable on a physical keyboard, not only by tapping the keypad.
assert.match(source, /addEventListener\("keydown"/, "listens for physical key presses");
assert.match(source, /e\.key >= "0" && e\.key <= "9"/, "digits type into the PIN");
assert.match(source, /e\.key === "Backspace"/, "Backspace deletes a digit");
assert.match(source, /removeEventListener\("keydown"/, "keydown listener is cleaned up");

// The icon-only delete key needs an accessible name for screen readers.
assert.match(source, /aria-label=\{key === "⌫" \? t\("pin\.delete"\)/, "delete key is labelled");

console.log("pin lock a11y checks passed");
