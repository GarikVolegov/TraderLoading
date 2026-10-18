import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  WORKSPACE_TOOLS,
  PREPARATION_STEPS,
  PREPARATION_TOOLS,
  matchingTools,
  widgetDestination,
} from "./workspaceTools";
import { processToolHref } from "./processToolNavigation";
import { reorganizationDictionary } from "./i18n/reorganization";
import { hasExplicitCenterView, centerView } from "./workspaceNavigation";
const widgetIds = [
  "account",
  "tradingview-watchlist",
  "quote",
  "routine",
  "missions",
  "checklist",
  "lot",
  "journal",
  "calendar",
  "sentiment",
  "volatility",
  "cot",
];
const source = readFileSync(new URL("../pages/Dashboard.tsx", import.meta.url), "utf8");
for (const id of widgetIds) {
  assert.ok(source.includes(`id: "${id}"`), `Existing widget ${id} must remain implemented`);
  assert.ok(widgetDestination(id), `Existing widget ${id} needs a catalog destination`);
}
assert.equal(new Set(WORKSPACE_TOOLS.map((tool) => tool.id)).size, WORKSPACE_TOOLS.length);
assert.equal(
  new Set(WORKSPACE_TOOLS.map((tool) => tool.href)).size,
  WORKSPACE_TOOLS.length,
  "Canonical resources should not have duplicate entries",
);
for (const language of ["it", "en", "es", "fr", "de"] as const) {
  const dict = reorganizationDictionary(language);
  for (const tool of WORKSPACE_TOOLS) {
    assert.ok(dict[`catalog.hint.${tool.id}`], `${tool.id} needs a purpose in ${language}`);
    assert.ok(
      matchingTools(dict[`catalog.hint.${tool.id}`], (key) => dict[key] ?? key).some(
        (found) => found.id === tool.id,
      ),
    );
  }
}
const translate = (key: string) => reorganizationDictionary("it")[key] ?? key;
assert.deepEqual(
  PREPARATION_TOOLS.map((tool) => tool.id),
  ["markets", "news", "economic-calendar", "sessions", "calculator"],
);
for (const language of ["it", "en", "es", "fr", "de"] as const) {
  const dict = reorganizationDictionary(language);
  for (const step of PREPARATION_STEPS) {
    assert.ok(dict[`catalog.prepare.${step.id}`]);
    assert.ok(dict[`catalog.prepare.${step.id}_outcome`]);
  }
}
assert.deepEqual(
  matchingTools("volatilità", translate).map((tool) => tool.id),
  ["volatility"],
);
assert.deepEqual(
  matchingTools("cot cftc", translate).map((tool) => tool.id),
  ["cot"],
);
assert.deepEqual(matchingTools("strumento inesistente", translate), []);
assert.equal(widgetDestination("not-existing"), undefined);
assert.equal(hasExplicitCenterView("?widget=cot"), true);
assert.equal(centerView("?widget=cot"), "strumenti");
assert.equal(
  processToolHref("/?vista=notizie&article=original", { pair: "EURUSD", fromProcess: true }),
  "/?vista=notizie&article=original&processReturn=1&pair=EURUSD",
);
assert.equal(
  processToolHref("/backtest", { methodVersionId: "owned-version", fromProcess: true }),
  "/backtest?processReturn=1&methodVersionId=owned-version",
);
assert.throws(() => processToolHref("https://outside.invalid/path", { fromProcess: true }));
assert.throws(() => processToolHref("//outside.invalid"));
console.log(
  "Tool catalog: all existing widgets retained, task search translated, focused routes and safe return context passed",
);
