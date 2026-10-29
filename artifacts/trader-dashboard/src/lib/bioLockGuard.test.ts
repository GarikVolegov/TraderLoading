import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_BIOLOCK_CONFIG,
  evaluateBioLockStatus,
  extractTradeBpm,
  classifyCardioBand,
  computeCardioPerformanceCorrelation,
  type RawJournalTradeInput,
} from "./bioLockGuard";
import { computeNotaryHash } from "./notaryScrollGenerator";
import { modulateDeepWorkByBpm, getRiskResonanceLevel, setRiskResonanceLevel } from "./soundFx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── 1. TEST PASSO 2: PRESIDIO BIO-LOCK PRE-ESECUZIONE ───
const nowMs = new Date("2026-10-26T10:00:00Z").getTime();

// A. Battito sereno (68 BPM < 92 BPM) -> non bloccato
const evalCalm = evaluateBioLockStatus({
  config: DEFAULT_BIOLOCK_CONFIG,
  currentBpm: 68,
  isCriticalDrift: false,
  lastBreathMs: null,
  nowMs,
});
assert.equal(evalCalm.isLocked, false, "Battito in Assetto Zen non deve attivare il Bio-Lock");

// B. Battito in Rischio Deriva (96 BPM >= 92 BPM) senza Respiro 4-7-8 recente -> BLOCCATO
const evalDriftLocked = evaluateBioLockStatus({
  config: DEFAULT_BIOLOCK_CONFIG,
  currentBpm: 96,
  isCriticalDrift: true,
  lastBreathMs: null,
  nowMs,
});
assert.equal(evalDriftLocked.isLocked, true, "Battito >= 92 BPM senza respiro deve attivare il Bio-Lock");
assert.ok(evalDriftLocked.reason?.includes("96 BPM"), "Il messaggio deve riportare i BPM correnti");

// C. Battito in Rischio Deriva (98 BPM) ma Respiro 4-7-8 completato 5 minuti fa -> SBLOCCATO (finestra di grazia)
const fiveMinAgo = nowMs - 5 * 60_000;
const evalUnlockedByBreath = evaluateBioLockStatus({
  config: DEFAULT_BIOLOCK_CONFIG,
  currentBpm: 98,
  isCriticalDrift: true,
  lastBreathMs: fiveMinAgo,
  nowMs,
});
assert.equal(evalUnlockedByBreath.isLocked, false, "Completare il Respiro 4-7-8 deve sbloccare il Bio-Lock");
assert.equal(evalUnlockedByBreath.isGraceActive, true);
assert.equal(evalUnlockedByBreath.remainingGraceMinutes, 10);

// D. Finestra di grazia scaduta (20 minuti dopo il Respiro 4-7-8) -> di nuovo BLOCCATO
const twentyMinAgo = nowMs - 20 * 60_000;
const evalExpiredGrace = evaluateBioLockStatus({
  config: DEFAULT_BIOLOCK_CONFIG,
  currentBpm: 95,
  isCriticalDrift: true,
  lastBreathMs: twentyMinAgo,
  nowMs,
});
assert.equal(evalExpiredGrace.isLocked, true, "Dopo 15 minuti la finestra di grazia scade e il Bio-Lock si riattiva");

// E. Bio-Lock disabilitato nelle impostazioni -> mai bloccato
const evalDisabled = evaluateBioLockStatus({
  config: { ...DEFAULT_BIOLOCK_CONFIG, enabled: false },
  currentBpm: 110,
  isCriticalDrift: true,
  lastBreathMs: null,
  nowMs,
});
assert.equal(evalDisabled.isLocked, false, "Se disabilitato dall'Operatore non deve bloccare");

// ─── 2. TEST PASSO 3: ESTRAZIONE BPM & CORRELAZIONE CARDIO-PERFORMANCE ───
const sampleTrades: RawJournalTradeInput[] = [
  {
    id: 1,
    tradeDate: "2026-10-20T09:00:00Z",
    result: "win",
    profit: 120,
    tags: "EURUSD, BUY, BPM-66, Cardio-Zen, Respiro-478",
    content: "Biometria: 66 BPM (Assetto Zen · Garmin Fenix)",
  },
  {
    id: 2,
    tradeDate: "2026-10-21T10:00:00Z",
    result: "win",
    profit: 80,
    tags: "GBPUSD, SELL, BPM-71, Cardio-Zen",
    content: "Biometria: 71 BPM (Assetto Zen)",
  },
  {
    id: 3,
    tradeDate: "2026-10-22T14:00:00Z",
    result: "win",
    profit: 50,
    tags: "XAUUSD, BUY, BPM-82, Cardio-Vigile",
    content: "Biometria: 82 BPM (Assetto Vigile)",
  },
  {
    id: 4,
    tradeDate: "2026-10-23T15:00:00Z",
    result: "loss",
    profit: -60,
    tags: "NAS100, SELL, BPM-98, Cardio-Deriva, FOMO",
    content: "Biometria: 98 BPM (Rischio Deriva)",
  },
  {
    id: 5,
    tradeDate: "2026-10-24T16:00:00Z",
    result: "loss",
    profit: -90,
    tags: "EURUSD, BUY, BPM-104, Cardio-Deriva",
    content: "Biometria: 104 BPM (Rischio Deriva)",
  },
];

