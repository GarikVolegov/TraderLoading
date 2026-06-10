import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const backtest = readFileSync(new URL("./backtest.ts", import.meta.url), "utf8");
const profile = readFileSync(new URL("./profile.ts", import.meta.url), "utf8");
const brokers = readFileSync(new URL("./brokers.ts", import.meta.url), "utf8");
const routesIndex = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../app.ts", import.meta.url), "utf8");

assert.match(routesIndex, /billingRouter/);
assert.match(app, /createStripeWebhookRouter/);
assert.match(app, /express\.raw\(\{\s*type:\s*"application\/json"/);

assert.match(backtest, /requireProFeature\(req,\s*res,\s*"backtest"\)/);
assert.match(profile, /requireProFeature\(req,\s*res,\s*"leaderboard"\)/);
assert.match(brokers, /requireProFeature\(req,\s*res,\s*"broker"\)/);

console.log("billing gate static checks passed");
