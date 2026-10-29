import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { PageLayout } from "@/components/PageLayout";
import { ProfileWidget } from "@/components/ProfileWidget";
import { AudioPlayer } from "@/components/AudioPlayer";
import { SoundFxSettings } from "@/components/settings/SoundFxSettings";
import { BackgroundPresetsManager } from "@/components/BackgroundPresetsManager";
import { BillingSubscriptionPanel } from "@/components/BillingSubscriptionPanel";
import { Button } from "@/components/ui/button";
import {
  LogIn,
  LogOut,
  UserCheck,
  Sun,
  TrendingUp,
  Target,
  Quote,
  Bell,
  Lock,
  Globe,
  Music,
  CheckSquare,
  BarChart2,
  HelpCircle,
  Star,
  FileText,
  LifeBuoy,
  Trophy,
  LayoutGrid,
  Shield,
  ShieldCheck,
  Sparkles,
  MessageSquareQuote,
  Award,
  Wallet,
  Settings as SettingsIcon,
  Compass,
  Sliders,
} from "lucide-react";
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
import { SmartWatchSettingsSection } from "@/components/settings/SmartWatchSettingsSection";
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
import { ReferralSettingsSection } from "@/components/settings/ReferralSettingsSection";
import { CreatorPayoutSettings } from "@/components/settings/CreatorPayoutSettings";
import { SigilIcon } from "@/components/ui/SigilIcon";
import { apiJSON } from "@/lib/apiFetch";
import { useQuery } from "@tanstack/react-query";
import { useGetProfile } from "@workspace/api-client-react";
import {
  computeLimenIntegritySnapshot,
  type LimenIntegritySnapshot,
} from "../../../../contracts/limenGrades";

export type MasterHubId = "identity" | "protocol" | "environment" | "order" | "doctrine";

export type TabId =
  | "profilo"
  | "sicurezza"
  | "account"
  | "trading"
  | "checklist"
  | "pairs"
  | "missioni"
  | "aspetto"
  | "audio"
  | "notifiche"
  | "citazioni"
  | "lingua"
  | "abbonamento"
  | "espansione"
  | "wallet"
  | "aiuto"
  | "supporto"
  | "termini"
  | "recensione"
  | "biblioteca"
  | "traguardi";

interface SubTabDef {
  id: TabId;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
}

interface MasterHubDef {
  id: MasterHubId;
  label: string;
  code: string;
  subtitle: string;
  icon: React.ReactNode;
  tabs: SubTabDef[];
}

