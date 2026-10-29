import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenPath = path.join(__dirname, "PinLockScreen.tsx");
assert.ok(fs.existsSync(screenPath), "PinLockScreen.tsx must exist");

const source = fs.readFileSync(screenPath, "utf-8");

// 1. Verify biometric integration
assert.ok(
  source.includes("isBiometricEnabled") && source.includes("unlockWithBiometrics"),
  "Must integrate biometric unlock from PinLockContext"
);
assert.ok(
  source.includes("ScanFace") || source.includes("Fingerprint"),
  "Must render biometric indicator icons"
);
assert.ok(
  source.includes("handleBiometricUnlock"),
  "Must provide biometric unlock trigger handler"
);

// 2. Verify synesthetic audio-tactile integration
assert.ok(
  source.includes("synestheticClick") && source.includes("synestheticAlert"),
  "Must trigger synesthetic feedback on keystrokes and PIN errors"
);

// 3. Verify design compliance
assert.ok(source.includes("#C5A059"), "Must adhere to imperial gold styling");

console.log("PinLockScreen biometric integration checks passed successfully!");
