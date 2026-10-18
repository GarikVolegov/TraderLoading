import React, { useState, useEffect } from "react";

import { useLocation, useSearch } from "wouter";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { ProfileWidget } from "@/components/ProfileWidget";
import { AudioPlayer } from "@/components/AudioPlayer";
import { BackgroundPresetsManager } from "@/components/BackgroundPresetsManager";
import { BillingSubscriptionPanel } from "@/components/BillingSubscriptionPanel";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, UserPlus, Sun, TrendingUp, Target, Quote, Bell, Lock, Globe, Music, CheckSquare, BarChart2, Library, HelpCircle, Star, FileText, LifeBuoy, Trophy, LayoutGrid } from "lucide-react";
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
import { ReferralSettingsSection } from "@/components/settings/ReferralSettingsSection";
import { CreatorPayoutSettings } from "@/components/settings/CreatorPayoutSettings";

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
    useState<TileId>(requestedSection ?? "profilo");
  // Reagisce ai cambi di query string anche a componente già montato
  // (es. click sul badge Pro del TopNav mentre si è già su /settings).
  useEffect(() => {
    setActiveDesktopSection(requestedSection ?? "profilo");
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
      label: uiText("auto.ui.b776b1b8f3"),
      subtitle: uiText("auto.ui.986f7f7f05"),
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
      subtitle: uiText("auto.ui.082626517e"),
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
      label: uiText("auto.ui.3df4de1ddd"),
      subtitle: uiText("auto.ui.b2eaac0417"),
      color: "text-purple-400",
      glow: "group-hover:shadow-purple-400/20",
    },
    {
      id: "termini",
      icon: <FileText className="w-6 h-6" />,
      label: uiText("auto.ui.173c92dc46"),
      subtitle: uiText("auto.ui.9ce5cd227f"),
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

  const groups: { key: string; sections: TileId[] }[] = [
    { key: "profile", sections: ["profilo", "sicurezza", "account"] },
    { key: "trading", sections: ["pairs", "trading", "checklist", "missioni"] },
    { key: "experience", sections: ["aspetto", "lingua", "audio", "notifiche", "citazioni"] },
    { key: "billing", sections: ["abbonamento"] },
    { key: "help", sections: ["aiuto", "supporto", "termini"] },
  ];
  const activeGroup = groups.find(group => group.sections.includes(activeDesktopSection)) ?? groups[0];
  const selectSection = (section: TileId) => navigate(`/settings?section=${section}`);
  useEffect(() => {
    if (requestedSection === "biblioteca") navigate("/wiki?t=unlocked", { replace: true });
    if (requestedSection === "traguardi") navigate("/milestones", { replace: true });
  }, [requestedSection, navigate]);

  const tileContent: Record<TileId, React.ReactNode> = {
    profilo: (
      <div className="space-y-6">
        <ProfileWidget />
        <ReferralSettingsSection />
        <ReviewSettingsSection />
      </div>
    ),
    abbonamento: (
      <div className="space-y-6">
        <BillingSubscriptionPanel />
        <CreatorPayoutSettings />
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
          {uiText("auto.ui.4432b3c245")}
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

  const activeTile = tiles.find(tile => tile.id === activeDesktopSection);
  return (
    <PageLayout quiet>
      <PageHeader title={t("settings.title")} subtitle={uiText("auto.ui.8d80245829")} />
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap gap-3 text-sm">
          <Button variant="outline" onClick={() => navigate("/milestones")}>{t("workspace.path")}</Button>
          <Button variant="outline" onClick={() => navigate("/wiki?t=unlocked")}>{t("nav.wiki")}</Button>
        </div>
        <div className="lg:hidden space-y-2">
          <label className="text-xs text-muted-foreground" htmlFor="settings-group">{t("settings.title")}</label>
          <select id="settings-group" value={activeGroup.key} onChange={event => selectSection(groups.find(group => group.key === event.target.value)!.sections[0])} className="min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm">
            {groups.map(group => <option key={group.key} value={group.key}>{t(`workspace.settings.${group.key}`)}</option>)}
          </select>
          <nav aria-label={t(`workspace.settings.${activeGroup.key}`)} className="flex flex-wrap gap-1">
            {activeGroup.sections.map(id => <button key={id} type="button" onClick={() => selectSection(id)} aria-pressed={id === activeDesktopSection} className={`min-h-11 rounded-lg px-3 text-sm ${id === activeDesktopSection ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>{tiles.find(tile => tile.id === id)?.label}</button>)}
          </nav>
        </div>
        <div className="flex items-start gap-6">
          <nav aria-label={t("settings.title")} className="sticky top-20 hidden w-56 shrink-0 space-y-5 lg:block">
            {groups.map(group => <section key={group.key}>
              <h2 className="mb-1 px-3 text-xs font-semibold text-muted-foreground">{t(`workspace.settings.${group.key}`)}</h2>
              {group.sections.map(id => {
                const tile = tiles.find(item => item.id === id)!;
                return <button key={id} type="button" onClick={() => selectSection(id)} aria-pressed={id === activeDesktopSection} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${id === activeDesktopSection ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
                  {React.cloneElement(tile.icon as React.ReactElement<{ className?: string }>, { className: "h-4 w-4 shrink-0" })}<span>{tile.label}</span>
                </button>;
              })}
            </section>)}
          </nav>
          <section className="min-w-0 flex-1 rounded-xl border border-border bg-card p-4 sm:p-6" aria-label={activeTile?.label}>
            <h2 className="mb-1 text-lg font-semibold">{activeTile?.label}</h2>
            <p className="mb-6 text-sm text-muted-foreground">{activeTile?.subtitle}</p>
            {tileContent[activeDesktopSection]}
          </section>
        </div>
      </div>
    </PageLayout>
  );
}
