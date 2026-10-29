import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const settingsPath = path.join(__dirname, "PinSettings.tsx");
assert.ok(fs.existsSync(settingsPath), "PinSettings.tsx must exist");

const source = fs.readFileSync(settingsPath, "utf-8");

// 1. Verify biometric controls and switch
assert.ok(
  source.includes("isBiometricEnabled") &&
    source.includes("enableBiometrics") &&
    source.includes("disableBiometrics"),
  "Must integrate biometric toggle from PinLockContext"
);
assert.ok(
  source.includes("ScanFace") || source.includes("Fingerprint"),
  "Must include biometric glyph indicators"
);
assert.ok(
  source.includes("Sblocco Biometrico Sovrano"),
  "Must display solemn biometric title"
);

// 2. Verify design compliance
assert.ok(source.includes("#C5A059"), "Must use imperial gold branding");

console.log("PinSettings static and biometric compliance checks passed successfully!");
