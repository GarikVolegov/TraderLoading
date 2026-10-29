import assert from "node:assert/strict";
import test from "node:test";
import {
  hasBuildVersionChanged,
  isChunkLoadFailure,
  isUserTypingInEditableElement,
  setCriticalSessionActive,
  isCriticalSessionActive,
  shouldSuppressAutomaticReload,
  isPendingUpdateAvailable,
} from "./pwaAutoUpdater.js";

test("hasBuildVersionChanged detects only genuine build version transitions", () => {
  assert.equal(hasBuildVersionChanged("v1.0.0", { version: "v1.0.0" }), false);
  assert.equal(hasBuildVersionChanged("v1.0.0", { version: "v1.0.1" }), true);
  assert.equal(hasBuildVersionChanged(null, { version: "v1.0.1" }), false);
  assert.equal(hasBuildVersionChanged("v1.0.0", {}), false);
  assert.equal(hasBuildVersionChanged("v1.0.0", null), false);
});

test("isUserTypingInEditableElement protects active text inputs and textareas from mid-typing reload", () => {
  assert.equal(isUserTypingInEditableElement(null), false);
  assert.equal(isUserTypingInEditableElement({ tagName: "DIV" }), false);
  assert.equal(isUserTypingInEditableElement({ tagName: "TEXTAREA" }), true);
  assert.equal(isUserTypingInEditableElement({ tagName: "INPUT", type: "text" }), true);
  assert.equal(isUserTypingInEditableElement({ tagName: "INPUT", type: "number" }), true);
  assert.equal(isUserTypingInEditableElement({ tagName: "INPUT", type: "button" }), false);
  assert.equal(isUserTypingInEditableElement({ tagName: "INPUT", type: "checkbox" }), false);
  assert.equal(
    isUserTypingInEditableElement({ tagName: "INPUT", type: "text", readOnly: true }),
    false,
  );
  assert.equal(isUserTypingInEditableElement({ tagName: "DIV", isContentEditable: true }), true);
});

test("isChunkLoadFailure identifies dynamic import chunk failures across Chromium, Firefox, and WebKit", () => {
  assert.equal(
    isChunkLoadFailure(new TypeError("Failed to fetch dynamically imported module: https://app/assets/Page-123.js")),
    true,
  );
  assert.equal(
    isChunkLoadFailure(new TypeError("Importing a module script failed.")),
    true,
  );
  assert.equal(
    isChunkLoadFailure(new Error("error loading dynamically imported module")),
    true,
  );
  assert.equal(isChunkLoadFailure(new Error("Regular business logic error")), false);
});

test("critical session guard and path suppression prevent unprompted reloads in Forge", () => {
  setCriticalSessionActive(false);
  assert.equal(isCriticalSessionActive(), false);

  // When inside backtest replay path, reload is strictly suppressed
  assert.equal(shouldSuppressAutomaticReload("/backtest/42/replay"), true);
  assert.equal(shouldSuppressAutomaticReload("/today"), false);

  // When critical session is activated (e.g. active live trading or replay)
  setCriticalSessionActive(true);
  assert.equal(isCriticalSessionActive(), true);
  assert.equal(shouldSuppressAutomaticReload("/today"), true);

  // Reset
  setCriticalSessionActive(false);
  assert.equal(isCriticalSessionActive(), false);
});
