import assert from "node:assert/strict";
import fs from "node:fs";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { DICT } from "@/lib/i18n/all";
import { readSettingsFeatureSource } from "../pages/settingsFeatureSource";

const appSource = fs.readFileSync("src/App.tsx", "utf8");
const settingsSource = readSettingsFeatureSource();

assert.match(appSource, /import \{ AppTutorialWrapper \} from "\.\/components\/AppTutorialWrapper"/);
assert.match(appSource, /<PairOnboardingWrapper \/>\s*<AppTutorialWrapper \/>/);

assert.equal(fs.existsSync("src/components/AppTutorialWrapper.tsx"), true);
assert.equal(fs.existsSync("src/components/AppTutorialWizard.tsx"), true);

const wrapperSource = fs.readFileSync("src/components/AppTutorialWrapper.tsx", "utf8");
assert.match(wrapperSource, /useBackground\(\)/);
assert.match(wrapperSource, /selectedPairs\.length > 0/);
assert.match(wrapperSource, /settingsLoaded/);
assert.match(wrapperSource, /onboardingTutorialCompletedAt/);
assert.match(wrapperSource, /new Date\(\)\.toISOString\(\)/);
assert.match(wrapperSource, /getGetUserSettingsQueryKey/);

const wizardSource = fs.readFileSync("src/components/AppTutorialWizard.tsx", "utf8");
assert.match(wizardSource, /Dialog/);
assert.match(wizardSource, /app_tutorial\.slide_dashboard_title/);
assert.doesNotMatch(wizardSource, /app_tutorial\.slide_more_title/);
assert.match(wizardSource, /onSkip/);
assert.match(wizardSource, /onFinish/);

assert.match(settingsSource, /AppTutorialWizard/);
assert.match(settingsSource, /settings\.help\.review_tutorial/);
assert.match(settingsSource, /setTutorialOpen\(true\)/);

const requiredKeys = [
  "app_tutorial.title",
  "app_tutorial.progress",
  "app_tutorial.next",
  "app_tutorial.back",
  "app_tutorial.skip",
  "app_tutorial.finish",
  "app_tutorial.slide_dashboard_title",
  "app_tutorial.slide_dashboard_body",
  "app_tutorial.slide_journal_title",
  "app_tutorial.slide_journal_body",
  "app_tutorial.slide_tools_title",
  "app_tutorial.slide_tools_body",
  "app_tutorial.slide_zen_community_title",
  "app_tutorial.slide_zen_community_body",
  "settings.help.review_tutorial",
  "settings.help.review_tutorial_desc",
] as const;

for (const lang of SUPPORTED_LANGUAGES) {
  for (const key of requiredKeys) {
    assert.ok(DICT[lang][key], `[${lang}] missing tutorial key ${key}`);
  }
}

console.log("app tutorial static checks passed");
