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

export function AudioProvider({ children }: { children: ReactNode }) {
  const { setCurrentStep, completeLoading } = useLoading();
  const [mode, setModeState] = useState<AudioMode>("off");
  const [volume, setVolumeState] = useState(40);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[] | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const hasAutoStarted = useRef(false);
  const startIdRef = useRef(0);

  const stopOscillators = useCallback(() => {
    if (oscillatorsRef.current) {
      oscillatorsRef.current.forEach(osc => { try { osc.stop(); } catch (e) { console.warn("osc.stop failed:", e); } });
      oscillatorsRef.current = null;
    }
  }, []);

  const startFrequencies = useCallback((baseFreq: number, beatFreq: number, vol: number) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;

      const thisStartId = ++startIdRef.current;

      const createNodes = () => {
        if (startIdRef.current !== thisStartId) return;
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
      };

      if (ctx.state === "running") {
        createNodes();
      } else {
        ctx.resume().then(createNodes).catch(e => console.warn("AudioContext resume failed:", e));
      }
    } catch (e) {
      console.warn("Audio start failed:", e);
    }
  }, [stopOscillators]);

  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const setMode = useCallback((newMode: AudioMode) => {
    if (newMode === "off") {
      startIdRef.current++;
      stopOscillators();
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

      document.removeEventListener("click", tryAutoStart, true);
      document.removeEventListener("keydown", tryAutoStart, true);
      document.removeEventListener("touchstart", tryAutoStart, true);
    };

    tryAutoStart();
    
    if (!hasAutoStarted.current) {
      document.addEventListener("click", tryAutoStart, true);
      document.addEventListener("keydown", tryAutoStart, true);
      document.addEventListener("touchstart", tryAutoStart, true);
    }

    return () => {
      clearTimeout(safetyTimeout);
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
