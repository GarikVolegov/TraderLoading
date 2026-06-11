import { motion } from "framer-motion";
import { Link } from "wouter";
import { Volume2, VolumeX } from "lucide-react";
import { useAudio } from "@/contexts/AudioContext";
import { MacroNewsTicker } from "@/components/MacroNewsTicker";
import { PlanBadge } from "@/components/PlanBadge";
import { useGetProfile } from "@workspace/api-client-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function TopNav() {
  const { mode, setMode } = useAudio();
  const { t } = useLanguage();
  const { data: profile } = useGetProfile();
  const isPlaying = mode !== "off";
  const avatarSrc =
    profile && profile.avatarUrl
      ? profile.avatarUrl
      : `${import.meta.env.BASE_URL}images/avatar-default.png`;
  const profileName = profile?.name ?? "Trader";

  return (
    <motion.header
      initial={{ y: -56, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.0 }}
      className="fixed top-0 left-0 right-0 z-40 lg:left-20"
    >
      <div className="bg-background/80 backdrop-blur-2xl border-b border-border/40 shadow-[0_1px_0_0_rgba(255,255,255,0.03)]">
          <div className="mx-auto flex h-14 max-w-[1760px] items-center gap-2 px-3 sm:gap-3 sm:px-5 lg:px-5 xl:px-7">

          {/* Brand — mobile/tablet only */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.35 }}
            className="lg:hidden shrink-0"
          >
            <Link href="/">
              <span className="text-sm font-bold font-mono tracking-wide whitespace-nowrap bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent cursor-pointer">
                TraderLoading
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
            {/* Piano Free/Pro */}
            <motion.div whileTap={{ scale: 0.92 }} className="hidden min-[360px]:flex items-center">
              <PlanBadge />
            </motion.div>

            {/* Audio toggle */}
            <motion.button
              type="button"
              aria-label={isPlaying ? "Disattiva audio focus" : "Attiva audio focus"}
              whileTap={{ scale: 0.88 }}
              onClick={() => setMode(isPlaying ? "off" : "deepfocus")}
              className={`flex h-11 w-11 items-center justify-center rounded-lg border transition-colors ${
                isPlaying
                  ? "border-primary/30 bg-primary/15 text-primary shadow-[0_0_12px_hsl(var(--primary)/0.15)]"
                  : "border-border/55 bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-primary"
              }`}
              title={isPlaying ? "Audio on" : "Audio off"}
            >
              {isPlaying ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </motion.button>

            {/* User avatar */}
            <motion.div whileTap={{ scale: 0.88 }} className="flex items-center">
              <Link
                href="/settings"
                aria-label={t("profile.open_settings")}
                title={t("profile.settings")}
                className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-primary/45 bg-card/60 p-0.5 shadow-[0_0_12px_hsl(var(--primary)/0.1)] transition-colors hover:border-primary hover:bg-primary/10"
              >
                <img
                  src={avatarSrc}
                  alt={t("profile.alt", { name: profileName })}
                  className="h-full w-full rounded-[6px] object-cover"
                />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.header>
  );
}
