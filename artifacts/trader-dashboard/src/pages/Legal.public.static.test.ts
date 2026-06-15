import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(
  new URL("../App.tsx", import.meta.url),
  "utf8",
);
const authShellSource = readFileSync(
  new URL("../components/AuthPageShell.tsx", import.meta.url),
  "utf8",
);
const landingSource = readFileSync(
  new URL("./LandingPage.tsx", import.meta.url),
  "utf8",
);

assert.match(
  appSource,
  /path="\/privacy"/,
  "App must expose a public /privacy route outside authenticated-only settings",
);
assert.match(
  appSource,
  /path="\/terms"/,
  "App must expose a public /terms route outside authenticated-only settings",
);
assert.match(
  authShellSource,
  /href="\/privacy"/,
  "Auth pages must link the Privacy Policy before sign-up",
);
assert.match(
  authShellSource,
  /href="\/terms"/,
  "Auth pages must link Terms before sign-up",
);
assert.match(
  landingSource,
  /href="\/privacy"/,
  "Landing footer must link the Privacy Policy",
);
assert.match(
  landingSource,
  /href="\/terms"/,
  "Landing footer must link Terms",
);

console.log("public legal route checks passed");
