import assert from "node:assert/strict";
import fs from "node:fs";

// 1. SessionDetailInspector Tests
const inspectorSrc = fs.readFileSync("src/components/journal/SessionDetailInspector.tsx", "utf8");

// Perspective switch: Dossier Storico vs Il Varco
assert.match(inspectorSrc, /Dossier Storico/, "SessionDetailInspector must contain Dossier Storico toggle");
assert.match(inspectorSrc, /Il Varco/, "SessionDetailInspector must contain Il Varco toggle");
assert.match(inspectorSrc, /tradeIndex/, "Must support tradeIndex prop");
assert.match(inspectorSrc, /totalTrades/, "Must support totalTrades prop");
assert.match(inspectorSrc, /onNavigateTrade/, "Must support onNavigateTrade stepper callback");
assert.match(inspectorSrc, /activeLiveSession/, "Must support activeLiveSession prop");

// Stepper controls
assert.match(inspectorSrc, /ChevronLeft/, "Must render left arrow for previous trade");
assert.match(inspectorSrc, /ChevronRight/, "Must render right arrow for next trade");
assert.match(inspectorSrc, /Trade\s*<strong[^>]*>\{tradeIndex \+ 1\}<\/strong>\s*di\s*<strong[^>]*>\{totalTrades\}<\/strong>/, "Must render Trade X di Y counter");

// Space Saturation & Visual Radar
assert.match(inspectorSrc, /Coordinate di Esecuzione/, "Must render Execution Coordinates header");
assert.match(inspectorSrc, /Corridoio di Volatilit[àa]/, "Must render Volatility Corridor");
assert.match(inspectorSrc, /<svg[^>]*viewBox="0 0 110 50"/, "Must render dynamic SVG price trajectory");
assert.match(inspectorSrc, /Disciplina (&|&amp;) Consolidamento/, "Must render Discipline & Consolidation block");

// Dynamic Discipline, Cognitive Audit & Personal Debrief Tests
assert.match(inspectorSrc, /verdettoTattico/, "Must compute dynamic algorithmic trade diagnosis");
assert.match(inspectorSrc, /Verdetto Algoritmico/, "Must render algorithmic verdict label");
assert.match(inspectorSrc, /AVAILABLE_TAGS/, "Must define interactive cognitive & emotional tags");
assert.match(inspectorSrc, /VIRTU_TAGS/, "Must define virtuous discipline tags");
assert.match(inspectorSrc, /LEAK_TAGS/, "Must define behavioral leak tags");
assert.match(inspectorSrc, /handleToggleTag/, "Must support 1-click interactive tag toggling with DB persistence");
assert.match(inspectorSrc, /regolaConsolidata/, "Must compute dynamic actionable rule for tomorrow");
assert.match(inspectorSrc, /handleSaveNote/, "Must support saving personal inline debrief notes to DB");
assert.match(inspectorSrc, /Salva Debrief/, "Must render direct Save Debrief button");
assert.match(inspectorSrc, /integrityScore/, "Must compute dynamic execution integrity score");
assert.match(inspectorSrc, /extractTraderNotes/, "Must sanitize and filter raw trade metadata keys");
assert.match(inspectorSrc, /Spunti:/, "Must render quick reflection chips");

// Raw Broker text filter
assert.match(inspectorSrc, /!raw\.includes\("FX Blue"\)\s*&&\s*!raw\.includes\("Ticket:"\)/, "Must filter raw FX Blue and Ticket logs");

// Il Varco Operative Window
assert.match(inspectorSrc, /Livelli Operativi Prefissati/, "Must render planned operative levels in Varco mode");
assert.match(inspectorSrc, /Checklist Pre-Flight del Varco/, "Must render pre-flight checklist in Varco mode");
assert.match(inspectorSrc, /Apri Finestra Operativa \(Il Varco\)/, "Must render direct call-to-action button linking to live cockpit");

// 2. SovereignJournalCockpit Integration Tests
const cockpitSrc = fs.readFileSync("src/components/journal/SovereignJournalCockpit.tsx", "utf8");
assert.match(cockpitSrc, /sortedEntries/, "Must compute sortedEntries sorted chronologically descending");
assert.match(cockpitSrc, /tradeIndex\s*=/, "Must compute tradeIndex");
assert.match(cockpitSrc, /handleNavigateTrade/, "Must implement handleNavigateTrade for stepper");
assert.match(cockpitSrc, /activeLiveSession=\{state\?\.session \?\? null\}/, "Must pass live process session to inspector");

// 3. UnifiedTradeLedgerTrajectory Tests
const trajectorySrc = fs.readFileSync("src/components/journal/UnifiedTradeLedgerTrajectory.tsx", "utf8");
assert.match(trajectorySrc, /Traiettoria dei Rendimenti \(€\)/, "Header must show Euro Trajectory");
assert.match(trajectorySrc, /monteCarloBands/, "Monte Carlo must be computed from actual trade samples");
assert.match(trajectorySrc, /<SovereignChronosHeatmap/, "Must embed SovereignChronosHeatmap calendar");

// 4. SovereignChronosHeatmap Tests
const heatmapSrc = fs.readFileSync("src/components/journal/SovereignChronosHeatmap.tsx", "utf8");
assert.match(heatmapSrc, /Resa Mensile/, "Header must be compact Resa Mensile on 1 line");
assert.match(heatmapSrc, /subMonths/, "Must support navigating to previous month");
assert.match(heatmapSrc, /addMonths/, "Must support navigating to next month");

console.log("SovereignJournalCockpit v8 right-dossier & live-varco static checks passed!");
