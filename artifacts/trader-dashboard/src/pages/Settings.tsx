import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useSearch } from "wouter";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { ProfileWidget } from "@/components/ProfileWidget";
import { AudioPlayer } from "@/components/AudioPlayer";
import { BackgroundPresetsManager } from "@/components/BackgroundPresetsManager";
import { BillingSubscriptionPanel } from "@/components/BillingSubscriptionPanel";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, UserPlus, Sun, TrendingUp, Target, Quote, Bell, Lock, Globe, Music, ChevronRight, CheckSquare, ChevronDown, BarChart2, Library, HelpCircle, Star, FileText, LifeBuoy, Trophy, LayoutGrid } from "lucide-react";
import { useAuth, useClerk } from "@clerk/react";
import { usePinLock } from "@/contexts/PinLockContext";
import { useLanguage, LANGUAGES, uiText } from "@/contexts/LanguageContext";
import { FontSettings } from "@/components/settings/FontSettings";
import { DarknessSettings } from "@/components/settings/DarknessSettings";
import { TradingSettings } from "@/components/settings/TradingSettings";
import { QuotesSettings } from "@/components/settings/QuotesSettings";
import { MissionTemplatesSettings } from "@/components/settings/MissionTemplatesSettings";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { LoginAccessSection } from "@/components/settings/LoginAccessSection";
import { PinSettings } from "@/components/settings/PinSettings";
import { LanguageSettings } from "@/components/settings/LanguageSettings";
import { ChecklistSettings } from "@/components/settings/ChecklistSettings";
import { AuthSection } from "@/components/settings/AuthSection";
import { AccountExportSection } from "@/components/settings/AccountExportSection";
import { AccountDeletionSection } from "@/components/settings/AccountDeletionSection";
import { PairPreferencesSettings } from "@/components/settings/PairPreferencesSettings";
import { RewardsLibrarySection } from "@/components/settings/RewardsLibrarySection";
import { SupportSection } from "@/components/settings/SupportSection";
import { HelpSection } from "@/components/settings/HelpSection";
import { TermsSection } from "@/components/settings/TermsSection";
import { WalletSettings } from "@/components/tornei/WalletSettings";
import { ReviewSettingsSection } from "@/components/settings/ReviewSettingsSection";

type TileId =
  | "profilo"
  | "abbonamento"
  | "pairs"
  | "audio"
  | "aspetto"
  | "notifiche"
  | "sicurezza"
  | "lingua"
  | "trading"
  | "missioni"
  | "citazioni"
  | "checklist"
  | "account"
  | "biblioteca"
  | "traguardi"
  | "supporto"
  | "aiuto"
  | "termini";

interface SettingsTile {
  id: TileId;
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  color: string;
  glow: string;
}

const SETTINGS_TILE_IDS: TileId[] = [
  "profilo",
  "abbonamento",
  "pairs",
  "audio",
  "aspetto",
  "notifiche",
  "sicurezza",
  "lingua",
  "trading",
  "missioni",
  "citazioni",
  "checklist",
  "account",
  "biblioteca",
  "traguardi",
  "supporto",
  "aiuto",
  "termini",
];

function getRequestedSection(search: string): TileId | null {
  const requested = new URLSearchParams(search).get("section");
  return SETTINGS_TILE_IDS.includes(requested as TileId) ? (requested as TileId) : null;
}

