import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./Dashboard.tsx", import.meta.url), "utf8");

assert.match(
  source,
  /\{\s*id:\s*"calendar",[\s\S]*?bodyHandlesOwnClicks:\s*true[\s\S]*?\}/,
  "calendar widget must opt out of body-level dashboard navigation",
);

assert.match(
  source,
  /const isBodyOpenable = isOpenable && !def\.bodyHandlesOwnClicks;/,
  "dashboard body navigation must be disabled for widgets that own their internal clicks",
);

assert.match(
  source,
  /onClick=\{\(event\) => \{\s*event\.stopPropagation\(\);\s*onOpen\(def\.id\);\s*\}\}/s,
  "open-page affordance must explicitly navigate without relying on the whole widget body",
);

assert.match(
  source,
  /aria-label=\{`Apri pagina \$\{def\.label\}`\}/,
  "open-page affordance must expose an accessible label",
);

console.log("dashboard calendar widget interaction checks passed");
