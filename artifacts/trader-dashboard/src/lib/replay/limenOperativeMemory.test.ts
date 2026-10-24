import assert from "node:assert/strict";
import {
  createInitialOperativeMemory,
  recordOperativeTradeOutcome,
  recordStep4CareEvent,
  deriveConceptInsights,
} from "./limenOperativeMemory";

// 1. Stato iniziale fedele al Piano Operativo
let mem = createInitialOperativeMemory("XAUUSD");
assert.equal(mem.symbol, "XAUUSD");
assert.equal(mem.flipActive, false);
assert.equal(mem.minImbalancePercent, 10);
assert.equal(mem.reaccumRiskMultiplier, 0.5);

// 2. Violazione di una schematica d'inversione LONG -> Attiva La Regola del Flip verso SHORT (solo JTC/BTI)
mem = recordOperativeTradeOutcome(mem, {
  direction: "long",
  result: "loss",
  exitReason: "invalidation",
  mfeR: 0.2,
  maeR: 1.0,
  cycle: "end_down",
  context: "swept",
  scenario: "valid_zone",
  trigger: "TEST",
  area: "virgin",
  sessionName: "Sessione Londra (08:00-11:30)",
  wasReversal: true,
});

assert.equal(mem.flipActive, true, "La Regola del Flip deve attivarsi dopo violazione di schematica d'inversione");
assert.equal(mem.flipDirection, "short", "Il Flip deve puntare verso la continuazione SHORT");
assert.equal(mem.preferPocOnReversal, true, "Dopo fallimento su TEST deve attivare preferenza POC");
assert.ok(mem.minImbalancePercent > 10, "In Area Vergine deve alzare la soglia di sbilanciamento SOW/SOS");
assert.equal(mem.step4CareStats.invalidationSavesCount, 1, "Deve tracciare il salvataggio anticipato mgmt_invalidation");
assert.ok(mem.step4CareStats.savedRiskR > 0, "Deve contabilizzare il rischio risparmiato in R");

// 3. Eventi intermedi Step 04 (mgmt_be e mgmt_tp1) + Vittoria sul trade in continuazione del Flip
mem = recordStep4CareEvent(mem, "be_moved");
mem = recordStep4CareEvent(mem, "tp1_partial");
mem = recordOperativeTradeOutcome(mem, {
  direction: "short",
  result: "win",
  exitReason: "tp",
  mfeR: 3.0,
  maeR: 0.3,
  cycle: "down",
  context: "swept",
  scenario: "no_zone",
  trigger: "JTC",
  area: "history",
  sessionName: "Sessione New York (14:00-18:00)",
  wasReversal: false,
});

assert.equal(mem.flipActive, false, "Il Flip si resetta una volta completata la continuazione a target");
assert.equal(mem.stats.wins, 1);
assert.equal(mem.stats.losses, 1);
assert.equal(mem.stats.winRate, 50);
assert.equal(mem.step4CareStats.beMovedCount, 1);
assert.equal(mem.step4CareStats.tp1PartialCount, 1);
assert.equal(mem.step4CareStats.flipWinsCount, 1);

// 4. Verifica Statistiche Granulari per Singolo Concetto
assert.equal(mem.conceptStats.byTrigger.JTC.wins, 1);
assert.equal(mem.conceptStats.byTrigger.JTC.winRate, 100);
assert.equal(mem.conceptStats.byTrigger.TEST.losses, 1);
assert.equal(mem.conceptStats.byScenario.no_zone.wins, 1);
assert.equal(mem.conceptStats.bySession["New York"].wins, 1);

const insights = deriveConceptInsights(mem);
assert.equal(insights.bestTrigger, "JTC");
assert.ok(insights.activeConcepts.length >= 4);

console.log("limenOperativeMemory tests passed!");
