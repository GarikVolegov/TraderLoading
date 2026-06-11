import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const landingSource = readFileSync(new URL("./LandingPage.tsx", import.meta.url), "utf8");

assert.match(
  landingSource,
  /rounded-full/,
  "landing navbar shell should be a rounded pill",
);
assert.match(
  landingSource,
  /backdrop-blur-\[30px\]|backdrop-blur-3xl|backdrop-blur-2xl/,
  "landing navbar shell should use a strong frosted glass blur",
);
assert.match(
  landingSource,
  /from-primary\/15/,
  "landing navbar should keep the selected neon liquid green tint",
);
assert.match(
  landingSource,
  /from-blue-500\/10/,
  "landing navbar should include the selected blue liquid tint",
);
assert.match(
  landingSource,
  /bg-\[linear-gradient\(115deg/,
  "landing navbar should include an inner diagonal liquid shine",
);
assert.doesNotMatch(
  landingSource,
  /border-b border-white\/5 backdrop-blur-md bg-background\/50/,
  "landing navbar should not use the old full-width bordered header style",
);

console.log("landing liquid glass nav static checks passed");
