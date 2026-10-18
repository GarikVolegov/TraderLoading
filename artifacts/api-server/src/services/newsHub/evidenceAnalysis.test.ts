import assert from "node:assert/strict";
import { supportedAnalysisText, supportedDeepDive } from "./evidenceAnalysis.js";

const evidence = "The Committee held the rate at 4.25%. Inflation remains elevated. Further decisions depend on incoming data.";
assert.equal(supportedAnalysisText("The rate remains at 4,25% according to the statement.", evidence), true);
assert.equal(supportedAnalysisText("The rate was cut by 50 bps to 3.75%.", evidence), false);
assert.equal(supportedAnalysisText("The rate is now 25% after the decision.", evidence), false, "digits inside another figure are not evidence");
assert.equal(supportedAnalysisText("Inflation was above expectations and surprised markets.", evidence), false);
assert.equal(supportedAnalysisText("The decision met the consensus of economists.", evidence), false);
assert.equal(supportedAnalysisText("The data was above expectations, according to the release.", "The release says the result was above expectations."), true);
assert.equal(supportedAnalysisText("too short", evidence), false);
assert.equal(supportedAnalysisText(null, evidence), false);
assert.equal(supportedAnalysisText("The Committee cut interest rates and promised emergency easing.", evidence), false);
assert.equal(supportedAnalysisText("The Committee cut interest rates.", "The Committee held interest rates. It lowered its inflation forecast."), false);
assert.equal(supportedAnalysisText("The reported rate is -4.25% in the source.", evidence), false,"a fabricated minus sign is not supported");
assert.equal(supportedAnalysisText("CPI inflation was reported at 4.25%.", evidence), false,"an authentic rate figure cannot be attributed to CPI");
const dive = {
  whatHappened: "The Committee kept its rate at 4.25%.",
  whyItMatters: "Interest rate policy influences the dollar and bond yields.",
  possibleImpact: "If incoming data strengthens the case for easing, yields could decline.",
};
assert.deepEqual(supportedDeepDive(dive, evidence), dive);
assert.equal(supportedDeepDive({ ...dive, whatHappened: "The rate fell to 3.75% following an unexpected surprise." }, evidence), undefined);
assert.equal(supportedDeepDive({ whatHappened: dive.whatHappened }, evidence), undefined);
assert.equal(supportedDeepDive({...dive,whatHappened:"The ECB held its rate at 4.25%."},evidence),undefined,"matching numbers do not justify a different institution");
assert.equal(supportedDeepDive({...dive,whatHappened:"A recession began after the Committee decision."},evidence),undefined,"unreported macro events cannot become reported facts");
assert.equal(supportedDeepDive({...dive,possibleImpact:"Gold will rally after this decision."},evidence),undefined,"scenario must not promise a future move");
console.log("news evidence analysis checks passed");
