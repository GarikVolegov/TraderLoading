import assert from "node:assert/strict";
import { cockpitContextReady, type CockpitAnalysis } from "../../../../../contracts/cockpit.js";

// 1. Test calcolo conformità fasi Custode della Soglia
const mockEmptyAnalysis: CockpitAnalysis = {
  market: "EURUSD",
  mode: "scalp",
  phase: 1,
  cycle: "",
  scenario: "",
  trigger: "",
};

assert.equal(cockpitContextReady(mockEmptyAnalysis), false, "Analisi vuota non deve risultare pronta");

const mockReadyAnalysis: CockpitAnalysis = {
  market: "EURUSD",
  mode: "scalp",
  phase: 3,
  cycle: "bullish",
  context: "swept",
  scenario: "continuation",
  itfSchema: "schema_a",
  ltfSchema: "schema_m1",
  trigger: "JTC",
  targetConfirmed: true,
};

assert.equal(cockpitContextReady(mockReadyAnalysis), true, "Analisi completa deve risultare pronta");

// 2. Test logica rischio overtrading
function evaluateOvertrading(trades: number, max: number): boolean {
  return trades >= max;
}

assert.equal(evaluateOvertrading(0, 3), false);
assert.equal(evaluateOvertrading(2, 3), false);
assert.equal(evaluateOvertrading(3, 3), true, "Raggiunto il massimo trade consentiti");
assert.equal(evaluateOvertrading(4, 3), true, "Superato il massimo trade consentiti");

// 3. Test calcolo circonferenza e offset dell'anello
const radius = 12;
const circumference = 2 * Math.PI * radius;

function computeStrokeOffset(pct: number): number {
  const clamped = Math.max(0, Math.min(100, pct));
  return circumference - (clamped / 100) * circumference;
}

assert.equal(Math.round(computeStrokeOffset(100)), 0, "100% deve avere offset zero (anello pieno)");
assert.equal(Math.round(computeStrokeOffset(0)), Math.round(circumference), "0% deve avere offset uguale alla circonferenza");
assert.ok(computeStrokeOffset(50) > 0 && computeStrokeOffset(50) < circumference, "50% deve essere a metà");

// 4. Test calcolo durata sessione e Sentinel Affaticamento Decisionale (90 min)
function computeSessionFatigue(params: {
  startTimeStr?: string | null;
  nowMs: number;
  sessionState?: string;
}): { elapsedMinutes: number; isFatigued: boolean } {
  if (!params.startTimeStr) {
    return { elapsedMinutes: 0, isFatigued: false };
  }
  const startMs = new Date(params.startTimeStr).getTime();
  const elapsedMinutes = Math.max(0, Math.floor((params.nowMs - startMs) / 60_000));
  const isSessionActive = Boolean(params.sessionState && params.sessionState !== "closed");
  const isFatigued = isSessionActive && elapsedMinutes >= 90;
  return { elapsedMinutes, isFatigued };
}

const baseNow = new Date("2026-10-25T14:00:00Z").getTime();

// 30 minuti trascorsi in sessione attiva -> no affaticamento
const res30 = computeSessionFatigue({
  startTimeStr: "2026-10-25T13:30:00Z",
  nowMs: baseNow,
  sessionState: "operation",
});
assert.equal(res30.elapsedMinutes, 30);
assert.equal(res30.isFatigued, false, "30m non deve innescare fatica");

// 89 minuti trascorsi -> ancora sotto soglia
const res89 = computeSessionFatigue({
  startTimeStr: "2026-10-25T12:31:00Z",
  nowMs: baseNow,
  sessionState: "operation",
});
assert.equal(res89.elapsedMinutes, 89);
assert.equal(res89.isFatigued, false, "89m non deve innescare fatica");

// 90 minuti trascorsi -> innesco allerta fatica decisionale
const res90 = computeSessionFatigue({
  startTimeStr: "2026-10-25T12:30:00Z",
  nowMs: baseNow,
  sessionState: "operation",
});
assert.equal(res90.elapsedMinutes, 90);
assert.equal(res90.isFatigued, true, "90m deve innescare l'allerta di affaticamento");

// 120 minuti trascorsi ma sessione già chiusa -> nessuna allerta
const resClosed = computeSessionFatigue({
  startTimeStr: "2026-10-25T12:00:00Z",
  nowMs: baseNow,
  sessionState: "closed",
});
assert.equal(resClosed.elapsedMinutes, 120);
assert.equal(resClosed.isFatigued, false, "Sessione chiusa non deve innescare affaticamento");

// Nessuna data di inizio -> durata 0 e no affaticamento
const resEmpty = computeSessionFatigue({
  startTimeStr: null,
  nowMs: baseNow,
  sessionState: "preparation",
});
assert.equal(resEmpty.elapsedMinutes, 0);
assert.equal(resEmpty.isFatigued, false);

// 5. Test logica Sentinella Acustica Correnti Macro (T-15m, T-5m, T-1m)
function filterImminentMacroEvent(
  events: Array<{ impact: string; date: string; title: string; country: string }>,
  nowMs: number
) {
  const highEvents = events
    .filter((e) => e.impact === "High" || e.impact === "high" || e.impact === "Major")
    .map((e) => {
      const timeMs = e.date ? Date.parse(e.date) : null;
      return { event: e, timeMs };
    })
    .filter((item): item is { event: typeof events[number]; timeMs: number } => item.timeMs !== null && !isNaN(item.timeMs));

  const relevant = highEvents
    .map(({ event, timeMs }) => ({
      event,
      timeMs,
      diffMs: timeMs - nowMs,
      diffMinutes: Math.round((timeMs - nowMs) / 60_000),
    }))
    .filter((item) => item.diffMs >= -60_000 && item.diffMs <= 15 * 60_000)
    .sort((a, b) => a.diffMs - b.diffMs);

  return relevant[0] ?? null;
}