export default function Settings() {
  const { isSignedIn, isLoaded } = useAuth();
  const { signOut } = useClerk();
  const { isPinSet } = usePinLock();
  const { language, t } = useLanguage();
  const [, navigate] = useLocation();
  const isAuthenticated = !!isSignedIn;
  const isLoading = !isLoaded;
  const login = () => navigate("/sign-in");
  const signup = () => navigate("/sign-up");
  const logout = () => {
    void signOut({ redirectUrl: "/" });
  };
  const searchString = useSearch();
  const requestedSection = getRequestedSection(searchString);
  const [activeDesktopSection, setActiveDesktopSection] =
    useState<TileId>(requestedSection ?? "audio");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    pairs: false,
    abbonamento: false,
    audio: false,
    aspetto: false,
    notifiche: false,
    sicurezza: false,
    lingua: false,
    trading: false,
    missioni: false,
    citazioni: false,
    checklist: false,
    account: false,
    biblioteca: false,
    traguardi: false,
    supporto: false,
    aiuto: false,
    termini: false,
    ...(requestedSection ? { [requestedSection]: true } : {}),
  });

  // Reagisce ai cambi di query string anche a componente già montato
  // (es. click sul badge Pro del TopNav mentre si è già su /settings).
  useEffect(() => {
    if (!requestedSection) return;
    setActiveDesktopSection(requestedSection);
    setOpenSections((prev) => (prev[requestedSection] ? prev : { ...prev, [requestedSection]: true }));
  }, [requestedSection]);

  const tiles: SettingsTile[] = [
    {
      id: "profilo",
      icon: <UserPlus className="w-6 h-6" />,
      label: t("settings.tile.profile"),
      subtitle: t("settings.tile.profile_sub"),
      color: "text-primary",
      glow: "group-hover:shadow-primary/20",
    },
    {
      id: "pairs",
      icon: <BarChart2 className="w-6 h-6" />,
      label: t("settings.tile.pairs"),
      subtitle: t("settings.tile.pairs_sub"),
      color: "text-indigo-400",
      glow: "group-hover:shadow-indigo-400/20",
    },
    {
      id: "abbonamento",
      icon: <Star className="w-6 h-6" />,
      label: "Abbonamento",
      subtitle: "Piano Pro, rinnovo e fatture",
      color: "text-primary",
      glow: "group-hover:shadow-primary/20",
    },
    {
      id: "audio",
      icon: <Music className="w-6 h-6" />,
      label: t("settings.tile.audio"),
      subtitle: t("settings.tile.audio_sub"),
      color: "text-blue-400",
      glow: "group-hover:shadow-blue-400/20",
    },
    {
      id: "aspetto",
      icon: <Sun className="w-6 h-6" />,
      label: t("settings.tile.appearance"),
      subtitle: t("settings.tile.appearance_sub"),
      color: "text-yellow-400",
      glow: "group-hover:shadow-yellow-400/20",
    },
    {
      id: "notifiche",
      icon: <Bell className="w-6 h-6" />,
      label: t("settings.tile.notifications"),
      subtitle: t("settings.tile.notifications_sub"),
      color: "text-orange-400",
      glow: "group-hover:shadow-orange-400/20",
    },
    {
      id: "sicurezza",
      icon: <Lock className="w-6 h-6" />,
      label: t("settings.tile.security"),
      subtitle: isPinSet
        ? t("settings.tile.security_active")
        : t("settings.tile.security_inactive"),
      color: "text-emerald-400",
      glow: "group-hover:shadow-emerald-400/20",
    },
    {
      id: "lingua",
      icon: <Globe className="w-6 h-6" />,
      label: t("settings.tile.language"),
      subtitle: `${LANGUAGES[language].flag} ${LANGUAGES[language].name}`,
      color: "text-cyan-400",
      glow: "group-hover:shadow-cyan-400/20",
    },
    {
      id: "trading",
      icon: <TrendingUp className="w-6 h-6" />,
      label: t("settings.tile.trading"),
      subtitle: t("settings.tile.trading_sub"),
      color: "text-violet-400",
      glow: "group-hover:shadow-violet-400/20",
    },
    {
      id: "missioni",
      icon: <Target className="w-6 h-6" />,
      label: t("settings.tile.missions"),
      subtitle: t("settings.tile.missions_sub"),
      color: "text-rose-400",
      glow: "group-hover:shadow-rose-400/20",
    },
    {
      id: "citazioni",
      icon: <Quote className="w-6 h-6" />,
      label: t("settings.tile.quotes"),
      subtitle: t("settings.tile.quotes_sub"),
      color: "text-amber-400",
      glow: "group-hover:shadow-amber-400/20",
    },
    {
      id: "checklist",
      icon: <CheckSquare className="w-6 h-6" />,
      label: t("settings.tile.checklist"),
      subtitle: t("settings.tile.checklist_sub"),
      color: "text-teal-400",
      glow: "group-hover:shadow-teal-400/20",
    },
    {
      id: "biblioteca",
      icon: <Library className="w-6 h-6" />,
      label: t("settings.tile.library"),
      subtitle: t("settings.tile.library_sub"),
      color: "text-primary",
      glow: "group-hover:shadow-primary/20",
    },
    {
      id: "traguardi",
      icon: <Trophy className="w-6 h-6" />,
      label: t("nav.milestones"),
      subtitle: "Certificati NFT e livelli sbloccati",
      color: "text-yellow-400",
      glow: "group-hover:shadow-yellow-400/20",
    },
    {
      id: "supporto",
      icon: <HelpCircle className="w-6 h-6" />,
      label: t("settings.tile.support"),
      subtitle: t("settings.tile.support_sub"),
      color: "text-sky-400",
      glow: "group-hover:shadow-sky-400/20",
    },
    {
      id: "aiuto",
      icon: <LifeBuoy className="w-6 h-6" />,
      label: "Aiuto",
      subtitle: "Guida rapida e tutorial",
      color: "text-purple-400",
      glow: "group-hover:shadow-purple-400/20",
    },
    {
      id: "termini",
      icon: <FileText className="w-6 h-6" />,
      label: "Termini & Condizioni",
      subtitle: "Privacy, licenza e disclaimer",
      color: "text-pink-400",
      glow: "group-hover:shadow-pink-400/20",
    },
    {
      id: "account",
      icon: isAuthenticated ? (
        <LogOut className="w-6 h-6" />
      ) : (
        <LogIn className="w-6 h-6" />
      ),
      label: t("settings.tile.account"),
      subtitle: isAuthenticated
        ? t("settings.tile.account_active")
        : t("settings.tile.account_inactive"),
      color: "text-slate-400",
      glow: "group-hover:shadow-slate-400/20",
    },
  ];

  const collapsibleSections = tiles.filter((tile) => tile.id !== "profilo");

  const tileContent: Record<TileId, React.ReactNode> = {
    profilo: (
      <div className="space-y-6">
        <ProfileWidget />
        <ReviewSettingsSection />
      </div>
    ),
    abbonamento: (
      <div className="space-y-6">
        <BillingSubscriptionPanel />
        <WalletSettings />
      </div>
    ),
    pairs: <PairPreferencesSettings />,
    audio: <AudioPlayer />,
    aspetto: (
      <div className="space-y-6">
        <FontSettings />
        <DarknessSettings />
        <BackgroundPresetsManager />
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => navigate("/?layout=edit")}
        >
          <LayoutGrid className="w-4 h-4" />
          Modifica layout dashboard
        </Button>
      </div>
    ),
    notifiche: <NotificationSettings />,
    sicurezza: (
      <div className="space-y-6">
        <PinSettings />
        <LoginAccessSection />
      </div>
    ),
    lingua: <LanguageSettings />,
    trading: <TradingSettings />,
    missioni: <MissionTemplatesSettings />,
    citazioni: <QuotesSettings />,
    checklist: <ChecklistSettings />,
    biblioteca: <RewardsLibrarySection />,
    traguardi: null,
    supporto: <SupportSection />,
    aiuto: <HelpSection />,
    termini: <TermsSection />,
    account: isAuthenticated ? (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t("settings.account.logged_in")}
        </p>
        <Button
          onClick={logout}
          variant="outline"
          className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-4 h-4 mr-2" /> {t("settings.account.logout")}
        </Button>
        <AccountExportSection />
        <AccountDeletionSection
          onDeleted={() => {
            void signOut({ redirectUrl: "/" });
          }}
        />
      </div>
    ) : !isLoading ? (
      <AuthSection login={login} signup={signup} />
    ) : (
      <p className="text-sm text-muted-foreground">
        {t("settings.account.loading")}
      </p>
    ),
  };

  return (
    <PageLayout>
      <PageHeader
        title={uiText("auto.ui.8f710ac6af")}
        subtitle={uiText("auto.ui.8d80245829")}
      />
      <div className="space-y-6 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <div className="bg-card/60 backdrop-blur-sm border border-border rounded-2xl p-5 sm:p-6">
            <ProfileWidget />
          </div>
        </motion.div>

        <div className="hidden lg:flex gap-6">
          <div className="w-64 shrink-0 space-y-1 self-start sticky top-16">
            <div className="bg-card/60 backdrop-blur-sm border border-border rounded-2xl p-2">
              {collapsibleSections.map((tile) => (
                <button
                  key={tile.id}
                  onClick={() =>
                    tile.id === "traguardi"
                      ? navigate("/milestones")
                      : setActiveDesktopSection(tile.id)
                  }
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                    activeDesktopSection === tile.id
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "text-muted-foreground hover:bg-card/80 hover:text-foreground border border-transparent"
                  }`}
                >
                  <div
                    className={`${activeDesktopSection === tile.id ? tile.color : "text-muted-foreground"} shrink-0`}
                  >
                    {React.cloneElement(
                      tile.icon as React.ReactElement<{ className?: string }>,
                      { className: "w-4 h-4" },
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{tile.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {tile.subtitle}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeDesktopSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="bg-card/60 backdrop-blur-sm border border-border rounded-2xl p-5 sm:p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div
                      className={
                        tiles.find((t) => t.id === activeDesktopSection)?.color
                      }
                    >
                      {tiles.find((t) => t.id === activeDesktopSection)?.icon}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">
                        {
                          tiles.find((t) => t.id === activeDesktopSection)
                            ?.label
                        }
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {
                          tiles.find((t) => t.id === activeDesktopSection)
                            ?.subtitle
                        }
                      </p>
                    </div>
                  </div>
                  {tileContent[activeDesktopSection]}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4">
          {collapsibleSections.map((tile, i) => (
            <motion.div
              key={tile.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (i + 1) * 0.05 }}
              className="space-y-2"
            >
              <button
                onClick={() =>
                  tile.id === "traguardi"
                    ? navigate("/milestones")
                    : setOpenSections((prev) => ({
                        ...prev,
                        [tile.id]: !prev[tile.id],
                      }))
                }
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card/60 backdrop-blur-sm hover:border-primary/30 hover:bg-card transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`${tile.color} transition-transform duration-200 group-hover:scale-110`}
                  >
                    {tile.icon}
                  </div>
                  <div className="text-left">
                    <h2 className="text-base font-bold">{tile.label}</h2>
                    <p className="text-xs text-muted-foreground">
                      {tile.subtitle}
                    </p>
                  </div>
                </div>
                {tile.id === "traguardi" ? (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown
                    className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${
                      openSections[tile.id] ? "rotate-180" : ""
                    }`}
                  />
                )}
              </button>

              <AnimatePresence>
                {openSections[tile.id] && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-card/60 backdrop-blur-sm border border-border rounded-2xl p-5 sm:p-6">
                      {tileContent[tile.id]}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