const TAB_TO_HUB: Record<TabId, MasterHubId> = {
  profilo: "identity",
  sicurezza: "identity",
  account: "identity",
  trading: "protocol",
  checklist: "protocol",
  pairs: "protocol",
  missioni: "protocol",
  aspetto: "environment",
  audio: "environment",
  notifiche: "environment",
  citazioni: "environment",
  lingua: "environment",
  abbonamento: "order",
  espansione: "order",
  wallet: "order",
  aiuto: "doctrine",
  supporto: "doctrine",
  termini: "doctrine",
  recensione: "doctrine",
  biblioteca: "doctrine",
  traguardi: "doctrine",
};

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

  const { data: profile } = useGetProfile();
  const { data: serverIntegrity } = useQuery<LimenIntegritySnapshot>({
    queryKey: ["profile-integrity"],
    queryFn: () => apiJSON("profile/integrity"),
    staleTime: 30_000,
  });

  const integrity =
    serverIntegrity && serverIntegrity.currentGrade
      ? serverIntegrity
      : computeLimenIntegritySnapshot({
          legacyLevel: profile?.level ?? 1,
          consecutiveIntegralSessions: profile?.streak ?? 0,
        });

  const searchString = useSearch();

  // Resolve requested section from search params
  const requestedSection = useMemo(() => {
    const raw = new URLSearchParams(searchString).get("section") as TabId | null;
    return raw && raw in TAB_TO_HUB ? raw : null;
  }, [searchString]);

  const masterHubs: MasterHubDef[] = useMemo(
    () => [
      {
        id: "identity",
        label: t("workspace.settings.profile"),
        code: "PILASTRO I",
        subtitle: "Dossier dell'Operatore, Grado, credenziali d'accesso e sovranità dell'account",
        icon: <UserCheck className="w-4 h-4 text-[#C5A059]" />,
        tabs: [
          {
            id: "profilo",
            label: t("settings.tile.profile"),
            subtitle: t("settings.tile.profile_sub"),
            icon: <UserCheck className="w-4 h-4" />,
          },
          {
            id: "sicurezza",
            label: t("settings.tile.security"),
            subtitle: isPinSet ? t("settings.tile.security_active") : t("settings.tile.security_inactive"),
            icon: <Lock className="w-4 h-4" />,
          },
          {
            id: "account",
            label: t("settings.tile.account"),
            subtitle: isAuthenticated ? t("settings.tile.account_active") : t("settings.tile.account_inactive"),
            icon: isAuthenticated ? <LogOut className="w-4 h-4" /> : <LogIn className="w-4 h-4" />,
          },
        ],
      },
      {
        id: "protocol",
        label: t("workspace.settings.trading"),
        code: "PILASTRO II",
        subtitle: "Parametri di rischio, il Custode della Soglia, mercati eletti e abitudini d'azione",
        icon: <TrendingUp className="w-4 h-4 text-[#C5A059]" />,
        tabs: [
          {
            id: "trading",
            label: t("settings.tile.trading"),
            subtitle: t("settings.tile.trading_sub"),
            icon: <TrendingUp className="w-4 h-4" />,
          },
          {
            id: "checklist",
            label: t("settings.tile.checklist"),
            subtitle: t("settings.tile.checklist_sub"),
            icon: <ShieldCheck className="w-4 h-4" />,
          },
          {
            id: "pairs",
            label: t("settings.tile.pairs"),
            subtitle: t("settings.tile.pairs_sub"),
            icon: <BarChart2 className="w-4 h-4" />,
          },
          {
            id: "missioni",
            label: t("settings.tile.missions"),
            subtitle: t("settings.tile.missions_sub"),
            icon: <Target className="w-4 h-4" />,
          },
        ],
      },
      {
        id: "environment",
        label: t("workspace.settings.experience"),
        code: "PILASTRO III",
        subtitle: "Architettura visiva ossidiana, frequenze binaurali, sentinelle, filosofia e idioma",
        icon: <Sun className="w-4 h-4 text-[#C5A059]" />,
        tabs: [
          {
            id: "aspetto",
            label: t("settings.tile.appearance"),
            subtitle: t("settings.tile.appearance_sub"),
            icon: <Sun className="w-4 h-4" />,
          },
          {
            id: "audio",
            label: t("settings.tile.audio"),
            subtitle: t("settings.tile.audio_sub"),
            icon: <Music className="w-4 h-4" />,
          },
          {
            id: "notifiche",
            label: t("settings.tile.notifications"),
            subtitle: t("settings.tile.notifications_sub"),
            icon: <Bell className="w-4 h-4" />,
          },
          {
            id: "citazioni",
            label: t("settings.tile.quotes"),
            subtitle: t("settings.tile.quotes_sub"),
            icon: <Quote className="w-4 h-4" />,
          },
          {
            id: "lingua",
            label: t("settings.tile.language"),
            subtitle: `${LANGUAGES[language].flag} ${LANGUAGES[language].name}`,
            icon: <Globe className="w-4 h-4" />,
          },
        ],
      },
      {
        id: "order",
        label: t("workspace.settings.billing"),
        code: "PILASTRO IV",
        subtitle: "Sottoscrizione d'accesso, Mandato di Espansione e governo del capitale",
        icon: <Award className="w-4 h-4 text-[#C5A059]" />,
        tabs: [
          {
            id: "abbonamento",
            label: uiText("auto.ui.b776b1b8f3"),
            subtitle: uiText("auto.ui.986f7f7f05"),
            icon: <Award className="w-4 h-4" />,
          },
          {
            id: "espansione",
            label: "Mandato di Espansione",
            subtitle: "Codice di Chiamata & Royalty 20%",
            icon: <Sparkles className="w-4 h-4" />,
          },
          {
            id: "wallet",
            label: "Wallet & Payouts",
            subtitle: "Saldo tornei e compensi creatore",
            icon: <Wallet className="w-4 h-4" />,
          },
        ],
      },
      {
        id: "doctrine",
        label: t("workspace.settings.help"),
        code: "PILASTRO V",
        subtitle: "Architettura operativa, il Concilio d'assistenza, patto d'onore e testimonianza",
        icon: <LifeBuoy className="w-4 h-4 text-[#C5A059]" />,
        tabs: [
          {
            id: "aiuto",
            label: uiText("auto.ui.3df4de1ddd"),
            subtitle: uiText("auto.ui.b2eaac0417"),
            icon: <LifeBuoy className="w-4 h-4" />,
          },
          {
            id: "supporto",
            label: t("settings.tile.support"),
            subtitle: t("settings.tile.support_sub"),
            icon: <HelpCircle className="w-4 h-4" />,
          },
          {
            id: "termini",
            label: uiText("auto.ui.173c92dc46"),
            subtitle: uiText("auto.ui.9ce5cd227f"),
            icon: <FileText className="w-4 h-4" />,
          },
          {
            id: "recensione",
            label: "Testimonianza d'Ordine",
            subtitle: "Valutazione e recensione dell'Operatore",
            icon: <MessageSquareQuote className="w-4 h-4" />,
          },
        ],
      },
    ],
    [t, isPinSet, isAuthenticated, language],
  );

  // Active state determination
  const initialHub = requestedSection ? TAB_TO_HUB[requestedSection] : "identity";
  const [activeHubId, setActiveHubId] = useState<MasterHubId>(initialHub);
  const [activeTabId, setActiveTabId] = useState<TabId>(requestedSection ?? "profilo");

  // Sync state whenever query param changes
  useEffect(() => {
    if (requestedSection) {
      const hub = TAB_TO_HUB[requestedSection];
      setActiveHubId(hub);
      setActiveTabId(requestedSection);
    }
  }, [requestedSection]);

  // Handle redirects for wiki/milestones
  useEffect(() => {
    if (requestedSection === "biblioteca") navigate("/wiki?t=unlocked", { replace: true });
    if (requestedSection === "traguardi") navigate("/milestones", { replace: true });
  }, [requestedSection, navigate]);

  const activeHub = masterHubs.find((h) => h.id === activeHubId) ?? masterHubs[0];
  const activeTab = activeHub.tabs.find((t) => t.id === activeTabId) ?? activeHub.tabs[0];

  const handleSelectHub = (hubId: MasterHubId) => {
    const targetHub = masterHubs.find((h) => h.id === hubId);
    if (!targetHub) return;
    setActiveHubId(hubId);
    const firstTab = targetHub.tabs[0].id;
    setActiveTabId(firstTab);
    navigate(`/settings?section=${firstTab}`);
  };

  const handleSelectTab = (tabId: TabId) => {
    setActiveTabId(tabId);
    navigate(`/settings?section=${tabId}`);
  };

  const tabContent: Record<TabId, React.ReactNode> = {
    profilo: <ProfileWidget />,
    sicurezza: (
      <div className="space-y-6">
        <PinSettings />
        <SmartWatchSettingsSection />
        <LoginAccessSection />
      </div>
    ),
    account: isAuthenticated ? (
      <div className="space-y-4 rounded-2xl border border-[#C5A059]/20 bg-[#0d0f14] p-5">
        <p className="text-xs font-mono text-muted-foreground">
          {t("settings.account.logged_in")}
        </p>
        <Button
          onClick={logout}
          variant="outline"
          className="w-full border-[#ef4444]/40 text-[#ef4444] hover:bg-[#ef4444]/10 text-xs font-mono"
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
      <p className="text-xs font-mono text-muted-foreground">
        {t("settings.account.loading")}
      </p>
    ),
    trading: <TradingSettings />,
    checklist: <ChecklistSettings />,
    pairs: <PairPreferencesSettings />,
    missioni: <MissionTemplatesSettings />,
    aspetto: (
      <div className="space-y-6">
        <FontSettings />
        <DarknessSettings />
        <BackgroundPresetsManager />
        <Button
          variant="outline"
          className="w-full justify-start border-[#C5A059]/30 bg-[#07080b]/80 hover:bg-[#C5A059]/10 hover:border-[#C5A059] text-xs font-mono"
          onClick={() => navigate("/?layout=edit")}
        >
          <LayoutGrid className="w-4 h-4 mr-2 text-[#C5A059]" />
          {uiText("auto.ui.4432b3c245")}
        </Button>
      </div>
    ),
    audio: (
      <div className="space-y-6">
        <AudioPlayer />
        <SoundFxSettings />
      </div>
    ),
    notifiche: <NotificationSettings />,
    citazioni: <QuotesSettings />,
    lingua: <LanguageSettings />,
    abbonamento: (
      <div className="space-y-6">
        <BillingSubscriptionPanel />
      </div>
    ),
    espansione: (
      <div className="space-y-6">
        <ReferralSettingsSection />
      </div>
    ),
    wallet: (
      <div className="space-y-6">
        <WalletSettings />
        <CreatorPayoutSettings />
      </div>
    ),
    aiuto: <HelpSection />,
    supporto: <SupportSection />,
    termini: <TermsSection />,
    recensione: <ReviewSettingsSection />,
    biblioteca: <RewardsLibrarySection />,
    traguardi: null,
  };

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl space-y-6 pb-16 pt-2">
        {/* Solenne Hero Header LIMEN */}
        <div className="relative overflow-hidden rounded-2xl border border-[#C5A059]/25 bg-gradient-to-r from-[#0d0f14] via-[#11131c] to-[#0d0f14] p-5 sm:p-6 shadow-2xl shadow-black/60">
          <div className="absolute -top-12 -right-12 h-44 w-44 rounded-full bg-[#C5A059]/10 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 rounded border border-[#C5A059]/30 bg-[#C5A059]/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-[#E8C56A]">
                  <Shield className="w-3 h-3 text-[#C5A059]" />
                  AUREUS PROTOCOL // CONFIGURAZIONE D'ORDINE
                </span>
                <span className="inline-flex items-center gap-1 rounded border border-[#10b981]/30 bg-[#10b981]/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#10b981]">
                  <ShieldCheck className="w-3 h-3 text-[#10b981]" />
                  INTEGRITÀ: {integrity.integrityIndex}%
                </span>
                <span className="inline-flex items-center gap-1 rounded border border-[#C5A059]/30 bg-[#07080b] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#E8C56A]">
                  <SigilIcon name={integrity.currentGrade.sigilId.replace("sigil-", "") as "grade-1"} size={11} />
                  {integrity.currentGrade.code}
                </span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#F4F4F6]">
                DOSSIER DELL'OPERATORE & IMPOSTAZIONI
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground/80 font-sans max-w-2xl">
                Registro storico d'integrità, governo del rischio, dotazioni e configurazione del cockpit.
              </p>
            </div>

            {/* Quick Actions & Navigation to Ascesa / Arsenale */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Button
                variant="outline"
                onClick={() => navigate("/milestones")}
                className="border-[#C5A059]/35 bg-[#07080b]/80 hover:bg-[#C5A059]/15 hover:border-[#C5A059] text-xs font-mono font-medium text-[#E8C56A] shadow-md transition-all whitespace-nowrap"
              >
                <Trophy className="w-3.5 h-3.5 mr-1.5 text-[#C5A059]" />
                I 5 Gradi di Ascesa
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/wiki?t=unlocked")}
                className="border-[#C5A059]/35 bg-[#07080b]/80 hover:bg-[#C5A059]/15 hover:border-[#C5A059] text-xs font-mono font-medium text-[#F4F4F6] shadow-md transition-all whitespace-nowrap"
              >
                <Shield className="w-3.5 h-3.5 mr-1.5 text-[#C5A059]" />
                L'Arsenale
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Hub Navigation Strip */}
        <div className="lg:hidden space-y-3 rounded-2xl border border-[#C5A059]/20 bg-[#0d0f14] p-3.5 shadow-lg">
          <div className="flex items-center justify-between pb-1">
            <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-[#C5A059]">
              Master Hub Operativo
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/60">
              {activeHub.code}
            </span>
          </div>

          {/* Horizontal scroll of Master Hubs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {masterHubs.map((hub) => {
              const isSelected = hub.id === activeHubId;
              return (
                <button
                  key={hub.id}
                  type="button"
                  onClick={() => handleSelectHub(hub.id)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-mono transition-all shrink-0 ${
                    isSelected
                      ? "bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/40 font-bold shadow-sm"
                      : "text-muted-foreground hover:text-foreground bg-[#11131c]/60 border border-transparent"
                  }`}
                >
                  {hub.icon}
                  <span>{hub.label}</span>
                </button>
              );
            })}
          </div>

          {/* Sub-Tabs Pills for Mobile */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-[#C5A059]/15 scrollbar-none">
            {activeHub.tabs.map((tab) => {
              const isSelected = tab.id === activeTabId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectTab(tab.id)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-mono transition-all shrink-0 ${
                    isSelected
                      ? "bg-[#C5A059] text-black font-bold shadow-xs"
                      : "text-muted-foreground hover:text-[#F4F4F6] bg-[#07080b] border border-[#26262E]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop Split View: Master Hub Sidebar + Content Panel */}
        <div className="flex items-start gap-6">
          {/* Master Hubs Sidebar */}
          <nav
            aria-label={t("settings.title")}
            className="sticky top-20 hidden w-64 shrink-0 space-y-2 lg:block max-h-[calc(100vh-6rem)] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#C5A059]/30"
          >
            {masterHubs.map((hub) => {
              const isSelected = hub.id === activeHubId;
              return (
                <div
                  key={hub.id}
                  className={`rounded-xl border transition-all ${
                    isSelected
                      ? "border-[#C5A059]/40 bg-[#0d0f14] shadow-[0_0_20px_rgba(197,160,89,0.1)]"
                      : "border-[#C5A059]/10 bg-[#0d0f14]/60 hover:border-[#C5A059]/25 hover:bg-[#0d0f14]"
                  }`}
                >
                  {/* Master Hub Trigger Button */}
                  <button
                    type="button"
                    onClick={() => handleSelectHub(hub.id)}
                    className={`flex w-full items-center justify-between p-3 text-left transition-colors rounded-t-xl ${
                      isSelected ? "text-[#E8C56A]" : "text-muted-foreground hover:text-[#F4F4F6]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
                          isSelected
                            ? "border-[#C5A059]/50 bg-[#C5A059]/20 text-[#E8C56A]"
                            : "border-[#26262E] bg-[#11131c] text-muted-foreground"
                        }`}
                      >
                        {hub.icon}
                      </div>
                      <div>
                        <span className="block font-mono text-[9px] uppercase tracking-widest text-[#C5A059]/70">
                          {hub.code}
                        </span>
                        <span className="block font-display text-xs font-bold tracking-wide">
                          {hub.label}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Sub-Tabs visible when Hub is active */}
                  {isSelected && (
                    <div className="space-y-0.5 px-2 pb-2.5 pt-0.5 border-t border-[#C5A059]/15">
                      {hub.tabs.map((tab) => {
                        const isTabActive = tab.id === activeTabId;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => handleSelectTab(tab.id)}
                            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-mono transition-all ${
                              isTabActive
                                ? "bg-[#C5A059]/20 text-[#E8C56A] font-bold border border-[#C5A059]/35 shadow-xs"
                                : "text-muted-foreground/75 hover:bg-[#11131c] hover:text-[#F4F4F6] border border-transparent"
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-[#C5A059]/60 shrink-0" />
                            <span className="truncate">{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Main Operational Panel */}
          <section
            className="min-w-0 flex-1 rounded-2xl border border-[#C5A059]/25 bg-[#0d0f14] p-5 sm:p-7 min-h-[640px] shadow-2xl shadow-black/50 transition-all"
            aria-label={activeTab.label}
          >
            {/* Master Hub Header */}
            <div className="border-b border-[#C5A059]/20 pb-4 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[#C5A059] block">
                    {activeHub.code} // {activeHub.label}
                  </span>
                  <h2 className="font-display text-xl sm:text-2xl font-bold uppercase tracking-wider text-[#F4F4F6]">
                    {activeTab.label}
                  </h2>
                </div>
                <p className="text-xs font-mono text-muted-foreground/75 sm:text-right max-w-sm">
                  {activeTab.subtitle}
                </p>
              </div>

              {/* Top Sub-Tabs Navigation Bar */}
              <div className="flex items-center gap-1.5 pt-4 overflow-x-auto scrollbar-none">
                {activeHub.tabs.map((tab) => {
                  const isCurrent = tab.id === activeTabId;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleSelectTab(tab.id)}
                      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-mono transition-all shrink-0 ${
                        isCurrent
                          ? "bg-[#C5A059]/20 text-[#E8C56A] font-bold border border-[#C5A059]/40 shadow-sm"
                          : "text-muted-foreground/80 hover:text-[#F4F4F6] hover:bg-[#11131c] border border-[#26262E]"
                      }`}
                    >
                      {React.cloneElement(
                        tab.icon as React.ReactElement<{ className?: string }>,
                        { className: `w-3.5 h-3.5 ${isCurrent ? "text-[#E8C56A]" : "text-[#C5A059]/70"}` },
                      )}
                      <span className="whitespace-nowrap">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Tab Body */}
            <div className="min-h-[460px] pt-1">
              {tabContent[activeTab.id]}
            </div>
          </section>
        </div>
      </div>
    </PageLayout>
  );
}
