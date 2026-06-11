import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const brokerWidget = readFileSync(new URL("./broker-hub/BrokerHubWidget.tsx", import.meta.url), "utf8");
const leaderboardWidget = readFileSync(new URL("./LeaderboardWidget.tsx", import.meta.url), "utf8");

assert.match(brokerWidget, /useBillingStatus/);
assert.match(brokerWidget, /BrokerHubWidgetInner/);
assert.match(brokerWidget, /Passa a Pro/);
assert.match(leaderboardWidget, /useBillingStatus/);
assert.match(leaderboardWidget, /LeaderboardWidgetInner/);
assert.match(leaderboardWidget, /Passa a Pro/);
assert.doesNotMatch(brokerWidget, /queryFn:\s*\(\)\s*=>\s*fetchBillingStatus\(\)/);
assert.doesNotMatch(leaderboardWidget, /queryFn:\s*\(\)\s*=>\s*fetchBillingStatus\(\)/);

console.log("dashboard pro widget static checks passed");
