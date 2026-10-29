import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isBiometricSupported,
  isBiometricEnabled,
  setBiometricEnabled,
  getStoredCredentialId,
  registerBiometric,
  authenticateBiometric,
} from "./biometrics.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const biometricsFile = path.join(__dirname, "biometrics.ts");
assert.ok(fs.existsSync(biometricsFile), "biometrics.ts must exist");

// 1. SSR / Node environment guards
const supportedSsr = await isBiometricSupported();
assert.equal(supportedSsr, false, "isBiometricSupported must safely return false in Node");
assert.equal(isBiometricEnabled(), false, "isBiometricEnabled must safely return false in Node");
assert.equal(getStoredCredentialId(), null, "getStoredCredentialId must return null in Node");

const regSsr = await registerBiometric();
assert.equal(regSsr, false, "registerBiometric must safely return false in Node");

const authSsr = await authenticateBiometric();
assert.equal(authSsr, false, "authenticateBiometric must safely return false in Node");

// 2. Storage and preference test
const fakeStorage = new Map<string, string>();
const fakeWindow = {
  localStorage: {
    getItem: (key: string) => fakeStorage.get(key) ?? null,
    setItem: (key: string, val: string) => fakeStorage.set(key, val),
    removeItem: (key: string) => fakeStorage.delete(key),
  },
  location: { hostname: "localhost" },
} as unknown as Window & typeof globalThis;

const originalWindow = (globalThis as unknown as { window?: unknown }).window;
(globalThis as unknown as { window?: unknown }).window = fakeWindow;

try {
  assert.equal(isBiometricEnabled(), false, "Default biometric enabled state should be false");

  setBiometricEnabled(true);
  assert.equal(isBiometricEnabled(), true, "Should return true after enabling");
  assert.equal(fakeStorage.get("aureus_biometric_enabled"), "true");

  setBiometricEnabled(false);
  assert.equal(isBiometricEnabled(), false, "Should return false after disabling");
  assert.equal(fakeStorage.get("aureus_biometric_enabled"), "false");
} finally {
  (globalThis as unknown as { window?: unknown }).window = originalWindow;
}

// 3. WebAuthn mock browser simulation
class MockPublicKeyCredential {
  static async isUserVerifyingPlatformAuthenticatorAvailable() {
    return true;
  }
}

let createCallCount = 0;
let getCallCount = 0;
let mockShouldFail = false;

const mockCredentials = {
  async create(_options: unknown) {
    createCallCount++;
    if (mockShouldFail) throw new Error("NotAllowedError: User cancelled");
    const rawIdBuffer = new Uint8Array([10, 20, 30, 40, 50]).buffer;
    return {
      rawId: rawIdBuffer,
      id: "mock_cred_id_123",
      type: "public-key",
    };
  },
  async get(_options: unknown) {
    getCallCount++;
    if (mockShouldFail) throw new Error("NotAllowedError: User cancelled");
    return {
      id: "mock_cred_id_123",
      type: "public-key",
    };
  },
};

const browserWithWebAuthn = {
  localStorage: {
    getItem: (key: string) => fakeStorage.get(key) ?? null,
    setItem: (key: string, val: string) => fakeStorage.set(key, val),
    removeItem: (key: string) => fakeStorage.delete(key),
  },
  location: { hostname: "localhost" },
  PublicKeyCredential: MockPublicKeyCredential,
} as unknown as Window & typeof globalThis;

const originalNavigator = globalThis.navigator;
(globalThis as unknown as { window?: unknown }).window = browserWithWebAuthn;
Object.defineProperty(globalThis, "navigator", {
  value: { credentials: mockCredentials },
  configurable: true,
  writable: true,
});

try {
  // Test support detection
  const isSupported = await isBiometricSupported();
  assert.equal(isSupported, true, "Platform authenticator must be detected as supported");

  // Test registration success
  mockShouldFail = false;
  const regSuccess = await registerBiometric("Operatore Aureus");
  assert.equal(regSuccess, true, "registerBiometric should succeed with valid authenticator");
  assert.equal(createCallCount, 1);
  assert.ok(getStoredCredentialId() != null, "Credential ID must be persisted in storage");
  assert.equal(isBiometricEnabled(), true, "Biometric must be marked enabled after registration");

  // Test authentication success
  const authSuccess = await authenticateBiometric();
  assert.equal(authSuccess, true, "authenticateBiometric should succeed");
  assert.equal(getCallCount, 1);

  // Test authentication rejection / cancellation
  mockShouldFail = true;
  const authCancelled = await authenticateBiometric();
  assert.equal(authCancelled, false, "authenticateBiometric should return false on user cancellation");
} finally {
  (globalThis as unknown as { window?: unknown }).window = originalWindow;
  Object.defineProperty(globalThis, "navigator", {
    value: originalNavigator,
    configurable: true,
    writable: true,
  });
}

console.log("Biometric Engine & WebAuthn tests passed with 100% precision!");
