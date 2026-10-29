import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateTradeBioTension } from "../journal/DisciplineBioTensionChart";

console.log("Starting Cockpit Bio-Guardrail Pre-Trade Tests...");

// ── TEST 1: INIEZIONE BATTITO SMARTWATCH REALE (BPM-TAG) ──
{
  const tradeWithWatch = {
    symbol: "EURUSD",
    direction: "buy" as const,
    entryPrice: 1.0850,
    stopLoss: 1.0820,
    takeProfit: 1.0910,
    pnl: 150,
    rMultiple: 2.0,
    tags: ["EURUSD", "BUY", "BPM-88", "Cardio-Zen", "AUREUS-Cockpit"],
    isWin: true,
    isLoss: false,
  };

  const trajectory = generateTradeBioTension(tradeWithWatch);
  assert.equal(trajectory.points[0].bpm, 88, "Il punto di ingresso deve rispecchiare esattamente il battito reale registrato dallo smartwatch");
}

// ── TEST 2: TAG CARDIO-ZEN E CARDIO-DERIVA ──
{
  const tradeZen = {
    symbol: "GBPUSD",
    direction: "sell" as const,
    tags: ["GBPUSD", "Cardio-Zen"],
    isWin: true,
  };
  const trajectoryZen = generateTradeBioTension(tradeZen);
  assert.equal(trajectoryZen.points[0].bpm, 60, "Cardio-Zen deve impostare la baseline calma a 60 BPM");

  const tradeDeriva = {
    symbol: "NAS100",
    direction: "buy" as const,
    tags: ["NAS100", "Cardio-Deriva"],
    isLoss: true,
  };
  const trajectoryDeriva = generateTradeBioTension(tradeDeriva);
  assert.equal(trajectoryDeriva.points[0].bpm, 84, "Cardio-Deriva deve impostare la baseline agitata a 84 BPM");
}

// ── TEST 3: STATIC CHECKS SU COCKPIT TRADE REGISTER MODAL ──
{
  const __dirname = fileURLToPath(new URL(".", import.meta.url));
  const modalPath = join(__dirname, "CockpitTradeRegisterModal.tsx");
  const modalContent = readFileSync(modalPath, "utf8");

  assert.ok(
    modalContent.includes("useSmartWatchHeartRate"),
    "CockpitTradeRegisterModal deve integrare useSmartWatchHeartRate"
  );
  assert.ok(
    modalContent.includes("ruby_drift"),
    "CockpitTradeRegisterModal deve gestire la zona critica ruby_drift"
  );
  assert.ok(
    modalContent.includes("cooldownSeconds"),
    "CockpitTradeRegisterModal deve implementare il timer di raffreddamento stoico"
  );
  assert.ok(
    modalContent.includes("Respiro Tattico 4-7-8"),
    "CockpitTradeRegisterModal deve consentire l'avvio del rituale di respirazione prima dell'ordine"
  );

  // Assenza di tag di debug proibiti
  for (const forbidden of ["DB", "ORVAL", "MOCK", "SCHEMA"]) {
    const regex = new RegExp(`['">]${forbidden}['"<]`);
    assert.equal(
      regex.test(modalContent),
      false,
      `CockpitTradeRegisterModal non deve contenere il tag di debug: ${forbidden}`
    );
  }
}

console.log("Tutti i test Bio-Guardrail Pre-Trade sono stati superati con successo!");
