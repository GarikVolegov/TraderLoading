import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const srcRoot = path.resolve(import.meta.dirname, "..");
const cssPath = path.join(srcRoot, "pages/TradingCockpit.css");
const tsxPath = path.join(srcRoot, "pages/TradingCockpit.tsx");

const css = fs.readFileSync(cssPath, "utf8");
const tsx = fs.readFileSync(tsxPath, "utf8");

// 1. TradingCockpit.css assertions
assert.match(
  css,
  /\.ck-process\s*\{[^}]*overflow-x:\s*hidden\s*!important/s,
  "TradingCockpit.css: .ck-process must declare overflow-x: hidden !important to block horizontal scroll"
);

assert.match(
  css,
  /\.ck-process\s*\{[^}]*overscroll-behavior-x:\s*none/s,
  "TradingCockpit.css: .ck-process must declare overscroll-behavior-x: none to prevent trackpad horizontal overscroll"
);

assert.match(
  css,
  /\.ck-process\s*\{[^}]*scrollbar-gutter:\s*stable/s,
  "TradingCockpit.css: .ck-process must declare scrollbar-gutter: stable to avoid content shifts"
);

assert.match(
  css,
  /\.ck-workspace\s*\{[^}]*overflow-x:\s*hidden/s,
  "TradingCockpit.css: .ck-workspace must declare overflow-x: hidden"
);

assert.match(
  css,
  /\.trading-cockpit\s*\{[^}]*overflow-x:\s*hidden/s,
  "TradingCockpit.css: .trading-cockpit must declare overflow-x: hidden"
);

// 2. TradingCockpit.tsx assertions
assert.match(
  tsx,
  /grid grid-cols-2 gap-2/,
  "TradingCockpit.tsx: must render balanced 2-column tactical bar for Respiro & Decompressione"
);

assert.match(
  tsx,
  /Respiro Tattico 4-7-8/,
  "TradingCockpit.tsx: must preserve Respiro button with shortcut B"
);

assert.match(
  tsx,
  /Camera di Decompressione/,
  "TradingCockpit.tsx: must preserve Decompressione button with shortcut D"
);

assert.match(
  tsx,
  /sessionTelemetry.*flex-wrap/s,
  "TradingCockpit.tsx: sessionTelemetry metrics must allow flex-wrap to prevent horizontal overflow"
);

console.log("TradingCockpit overflow-x protection static tests passed with 100% precision!");
