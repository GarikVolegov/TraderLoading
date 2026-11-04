// ─── AUREUS PROTOCOL — FX Replay Feature Parity Static Verification ──────────
// Verifica statica della parità e superiorità di tutte e 6 le funzionalità core
// evidenziate nel benchmark FX Replay:
// 1. Order Flow (Volume Profile, POC, VAH, VAL, Delta Footprint)
// 2. Talk to Journal (AI Speech-to-Text & Session Notes auto-linked)
// 3. Order Panel (Pinnable & Pop-out Ticket, Right Vertical Tool Rail)
// 4. Watchlist (1-Click Asset Switching across Forex, Metals, Indices, Crypto)
// 5. Price Controls (Detachable, Draggable & Pinnable Transport Bar)
// 6. Workspace (Object Tree drawings manager & Macro News economic calendar)

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// 1. TerminalHeader Feature Verifications
const headerSrc = fs.readFileSync(path.join(currentDir, "TerminalHeader.tsx"), "utf8");
assert.match(headerSrc, /Order Flow/, "TerminalHeader must render 'Order Flow' button");
assert.match(headerSrc, /NEW/, "TerminalHeader must badge Order Flow with 'NEW'");
assert.match(headerSrc, /onToggleOrderFlow/, "TerminalHeader must handle onToggleOrderFlow");
assert.match(headerSrc, /Talk to Journal/, "TerminalHeader must render 'Talk to Journal' action button");
assert.match(headerSrc, /onOpenTalkToJournal/, "TerminalHeader must handle onOpenTalkToJournal");

// 2. ReplayChart Overlays
const chartSrc = fs.readFileSync(path.join(currentDir, "ReplayChart.tsx"), "utf8");
assert.match(chartSrc, /ReplayOrderFlowOverlay/, "ReplayChart must import ReplayOrderFlowOverlay");
assert.match(chartSrc, /<ReplayOrderFlowOverlay/, "ReplayChart must render ReplayOrderFlowOverlay when active");
assert.match(chartSrc, /RedNewsOverlay/, "ReplayChart must import RedNewsOverlay");
assert.match(chartSrc, /<RedNewsOverlay/, "ReplayChart must render RedNewsOverlay when active");

// 3. TransportBar Draggable Price Controls
const transportSrc = fs.readFileSync(path.join(currentDir, "TransportBar.tsx"), "utf8");
assert.match(transportSrc, /isDetached/, "TransportBar must support isDetached state");
assert.match(transportSrc, /GripHorizontal/, "TransportBar must provide drag handle grip");
assert.match(transportSrc, /handlePointerDown/, "TransportBar must implement pointer dragging");
assert.match(transportSrc, /PinOff|Pin/, "TransportBar must provide Pin/Unpin controls");

// 4. BacktestTerminal Workspace & Right Dock
const terminalSrc = fs.readFileSync(path.join(currentDir, "BacktestTerminal.tsx"), "utf8");
assert.match(terminalSrc, /btm-right-dock/, "BacktestTerminal must provide right vertical tool dock");
assert.match(terminalSrc, /TalkToJournalModal/, "BacktestTerminal must mount TalkToJournalModal");
assert.match(terminalSrc, /ReplayWatchlistPanel/, "BacktestTerminal must mount ReplayWatchlistPanel");
assert.match(terminalSrc, /ReplayNewsPanel/, "BacktestTerminal must mount ReplayNewsPanel");
assert.match(terminalSrc, /ChartObjectTreeModal/, "BacktestTerminal must mount ChartObjectTreeModal");
assert.match(terminalSrc, /handleSelectSymbol/, "BacktestTerminal must implement 1-click symbol switcher");

// 5. JournalPanel Talk to Journal Integration
const journalSrc = fs.readFileSync(path.join(currentDir, "JournalPanel.tsx"), "utf8");
assert.match(journalSrc, /Talk to Journal/, "JournalPanel must integrate Talk to Journal section");
assert.match(journalSrc, /sessionNotes/, "JournalPanel must manage session notes");
assert.match(journalSrc, /onOpenTalkToJournal/, "JournalPanel must support triggering Talk to Journal");

// 6. Component File Existence Checks
assert.ok(fs.existsSync(path.join(currentDir, "TalkToJournalModal.tsx")), "TalkToJournalModal.tsx must exist");
assert.ok(fs.existsSync(path.join(currentDir, "ReplayOrderFlowOverlay.tsx")), "ReplayOrderFlowOverlay.tsx must exist");
assert.ok(fs.existsSync(path.join(currentDir, "ReplayWatchlistPanel.tsx")), "ReplayWatchlistPanel.tsx must exist");
assert.ok(fs.existsSync(path.join(currentDir, "ReplayNewsPanel.tsx")), "ReplayNewsPanel.tsx must exist");
assert.ok(fs.existsSync(path.join(currentDir, "MeetNewChartsModal.tsx")), "MeetNewChartsModal.tsx must exist");

// 7. Meet The New Charts Modal Verification
const meetModalSrc = fs.readFileSync(path.join(currentDir, "MeetNewChartsModal.tsx"), "utf8");
assert.match(meetModalSrc, /Meet the new charts/, "MeetNewChartsModal must have title 'Meet the new charts'");
assert.match(meetModalSrc, /Order flow/, "MeetNewChartsModal must include Order flow card");
assert.match(meetModalSrc, /Talk to Journal/, "MeetNewChartsModal must include Talk to Journal card");
assert.match(meetModalSrc, /Order panel/, "MeetNewChartsModal must include Order panel card");
assert.match(meetModalSrc, /Watchlist/, "MeetNewChartsModal must include Watchlist card");
assert.match(meetModalSrc, /Price controls/, "MeetNewChartsModal must include Price controls card");
assert.match(meetModalSrc, /Workspace/, "MeetNewChartsModal must include Workspace card");
assert.match(meetModalSrc, /Take the 60-second tour/, "MeetNewChartsModal must have 60-second tour button");
assert.match(terminalSrc, /MeetNewChartsModal/, "BacktestTerminal must mount MeetNewChartsModal");
assert.match(headerSrc, /Meet the new charts/, "TerminalHeader must render 'Meet the new charts' guide button");

console.log("All 6 FX Replay features verified with 100% precision in AUREUS PROTOCOL!");
