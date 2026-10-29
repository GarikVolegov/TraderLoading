import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isSoundEnabled,
  setSoundEnabled,
  getSoundVolume,
  setSoundVolume,
  soundClick,
  soundCheck,
  soundSuccess,
  soundAlert,
  soundTrophy,
  soundSealOfAction,
  soundMacroAlert,
  synestheticClick,
  synestheticCheck,
  synestheticConfirm,
  synestheticAlert,
  synestheticTrophy,
  synestheticSealOfAction,
  synestheticMacroAlert,
  soundArenaTradeWin,
  soundArenaTradeLoss,
  soundArenaDisqualification,
  soundArenaLaunch,
  soundArenaCountdownTick,
  synestheticArenaTradeWin,
  synestheticArenaTradeLoss,
  synestheticArenaDisqualification,
  synestheticArenaLaunch,
  synestheticArenaCountdown,
  isDeepWorkAmbienceActive,
  getDeepWorkAmbienceMode,
  startDeepWorkAmbience,
  stopDeepWorkAmbience,
  toggleDeepWorkAmbience,
  subscribeDeepWorkAmbience,
  setRiskResonanceLevel,
  getRiskResonanceLevel,
  playBreathInhale,
  playBreathHold,
  playBreathExhale,
  playBreathComplete,
  stopBreathAudio,
  isHeartbeatSoundMuted,
  setHeartbeatSoundMuted,
  startProceduralHeartbeat,
  setHeartbeatBpm,
  stopProceduralHeartbeat,
  isHeartbeatActive,
  getHeartbeatBpm,
  subscribeHeartbeat,
  getHeartbeatVolume,
  setHeartbeatVolume,
  getStopLossProximityThreshold,
  setStopLossProximityThreshold,
  isVignetteOverlayEnabled,
  setVignetteOverlayEnabled,
} from "./soundFx.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const soundFxFile = path.join(__dirname, "soundFx.ts");

assert.ok(fs.existsSync(soundFxFile), "soundFx.ts must exist");

// 1. In Node.js / SSR environment without window, all functions must execute safely without throwing
assert.doesNotThrow(() => {
  soundClick();
  soundCheck();
  soundSuccess();
  soundAlert();
  soundTrophy();
  soundSealOfAction();
  soundMacroAlert("warning");
  soundMacroAlert("imminent");
  synestheticClick();
  synestheticCheck();
  synestheticConfirm();
  synestheticAlert();
  synestheticTrophy();
  synestheticSealOfAction();
  synestheticMacroAlert("warning");
  synestheticMacroAlert("imminent");
  soundArenaTradeWin(true);
  soundArenaTradeWin(false);
  soundArenaTradeLoss(true);
  soundArenaTradeLoss(false);
  soundArenaDisqualification();
  soundArenaLaunch();
  soundArenaCountdownTick(3);
  soundArenaCountdownTick(1);
  soundArenaCountdownTick(0);
  synestheticArenaTradeWin(true);
  synestheticArenaTradeWin(false);
  synestheticArenaTradeLoss(true);
  synestheticArenaTradeLoss(false);
  synestheticArenaDisqualification();
  synestheticArenaLaunch();
  synestheticArenaCountdown(3);
  startDeepWorkAmbience();
  setRiskResonanceLevel(0.65);
  assert.equal(getRiskResonanceLevel(), 0.65);
  stopDeepWorkAmbience();
  toggleDeepWorkAmbience();
  assert.equal(isDeepWorkAmbienceActive(), false);
  playBreathInhale(1);
  playBreathHold(1);
  playBreathExhale(1);
  playBreathComplete();
  stopBreathAudio();
  assert.equal(isHeartbeatSoundMuted(), false);
  setHeartbeatSoundMuted(true);
  setHeartbeatSoundMuted(false);
  startProceduralHeartbeat(75, 0.4);
  setHeartbeatBpm(85, 0.7);
  assert.equal(typeof getHeartbeatBpm(), "number");
  assert.equal(typeof isHeartbeatActive(), "boolean");
  stopProceduralHeartbeat();
}, "Audio synthesis must not throw in SSR / non-browser environments");

// 2. Test localStorage settings toggle & volume controls
const fakeStorage = new Map<string, string>();
const fakeWindow = {
  localStorage: {
    getItem: (key: string) => fakeStorage.get(key) ?? null,
    setItem: (key: string, val: string) => fakeStorage.set(key, val),
    removeItem: (key: string) => fakeStorage.delete(key),
  },
} as unknown as Window & typeof globalThis;