assert.equal(classifyCardioBand(66), "zen");
assert.equal(classifyCardioBand(82), "vigilant");
assert.equal(classifyCardioBand(98), "drift");

const extracted1 = extractTradeBpm(sampleTrades[0], 120);
assert.equal(extracted1.bpm, 66);
assert.equal(extracted1.isLiveBleTag, true);

const report = computeCardioPerformanceCorrelation(
  sampleTrades,
  (t) => t.profit ?? 0,
  92
);

assert.equal(report.totalAnalyzedTrades, 5);
assert.equal(report.liveBleTaggedCount, 5);

// Fascia Zen (< 75 BPM): 2 trade, 2 win -> 100% WR, +200€
assert.equal(report.bands.zen.tradesCount, 2);
assert.equal(report.bands.zen.winRate, 100);
assert.equal(report.bands.zen.netPnl, 200);
assert.deepEqual(report.bands.zen.cumulativeCurve, [0, 120, 200]);

// Fascia Vigile (75-91 BPM): 1 trade, 1 win -> 100% WR, +50€
assert.equal(report.bands.vigilant.tradesCount, 1);
assert.equal(report.bands.vigilant.winRate, 100);
assert.equal(report.bands.vigilant.netPnl, 50);

// Fascia Deriva (>= 92 BPM): 2 trade, 0 win, 2 loss -> 0% WR, -150€
assert.equal(report.bands.drift.tradesCount, 2);
assert.equal(report.bands.drift.winRate, 0);
assert.equal(report.bands.drift.netPnl, -150);
assert.equal(report.tachycardiaBleedEuro, 150);
assert.equal(report.clarityWinRateEdge, 100);

// ─── 3. VERIFICA PASSO 1 (BIO-FEEDBACK BPM) & PASSO 2 (NOTARY BIOMETRICS) ───
setRiskResonanceLevel(0);
assert.equal(getRiskResonanceLevel(), 0);
modulateDeepWorkByBpm(60);
assert.equal(getRiskResonanceLevel(), 0, "60 BPM deve mantenere risonanza a 0");
modulateDeepWorkByBpm(100);
assert.equal(getRiskResonanceLevel(), 1.0, "100 BPM deve portare la risonanza a 1.0");

// Notary hash deterministico include cardioMetrics
const notaryWithCardio = {
  operatorName: "Iniziato AUREUS",
  gradeTitle: "Custode del Registro",
  gradeCode: "GRADO II",
  integrityIndex: 100,
  consecutiveSessions: 10,
  violationsCount: 0,
  winRate: 80,
  totalTrades: 10,
  profitFormatted: "+1.250,00 €",
  cardioMetrics: {
    zenWinRate: 85,
    zenPct: 70,
    avgBpm: 66,
    totalTrades: 10,
  },
};
const hashWithCardio = computeNotaryHash(notaryWithCardio);
assert.ok(hashWithCardio.startsWith("0x"), "L'impronta deve essere esadecimale SHA-256");
assert.equal(hashWithCardio.length, 66);

// ─── 4. VERIFICA STATICA INTEGRAZIONE UI E DESIGN SYSTEM ───
const modalPath = path.join(__dirname, "../components/journal/CardioPerformanceAnalyticsModal.tsx");
assert.ok(fs.existsSync(modalPath), "CardioPerformanceAnalyticsModal.tsx deve esistere");
const modalSrc = fs.readFileSync(modalPath, "utf8");
assert.ok(modalSrc.includes("Assetto Zen") || modalSrc.includes("computeCardioPerformanceCorrelation"), "Deve mostrare la correlazione per fascia cardiaca");
assert.ok(modalSrc.includes("whitespace-nowrap"), "Deve applicare whitespace-nowrap alle metriche numeriche");

const orderTicketPath = path.join(__dirname, "../components/backtest-terminal/OrderTicket.tsx");
assert.ok(fs.existsSync(orderTicketPath), "OrderTicket.tsx deve esistere");
const orderTicketSrc = fs.readFileSync(orderTicketPath, "utf8");
assert.ok(orderTicketSrc.includes("evaluateBioLockStatus"), "OrderTicket deve valutare il Presidio Bio-Lock");
assert.ok(orderTicketSrc.includes("TacticalBreathModal"), "OrderTicket deve montare TacticalBreathModal");

console.log("Tutti i test Passo 1, 2 e 3 superati con successo al 100%!");
