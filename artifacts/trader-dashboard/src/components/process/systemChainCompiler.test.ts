import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SYSTEM_TUTORIAL_PRESETS } from "./SystemCompilationTutorialModal";

// 1. Verify SYSTEM_TUTORIAL_PRESETS institutional archetypes
const expectedIds = ["ict-liquidity-sweep", "momentum-breakout", "swing-strutturale"];
assert.equal(
  SYSTEM_TUTORIAL_PRESETS.length,
  3,
  "SYSTEM_TUTORIAL_PRESETS must define exactly 3 institutional archetypes",
);

for (const expectedId of expectedIds) {
  const preset = SYSTEM_TUTORIAL_PRESETS.find((p) => p.id === expectedId);
  assert.ok(preset, `Missing institutional archetype preset: ${expectedId}`);
  assert.ok(preset.name.trim().length > 0, `Preset ${expectedId} must have a name`);
  assert.ok(preset.code.trim().length > 0, `Preset ${expectedId} must have a code`);
  assert.ok(preset.rules.markets.trim().length > 0, `Preset ${expectedId} must specify markets`);
  assert.ok(preset.rules.windows.trim().length > 0, `Preset ${expectedId} must specify windows`);
  assert.ok(preset.rules.setup.trim().length > 0, `Preset ${expectedId} must specify setup`);
  assert.ok(preset.rules.entry.trim().length > 0, `Preset ${expectedId} must specify entry`);
  assert.ok(preset.rules.exit.trim().length > 0, `Preset ${expectedId} must specify exit`);
  assert.ok(
    preset.rules.invalidation.trim().length > 0,
    `Preset ${expectedId} must specify invalidation`,
  );
  assert.ok(
    preset.rules.waitConditions.trim().length > 0,
    `Preset ${expectedId} must specify waitConditions`,
  );
  assert.ok(
    preset.rules.riskPerTrade > 0,
    `Preset ${expectedId} must have positive riskPerTrade`,
  );
  assert.ok(
    preset.rules.maxDailyLoss >= preset.rules.riskPerTrade,
    `Preset ${expectedId} must have maxDailyLoss >= riskPerTrade`,
  );
  assert.ok(
    preset.rules.maxDailyTrades > 0,
    `Preset ${expectedId} must have positive maxDailyTrades`,
  );
  const checklistLines = preset.rules.checklist
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  assert.ok(
    checklistLines.length >= 3,
    `Preset ${expectedId} must have at least 3 checklist items`,
  );
}

// 2. Verify SystemCompilationTutorialModal.tsx static structure & whitespace-nowrap compliance
const tutorialModalSource = readFileSync(
  new URL("./SystemCompilationTutorialModal.tsx", import.meta.url),
  "utf8",
);
assert.match(tutorialModalSource, /whitespace-nowrap/);
assert.match(tutorialModalSource, /system-compilation-tutorial-modal/);
assert.match(tutorialModalSource, /MobileChainWizard/);

// 3. Verify MobileChainWizard.tsx exports & navigation pills
const wizardSource = readFileSync(
  new URL("../ui/MobileChainWizard.tsx", import.meta.url),
  "utf8",
);
assert.match(wizardSource, /export function MobileChainWizard/);
assert.match(wizardSource, /export function QuickSelectChipBar/);
assert.match(wizardSource, /chain-step-pill-/);
assert.match(wizardSource, /whitespace-nowrap/);

// 4. Verify Method.tsx integrates the 5-ring chain, QuickSelectChipBar, and SystemCompilationTutorialModal
const methodSource = readFileSync(new URL("../../pages/Method.tsx", import.meta.url), "utf8");
for (const ringId of [
  "identity-markets",
  "windows-setup",
  "entry-exit-invalidation",
  "risk-wait",
  "threshold-seal",
]) {
  assert.ok(
    methodSource.includes(`id: "${ringId}"`),
    `Method.tsx must include chain ring id "${ringId}"`,
  );
}
assert.match(methodSource, /QuickSelectChipBar/);
assert.match(methodSource, /SystemCompilationTutorialModal/);
assert.match(methodSource, /MobileChainWizard/);

// 5. Verify DailyOrderStageCard.tsx integrates the 4-stage mobile chain and SystemCompilationTutorialModal
const dailyOrderStageSource = readFileSync(
  new URL("../daily-order/DailyOrderStageCard.tsx", import.meta.url),
  "utf8",
);
assert.match(dailyOrderStageSource, /daily-order-mobile-chain/);
assert.match(dailyOrderStageSource, /daily-order-mobile-chain-footer/);
assert.match(dailyOrderStageSource, /mobileStage === 1 \? "block" : "hidden md:block"/);
assert.match(dailyOrderStageSource, /mobileStage === 2 \? "block" : "hidden md:block"/);
assert.match(dailyOrderStageSource, /mobileStage === 3 \? "block" : "hidden md:block"/);
assert.match(dailyOrderStageSource, /mobileStage === 4 \? "block" : "hidden md:block"/);
assert.match(dailyOrderStageSource, /<SystemCompilationTutorialModal/);
assert.match(dailyOrderStageSource, /whitespace-nowrap/);

console.log("systemChainCompiler tests passed");
