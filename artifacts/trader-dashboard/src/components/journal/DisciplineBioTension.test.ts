import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateTradeBioTension,
  type TradeBioTelemetryData,
} from "./DisciplineBioTensionChart";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. Functional Test: Win Trade generates serene trajectory
{
  const winTrade: TradeBioTelemetryData = {
    symbol: "EURUSD",
    direction: "LONG",
    entryPrice: 1.085,
    exitPrice: 1.092,
    stopLoss: 1.081,
    takeProfit: 1.092,
    pnl: 140,
    rMultiple: 1.75,
    isWin: true,
    isLoss: false,
    tags: ["piano", "calma"],
  };

  const bio = generateTradeBioTension(winTrade);
  assert.ok(bio.points.length >= 4, "Must generate at least 4 trajectory points");
  assert.ok(bio.avgBpm <= 70, `Expected avg BPM <= 70 for win trade with calma, got ${bio.avgBpm}`);
  assert.equal(bio.verdict.type, "calm");
  assert.ok(bio.clarityIndex >= 82, `Clarity index must be >= 82, got ${bio.clarityIndex}`);
  assert.equal(bio.timeInRedZonePct, 0, "Win trade should have 0% red zone");
}

// 2. Functional Test: Loss Trade with Stop Loss produces controlled climax
{
  const lossTrade: TradeBioTelemetryData = {
    symbol: "XAUUSD",
    direction: "SHORT",
    entryPrice: 2650.0,
    exitPrice: 2660.0,
    stopLoss: 2660.0,
    takeProfit: 2630.0,
    pnl: -100,
    rMultiple: -1.0,
    isWin: false,
    isLoss: true,
    tags: ["fomo"],
  };

  const bio = generateTradeBioTension(lossTrade);
  assert.ok(bio.peakBpm >= 90, `Peak BPM must be >= 90 during critical pullback, got ${bio.peakBpm}`);
  const climaxPoint = bio.points.find((p) => p.phase === "climax");
  assert.ok(climaxPoint, "Must have a climax point");
  assert.equal(climaxPoint?.stressLevel, "critical");
}

// 3. Functional Test: Premature Exit tag detects emotional fear closure
{
  const prematureTrade: TradeBioTelemetryData = {
    symbol: "US30",
    direction: "LONG",
    entryPrice: 42000,
    exitPrice: 41950,
    stopLoss: 41800,
    takeProfit: 42400,
    pnl: -50,
    rMultiple: -0.25,
    isWin: false,
    isLoss: true,
    tags: ["uscita_prematura"],
  };

  const bio = generateTradeBioTension(prematureTrade);
  const exitPoint = bio.points.find((p) => p.phase === "exit");
  assert.ok(exitPoint, "Must have exit point");
  assert.ok(
    exitPoint?.annotation?.includes("Uscita da Paura") || exitPoint?.annotation?.includes("Anticipata"),
    "Exit point annotation must reflect premature contraction",
  );
}

// 4. Static File and Design System Verification
{
  const chartPath = path.join(__dirname, "DisciplineBioTensionChart.tsx");
  const modalPath = path.join(__dirname, "DisciplineBioTensionModal.tsx");

  assert.ok(fs.existsSync(chartPath), "DisciplineBioTensionChart.tsx must exist");
  assert.ok(fs.existsSync(modalPath), "DisciplineBioTensionModal.tsx must exist");

  const chartSrc = fs.readFileSync(chartPath, "utf8");
  const modalSrc = fs.readFileSync(modalPath, "utf8");

  // Check no forbidden debug tags
  const debugWords = ["MOCK", "SCHEMA", "DUMMY", "TEST_ONLY"];
  for (const word of debugWords) {
    assert.ok(!chartSrc.includes(`"${word}"`), `Chart must not contain debug tag: ${word}`);
    assert.ok(!modalSrc.includes(`"${word}"`), `Modal must not contain debug tag: ${word}`);
  }

  // Check presence of AUREUS colors and labels
  assert.ok(chartSrc.includes("Replay Termobarico"), "Chart must feature Replay Termobarico header");
  assert.ok(chartSrc.includes("CALMA STOICA"), "Chart must define Calma Stoica threshold");
  assert.ok(chartSrc.includes("SOGLIA DI TENSIONE"), "Chart must define Soglia di Tensione threshold");
  assert.ok(modalSrc.includes("Respiro Tattico 4-7-8"), "Modal must link to Tactical Breath");
}

console.log("DisciplineBioTension functional and static unit tests passed with 100% precision!");