const mockCalendar = [
  { impact: "Low", date: "2026-10-25T14:02:00Z", title: "Minor speech", country: "EUR" },
  { impact: "High", date: "2026-10-25T14:25:00Z", title: "Core CPI", country: "USD" }, // 25m out (ignored)
  { impact: "High", date: "2026-10-25T14:04:00Z", title: "Non-Farm Payrolls", country: "USD" }, // 4m out (warning)
];

const found4m = filterImminentMacroEvent(mockCalendar, baseNow);
assert.ok(found4m, "Deve rilevare l'evento High a 4 minuti");
assert.equal(found4m.event.title, "Non-Farm Payrolls");
assert.equal(found4m.diffMinutes, 4);
assert.ok(found4m.diffMs <= 5 * 60_000 && found4m.diffMs > 60_000, "Deve ricadere nella fascia warning 5m");

// Evento a 45 secondi
const mockCalendarImminent = [
  { impact: "High", date: "2026-10-25T14:00:45Z", title: "FOMC Rate Decision", country: "USD" },
];
const found45s = filterImminentMacroEvent(mockCalendarImminent, baseNow);
assert.ok(found45s);
assert.equal(found45s.diffMs, 45_000);
assert.ok(found45s.diffMs <= 60_000 && found45s.diffMs >= -30_000, "Deve ricadere nella fascia imminente 1m");

// Evento passato oltre i 60 secondi -> ignorato
const mockCalendarPast = [
  { impact: "High", date: "2026-10-25T13:58:00Z", title: "Retail Sales", country: "USD" },
];
assert.equal(filterImminentMacroEvent(mockCalendarPast, baseNow), null, "Evento concluso non deve essere rilevato");

// 5. Test logica Bio-Telemetria Cardiaca Live
function computeCockpitBioTelemetry(params: {
  isDriftWarning: boolean;
  macroDiffMs?: number | null;
  tradesToday: number;
  maxTrades: number;
  isFatigued: boolean;
}): { bpm: number; stressReason: string; status: string; color: string } {
  let baseBpm = 60;
  let stressReason = "Assetto Sereno";
  let status = "calm";
  let color = "#10b981";

  if (params.isDriftWarning) {
    baseBpm = Math.max(baseBpm, 96);
    stressReason = "Rischio Deriva";
    status = "critical";
    color = "#ef4444";
  } else if (params.macroDiffMs != null && params.macroDiffMs <= 60_000) {
    baseBpm = Math.max(baseBpm, 92);
    stressReason = "Macro Imminente";
    status = "critical";
    color = "#ef4444";
  } else if (params.tradesToday >= params.maxTrades) {
    baseBpm = Math.max(baseBpm, 88);
    stressReason = "Soglia Max";
    status = "elevated";
    color = "#f59e0b";
  } else if (params.isFatigued) {
    baseBpm = Math.max(baseBpm, 82);
    stressReason = "Affaticamento";
    status = "elevated";
    color = "#f59e0b";
  } else if (params.macroDiffMs != null && params.macroDiffMs <= 300_000) {
    baseBpm = Math.max(baseBpm, 76);
    stressReason = "Allerta Macro";
    status = "vigilant";
    color = "#C5A059";
  } else if (params.tradesToday >= params.maxTrades * 0.75) {
    baseBpm = Math.max(baseBpm, 72);
    stressReason = "Quota 75%";
    status = "vigilant";
    color = "#C5A059";
  }

  return { bpm: baseBpm, stressReason, status, color };
}

// A. Caso Calmo
const calmBio = computeCockpitBioTelemetry({ isDriftWarning: false, tradesToday: 1, maxTrades: 3, isFatigued: false });
assert.equal(calmBio.bpm, 60);
assert.equal(calmBio.status, "calm");
assert.equal(calmBio.stressReason, "Assetto Sereno");

// B. Caso Overtrading
const overtradeBio = computeCockpitBioTelemetry({ isDriftWarning: false, tradesToday: 3, maxTrades: 3, isFatigued: false });
assert.equal(overtradeBio.bpm, 88);
assert.equal(overtradeBio.status, "elevated");
assert.equal(overtradeBio.stressReason, "Soglia Max");

// C. Caso Macro Imminente (45 secondi)
const macroBio = computeCockpitBioTelemetry({ isDriftWarning: false, macroDiffMs: 45_000, tradesToday: 0, maxTrades: 3, isFatigued: false });
assert.equal(macroBio.bpm, 92);
assert.equal(macroBio.status, "critical");
assert.equal(macroBio.stressReason, "Macro Imminente");

// D. Caso Deriva
const driftBio = computeCockpitBioTelemetry({ isDriftWarning: true, tradesToday: 0, maxTrades: 3, isFatigued: false });
assert.equal(driftBio.bpm, 96);
assert.equal(driftBio.status, "critical");
assert.equal(driftBio.stressReason, "Rischio Deriva");

console.log("CockpitIntegritySentinelBar unit tests passed successfully");
