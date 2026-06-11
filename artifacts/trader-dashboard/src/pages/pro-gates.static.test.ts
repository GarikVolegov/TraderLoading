import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const backtest = readFileSync(new URL("./Backtest.tsx", import.meta.url), "utf8");
const broker = readFileSync(new URL("./Broker.tsx", import.meta.url), "utf8");
const chat = readFileSync(new URL("./Chat.tsx", import.meta.url), "utf8");
const wiki = readFileSync(new URL("./Wiki.tsx", import.meta.url), "utf8");
const gate = readFileSync(new URL("../components/ProUpgradeGate.tsx", import.meta.url), "utf8");

assert.match(backtest, /ProUpgradeGate/);
assert.match(backtest, /feature="backtest"/);
assert.match(broker, /ProUpgradeGate/);
assert.match(broker, /feature="broker"/);
assert.match(chat, /ProUpgradeGate/);
assert.match(chat, /feature="leaderboard"/);
assert.match(wiki, /ProUpgradeGate/);
assert.match(wiki, /feature="wiki"/);
assert.match(gate, /export type ProFeature = "backtest" \| "leaderboard" \| "broker" \| "wiki"/);
assert.match(gate, /billing\.gate\.wiki\.title/);

console.log("page pro gate static checks passed");
