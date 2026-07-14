import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { useLocation, useSearch } from "wouter";
import { parseChatTab, type ChatTab } from "@/lib/chatTabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProUpgradeGate } from "@/components/ProUpgradeGate";
import { useUser } from "@clerk/react";
import { Loader2, LogIn, Globe } from "lucide-react";
import type { SocialUser } from "@/components/social/types";
import { SocialTab } from "@/components/social/SocialTab";
import { MessaggiTab } from "@/components/social/MessaggiTab";
import { ClassificaTab } from "@/components/social/ClassificaTab";
import { CommunityTab } from "@/components/social/CommunityTab";

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function Chat() {
  const { t } = useLanguage();
  // Clerk è la fonte auth dell'app (lo shim legacy replit-auth-web faceva una
  // fetch ridondante e la sua CTA puntava al vecchio login OIDC, morto in prod).
  const { user, isSignedIn, isLoaded } = useUser();
  const authLoading = !isLoaded;
  const isAuthenticated = !!isSignedIn;
  const [, navigate] = useLocation();
  const login = () => navigate("/sign-in");
  const activeTab: ChatTab = parseChatTab(useSearch());
  const [pendingChat, setPendingChat] = useState<SocialUser | null>(null);

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

  return (
    <PageLayout>
      <PageHeader title={t("chat.title")} subtitle={t("chat.subtitle")} />
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card/30 backdrop-blur-md border border-border rounded-2xl overflow-hidden flex flex-col min-h-0 h-[calc(100dvh-var(--safe-top)-4.6rem-var(--bottom-nav-clearance))] sm:h-[calc(100dvh-var(--safe-top)-8.5rem-var(--bottom-nav-clearance))]"
      >
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
