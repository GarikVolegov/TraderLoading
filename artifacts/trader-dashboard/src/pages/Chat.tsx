import { ViewportPanel } from "@/components/ViewportPanel";
import { lazy, Suspense } from "react";
import { PageLayout } from "@/components/PageLayout";
import { SectionTabs } from "@/components/SectionTabs";
import { useLocation, useSearch, Link } from "wouter";
import { parseSocialLocation, socialHref } from "@/lib/chatTabs";
import { socialText } from "@/lib/i18n/reorganizationSocial";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { ProUpgradeGate } from "@/components/ProUpgradeGate";
import { SundayCouncilBanner } from "@/components/social/SundayCouncilBanner";
import { useUser } from "@clerk/react";
import { Loader2, LogIn, Users } from "lucide-react";
import type { SocialUser } from "@/components/social/types";
import { useLimenEntitlements } from "@/hooks/useLimenEntitlements";
import { LimenServiceLockGate } from "@/components/candidacy/LimenServiceLockGate";

const SocialTab = lazy(() => import("@/components/social/SocialTab").then(m => ({ default: m.SocialTab })));
const ConversationsWorkspace = lazy(() => import("@/components/social/ConversationsWorkspace"));
const ClassificaTab = lazy(() => import("@/components/social/ClassificaTab").then(m => ({ default: m.ClassificaTab })));
const TorneiWorkspace = lazy(() => import("./Tornei").then(m => ({ default: m.TorneiWorkspace })));
const BacktestTournamentHub = lazy(() => import("@/components/backtest-tournament/BacktestTournamentHub").then(m => ({ default: m.BacktestTournamentHub })));

function Loading() {
  return <div className="flex min-h-48 items-center justify-center" role="status"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
}

export default function Chat() {
  const { t, language } = useLanguage();
  const { user, isSignedIn, isLoaded } = useUser();
  const [, navigate] = useLocation();
  const { entitlements } = useLimenEntitlements();
  const location = parseSocialLocation(useSearch());
  const text = (key: Parameters<typeof socialText>[1]) => socialText(language, key);
  const handleStartChat = (peer: SocialUser) => {
    if (peer.userId) navigate(socialHref("conversazioni", { peer: peer.userId }));
  };

  const isStaging = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("staging") === "1";

  if (!isLoaded) return <PageLayout quiet><Loading /></PageLayout>;
  if (!isSignedIn && !isStaging) return (
    <PageLayout quiet>
      <div className="flex h-[60vh] items-center justify-center">
        <div className="space-y-4 text-center">
          <Users className="mx-auto h-12 w-12 text-primary/50" />
          <h1 className="font-display text-xl font-bold uppercase tracking-wider">{text("title")}</h1>
          <p className="text-muted-foreground">{t("chat.login_required")}</p>
          <button onClick={() => navigate("/sign-in")} className="inline-flex min-h-11 items-center gap-2 rounded-[4px] bg-primary px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.14em] text-primary-foreground"><LogIn className="h-4 w-4" />{t("common.start")}</button>
        </div>
      </div>
    </PageLayout>
  );

  return (
    <PageLayout quiet={location.tab === "conversazioni"} className="chat-page">
      <div className="chat-overview space-y-2 pt-1">
        <SundayCouncilBanner />
        <div className={cn(
          "flex flex-col md:flex-row md:items-center justify-between gap-2",
          location.tab === "competizioni" ? "border-b border-border/70 pb-2" : "lg:hidden border-b border-border/70 pb-2"
        )}>
          {/* SectionTabs visible only on mobile screens where the desktop sidebar is not shown */}
          <div className="lg:hidden">
            <SectionTabs
              ariaLabel={text("navigation")}
              value={location.tab}
              className="border-b-0 pb-0"
              items={[
                { value: "conversazioni", label: "01 · Agorà", href: socialHref("conversazioni") },
                { value: "social", label: "02 · Cronache", href: socialHref("social") },
                { value: "competizioni", label: "03 · Arene", href: socialHref("competizioni") },
              ]}
            />
          </div>
          {location.tab === "competizioni" && (
            <div className="inline-flex items-center rounded-lg border border-[#26262E] bg-[#07080B] p-0.5 font-mono text-xs shrink-0 self-start md:self-auto ml-auto max-w-full overflow-x-auto scrollbar-none">
              <Link
                href={socialHref("competizioni", { vista: "xp" })}
                className={cn(
                  "px-2.5 py-1 rounded transition-colors whitespace-nowrap",
                  location.competitionView === "xp"
                    ? "bg-[#C5A059]/20 text-[#E8C56A] font-bold shadow-sm"
                    : "text-slate-400 hover:text-white"
                )}
              >
                {text("xp")}
              </Link>
              <Link
                href={socialHref("competizioni", { vista: "torneo" })}
                className={cn(
                  "px-2.5 py-1 rounded transition-colors whitespace-nowrap",
                  location.competitionView === "torneo" || !location.competitionView
                    ? "bg-[#C5A059]/20 text-[#E8C56A] font-bold shadow-sm"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Arene della Disciplina
              </Link>
              <Link
                href={socialHref("competizioni", { vista: "battaglie", sub: "backtest" })}
                className={cn(
                  "px-2.5 py-1 rounded transition-colors whitespace-nowrap",
                  location.competitionView === "battaglie"
                    ? "bg-[#C5A059]/20 text-[#E8C56A] font-bold shadow-sm"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Prove del Fuoco
              </Link>
            </div>
          )}
        </div>
      </div>
      <Suspense fallback={<Loading />}>
        {location.tab === "conversazioni" && (
          <ViewportPanel>
            <div className="h-full min-h-0 flex flex-col">
              <ConversationsWorkspace currentUserId={user?.id ?? ""} currentUserName={user?.firstName ?? "Operatore"} />
            </div>
          </ViewportPanel>
        )}
        {location.tab === "social" && (
          <ViewportPanel>
            <div className="h-full min-h-0 flex flex-col">
              <SocialTab currentUserId={user?.id ?? ""} onStartChat={handleStartChat} />
            </div>
          </ViewportPanel>
        )}
        {location.tab === "competizioni" && (location.competitionView === "xp"
          ? <section className="flex flex-col min-h-[500px] h-[calc(100dvh-var(--safe-top)-14rem-var(--bottom-nav-clearance))] max-h-[900px] overflow-hidden rounded-lg border border-border/70 bg-card/40"><ProUpgradeGate feature="leaderboard"><ClassificaTab currentUserId={user?.id ?? ""} /></ProUpgradeGate></section>
          : !entitlements.quarterlyTournaments
          ? <LimenServiceLockGate serviceId="quarterly_tournaments" />
          : location.competitionView === "battaglie"
          ? (
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#C5A059]/30">
              <BacktestTournamentHub />
            </div>
          )
          : <TorneiWorkspace embedded />)}
      </Suspense>
    </PageLayout>
  );
}
