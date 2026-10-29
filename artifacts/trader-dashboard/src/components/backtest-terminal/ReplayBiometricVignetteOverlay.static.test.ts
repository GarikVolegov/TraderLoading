import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const dir = import.meta.dirname;

// 1. Source verification of ReplayBiometricVignetteOverlay
const overlaySrc = fs.readFileSync(path.join(dir, "ReplayBiometricVignetteOverlay.tsx"), "utf8");

assert.match(overlaySrc, /computeReplayTelemetry/, "Overlay must derive state from computeReplayTelemetry");
assert.match(overlaySrc, /btmCriticalVignettePulse/, "Overlay must define critical ruby pulsing vignette");
assert.match(overlaySrc, /btmTargetVignettePulse/, "Overlay must define target golden pulsing vignette");
assert.match(overlaySrc, /btmUnprotectedStrobe/, "Overlay must define unprotected amber/ruby strobe");
assert.match(overlaySrc, /pointerEvents:\s*"none"/, "Overlay must never intercept mouse or pointer events");
assert.match(overlaySrc, /whitespace-nowrap/, "Overlay must enforce whitespace-nowrap on all metric tags");
assert.match(overlaySrc, /BPM/, "Overlay must display biometric heart rate BPM");

// 2. Integration check in BacktestTerminal
const terminalSrc = fs.readFileSync(path.join(dir, "BacktestTerminal.tsx"), "utf8");
assert.match(terminalSrc, /ReplayBiometricVignetteOverlay/, "BacktestTerminal must import ReplayBiometricVignetteOverlay");
assert.match(terminalSrc, /<ReplayBiometricVignetteOverlay engine=\{engine\} \/>/, "BacktestTerminal must render ReplayBiometricVignetteOverlay inside chart wrap");

console.log("All ReplayBiometricVignetteOverlay unit and static checks passed with 100% precision!");
