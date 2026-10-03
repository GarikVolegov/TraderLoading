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
  /aria-label=\{uiText\("auto\.ui\.d51d1796fa", \{ label: uiText\(def\.labelKey\) \}\)\}/,
  "open-page affordance must expose an accessible label",
);
assert.match(
  readFileSync(new URL("../lib/i18n/dict.it.ts", import.meta.url), "utf8"),
  /"auto\.ui\.d51d1796fa":\s*"Apri pagina \{label\}"/,
  "the accessible label template must exist in the i18n catalog",
);

console.log("dashboard calendar widget interaction checks passed");
