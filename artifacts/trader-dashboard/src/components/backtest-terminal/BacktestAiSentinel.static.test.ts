import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const dir = import.meta.dirname;

// 1. BacktestAiSentinelPanel Tests
const panelSrc = fs.readFileSync(path.join(dir, "BacktestAiSentinelPanel.tsx"), "utf8");

assert.match(panelSrc, /Sentinella della Forgia/, "Must render Sentinella della Forgia title");
assert.match(panelSrc, /Procedura a 4 Fasi/, "Must render procedural 4-phase section");
assert.match(panelSrc, /PENDING LIMIT/, "Must support Pending Limit badge");
assert.match(panelSrc, /Piazza[\s\S]*nella Forgia/, "Must support Limit order execution CTA");
assert.match(panelSrc, /Scansiona Barra/, "Must render scan current bar CTA");
assert.match(panelSrc, /Analisi Continua/, "Must support continuous automatic analysis toggle");
assert.match(panelSrc, /Auto-Esegui/, "Must support Auto-Esecuzione toggle");
assert.match(panelSrc, /Memoria Antifragile & Flip/, "Must render Memoria Antifragile & Flip section");
assert.match(panelSrc, /REGOLA DEL FLIP ATTIVA/, "Must support Regola del Flip badge");

// 2. ReplayChart Integration Tests
const replayChartSrc = fs.readFileSync(path.join(dir, "ReplayChart.tsx"), "utf8");
assert.match(replayChartSrc, /LimenAiSetupOverlay/, "ReplayChart must mount LimenAiSetupOverlay");
assert.match(replayChartSrc, /setup=\{aiSetup\}/, "ReplayChart must forward aiSetup to LimenAiSetupOverlay");

// 3. TerminalHeader Integration Tests
const headerSrc = fs.readFileSync(path.join(dir, "TerminalHeader.tsx"), "utf8");
assert.match(headerSrc, /IA Sentinel/, "TerminalHeader must contain IA Sentinel button");

// 4. BacktestTerminal Orchestration Tests
const terminalSrc = fs.readFileSync(path.join(dir, "BacktestTerminal.tsx"), "utf8");
assert.match(terminalSrc, /BacktestAiSentinelPanel/, "BacktestTerminal must mount BacktestAiSentinelPanel");
assert.match(terminalSrc, /handleScanReplayAi/, "BacktestTerminal must define handleScanReplayAi");
assert.match(terminalSrc, /handleExecuteReplaySetup/, "BacktestTerminal must define handleExecuteReplaySetup");
assert.match(terminalSrc, /executeDrawingOrder/, "BacktestTerminal must connect AI setup execution to engine");
assert.match(terminalSrc, /autoExecuteAi/, "BacktestTerminal must support autonomous autoExecuteAi state");
assert.match(terminalSrc, /recordOperativeTradeOutcome/, "BacktestTerminal must update operative memory on closed trades");
assert.match(terminalSrc, /mgmt_tp1/, "BacktestTerminal must enforce Step 04 50% partial at 1:3 R:R");
assert.match(terminalSrc, /mgmt_be/, "BacktestTerminal must enforce Step 04 BE at 1:1.5 R:R");
assert.match(terminalSrc, /mgmt_invalidation/, "BacktestTerminal must enforce Step 04 early exit on schematic invalidation");

console.log("All BacktestAiSentinel static checks passed!");
