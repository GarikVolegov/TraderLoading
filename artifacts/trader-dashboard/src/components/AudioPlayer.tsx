import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Volume2, Pause, Play, VolumeX } from "lucide-react";
import { useAudio, AUDIO_MODES, type AudioMode } from "@/contexts/AudioContext";

const MODE_KEYS = Object.keys(AUDIO_MODES) as Exclude<AudioMode, "off">[];

export function AudioPlayer() {
  const { mode, volume, setMode, setVolume } = useAudio();

  return (
    <Card className="p-3 sm:p-5 border-primary/20 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-5">
        <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        <h3 className="text-base sm:text-lg font-semibold">Audio Binaural</h3>
        {mode !== "off" && (
          <span className="ml-auto text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full border border-primary/30 animate-pulse">
            {AUDIO_MODES[mode].label} attivo
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3 sm:mb-4">
        {MODE_KEYS.map(id => {
          const cfg = AUDIO_MODES[id];
          const active = mode === id;
          return (
            <motion.button
              key={id}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setMode(active ? "off" : id)}
              className={`px-1.5 sm:px-2 py-2 sm:py-2.5 rounded-lg font-medium text-xs sm:text-sm transition-all flex flex-col items-center gap-0.5 ${
                active
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : "bg-card border border-border hover:border-primary/30 text-foreground"
              }`}
            >
              <span className="text-base">{cfg.icon}</span>
              <div className="flex items-center gap-1">
                {active ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                <span>{cfg.label}</span>
              </div>
              <span className="text-[10px] opacity-60 leading-tight text-center">{cfg.description}</span>
            </motion.button>
          );
        })}

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setMode("off")}
          className={`px-1.5 sm:px-2 py-2 sm:py-2.5 rounded-lg font-medium text-xs sm:text-sm transition-all flex flex-col items-center justify-center gap-1 ${
            mode === "off"
              ? "bg-destructive/20 text-destructive border border-destructive/40"
              : "bg-card border border-border hover:border-destructive/30 text-foreground"
          }`}
        >
          <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>Stop</span>
        </motion.button>
      </div>

      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Volume</span>
          <span>{volume}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
        />
      </div>
    </Card>
  );
}
