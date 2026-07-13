import assert from "node:assert/strict";
import fs from "node:fs";

// Adversarial-review follow-up: these pre-existing mutateAsync+local-catch
// call sites already show their own toast on failure, so each must opt out
// of App.tsx's global MutationCache toast (lib/mutationErrorPolicy.ts) via
// meta.suppressGlobalError to avoid a double toast on the same failure.
const FILES = [
  "src/components/SessionCheckinModal.tsx",
  "src/components/settings/MissionTemplatesSettings.tsx",
  "src/components/settings/FontSettings.tsx",
  "src/components/settings/NotificationSettings.tsx",
  "src/components/settings/QuotesSettings.tsx",
  "src/components/settings/ChecklistSettings.tsx",
  "src/components/settings/TradingSettings.tsx",
  "src/components/settings/PairPreferencesSettings.tsx",
  "src/components/settings/LanguageSettings.tsx",
  "src/pages/Support.tsx",
  "src/pages/Backtest.tsx",
  "src/pages/Journal.tsx",
  "src/pages/Checklist.tsx",
  "src/pages/BacktestReplay.tsx",
];

for (const file of FILES) {
  const src = fs.readFileSync(file, "utf8");
  assert.match(src, /suppressGlobalError:\s*true/, `${file} must opt at least one mutation out of the global mutation-error toast`);
}

console.log(`double-toast sweep checks passed (${FILES.length} files)`);
