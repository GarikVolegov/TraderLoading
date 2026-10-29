import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { computeReplayTelemetry } from "./ReplayBioTelemetryHUD.js";
import type { OpenPosition } from "../../lib/replay/types.js";

const dir = import.meta.dirname;

// ─── 1. Unit Tests per il Motore Matematico di Bio-Telemetria ──────────────────

// A. Stasi Operativa (nessun trade a mercato)
const idleTelemetry = computeReplayTelemetry([], 1.085, "EURUSD", 0);
assert.equal(idleTelemetry.bpm, 60, "Idle state must default to 60 BPM");
assert.equal(idleTelemetry.status, "idle");
assert.equal(idleTelemetry.label, "STASI OPERATIVA");

// B. Trade BUY in Profitto con TP Imminente
const buyProfitPos: OpenPosition = {
  direction: "buy",
  entryPrice: 1.0800,
  stopLoss: 1.0770, // 30 pips SL
  takeProfit: 1.0860, // 60 pips TP
  hasStop: true,
  lots: 1,
  riskAmount: 300,
  entryTime: 1700000000,
  slPips: 30,
  tpPips: 60,
};

// Prezzo a 1.0855 (a 5 pips dal TP 1.0860)
const nearTpTelemetry = computeReplayTelemetry([buyProfitPos], 1.0855, "EURUSD", 550);
assert.equal(nearTpTelemetry.bpm, 58, "Near TP telemetry must reflect calm 58 BPM");
assert.equal(nearTpTelemetry.status, "profit");
assert.equal(nearTpTelemetry.label, "TARGET IMMINENTE");
assert.match(nearTpTelemetry.proximityDetail, /TP a 5\.0 pips/);

// C. Trade BUY in Moderata Tensione (40% di distanza rimanente allo Stop)
// entry = 1.0800, SL = 1.0770 (span = 0.0030)
// 40% di 0.0030 = 0.0012 -> currentPrice = 1.0782
const moderateBuyTelemetry = computeReplayTelemetry([buyProfitPos], 1.0782, "EURUSD", -180);
assert.equal(moderateBuyTelemetry.status, "attention");
assert.equal(moderateBuyTelemetry.label, "ATTENZIONE STOP");
assert.ok(moderateBuyTelemetry.bpm >= 68 && moderateBuyTelemetry.bpm <= 84, "Moderate tension BPM must be between 68 and 84");

// D. Trade BUY in Prossimità Critica allo Stop Loss (15% di distanza rimanente allo Stop)
// 15% di 0.0030 = 0.00045 -> currentPrice = 1.07745
const criticalBuyTelemetry = computeReplayTelemetry([buyProfitPos], 1.07745, "EURUSD", -255);
assert.equal(criticalBuyTelemetry.status, "critical");
assert.equal(criticalBuyTelemetry.label, "SOGLIA CRITICA");
assert.ok(criticalBuyTelemetry.bpm >= 85 && criticalBuyTelemetry.bpm <= 105, "Critical tension BPM must ramp from 85 to 105");

// E. Trade SELL in Prossimità Critica allo Stop Loss
const sellPos: OpenPosition = {
  direction: "sell",
  entryPrice: 150.00,
  stopLoss: 151.00, // 100 pips SL (JPY)
  takeProfit: 147.00,
  hasStop: true,
  lots: 1,
  riskAmount: 500,
  entryTime: 1700000000,
  slPips: 100,
  tpPips: 300,
};

// Prezzo sale a 150.85 (a soli 15 pips dallo stop di 151.00, ratio = 0.15)
const criticalSellTelemetry = computeReplayTelemetry([sellPos], 150.85, "USDJPY", -425);
assert.equal(criticalSellTelemetry.status, "critical");
assert.equal(criticalSellTelemetry.label, "SOGLIA CRITICA");
assert.ok(criticalSellTelemetry.bpm >= 85, "Critical sell BPM must accelerate >= 85");
assert.match(criticalSellTelemetry.proximityDetail, /Stop a 15\.0 pips/);

// F. Trade in perdita privo di Stop Loss (Violazione dell'Integrità)
const unprotectedPos: OpenPosition = {
  direction: "buy",
  entryPrice: 1.0800,
  stopLoss: 0,
  takeProfit: 0,
  hasStop: false,
  lots: 1,
  riskAmount: 0,
  entryTime: 1700000000,
  slPips: 0,
  tpPips: 0,
};

const unprotectedTelemetry = computeReplayTelemetry([unprotectedPos], 1.0750, "EURUSD", -500);
assert.equal(unprotectedTelemetry.status, "unprotected");
assert.equal(unprotectedTelemetry.label, "STOP ASSENTE");
assert.equal(unprotectedTelemetry.bpm, 94);
assert.equal(unprotectedTelemetry.hrvStatus, "inibita", "Unprotected risk must exhibit inhibited HRV status");
assert.ok(unprotectedTelemetry.hrvRmssd <= 25, "Unprotected risk HRV RMSSD must be <= 25 ms");

// G. Verifica HRV RMSSD Coerenza Elevata (Idle / Profit)
assert.equal(idleTelemetry.hrvStatus, "elevata", "Idle state must reflect elevated HRV coherence");
assert.ok(idleTelemetry.hrvRmssd >= 60, "Idle HRV RMSSD must be >= 60 ms");
assert.equal(nearTpTelemetry.hrvStatus, "elevata", "Near TP must reflect elevated HRV coherence");
assert.equal(moderateBuyTelemetry.hrvStatus, "vigile", "Moderate tension must reflect vigilant HRV status");

// ─── 2. Static Architectural & Code Quality Checks ─────────────────────────────

const hudSrc = fs.readFileSync(path.join(dir, "ReplayBioTelemetryHUD.tsx"), "utf8");
assert.match(hudSrc, /startProceduralHeartbeat/, "HUD must use procedural Web Audio heartbeat");
assert.match(hudSrc, /setHeartbeatBpm/, "HUD must update BPM dynamically");
assert.match(hudSrc, /stopProceduralHeartbeat/, "HUD must stop audio on pause/unmount");
assert.match(hudSrc, /isHeartbeatSoundMuted/, "HUD must support independent audio mute");
assert.match(hudSrc, /whitespace-nowrap/, "HUD must enforce whitespace-nowrap on all metric tags");
assert.match(hudSrc, /useSmartWatchHeartRate/, "HUD must consume live smartwatch telemetry when available");
assert.match(hudSrc, /activeHrv/, "HUD must expose active HRV RMSSD indicator");
assert.match(hudSrc, /font-mono/, "HUD must enforce font-mono formatting");

const transportSrc = fs.readFileSync(path.join(dir, "TransportBar.tsx"), "utf8");
assert.match(transportSrc, /ReplayBioTelemetryHUD/, "TransportBar must embed ReplayBioTelemetryHUD");

const terminalSrc = fs.readFileSync(path.join(dir, "BacktestTerminal.tsx"), "utf8");
assert.match(terminalSrc, /synestheticSealOfAction/, "BacktestTerminal must trigger synestheticSealOfAction on fills");
assert.match(terminalSrc, /synestheticTrophy/, "BacktestTerminal must trigger synestheticTrophy on TP");
assert.match(terminalSrc, /synestheticAlert/, "BacktestTerminal must trigger synestheticAlert on SL");

console.log("All ReplayBioTelemetryHUD unit and static checks passed with 100% precision!");
