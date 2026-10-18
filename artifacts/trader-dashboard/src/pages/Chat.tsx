import { lazy, Suspense } from "react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { SectionTabs } from "@/components/SectionTabs";
import { useLocation, useSearch } from "wouter";
import { parseSocialLocation, socialHref } from "@/lib/chatTabs";
import { socialText } from "@/lib/i18n/reorganizationSocial";
import { useLanguage } from "@/contexts/LanguageContext";
import { ProUpgradeGate } from "@/components/ProUpgradeGate";
import { useUser } from "@clerk/react";
import { Loader2, LogIn, Users } from "lucide-react";
import type { SocialUser } from "@/components/social/types";

const SocialTab = lazy(() => import("@/components/social/SocialTab").then(m => ({ default: m.SocialTab })));
const ConversationsWorkspace = lazy(() => import("@/components/social/ConversationsWorkspace"));
const ClassificaTab = lazy(() => import("@/components/social/ClassificaTab").then(m => ({ default: m.ClassificaTab })));
const TorneiWorkspace = lazy(() => import("./Tornei").then(m => ({ default: m.TorneiWorkspace })));

function Loading() {
  return <div className="flex min-h-48 items-center justify-center" role="status"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
}

export default function Chat() {
  const { t, language } = useLanguage();
  const { user, isSignedIn, isLoaded } = useUser();
  const [, navigate] = useLocation();
  const location = parseSocialLocation(useSearch());
  const text = (key: Parameters<typeof socialText>[1]) => socialText(language, key);
  const handleStartChat = (peer: SocialUser) => {
    if (peer.userId) navigate(socialHref("conversazioni", { peer: peer.userId }));
  };

  if (!isLoaded) return <PageLayout quiet><Loading /></PageLayout>;
  if (!isSignedIn) return (
    <PageLayout quiet>
      <div className="flex h-[60vh] items-center justify-center">
        <div className="space-y-4 text-center">
          <Users className="mx-auto h-12 w-12 text-primary/50" />
          <h1 className="text-xl font-semibold">{text("title")}</h1>
          <p className="text-muted-foreground">{t("chat.login_required")}</p>
          <button onClick={() => navigate("/sign-in")} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-6 py-3 text-primary-foreground"><LogIn className="h-4 w-4" />{t("common.start")}</button>
        </div>
      </div>
    </PageLayout>
  );

  return (
    <PageLayout quiet>
      <PageHeader title={text("title")} subtitle={text("subtitle")} />
      <SectionTabs ariaLabel={text("navigation")} value={location.tab} items={[
        { value: "conversazioni", label: text("conversations"), href: socialHref("conversazioni") },
        { value: "social", label: text("activity"), href: socialHref("social") },
        { value: "competizioni", label: text("competitions"), href: socialHref("competizioni") },
      ]} />
      {location.tab === "competizioni" && (
        <SectionTabs ariaLabel={text("competitionNavigation")} value={location.competitionView === "xp" ? "xp" : "torneo"} items={[
          { value: "xp", label: text("xp"), href: socialHref("competizioni", { vista: "xp" }) },
          { value: "torneo", label: text("tournament"), href: socialHref("competizioni", { vista: "torneo" }) },
        ]} />
      )}
      <Suspense fallback={<Loading />}>
        {location.tab === "conversazioni" && <section className="h-[calc(100dvh-var(--safe-top)-8.8rem-var(--bottom-nav-clearance))] min-h-[240px] overflow-hidden rounded-2xl border border-border/60 bg-card/40 sm:h-[calc(100dvh-var(--safe-top)-13rem-var(--bottom-nav-clearance))]">
          <ConversationsWorkspace currentUserId={user?.id ?? ""} currentUserName={user?.firstName ?? "Trader"} />
        </section>}
        {location.tab === "social" && <section className="h-[calc(100dvh-var(--safe-top)-8.8rem-var(--bottom-nav-clearance))] min-h-[240px] overflow-hidden rounded-2xl border border-border/60 bg-card/40 sm:h-[calc(100dvh-var(--safe-top)-13rem-var(--bottom-nav-clearance))]">
          <SocialTab currentUserId={user?.id ?? ""} onStartChat={handleStartChat} />
        </section>}
        {location.tab === "competizioni" && (location.competitionView === "xp"
          ? <section className="h-[min(70dvh,800px)] min-h-96 overflow-hidden rounded-2xl border border-border/60 bg-card/40"><ProUpgradeGate feature="leaderboard"><ClassificaTab currentUserId={user?.id ?? ""} /></ProUpgradeGate></section>
          : <TorneiWorkspace embedded />)}
      </Suspense>
    </PageLayout>
  );
}
