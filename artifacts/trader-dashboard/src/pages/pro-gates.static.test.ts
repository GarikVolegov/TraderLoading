import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const backtest = readFileSync(new URL("./Backtest.tsx", import.meta.url), "utf8");
const broker = readFileSync(new URL("./Broker.tsx", import.meta.url), "utf8");
const chat = readFileSync(new URL("./Chat.tsx", import.meta.url), "utf8");

assert.match(backtest, /ProUpgradeGate/);
assert.match(backtest, /feature="backtest"/);
assert.match(broker, /ProUpgradeGate/);
assert.match(broker, /feature="broker"/);
assert.match(chat, /ProUpgradeGate/);
assert.match(chat, /feature="leaderboard"/);

console.log("page pro gate static checks passed");
