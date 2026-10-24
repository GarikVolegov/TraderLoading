// ── Native Web Audio synthesizer for tournament soundtrack, fanfare & chimes ──
// Zero external audio files, works offline, pure browser Web Audio API.

const SOUND_KEY = "traderloadings:tournament-sound-enabled";

export function isTournamentSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SOUND_KEY) !== "0";
}

export function setTournamentSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SOUND_KEY, enabled ? "1" : "0");
  if (!enabled) {
    stopArenaMusic();
  }
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// ── Continuous Sovereign Arena Music Engine ("Cantico della Forgia") ─────────
interface ArenaMusicSession {
  masterGain: GainNode;
  droneOsc1: OscillatorNode;
  droneOsc2: OscillatorNode;
  lfoOsc: OscillatorNode;
  stepTimer: number;
  unlockHandler?: () => void;
}

let activeMusic: ArenaMusicSession | null = null;

// D Dorian / Sovereign Modal Scale frequencies (Hz)
const ARENA_SCALE_NOTES = [
  146.83, // D3
  174.61, // F3
  220.0,  // A3
  261.63, // C4
  293.66, // D4
  329.63, // E4
  349.23, // F4
  440.0,  // A4
  392.0,  // G4
  329.63, // E4
  293.66, // D4
  220.0,  // A3
];

export function isArenaMusicPlaying(): boolean {
  return activeMusic !== null;
}

export function startArenaMusic(): boolean {
  if (typeof window === "undefined") return false;
  if (!isTournamentSoundEnabled()) return false;
  if (activeMusic) {
    if (audioCtx && audioCtx.state === "suspended") {
      void audioCtx.resume().catch(() => {});
    }
    return true;
  }

  const ctx = getAudioContext();
  if (!ctx) return false;

  const now = ctx.currentTime;

  // Master gain for smooth fade-in and fade-out
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.exponentialRampToValueAtTime(0.18, now + 1.2);
  masterGain.connect(ctx.destination);

  // Low-pass filter for warm atmospheric drone
  const droneFilter = ctx.createBiquadFilter();
  droneFilter.type = "lowpass";
  droneFilter.frequency.setValueAtTime(240, now);
  droneFilter.Q.setValueAtTime(1.8, now);
  droneFilter.connect(masterGain);

  // Slow LFO modulating filter cutoff (breathing forge effect)
  const lfoOsc = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfoOsc.type = "sine";
  lfoOsc.frequency.setValueAtTime(0.14, now);
  lfoGain.gain.setValueAtTime(95, now);
  lfoOsc.connect(lfoGain);
  lfoGain.connect(droneFilter.frequency);

  // Sub-bass & Fifth Drone (D2 = 73.42 Hz, A2 = 110.00 Hz)
  const droneOsc1 = ctx.createOscillator();
  const droneGain1 = ctx.createGain();
  droneOsc1.type = "triangle";
  droneOsc1.frequency.setValueAtTime(73.42, now);
  droneGain1.gain.setValueAtTime(0.28, now);
  droneOsc1.connect(droneGain1);
  droneGain1.connect(droneFilter);

  const droneOsc2 = ctx.createOscillator();
  const droneGain2 = ctx.createGain();
  droneOsc2.type = "sine";
  droneOsc2.frequency.setValueAtTime(110.0, now);
  droneGain2.gain.setValueAtTime(0.2, now);
  droneOsc2.connect(droneGain2);
  droneGain2.connect(droneFilter);

  droneOsc1.start(now);
  droneOsc2.start(now);
  lfoOsc.start(now);

  let stepIdx = 0;

  const triggerStep = () => {
    if (!activeMusic || !audioCtx) return;
    if (audioCtx.state === "suspended") return;

    const t = audioCtx.currentTime;
    const freq = ARENA_SCALE_NOTES[stepIdx % ARENA_SCALE_NOTES.length];

    // Melodic stoic pluck / pad note
    const noteOsc = audioCtx.createOscillator();
    const noteFilter = audioCtx.createBiquadFilter();
    const noteGain = audioCtx.createGain();

    noteOsc.type = stepIdx % 4 === 0 ? "sawtooth" : "triangle";
    noteOsc.frequency.setValueAtTime(freq, t);

    noteFilter.type = "lowpass";
    noteFilter.frequency.setValueAtTime(stepIdx % 4 === 0 ? 920 : 680, t);
    noteFilter.frequency.exponentialRampToValueAtTime(220, t + 1.35);

    noteGain.gain.setValueAtTime(0.0001, t);
    noteGain.gain.linearRampToValueAtTime(stepIdx % 4 === 0 ? 0.14 : 0.09, t + 0.07);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.45);

    noteOsc.connect(noteFilter);
    noteFilter.connect(noteGain);
    noteGain.connect(masterGain);

    noteOsc.start(t);
    noteOsc.stop(t + 1.5);

    // Every 4 steps: deep forge anvil/pulse resonance
    if (stepIdx % 4 === 0) {
      const pulseOsc = audioCtx.createOscillator();
      const pulseGain = audioCtx.createGain();
      pulseOsc.type = "sine";
      pulseOsc.frequency.setValueAtTime(98.0, t);
      pulseOsc.frequency.exponentialRampToValueAtTime(42.0, t + 0.35);

      pulseGain.gain.setValueAtTime(0.0001, t);
      pulseGain.gain.linearRampToValueAtTime(0.22, t + 0.02);
      pulseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

      pulseOsc.connect(pulseGain);
      pulseGain.connect(masterGain);

      pulseOsc.start(t);
      pulseOsc.stop(t + 0.5);
    }

    stepIdx += 1;
  };

  // Trigger first note immediately and schedule loop
  triggerStep();
  const stepTimer = window.setInterval(triggerStep, 680);

  const unlockHandler = () => {
    if (audioCtx && audioCtx.state === "suspended") {
      void audioCtx.resume().catch(() => {});
    }
  };
  window.addEventListener("pointerdown", unlockHandler, { passive: true });
  window.addEventListener("keydown", unlockHandler, { passive: true });

  activeMusic = {
    masterGain,
    droneOsc1,
    droneOsc2,
    lfoOsc,
    stepTimer,
    unlockHandler,
  };

  return true;
}

