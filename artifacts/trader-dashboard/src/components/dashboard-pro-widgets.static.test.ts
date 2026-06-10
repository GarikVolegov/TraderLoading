import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const brokerWidget = readFileSync(new URL("./broker-hub/BrokerHubWidget.tsx", import.meta.url), "utf8");
const leaderboardWidget = readFileSync(new URL("./LeaderboardWidget.tsx", import.meta.url), "utf8");

assert.match(brokerWidget, /fetchBillingStatus/);
assert.match(brokerWidget, /BrokerHubWidgetInner/);
assert.match(brokerWidget, /Passa a Pro/);
assert.match(leaderboardWidget, /fetchBillingStatus/);
assert.match(leaderboardWidget, /LeaderboardWidgetInner/);
assert.match(leaderboardWidget, /Passa a Pro/);

console.log("dashboard pro widget static checks passed");
