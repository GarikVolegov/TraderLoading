import assert from "node:assert/strict";
import test from "node:test";
import {
  getStoredForgeSentinelAutoScan,
  setStoredForgeSentinelAutoScan,
  getStoredForgeSentinelAutoExecute,
  setStoredForgeSentinelAutoExecute,
  getStoredForgeSentinelOverlay,
  setStoredForgeSentinelOverlay,
  getStoredCockpitSentinelAutoScan,
  setStoredCockpitSentinelAutoScan,
  getStoredCockpitSentinelAutoAlign,
  setStoredCockpitSentinelAutoAlign,
} from "./sentinelPersistence.js";

test("sentinelPersistence defaults gracefully when storage is empty", () => {
  // Forge default auto-scan is false (safe)
  assert.equal(getStoredForgeSentinelAutoScan(), false);
  assert.equal(getStoredForgeSentinelAutoExecute(), false);
  assert.equal(getStoredForgeSentinelOverlay(), true);

  // Cockpit defaults
  assert.equal(getStoredCockpitSentinelAutoScan(), false);
  assert.equal(getStoredCockpitSentinelAutoAlign(), true);
});

test("sentinelPersistence persists operator choice across turn-off and remount", () => {
  const store = new Map<string, string>();
  const originalWindow = globalThis.window;

  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    },
  };

  try {
    // 1. Operator turns OFF the sentinel
    setStoredForgeSentinelAutoScan(false);
    assert.equal(getStoredForgeSentinelAutoScan(true), false);

    // 2. Operator turns ON auto-scan
    setStoredForgeSentinelAutoScan(true);
    assert.equal(getStoredForgeSentinelAutoScan(false), true);

    // 3. Operator turns OFF again -> must STAY OFF even if default is requested true
    setStoredForgeSentinelAutoScan(false);
    assert.equal(getStoredForgeSentinelAutoScan(true), false);

    // 4. Test Auto-Execute
    setStoredForgeSentinelAutoExecute(false);
    assert.equal(getStoredForgeSentinelAutoExecute(true), false);
    setStoredForgeSentinelAutoExecute(true);
    assert.equal(getStoredForgeSentinelAutoExecute(false), true);

    // 5. Test Overlay
    setStoredForgeSentinelOverlay(false);
    assert.equal(getStoredForgeSentinelOverlay(true), false);

    // 6. Test Cockpit Auto-Scan
    setStoredCockpitSentinelAutoScan(false);
    assert.equal(getStoredCockpitSentinelAutoScan(true), false);
    setStoredCockpitSentinelAutoScan(true);
    assert.equal(getStoredCockpitSentinelAutoScan(false), true);

    // 7. Test Cockpit Auto-Align
    setStoredCockpitSentinelAutoAlign(false);
    assert.equal(getStoredCockpitSentinelAutoAlign(true), false);
  } finally {
    (globalThis as any).window = originalWindow;
  }
});
