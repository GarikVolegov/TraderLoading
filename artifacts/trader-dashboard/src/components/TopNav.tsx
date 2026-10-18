import { BrandMark } from "@/components/BrandMark";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { motion } from "framer-motion";
import { Link, useLocation, useSearch } from "wouter";
import { Volume2, VolumeX } from "lucide-react";
import { useAudio } from "@/contexts/AudioContext";
import { MacroNewsTicker } from "@/components/MacroNewsTicker";
import { useGetProfile } from "@workspace/api-client-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBillingStatus } from "@/lib/billingApi";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { NAV_ITEMS, rootDestination } from "@/lib/navHubs";

export function TopNav() {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const hub = rootDestination(location, search);
  const currentLabel = location === "/settings" ? "nav.settings" : NAV_ITEMS.find((item) => item.id === hub)?.labelKey ?? "process.nav.today";
  const { mode, setMode } = useAudio();
  const { t } = useLanguage();
  const { data: profile } = useGetProfile();
  const billing = useBillingStatus();
  const isPlaying = mode !== "off";
  const avatarSrc =
    profile && profile.avatarUrl
      ? profile.avatarUrl
      : `${import.meta.env.BASE_URL}images/avatar-default.webp`;
  const profileName = profile?.name ?? "Trader";

  return (
    <motion.header
      initial={{ y: -56, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.0 }}
      className="fixed top-0 left-0 right-0 z-40 lg:left-[var(--app-inset-left)]"
    >
      <div className="bg-background border-b border-border pt-[var(--safe-top)]">
          <div className="mx-auto flex h-14 max-w-[1760px] items-center gap-2 px-3 sm:gap-3 sm:px-5 lg:px-5 xl:px-7">

          {/* Brand — mobile/tablet only */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.35 }}
            className="lg:hidden shrink-0"
          >
            <Link href="/">
              <BrandMark />
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
            {hub === "resources" && new URLSearchParams(search).get("vista") === "notizie" ? <MacroNewsTicker /> : <span className="hidden lg:block text-xs text-muted-foreground"><span className="font-mono text-primary">{t("process.nav.path")}</span><span className="mx-3 opacity-40">/</span>{t(currentLabel)}</span>}
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
              type="button"
              aria-label={isPlaying ? "Disattiva audio focus" : "Attiva audio focus"}
              whileTap={{ scale: 0.88 }}
              onClick={() => setMode(isPlaying ? "off" : "deepfocus")}
              className={`flex h-11 w-11 items-center justify-center rounded-lg border transition-colors ${
                isPlaying
                  ? "border-primary/30 bg-primary/15 text-primary"
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
              <DropdownMenu><DropdownMenuTrigger asChild><button
                type="button"
                aria-label={t("profile.open_settings")}
                title={t("profile.settings")}
                className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary hover:bg-primary/10"
              >
                <ProfileAvatar
                  name={profileName}
                  src={avatarSrc}
                  alt={t("profile.alt", { name: profileName })}
                  className="h-full w-full object-cover"
                />
                {!billing.isLoading && (
                  <span className="absolute inset-x-0 bottom-0 bg-black/55 py-px text-center text-[7px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                    {billing.data?.pro ? "Pro" : t("billing.status.free")}
                  </span>
                )}
              </button></DropdownMenuTrigger><DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => navigate("/settings?section=profilo")}>{t("workspace.profile")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate("/method")}>{t("process.nav.method")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate("/resources")}>{t("process.nav.resources")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate("/settings")}>{t("nav.settings")}</DropdownMenuItem>
              </DropdownMenuContent></DropdownMenu>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.header>
  );
}
