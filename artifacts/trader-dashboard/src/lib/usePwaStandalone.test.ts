import assert from "node:assert/strict";
import { checkIsStandalone, checkIsIos } from "./usePwaStandalone.js";

console.log("Starting usePwaStandalone tests...");

// 1. In Node.js environment (SSR)
assert.equal(checkIsStandalone(), false, "checkIsStandalone must safely return false in SSR");
assert.equal(checkIsIos(), false, "checkIsIos must safely return false in SSR");

// 2. Mock browser environment
const originalWindow = (globalThis as unknown as { window?: unknown }).window;
const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, "navigator");

try {
  // Test standalone false
  (globalThis as unknown as { window: unknown }).window = {
    matchMedia: (query: string) => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
    navigator: {},
  };
  Object.defineProperty(globalThis, "navigator", {
    value: { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
    configurable: true,
    writable: true,
  });

  assert.equal(checkIsStandalone(), false, "Should return false when not in standalone");
  assert.equal(checkIsIos(), false, "Macintosh UA should not be detected as iOS");

  // Test display-mode: standalone
  (globalThis as unknown as { window: unknown }).window = {
    matchMedia: (query: string) => ({
      matches: query.includes("display-mode: standalone"),
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
    navigator: {},
  };
  assert.equal(checkIsStandalone(), true, "Should return true when display-mode: standalone matches");

  // Test iOS navigator.standalone
  (globalThis as unknown as { window: unknown }).window = {
    matchMedia: (query: string) => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
    navigator: {
      standalone: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    },
  };
  Object.defineProperty(globalThis, "navigator", {
    value: {
      standalone: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    },
    configurable: true,
    writable: true,
  });
  assert.equal(checkIsStandalone(), true, "Should return true when iOS navigator.standalone is true");
  assert.equal(checkIsIos(), true, "iPhone UA should be detected as iOS");

} finally {
  (globalThis as unknown as { window?: unknown }).window = originalWindow;
  if (originalNavigatorDesc) {
    Object.defineProperty(globalThis, "navigator", originalNavigatorDesc);
  }
}

console.log("usePwaStandalone tests passed with 100% precision!");
