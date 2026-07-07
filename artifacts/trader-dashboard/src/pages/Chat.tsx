import { useState, useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { useLocation, useSearch } from "wouter";
import { parseChatTab, type ChatTab } from "@/lib/chatTabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProUpgradeGate } from "@/components/ProUpgradeGate";
import { useAuth } from "@workspace/replit-auth-web";
import { Loader2, LogIn, Globe, Lock, Trophy, Radio } from "lucide-react";
import type { SocialUser } from "@/components/social/types";
import { SocialTab } from "@/components/social/SocialTab";
import { MessaggiTab } from "@/components/social/MessaggiTab";
import { ClassificaTab } from "@/components/social/ClassificaTab";
import { CommunityTab } from "@/components/social/CommunityTab";

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function Chat() {
  const { t } = useLanguage();
  const { isAuthenticated, isLoading: authLoading, login, user } = useAuth();
  const [, navigate] = useLocation();
  const activeTab: ChatTab = parseChatTab(useSearch());
  const [pendingChat, setPendingChat] = useState<SocialUser | null>(null);

  const setActiveTab = (tab: ChatTab) => navigate(`/chat?t=${tab}`);

  const handleStartChat = (u: SocialUser) => {
    setPendingChat(u);
    navigate("/chat?t=messaggi");
  };

  useEffect(() => {
    if (activeTab === "messaggi" && pendingChat) {
      setPendingChat(null);
    }
  }, [activeTab, pendingChat]);

  if (authLoading)
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );

  if (!isAuthenticated)
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center space-y-4">
            <Globe className="w-16 h-16 mx-auto text-primary opacity-40" />
            <h2 className="text-xl font-bold font-mono tracking-tight">
              {t("chat.title")}
            </h2>
            <p className="text-muted-foreground">{t("chat.login_required")}</p>
            <button
              onClick={() => login()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
            >
              <LogIn className="w-4 h-4" /> {t("common.start")}
            </button>
          </div>
        </div>
      </PageLayout>
    );

  const tabs: { id: ChatTab; label: string; icon: ReactNode }[] = [
    {
      id: "social",
      label: t("chat.tab.social"),
      icon: <Globe className="w-4 h-4" />,
    },
    {
      id: "messaggi",
      label: t("chat.tab.messages"),
      icon: <Lock className="w-4 h-4" />,
    },
    { id: "comunita", label: t("chat.tab.community"), icon: <Radio className="w-4 h-4" /> },
    {
      id: "classifica",
      label: t("chat.tab.leaderboard"),
      icon: <Trophy className="w-4 h-4" />,
    },
  ];

  return (
    <PageLayout>
      <PageHeader title={t("chat.title")} subtitle={t("chat.subtitle")} />
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card/30 backdrop-blur-md border border-border rounded-2xl overflow-hidden flex flex-col min-h-0 h-[calc(100dvh-var(--safe-top)-4.6rem-var(--bottom-nav-clearance))] sm:h-[calc(100dvh-var(--safe-top)-8.5rem-var(--bottom-nav-clearance))]"
      >
        <div className="flex border-b border-border shrink-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[80px] flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-all whitespace-nowrap px-2 ${activeTab === tab.id ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === "social" && (
            <SocialTab
              currentUserId={user?.id ?? ""}
              onStartChat={handleStartChat}
            />
          )}
          {activeTab === "messaggi" && (
            <MessaggiTab
              currentUser={{ id: user?.id ?? "" }}
              initialPeer={pendingChat}
            />
          )}
          {activeTab === "comunita" && (
            <CommunityTab
              currentUserId={user?.id ?? ""}
              currentUserName={
                user?.firstName ?? "Trader"
              }
            />
          )}
          {activeTab === "classifica" && (
            <ProUpgradeGate feature="leaderboard">
              <ClassificaTab currentUserId={user?.id ?? ""} />
            </ProUpgradeGate>
          )}
        </div>
      </motion.section>
    </PageLayout>
  );
}