// Attach mock window
const originalWindow = (globalThis as unknown as { window?: unknown }).window;
(globalThis as unknown as { window?: unknown }).window = fakeWindow;

try {
  // Default is enabled
  assert.equal(isSoundEnabled(), true, "sound should be enabled by default");

  // Disable sound
  setSoundEnabled(false);
  assert.equal(isSoundEnabled(), false, "sound should be disabled when muted");
  assert.equal(fakeStorage.get("aureus_sfx_muted"), "true");

  // Re-enable sound
  setSoundEnabled(true);
  assert.equal(isSoundEnabled(), true, "sound should be re-enabled");
  assert.equal(fakeStorage.get("aureus_sfx_muted"), "false");

  // Test volume default & clamping
  assert.equal(getSoundVolume(), 0.75, "Default volume should be 0.75");

  setSoundVolume(0.4);
  assert.equal(getSoundVolume(), 0.4, "Volume should update to 0.4");
  assert.equal(fakeStorage.get("aureus_sfx_volume"), "0.40");

  setSoundVolume(1.8);
  assert.equal(getSoundVolume(), 1.0, "Volume > 1 should clamp to 1.0");

  setSoundVolume(-0.5);
  assert.equal(getSoundVolume(), 0.0, "Volume < 0 should clamp to 0.0");

  setSoundVolume(0.8);

  // Test Heartbeat Volume controls
  assert.equal(getHeartbeatVolume(), 0.8, "Default heartbeat volume should be 0.8");
  setHeartbeatVolume(0.5);
  assert.equal(getHeartbeatVolume(), 0.5, "Heartbeat volume should update to 0.5");
  assert.equal(fakeStorage.get("aureus_replay_heartbeat_volume"), "0.50");

  // Test Stop Loss proximity threshold
  assert.equal(getStopLossProximityThreshold(), 0.25, "Default SL proximity threshold should be 0.25");
  setStopLossProximityThreshold(0.35);
  assert.equal(getStopLossProximityThreshold(), 0.35, "SL proximity threshold should update to 0.35");
  assert.equal(fakeStorage.get("aureus_replay_sl_threshold"), "0.35");

  // Test Vignette overlay toggle
  assert.equal(isVignetteOverlayEnabled(), true, "Default vignette overlay should be enabled");
  setVignetteOverlayEnabled(false);
  assert.equal(isVignetteOverlayEnabled(), false, "Vignette overlay should be disabled");
  setVignetteOverlayEnabled(true);
  assert.equal(isVignetteOverlayEnabled(), true, "Vignette overlay should be re-enabled");
} finally {
  (globalThis as unknown as { window?: unknown }).window = originalWindow;
}

// 3. Test Web Audio synthesis with mock AudioContext
let oscillatorsCreated = 0;
let gainNodesCreated = 0;
let filterNodesCreated = 0;
let startCalls = 0;
let stopCalls = 0;

class MockAudioParam {
  value = 1.0;
  setValueAtTime(val: number, _time: number) {
    this.value = val;
  }
  linearRampToValueAtTime(val: number, _time: number) {
    this.value = val;
  }
  exponentialRampToValueAtTime(val: number, _time: number) {
    this.value = val;
  }
}

class MockAudioNode {
  connect(_dest: unknown) {}
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
  constructor() {
    super();
    gainNodesCreated++;
  }
}

class MockOscillatorNode extends MockAudioNode {
  type = "sine";
  frequency = new MockAudioParam();
  constructor() {
    super();
    oscillatorsCreated++;
  }
  start(_time?: number) {
    startCalls++;
  }
  stop(_time?: number) {
    stopCalls++;
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  type = "lowpass";
  frequency = new MockAudioParam();
  Q = new MockAudioParam();
  constructor() {
    super();
    filterNodesCreated++;
  }
}

class MockAudioBufferSourceNode extends MockAudioNode {
  buffer: unknown = null;
  loop = false;
  start() {
    startCalls++;
  }
  stop() {
    stopCalls++;
  }
}

class MockAudioContext {
  state = "running";
  currentTime = 100.0;
  sampleRate = 44100;
  destination = new MockAudioNode();

