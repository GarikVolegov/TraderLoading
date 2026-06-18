import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { useLoading } from "./LoadingContext";

export type AudioMode = "alpha" | "theta" | "beta" | "gamma" | "deepfocus" | "off";

interface AudioModeConfig {
  label: string;
  description: string;
  baseFreq: number;
  beatFreq: number;
  icon: string;
}

export const AUDIO_MODES: Record<Exclude<AudioMode, "off">, AudioModeConfig> = {
  alpha: { label: "Alpha", description: "Concentrazione rilassata · 10 Hz", baseFreq: 200, beatFreq: 10, icon: "🧘" },
  theta: { label: "Theta", description: "Meditazione profonda · 6 Hz", baseFreq: 180, beatFreq: 6, icon: "🌊" },
  beta: { label: "Beta", description: "Attenzione attiva · 18 Hz", baseFreq: 210, beatFreq: 18, icon: "⚡" },
  gamma: { label: "Gamma", description: "Peak performance · 40 Hz", baseFreq: 220, beatFreq: 40, icon: "🔥" },
  deepfocus: { label: "Deep Focus", description: "Focus profondo · 14 Hz", baseFreq: 195, beatFreq: 14, icon: "🎯" },
};

interface AudioContextType {
  mode: AudioMode;
  setMode: (m: AudioMode) => void;
  volume: number;
  setVolume: (v: number) => void;
}

const AudioCtx = createContext<AudioContextType | null>(null);

// Builds 1s of silent 8-bit mono WAV as an object URL. Used as the source of a looping
// <audio> element: playing an HTMLMediaElement on a user gesture flips the iOS audio
// session to "playback", so the Web Audio oscillators are no longer muted by the hardware
// Silent switch (which mutes bare AudioContext output on iPhone).
function buildSilentWavUrl(): string {
  const sampleRate = 8000;
  const dataSize = sampleRate; // 1s, 8-bit mono
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true); // 8-bit
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < dataSize; i++) view.setUint8(44 + i, 128); // 8-bit silence = 128
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const { setCurrentStep, completeLoading } = useLoading();
  const [mode, setModeState] = useState<AudioMode>("off");
  const [volume, setVolumeState] = useState(40);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[] | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const hasAutoStarted = useRef(false);
  const startIdRef = useRef(0);

  const silentAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopOscillators = useCallback(() => {
    if (oscillatorsRef.current) {
      oscillatorsRef.current.forEach(osc => { try { osc.stop(); } catch (e) { console.warn("osc.stop failed:", e); } });
      oscillatorsRef.current = null;
    }
  }, []);

  // Play a near-silent looping media element to flip the iOS audio session to "playback".
  // Must be called inside a user gesture; safe to call repeatedly.
  const unlockMediaSession = useCallback(() => {
    try {
      if (!silentAudioRef.current) {
        const el = document.createElement("audio");
        el.setAttribute("playsinline", "");
        el.loop = true;
        el.volume = 0.001;
        el.src = buildSilentWavUrl();
        silentAudioRef.current = el;
      }
      const playPromise = silentAudioRef.current.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => { /* gesture-gated; ignore */ });
      }
    } catch (e) {
      console.warn("media-session unlock failed:", e);
    }
  }, []);

  const startFrequencies = useCallback((baseFreq: number, beatFreq: number, vol: number) => {
    try {
      // Flip the iOS audio session inside the gesture so Web Audio bypasses the Silent switch.
      unlockMediaSession();

      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;

      ++startIdRef.current;

      // Create AND start the oscillators synchronously, within the gesture call stack.
      // iOS/Safari only emits sound when nodes are started in the gesture; the previous
      // approach deferred node creation into resume().then(...) and produced silence on iOS.
      stopOscillators();

      const gain = ctx.createGain();
      gain.gain.value = (vol / 100) * 0.3;
      gain.connect(ctx.destination);
      gainRef.current = gain;

      const panL = ctx.createStereoPanner();
      panL.pan.value = -1;
      panL.connect(gain);

      const panR = ctx.createStereoPanner();
      panR.pan.value = 1;
      panR.connect(gain);

      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.value = baseFreq;
      osc1.connect(panL);
      osc1.start();

      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = baseFreq + beatFreq;
      osc2.connect(panR);
      osc2.start();

      oscillatorsRef.current = [osc1, osc2];

      // Nodes are already running; just make sure the context isn't suspended. Retry once
      // shortly after in case iOS left it suspended immediately after the gesture.
      if (ctx.state !== "running") {
        ctx.resume().catch(e => console.warn("AudioContext resume failed:", e));
        setTimeout(() => { ctx.resume().catch(() => {}); }, 250);
      }
    } catch (e) {
      console.warn("Audio start failed:", e);
    }
  }, [stopOscillators, unlockMediaSession]);

  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const setMode = useCallback((newMode: AudioMode) => {
    if (newMode === "off") {
      startIdRef.current++;
      stopOscillators();
      silentAudioRef.current?.pause();
    } else {
      const config = AUDIO_MODES[newMode as keyof typeof AUDIO_MODES];
      if (!config) return;
      startFrequencies(config.baseFreq, config.beatFreq, volumeRef.current);
    }
    setModeState(newMode);
    localStorage.setItem("lastAudioMode", newMode);
  }, [stopOscillators, startFrequencies]);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (gainRef.current) {
      gainRef.current.gain.value = (v / 100) * 0.3;
    }
  }, []);

  const setModeRef = useRef(setMode);
  setModeRef.current = setMode;

  useEffect(() => {
    if (hasAutoStarted.current) return;

    const safetyTimeout = setTimeout(() => {
      completeLoading();
    }, 2000);

    const tryAutoStart = () => {
      if (hasAutoStarted.current) return;
      hasAutoStarted.current = true;

      document.removeEventListener("pointerdown", tryAutoStart, true);
      document.removeEventListener("click", tryAutoStart, true);
      document.removeEventListener("keydown", tryAutoStart, true);
      document.removeEventListener("touchstart", tryAutoStart, true);

      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        }
        audioCtxRef.current.resume();
      } catch (e) {
        console.warn("AudioContext early unlock failed:", e);
      }

      setCurrentStep("audio");

      const lastMode = localStorage.getItem("lastAudioMode") as AudioMode | null;
      const modeToStart = (lastMode && lastMode !== "off") ? lastMode : "alpha";
      setModeRef.current(modeToStart);

      setTimeout(() => {
        clearTimeout(safetyTimeout);
        completeLoading();
      }, 800);
    };

    document.addEventListener("pointerdown", tryAutoStart, true);
    document.addEventListener("click", tryAutoStart, true);
    document.addEventListener("keydown", tryAutoStart, true);
    document.addEventListener("touchstart", tryAutoStart, true);

    return () => {
      clearTimeout(safetyTimeout);
      document.removeEventListener("pointerdown", tryAutoStart, true);
      document.removeEventListener("click", tryAutoStart, true);
      document.removeEventListener("keydown", tryAutoStart, true);
      document.removeEventListener("touchstart", tryAutoStart, true);
    };
  }, [setCurrentStep, completeLoading]);

  return (
    <AudioCtx.Provider value={{ mode, setMode, volume, setVolume }}>
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error("useAudio must be used within AudioProvider");
  return ctx;
}
