import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const srcRoot = path.resolve(import.meta.dirname, "../..");

// 1. LimenAiSetupOverlay Tests
const overlaySrc = fs.readFileSync(path.join(srcRoot, "components/chart/LimenAiSetupOverlay.tsx"), "utf8");

assert.match(overlaySrc, /limen-ai-setup-overlay/, "Must define root container class");
assert.match(overlaySrc, /is-entry/, "Must render Entry line");
assert.match(overlaySrc, /is-stop/, "Must render Stop Loss zone and line");
assert.match(overlaySrc, /is-be/, "Must render Break Even Trigger line");
assert.match(overlaySrc, /is-tp1/, "Must render Take Profit 1 Parziale line");
assert.match(overlaySrc, /is-tp2/, "Must render Take Profit 2 Runner line");
assert.match(overlaySrc, /limen-ai-handle/, "Must render interactive drag handles");
assert.match(overlaySrc, /Adotta nel Varco/, "Must render direct 1-click adoption CTA");

// 2. CockpitAiSentinelCard Tests
const cardSrc = fs.readFileSync(path.join(srcRoot, "components/cockpit/CockpitAiSentinelCard.tsx"), "utf8");

assert.match(cardSrc, /Sentinella Visiva/, "Must render Sentinella Visiva title");
assert.match(cardSrc, /Audit Checklist (AUREUS|LIMEN)/, "Must render 4-phase checklist audit section");
assert.match(cardSrc, /1\.\s*Contesto HTF/, "Must audit Phase 1 HTF");
assert.match(cardSrc, /2\.\s*Punto Svolta/, "Must audit Phase 2 Svolta");
assert.match(cardSrc, /3\.\s*Trigger/, "Must audit Phase 3 Trigger");
assert.match(cardSrc, /4\.\s*Rischio & Size/, "Must audit Phase 4 Risk");
assert.match(cardSrc, /Adotta Setup AI nel Varco/, "Must render adoption button");
assert.match(cardSrc, /Scansiona Varco/, "Must render scan button");
assert.match(cardSrc, /Statistiche per Singolo Concetto/, "Must render per-concept statistics in Il Varco");
assert.match(cardSrc, /Analisi Continua/, "Must render continuous live analysis toggle in Il Varco");
assert.match(cardSrc, /Auto-Allinea/, "Must render Auto-Allinea toggle in Il Varco");

// 3. LimenChartHeader Tests
const headerSrc = fs.readFileSync(path.join(srcRoot, "components/chart/LimenChartHeader.tsx"), "utf8");
assert.match(headerSrc, /IA Sentinel/, "Must render IA Sentinel button in chart header");

// 4. TradingCockpit Integration Tests
const cockpitSrc = fs.readFileSync(path.join(srcRoot, "pages/TradingCockpit.tsx"), "utf8");
assert.match(cockpitSrc, /CockpitAiSentinelCard/, "Must mount CockpitAiSentinelCard in TradingCockpit");
assert.match(cockpitSrc, /handleScanVarcoAi/, "Must define scan handler");
assert.match(cockpitSrc, /handleAdoptAiSetup/, "Must define setup adoption handler");
assert.match(cockpitSrc, /aiSetup=\{aiSetup\}/, "Must pass aiSetup to LimenProprietaryChart");
assert.match(cockpitSrc, /operativeMemory/, "Must share operativeMemory with Il Varco");

console.log("All LimenAiSetupOverlay and CockpitAiSentinelCard static checks passed!");
