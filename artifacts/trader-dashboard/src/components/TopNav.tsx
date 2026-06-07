import { motion } from "framer-motion";
import { Link } from "wouter";
import { Settings, Volume2, VolumeX, Bell } from "lucide-react";
import { useAudio } from "@/contexts/AudioContext";
import { MacroNewsTicker } from "@/components/MacroNewsTicker";
import { UserButton } from "@clerk/react";

export function TopNav() {
  const { mode, setMode } = useAudio();
  const isPlaying = mode !== "off";

  return (
    <motion.header
      initial={{ y: -56, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.0 }}
      className="fixed top-0 left-0 right-0 z-40 lg:left-20"
    >
      <div className="bg-background/80 backdrop-blur-2xl border-b border-border/40 shadow-[0_1px_0_0_rgba(255,255,255,0.03)]">
          <div className="max-w-[1760px] mx-auto px-3 sm:px-5 lg:px-5 xl:px-7 flex items-center gap-2 sm:gap-3 h-[3.25rem]">

          {/* Brand — mobile/tablet only */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.35 }}
            className="lg:hidden shrink-0"
          >
            <Link href="/">
              <span className="text-sm font-bold font-mono tracking-widest whitespace-nowrap bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent cursor-pointer">
                TRADER<span className="text-primary">LOADING</span>
              </span>
            </Link>
          </motion.div>

          {/* Divider — mobile only */}
          <div className="w-px h-4 bg-border/60 lg:hidden shrink-0" />

          {/* Ticker */}
          <motion.div
            className="flex-1 min-w-0 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.28, duration: 0.4 }}
          >
            <MacroNewsTicker />
          </motion.div>

          {/* Right controls */}
          <motion.div
            className="flex items-center gap-1.5 sm:gap-2 shrink-0"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
          >
            {/* Audio toggle */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => setMode(isPlaying ? "off" : "deepfocus")}
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                isPlaying
                  ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_12px_rgba(0,204,102,0.15)]"
                  : "bg-card/60 text-muted-foreground border border-border/60 hover:border-border hover:text-foreground"
              }`}
              title={isPlaying ? "Audio on" : "Audio off"}
            >
              {isPlaying ? (
                <Volume2 className="w-3.5 h-3.5" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
            </motion.button>

            {/* Settings */}
            <motion.div whileTap={{ scale: 0.88 }}>
              <Link
                href="/settings"
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-card/60 text-muted-foreground border border-border/60 hover:border-border hover:text-foreground transition-all"
              >
                <Settings className="w-3.5 h-3.5" />
              </Link>
            </motion.div>

            {/* User avatar */}
            <div className="flex items-center">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8 rounded-lg border border-border/60",
                  },
                }}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </motion.header>
  );
}