  createOscillator() {
    return new MockOscillatorNode();
  }
  createGain() {
    return new MockGainNode();
  }
  createBiquadFilter() {
    return new MockBiquadFilterNode();
  }
  createBuffer(_channels: number, length: number, _sampleRate: number) {
    return {
      getChannelData: (_channel: number) => new Float32Array(length),
    };
  }
  createBufferSource() {
    return new MockAudioBufferSourceNode();
  }
  resume() {
    return Promise.resolve();
  }
}

const browserWithAudio = {
  localStorage: {
    getItem: (key: string) => fakeStorage.get(key) ?? null,
    setItem: (key: string, val: string) => fakeStorage.set(key, val),
  },
  AudioContext: MockAudioContext,
} as unknown as Window & typeof globalThis;

(globalThis as unknown as { window?: unknown }).window = browserWithAudio;

try {
  setSoundEnabled(true);
  setSoundVolume(0.85);

  // Test soundClick: 2 oscillators (transient + obsidian body) + 2 filters + gains + master
  const oscBeforeClick = oscillatorsCreated;
  soundClick();
  assert.equal(oscillatorsCreated, oscBeforeClick + 2, "soundClick must create 2 oscillators for physical layering");

  // Test soundCheck: 3 oscillators (528 Hz Solfeggio + 529.4 Hz Alpha detune + 1056 Hz octave)
  const oscBeforeCheck = oscillatorsCreated;
  const filterBeforeCheck = filterNodesCreated;
  soundCheck();
  assert.equal(oscillatorsCreated, oscBeforeCheck + 3, "soundCheck must create 3 oscillators for Solfeggio & Alpha beating");
  assert.equal(filterNodesCreated, filterBeforeCheck + 1, "soundCheck must use dynamic biquad damping filter");

  // Test soundSuccess: 4 oscillators (432 Hz golden choral chord: 216, 324, 432, 540)
  const oscBeforeSuccess = oscillatorsCreated;
  soundSuccess();
  assert.equal(oscillatorsCreated, oscBeforeSuccess + 4, "soundSuccess must create 4 harmonic chord voices");

  // Test soundAlert: 2 oscillators (108 Hz monastic gong + 54 Hz sub-bass) + resonant filter
  const oscBeforeAlert = oscillatorsCreated;
  const filterBeforeAlert = filterNodesCreated;
  soundAlert();
  assert.equal(oscillatorsCreated, oscBeforeAlert + 2, "soundAlert must create 2 oscillators (108Hz + 54Hz sub-body)");
  assert.equal(filterNodesCreated, filterBeforeAlert + 1, "soundAlert must create a lowpass filter");

  // Test soundTrophy: 6 oscillators (C-G-C-E-G-D cathedral suspended chord)
  const oscBeforeTrophy = oscillatorsCreated;
  soundTrophy();
  assert.equal(oscillatorsCreated, oscBeforeTrophy + 6, "soundTrophy must create 6 pure cathedral voices");

  // Test soundSealOfAction: 3 oscillators (432Hz fundamental + 864Hz anvil impact + 72Hz sub-gravitas)
  const oscBeforeSeal = oscillatorsCreated;
  soundSealOfAction();
  assert.equal(oscillatorsCreated, oscBeforeSeal + 3, "soundSealOfAction must create 3 oscillators (432Hz + 864Hz + 72Hz)");

  // Test soundMacroAlert warning: 4 oscillators (2 chimes × fundamental + harmonic)
  const oscBeforeMacroWarn = oscillatorsCreated;
  soundMacroAlert("warning");
  assert.equal(oscillatorsCreated, oscBeforeMacroWarn + 4, "soundMacroAlert warning must create 4 oscillators (2 double bells)");

  // Test soundMacroAlert imminent: 4 oscillators (3 chord strikes + 108Hz sub-anchor)
  const oscBeforeMacroImm = oscillatorsCreated;
  soundMacroAlert("imminent");
  assert.equal(oscillatorsCreated, oscBeforeMacroImm + 4, "soundMacroAlert imminent must create 4 oscillators (3 strikes + sub)");

  // Test that when muted, no oscillators are created
  setSoundEnabled(false);
  const oscBeforeMuted = oscillatorsCreated;
  soundClick();
  soundCheck();
  soundSuccess();
  soundAlert();
  soundTrophy();
  soundSealOfAction();
  assert.equal(oscillatorsCreated, oscBeforeMuted, "Muted state must prevent any audio synthesis");

  // Test synesthetic functions when re-enabled
  setSoundEnabled(true);
  const oscBeforeSynesthetic = oscillatorsCreated;
  synestheticClick();
  synestheticCheck();
  synestheticConfirm();
  synestheticAlert();
  synestheticTrophy();
  synestheticSealOfAction();
  assert.ok(oscillatorsCreated > oscBeforeSynesthetic, "Synesthetic functions must trigger audio components");
  assert.ok(startCalls > 0 && stopCalls > 0, "Oscillators must have their start and stop envelopes executed");

  // Test Deep Work Ambience & Reactive Subscription
  assert.equal(isDeepWorkAmbienceActive(), false, "Ambience should be off initially");
  let subState = false;
  const unsubAmbience = subscribeDeepWorkAmbience((active) => {
    subState = active;
  });
  assert.equal(subState, false, "Subscription initial value should be false");

  const started = toggleDeepWorkAmbience();
  assert.equal(started, true, "toggleDeepWorkAmbience should start ambience");
  assert.equal(isDeepWorkAmbienceActive(), true, "Ambience should now be active");
  assert.equal(getDeepWorkAmbienceMode(), "432hz", "Default mode should be 432hz");
  assert.equal(subState, true, "Subscriber should be notified of ambience start");

  // Switch to 528hz
  const switched = toggleDeepWorkAmbience("528hz");
  assert.equal(switched, true, "toggleDeepWorkAmbience with 528hz should switch mode");
  assert.equal(getDeepWorkAmbienceMode(), "528hz", "Ambience mode should be 528hz");

  // Test Adaptive Risk Resonance modulation while ambience is active
  setRiskResonanceLevel(0.8);
  assert.equal(getRiskResonanceLevel(), 0.8, "Risk resonance ratio must be clamped and saved");
  setRiskResonanceLevel(-0.2);
  assert.equal(getRiskResonanceLevel(), 0.0, "Risk resonance ratio must clamp minimum to 0");
  setRiskResonanceLevel(1.5);
  assert.equal(getRiskResonanceLevel(), 1.0, "Risk resonance ratio must clamp maximum to 1");

  const stopped = toggleDeepWorkAmbience();
  assert.equal(stopped, false, "toggleDeepWorkAmbience should stop ambience");
  assert.equal(isDeepWorkAmbienceActive(), false, "Ambience should now be inactive");
  assert.equal(subState, false, "Subscriber should be notified of ambience stop");

  // Test Tactical Breath Audio synthesis
  const oscBeforeInhale = oscillatorsCreated;
  playBreathInhale(4);
  assert.ok(oscillatorsCreated > oscBeforeInhale, "playBreathInhale must create oscillator");

  const oscBeforeHold = oscillatorsCreated;
  playBreathHold(7);
  assert.ok(oscillatorsCreated > oscBeforeHold, "playBreathHold must create chord oscillators");

  const oscBeforeExhale = oscillatorsCreated;
  playBreathExhale(8);
  assert.ok(oscillatorsCreated > oscBeforeExhale, "playBreathExhale must create descending oscillator and noise");

  const oscBeforeComplete = oscillatorsCreated;
  playBreathComplete();
  assert.ok(oscillatorsCreated > oscBeforeComplete, "playBreathComplete must create harmonic triad bell");

  stopBreathAudio();

  // Test Procedural Heartbeat Audio synthesis & Dynamic BPM modulation
  let hbActive = false;
  let hbBpm = 60;
  const unsubHb = subscribeHeartbeat((active, bpm) => {
    hbActive = active;
    hbBpm = bpm;
  });

  assert.equal(isHeartbeatActive(), false, "Heartbeat should be inactive initially");
  assert.equal(hbActive, false, "Heartbeat subscription initial state must be false");

  const oscBeforeHeartbeat = oscillatorsCreated;
  startProceduralHeartbeat(72, 0.3);
  assert.equal(isHeartbeatActive(), true, "startProceduralHeartbeat should activate engine");
  assert.equal(getHeartbeatBpm(), 72, "getHeartbeatBpm should reflect starting BPM");
  assert.equal(hbActive, true, "Heartbeat subscriber should be notified of activation");
  assert.equal(hbBpm, 72, "Heartbeat subscriber should receive 72 BPM");
  assert.ok(oscillatorsCreated > oscBeforeHeartbeat, "startProceduralHeartbeat must synthesize lub-dub oscillators");

  // Dynamic acceleration towards Stop Loss
  setHeartbeatBpm(98, 0.85);
  assert.equal(getHeartbeatBpm(), 98, "setHeartbeatBpm should ramp to 98 BPM");
  assert.equal(hbBpm, 98, "Heartbeat subscriber should receive 98 BPM");

  stopProceduralHeartbeat();
  assert.equal(isHeartbeatActive(), false, "stopProceduralHeartbeat must stop engine");
  assert.equal(hbActive, false, "Heartbeat subscriber must be notified of stop");

  unsubHb();
  unsubAmbience();
} finally {
  (globalThis as unknown as { window?: unknown }).window = originalWindow;
}

console.log("High-Craft Acoustic Sound Engine & Synesthesia tests passed with 100% precision!");
