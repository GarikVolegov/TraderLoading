import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { freshCockpit } from "../../../../../contracts/cockpit";
import { computeMobileCopilotVerdict } from "./CockpitMobileCopilotFlow";

const dir = import.meta.dirname;
const flowSrc = fs.readFileSync(path.join(dir, "CockpitMobileCopilotFlow.tsx"), "utf8");
const visualChoiceSrc = fs.readFileSync(path.join(dir, "CockpitVisualChoice.tsx"), "utf8");
const cockpitSrc = fs.readFileSync(path.resolve(dir, "../../pages/TradingCockpit.tsx"), "utf8");
const cockpitCss = fs.readFileSync(path.resolve(dir, "../../pages/TradingCockpit.css"), "utf8");

// 1. Verify exact inline SVG vector schematic paths from reference site
assert.ok(
  visualChoiceSrc.includes("M2 22h34M3 16l7-7 7 15 7-18 9 10M24 5l1 8 8-1"),
  "Must include exact sweep vector schematic path",
);
assert.ok(
  visualChoiceSrc.includes("M2 5h34M2 27h34M3 17l6-6 6 10 6-12 7 13 6-8"),
  "Must include exact compression vector schematic path",
);
assert.ok(
  visualChoiceSrc.includes("M2 22h34M3 5l7 16 6-4 5 6 7-12 7-5M2 25h34"),
  "Must include exact zone mitigation vector schematic path",
);
assert.ok(
  visualChoiceSrc.includes("M2 14h34M3 6l8 14 7-10 8 15 9-6"),
  "Must include exact liquidity-only vector schematic path",
);
assert.ok(
  visualChoiceSrc.includes("M3 25h8v-7h8v-7h8V4h8M2 26h10m6-8h10m-2-8h10"),
  "Must include exact intermediate boxes / re-accumulation vector schematic path",
);

// 2. Verify Mobile Copilot structure & 4 LEDs ("Le quattro domande")
assert.ok(flowSrc.includes("01 / DOVE") && flowSrc.includes("Ciclo grande"));
assert.ok(flowSrc.includes("02 / SINISTRA") && flowSrc.includes("Zona HTF"));
assert.ok(flowSrc.includes("03 / COME") && flowSrc.includes("Ciclo piccolo"));
assert.ok(flowSrc.includes("04 / TARGET") && flowSrc.includes("Liquidità"));
assert.ok(flowSrc.includes("FINESTRA DI REATTIVITÀ · 3 M1"));
assert.ok(flowSrc.includes("EDGE TRACKER"));
assert.ok(flowSrc.includes("Compila Fase"));

// 3. Verify Verdict Engine deterministic states
const now = new Date("2026-05-12T09:15:00Z"); // London active window
const base = freshCockpit("XAUUSD", "scalp", now);

const v1 = computeMobileCopilotVerdict(
  base,
  ["H1", "M15", "M1"],
  false,
  false,
  { be: false, tp1: false, congestion: false, invalidation: false },
  now,
);
assert.equal(v1.eyebrow, "CONTEXT FIRST");

const vComp = computeMobileCopilotVerdict(
  { ...base, cycle: "up", context: "compression" },
  ["H1", "M15", "M1"],
  false,
  false,
  { be: false, tp1: false, congestion: false, invalidation: false },
  now,
);
assert.equal(vComp.state, "red");
assert.equal(vComp.eyebrow, "NO TRADE / COMPRESSIONE");

const vVirginFail = computeMobileCopilotVerdict(
  {
    ...base,
    cycle: "up",
    context: "swept",
    scenario: "valid_zone",
    itfSchema: true,
    ltfSchema: true,
    trigger: "TEST",
    area: "virgin",
    imbalance: false,
  },
  ["H1", "M15", "M1"],
  false,
  false,
  { be: false, tp1: false, congestion: false, invalidation: false },
  now,
);
assert.equal(vVirginFail.state, "red");
assert.equal(vVirginFail.eyebrow, "FILTRO 10%");

const vGo = computeMobileCopilotVerdict(
  {
    ...base,
    cycle: "up",
    context: "swept",
    scenario: "valid_zone",
    itfSchema: true,
    ltfSchema: true,
    trigger: "TEST",
    area: "history",
    target: "Max Londra",
    targetConfirmed: true,
    news: "clear",
  },
  ["H1", "M15", "M1"],
  false,
  false,
  { be: false, tp1: false, congestion: false, invalidation: false },
  now,
);
assert.equal(vGo.state, "green");
assert.equal(vGo.eyebrow, "GO TRADE / 4 DOMANDE VALIDATE");

// 4. Verify integration in TradingCockpit.tsx & TradingCockpit.css
assert.ok(cockpitSrc.includes("<CockpitMobileCopilotFlow"));
assert.ok(cockpitSrc.includes("<CockpitMobileChartChecklistSheet"));
assert.ok(cockpitCss.includes(".ck-ref-mobile-shell"));
assert.ok(cockpitCss.includes(".ck-ref-leds"));
assert.ok(cockpitCss.includes(".ck-ref-verdict"));
assert.ok(cockpitCss.includes(".ck-ref-phase"));

console.log("CockpitMobileCopilotFlow static & unit tests passed with 100% precision!");