export function stopArenaMusic(): void {
  if (!activeMusic) return;
  const session = activeMusic;
  activeMusic = null;

  window.clearInterval(session.stepTimer);
  if (session.unlockHandler && typeof window !== "undefined") {
    window.removeEventListener("pointerdown", session.unlockHandler);
    window.removeEventListener("keydown", session.unlockHandler);
  }

  try {
    if (audioCtx) {
      const now = audioCtx.currentTime;
      session.masterGain.gain.cancelScheduledValues(now);
      session.masterGain.gain.setValueAtTime(
        Math.max(0.0001, session.masterGain.gain.value),
        now,
      );
      session.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      window.setTimeout(() => {
        try {
          session.droneOsc1.stop();
          session.droneOsc2.stop();
          session.lfoOsc.stop();
          session.masterGain.disconnect();
        } catch {
          // Ignore already stopped nodes
        }
      }, 220);
    }
  } catch {
    // Ignore audio context teardown errors
  }
}

/**
 * Plays an epic, celebratory synth arpeggio fanfare (C5 -> E5 -> G5 -> B5 -> C6)
 * with radiant harmonics and reverb tail for the "You Win!" modal.
 */
export function playVictoryFanfare(): void {
  if (!isTournamentSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 987.77, 1046.5]; // C5, E5, G5, B5, C6
  const delays = [0, 0.12, 0.24, 0.36, 0.48];

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = idx === notes.length - 1 ? "sawtooth" : "triangle";
    osc.frequency.setValueAtTime(freq, now + delays[idx]);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200 + idx * 300, now + delays[idx]);

    const isLast = idx === notes.length - 1;
    const duration = isLast ? 2.2 : 0.4;
    const peakGain = isLast ? 0.28 : 0.16;

    gain.gain.setValueAtTime(0.0001, now + delays[idx]);
    gain.gain.exponentialRampToValueAtTime(peakGain, now + delays[idx] + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delays[idx] + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + delays[idx]);
    osc.stop(now + delays[idx] + duration + 0.1);
  });
}

/**
 * Short crisp chime for button clicks, queue joins, or trade triggers.
 */
export function playBattleChime(): void {
  if (!isTournamentSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(880, now); // A5
  osc.frequency.exponentialRampToValueAtTime(1320, now + 0.1); // E6

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.3);
}
