import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  calculateHeartRateZone,
  parseHeartRateMeasurement,
  computeHrvRmssd,
  smartWatchManager,
  BLE_HEART_RATE_SERVICE,
  BLE_HEART_RATE_MEASUREMENT_CHAR,
} from "./smartwatchBle";

console.log("Starting SmartWatch BLE & Bio-Telemetry Tests...");

// ── TEST 1: SOGLIE CARDIO AUREUS ──
assert.equal(calculateHeartRateZone(50), "zen");
assert.equal(calculateHeartRateZone(74), "zen");
assert.equal(calculateHeartRateZone(75), "vigilant");
assert.equal(calculateHeartRateZone(89), "vigilant");
assert.equal(calculateHeartRateZone(90), "ruby_drift");
assert.equal(calculateHeartRateZone(130), "ruby_drift");

// ── TEST 2: COSTANTI BLUETOOTH SIG STANDARD ──
assert.equal(BLE_HEART_RATE_SERVICE, 0x180d, "GATT Heart Rate Service UUID deve essere 0x180D");
assert.equal(
  BLE_HEART_RATE_MEASUREMENT_CHAR,
  0x2a37,
  "GATT Heart Rate Measurement UUID deve essere 0x2A37"
);

// ── TEST 3: DECODIFICA PACCHETTO GATT (8-BIT FORMAT) ──
// Flags: 0x00 (8-bit BPM, no sensor contact, no energy, no RR)
// Byte 1: 72 BPM
{
  const buffer = new ArrayBuffer(2);
  const view = new DataView(buffer);
  view.setUint8(0, 0x00);
  view.setUint8(1, 72);

  const parsed = parseHeartRateMeasurement(view);
  assert.equal(parsed.bpm, 72);
  assert.equal(parsed.sensorContact, undefined);
  assert.deepEqual(parsed.rrIntervalsMs, []);
}

// ── TEST 4: DECODIFICA PACCHETTO GATT (16-BIT FORMAT + SENSOR CONTACT) ──
// Flags: 0x01 (16-bit BPM) | 0x04 (contact supported) | 0x02 (contact detected) = 0x07
// Bytes 1-2: 125 BPM in little-endian (0x7D, 0x00)
{
  const buffer = new ArrayBuffer(3);
  const view = new DataView(buffer);
  view.setUint8(0, 0x07);
  view.setUint16(1, 125, true);

  const parsed = parseHeartRateMeasurement(view);
  assert.equal(parsed.bpm, 125);
  assert.equal(parsed.sensorContact, true);
}

// ── TEST 5: DECODIFICA RR-INTERVALS & CALCOLO HRV RMSSD ──
// Flags: 0x10 (RR-Intervals present)
// Byte 1: 80 BPM
// Bytes 2-3: RR raw 1024 (= 1000 ms)
// Bytes 4-5: RR raw 922 (= 900 ms)
{
  const buffer = new ArrayBuffer(6);
  const view = new DataView(buffer);
  view.setUint8(0, 0x10);
  view.setUint8(1, 80);
  view.setUint16(2, 1024, true);
  view.setUint16(4, 922, true);

  const parsed = parseHeartRateMeasurement(view);
  assert.equal(parsed.bpm, 80);
  assert.equal(parsed.rrIntervalsMs.length, 2);
  assert.equal(parsed.rrIntervalsMs[0], 1000);
  assert.equal(parsed.rrIntervalsMs[1], 900);

  const hrv = computeHrvRmssd(parsed.rrIntervalsMs);
  assert.ok(typeof hrv === "number");
  assert.equal(hrv, 100); // sqrt((1000-900)^2 / 1) = 100 ms
}

// ── TEST 6: CASI LIMITE E PACCHETTI CORROTTI ──
{
  const emptyView = new DataView(new ArrayBuffer(1));
  assert.throws(() => parseHeartRateMeasurement(emptyView), /lunghezza insufficiente/);
  assert.equal(computeHrvRmssd([]), undefined);
  assert.equal(computeHrvRmssd([800]), undefined);
}

// ── TEST 7: SMARTWATCH MANAGER SINGLETON & SIMULATORE DEMO ──
{
  smartWatchManager.startSimulation(70);
  const state = smartWatchManager.getState();
  assert.equal(state.status, "simulated");
  assert.equal(state.isSimulated, true);
  assert.equal(state.zone, "zen");
  assert.ok(state.bpm >= 50 && state.bpm <= 130);

  let notifiedState: any = null;
  const unsubscribe = smartWatchManager.subscribe((s) => {
    notifiedState = s;
  });
  assert.ok(notifiedState);
  assert.equal(notifiedState.status, "simulated");
  unsubscribe();

  smartWatchManager.stopSimulation();
  smartWatchManager.disconnect();
  assert.equal(smartWatchManager.getState().status, "disconnected");
}

// ── TEST 8: STATICA & DESIGN SYSTEM DEI COMPONENTI SMARTWATCH ──
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const modalPath = join(__dirname, "../components/biometrics/SmartWatchConnectModal.tsx");
const sectionPath = join(__dirname, "../components/settings/SmartWatchSettingsSection.tsx");

for (const path of [modalPath, sectionPath]) {
  const content = readFileSync(path, "utf8");

  // Divieto di tag di debug proibiti
  for (const forbidden of ["DB", "ORVAL", "MOCK", "SCHEMA"]) {
    const regex = new RegExp(`['">]${forbidden}['"<]`);
    assert.equal(regex.test(content), false, `${path} non deve contenere il tag di debug: ${forbidden}`);
  }

  // Rispetto del design system AUREUS
  assert.ok(content.includes("#C5A059"), `${path} deve utilizzare il colore oro imperiale #C5A059`);
  assert.ok(content.includes("font-mono"), `${path} deve utilizzare font-mono per dati e metriche`);
}

console.log("Tutti i test SmartWatch BLE & Bio-Telemetry sono stati superati con successo!");
