import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const legacyToolsPage = new URL("./pages/Tools.tsx", import.meta.url);
const bottomNav = readFileSync(new URL("./components/BottomNav.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("./pages/Dashboard.tsx", import.meta.url), "utf8");
const sentimentWidget = readFileSync(new URL("./components/SentimentWidget.tsx", import.meta.url), "utf8");
const volatilityWidget = readFileSync(new URL("./components/VolatilityWidget.tsx", import.meta.url), "utf8");
const cotWidget = readFileSync(new URL("./components/CotWidget.tsx", import.meta.url), "utf8");

assert.doesNotMatch(app, /const Tools = lazy/);
assert.match(app, /<Route path="\/backtest" component=\{Backtest\} \/>/);
assert.match(app, /<Route path="\/tools" component=\{Backtest\} \/>/);
assert.equal(existsSync(legacyToolsPage), false);

assert.match(
  bottomNav,
  /\{\s*href: "\/backtest",\s*icon: FlaskConical,\s*labelKey: "nav\.backtest",\s*isChat: false\s*\}/,
);
assert.doesNotMatch(bottomNav, /href: "\/tools"/);
assert.doesNotMatch(bottomNav, /labelKey: "nav\.tools"/);
assert.equal((bottomNav.match(/href: "\/backtest"/g) ?? []).length, 1);

assert.doesNotMatch(dashboard, /route: "\/tools\?tab=/);
assert.doesNotMatch(sentimentWidget, /href="\/tools"/);
assert.doesNotMatch(volatilityWidget, /href="\/tools"/);
assert.doesNotMatch(cotWidget, /href="\/tools"/);

console.log("backtest navigation checks passed");
