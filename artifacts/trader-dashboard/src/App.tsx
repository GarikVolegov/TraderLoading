import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { motion } from "framer-motion";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { shouldRetryQuery } from "./lib/queryRetry";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useAuth } from "@clerk/react";
import { dark } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AudioProvider } from "./contexts/AudioContext";
import { BackgroundProvider } from "./contexts/BackgroundContext";
import { LoadingProvider } from "./contexts/LoadingContext";
import { PinLockProvider } from "./contexts/PinLockContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { LoadingScreen } from "./components/LoadingScreen";
import { AuthPageShell } from "./components/AuthPageShell";
import { CookieConsentPopup } from "./components/CookieConsentPopup";
import { WelcomeNotification } from "./components/WelcomeNotification";
import { GoalReminders } from "./components/GoalReminders";
import { DailyAlarmNotifier } from "./components/DailyAlarmNotifier";
import { MacroNotifier } from "./components/MacroNotifier";
import { SessionStartNotifier } from "./components/SessionStartNotifier";
import { SessionCheckinModal } from "./components/SessionCheckinModal";
import { CommandPalette } from "./components/CommandPalette";
import { SignUpConversionTracker } from "./components/SignUpConversionTracker";
import { NicknameOnboarding } from "./pages/NicknameOnboarding";
import { initAnalytics } from "./lib/analytics";

// Avvio analytics (no-op senza VITE_GA_MEASUREMENT_ID o senza consenso cookie).
initAnalytics();
import { ScheduledCallRuntime } from "./components/ScheduledCallRuntime";
import { LevelRewardModal } from "./components/LevelRewardModal";
import { ReviewPromptModal } from "./components/ReviewPromptModal";
import { PinLockScreen } from "./components/PinLockScreen";
import { ChecklistSetupModal } from "./components/ChecklistSetupModal";
import { PairOnboardingWrapper } from "./components/PairOnboardingWrapper";
import { AppTutorialWrapper } from "./components/AppTutorialWrapper";
import { TopNav } from "./components/TopNav";
import { BottomNav } from "./components/BottomNav";
import { useLanguage } from "./contexts/LanguageContext";
import type { Language } from "./lib/i18n";
import {
  SEO_PAGE_KEYS,
  seoPageFromSlug,
  seoPagePath,
  type SeoPageKey,
} from "./lib/seo";
import { getGetUserSettingsQueryKey, useUpdateUserSettings } from "@workspace/api-client-react";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Journal = lazy(() => import("./pages/Journal"));
const Settings = lazy(() => import("./pages/Settings"));
const Support = lazy(() => import("./pages/Support"));
const Checklist = lazy(() => import("./pages/Checklist"));
const News = lazy(() => import("./pages/News"));
const Chat = lazy(() => import("./pages/Chat"));
const Backtest = lazy(() => import("./pages/Backtest"));
const Wiki = lazy(() => import("./pages/Wiki"));
const Zen = lazy(() => import("./pages/Zen"));
const Milestones = lazy(() => import("./pages/Milestones"));
const Library = lazy(() => import("./pages/Library"));
const Routine = lazy(() => import("./pages/Routine"));
const Missions = lazy(() => import("./pages/Missions"));
const Tornei = lazy(() => import("./pages/Tornei"));
const Clock = lazy(() => import("./pages/Clock"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Broker = lazy(() => import("./pages/Broker"));
const ProPage = lazy(() => import("./pages/ProPage"));
const BillingReturn = lazy(() => import("./pages/BillingReturn"));
const NotFound = lazy(() => import("./pages/not-found"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Admin = lazy(() => import("./pages/Admin"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const Styleguide = lazy(() => import("@/components/ui/styleguide/Styleguide"));
const SeoArticlePage = lazy(() => import("./pages/seo/SeoArticlePage"));

// Public marketing languages served under a /{lang} URL prefix (English lives
// at the root and is the x-default).
const LOCALIZED_LANGS: Language[] = ["it", "es", "fr", "de"];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry transient server/network blips (so a momentary failure doesn't leave a
      // widget broken until reload) but never a 4xx — see shouldRetryQuery.
      retry: shouldRetryQuery,
      // Refetch stale queries when the tab regains focus, so widgets recover after
      // the laptop wakes from sleep (or a cookie refresh) instead of staying broken
      // until a manual reload. Bounded by staleTime below, so it only refetches what
      // is actually stale — not a refetch storm on every focus.
      refetchOnWindowFocus: true,
      // Serve cached data instantly on navigation instead of refetching on every
      // remount (default staleTime 0). Real-time market/chat queries override this
      // with their own staleTime/refetchInterval, so freshness there is unaffected.
      staleTime: 60_000,
    },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

// NOTE: we intentionally do NOT wire VITE_CLERK_PROXY_URL into ClerkProvider.
// This Clerk instance is configured with a custom domain (clerk.<domain>), which
// clerk-js reaches directly from the publishable key. Routing through the app's
// own /api/__clerk proxy made clerk-js hit frontend-api.clerk.dev, which cannot
// attribute a custom-domain instance and returns 400 host_invalid — so Clerk
// never initialized, useAuth().isLoaded stayed false, and the app showed a
// permanent black screen. The proxy is only needed for deploys without a custom
// domain (e.g. *.replit.app); re-add it there with the matching Clerk dashboard
// proxy configuration, not here.

// A missing/garbage key makes ClerkProvider throw on render, which used to blank
// the whole app to a black screen. Detect it up front so we can show an
// actionable message instead. Clerk keys are always `pk_test_…` or `pk_live_…`.
const hasValidClerkKey =
  typeof clerkPubKey === "string" &&
  (clerkPubKey.startsWith("pk_test_") || clerkPubKey.startsWith("pk_live_"));

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  baseTheme: dark,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/app-icon-192.png`,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "#51a488",
    colorForeground: "#f8fafc",
    colorMutedForeground: "#94a3b8",
    colorDanger: "#ef4444",
    colorBackground: "#07111f",
    colorInput: "#0d1527",
    colorInputForeground: "#f8fafc",
    colorNeutral: "#334155",
    fontFamily: "'Fira Sans', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "!bg-transparent rounded-lg w-full max-w-full overflow-hidden !shadow-none !border-0",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!hidden",
    header: "!hidden",
    headerTitle: "text-[#f8fafc] font-bold font-mono",
    headerSubtitle: "text-[#94a3b8]",
    socialButtonsBlockButtonText: "text-[#f8fafc] font-semibold",
    formFieldLabel: "text-[#f8fafc] font-semibold",
    footerActionLink: "text-[#51a488] hover:text-[#7cb6a3] font-semibold",
    footerActionText: "text-[#94a3b8]",
    dividerText: "text-[#94a3b8]",
    identityPreviewEditButton: "text-[#51a488]",
    formFieldSuccessText: "text-[#51a488]",
    alertText: "text-[#f8fafc]",
    logoBox: "!hidden",
    logoImage: "h-11 w-11 rounded-lg",
    socialButtonsBlockButton: "!border-[#334155] hover:!border-[#51a488]/50 !bg-[#0d1527]/70 !rounded-xl backdrop-blur",
    formButtonPrimary: "!bg-[#51a488] !text-[#031a0d] hover:!bg-[#7cb6a3] font-bold !rounded-xl !shadow-[0_10px_22px_rgba(81,164,136,0.18)]",
    formFieldInput: "!bg-[#0d1527]/70 !border-[#334155] !text-[#f8fafc] focus:!border-[#51a488] focus:!ring-1 focus:!ring-[#51a488]/40 !rounded-xl",
    footerAction: "!bg-[#06101d]",
    dividerLine: "!bg-[#334155]/70",
    alert: "!bg-[#1f0d12] !border-[#ef4444]/35 !rounded-xl",
    otpCodeFieldInput: "!bg-[#0d1527]/70 !border-[#334155] !text-[#f8fafc] focus:!border-[#51a488] !rounded-xl",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  return (
    <AuthPageShell mode="sign-in">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={`${basePath}/`}
      />
    </AuthPageShell>
  );
}

function SignUpPage() {
  return (
    <AuthPageShell mode="sign-up">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/welcome`}
      />
    </AuthPageShell>
  );
}

function WelcomePage() {
  return (
    <>
      <Show when="signed-in">
        <NicknameOnboarding />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function PrivacyPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <LegalPage kind="privacy" />
    </Suspense>
  );
}

function TermsPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <LegalPage kind="terms" />
    </Suspense>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

/* ── Page transition — entrance only, no exit to avoid crash ─────────────── */
const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function PageFallback() {
  return <div className="min-h-screen bg-background" />;
}

function LanguageServerSync() {
  const { language } = useLanguage();
  const updateSettings = useUpdateUserSettings();
  const qc = useQueryClient();
  const lastSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastSyncedRef.current === language) return;
    lastSyncedRef.current = language;
    updateSettings.mutate(
      { data: { language } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() }) },
    );
  }, [language, qc, updateSettings]);

  return null;
}

function AppRouter() {
  const [location] = useLocation();

  // Entrance-only page transition. No AnimatePresence: there is no exit
  // animation, so AnimatePresence served no purpose — and its sync mode kept the
  // previous page mounted (stacked under the new one, each min-h-screen), which
  // showed as duplicated content when scrolling after navigation. Rendering a
  // keyed motion.div directly unmounts the old page immediately while still
  // playing the entrance animation on each route change.
  return (
    <motion.div key={location} {...pageTransition}>
      <Suspense fallback={<PageFallback />}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/journal" component={Journal} />
          <Route path="/checklist" component={Checklist} />
          <Route path="/news" component={News} />
          <Route path="/chat" component={Chat} />
          <Route path="/backtest" component={Backtest} />
          <Route path="/tools" component={Backtest} />
          <Route path="/wiki" component={Wiki} />
          <Route path="/zen" component={Zen} />
          <Route path="/milestones" component={Milestones} />
          <Route path="/library" component={Library} />
          <Route path="/routine" component={Routine} />
          <Route path="/missions" component={Missions} />
          <Route path="/tornei" component={Tornei} />
          <Route path="/clock" component={Clock} />
          <Route path="/calendar" component={Calendar} />
          <Route path="/broker" component={Broker} />
          <Route path="/pro" component={ProPage} />
          <Route path="/billing/return" component={BillingReturn} />
          <Route path="/settings" component={Settings} />
          <Route path="/support" component={Support} />
          <Route path="/support/:id" component={Support} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </motion.div>
  );
}

function AuthenticatedShell() {
  const [location] = useLocation();

  if (location.startsWith("/admin")) {
    return (
      <Suspense fallback={<PageFallback />}>
        <Admin />
      </Suspense>
    );
  }

  return (
    <BackgroundProvider>
      {/* Global overlays — never unmounted during page transitions */}
      <PinLockScreen />
      <ChecklistSetupModal />
      <LoadingScreen />
      <WelcomeNotification />
      <GoalReminders />
      <DailyAlarmNotifier />
      <ScheduledCallRuntime />
      <MacroNotifier />
      <SessionStartNotifier />
      <LanguageServerSync />
      <PairOnboardingWrapper />
      <AppTutorialWrapper />
      <SessionCheckinModal />
      <LevelRewardModal />
      <ReviewPromptModal />
      <CommandPalette />
      <SignUpConversionTracker />

      {/* Global nav — always mounted, unaffected by page transitions */}
      <TopNav />
      <BottomNav />

      {/* Animated page content */}
      <AppRouter />
    </BackgroundProvider>
  );
}

function AuthTimeoutScreen() {
  return (
    <div
      role="alert"
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.25rem",
        padding: "1.5rem",
        background: "#07111f",
        color: "#f8fafc",
        fontFamily: "'Fira Sans', system-ui, -apple-system, sans-serif",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "2.5rem", lineHeight: 1 }}>⏳</div>
      <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>
        Trouble loading
      </h1>
      <p style={{ margin: 0, maxWidth: "32rem", color: "#94a3b8", lineHeight: 1.5 }}>
        Sign-in is taking longer than expected. Check your connection and reload.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          cursor: "pointer",
          border: "none",
          borderRadius: "0.5rem",
          padding: "0.75rem 1.5rem",
          fontWeight: 700,
          fontSize: "1rem",
          background: "#51a488",
          color: "#031a0d",
        }}
      >
        Reload
      </button>
    </div>
  );
}

function AppShell() {
  const { isLoaded } = useAuth();
  const [authTimedOut, setAuthTimedOut] = useState(false);

  // If Clerk never finishes initializing (e.g. its Frontend API is
  // unreachable), surface an actionable screen rather than an indefinite black
  // placeholder — the "tutto nero" symptom is precisely isLoaded stuck false.
  useEffect(() => {
    if (isLoaded) return;
    const timer = window.setTimeout(() => setAuthTimedOut(true), 12000);
    return () => window.clearTimeout(timer);
  }, [isLoaded]);

  if (!isLoaded) {
    return authTimedOut ? (
      <AuthTimeoutScreen />
    ) : (
      <div className="min-h-screen bg-[hsl(224,71%,4%)]" />
    );
  }

  return (
    <>
      <Show when="signed-in">
        <AuthenticatedShell />
      </Show>
      <Show when="signed-out">
        <Suspense fallback={<PageFallback />}>
          <LandingPage />
        </Suspense>
      </Show>
    </>
  );
}

function ClerkConfigErrorScreen() {
  return (
    <div
      role="alert"
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.25rem",
        padding: "1.5rem",
        background: "#07111f",
        color: "#f8fafc",
        fontFamily: "'Fira Sans', system-ui, -apple-system, sans-serif",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "2.5rem", lineHeight: 1 }}>🔑</div>
      <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>
        Authentication is not configured
      </h1>
      <p style={{ margin: 0, maxWidth: "34rem", color: "#94a3b8", lineHeight: 1.5 }}>
        This build is missing a valid Clerk publishable key, so sign-in cannot
        load. Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> at build time (for the
        AWS image, pass it as a <code>--build-arg</code>) and redeploy.
      </p>
    </div>
  );
}

/* ── Public marketing routes (language-prefixed, prerendered) ───────────────
   These render the public landing + dedicated SEO pages regardless of auth, so
   crawlers (always anonymous) see fully-rendered, per-language content. The URL
   prefix drives the language. */

function MarketingPage({ lang, page }: { lang: Language; page: SeoPageKey }) {
  const { setLanguage } = useLanguage();
  useEffect(() => {
    setLanguage(lang, false);
  }, [lang, setLanguage]);
  return (
    <Suspense fallback={<PageFallback />}>
      <SeoArticlePage page={page} />
    </Suspense>
  );
}

function MarketingLanding({ lang }: { lang: Language }) {
  const { setLanguage } = useLanguage();
  useEffect(() => {
    setLanguage(lang, false);
  }, [lang, setLanguage]);
  return (
    <Suspense fallback={<PageFallback />}>
      <LandingPage />
    </Suspense>
  );
}

function LocalizedMarketingRoute({ lang, slug }: { lang: Language; slug?: string }) {
  if (!slug) return <MarketingLanding lang={lang} />;
  const page = seoPageFromSlug(lang, slug);
  if (page) return <MarketingPage lang={lang} page={page} />;
  return (
    <Suspense fallback={<PageFallback />}>
      <NotFound />
    </Suspense>
  );
}

// English keyword/marketing pages at the root, plus a /{lang}/:slug? route per
// localized language (matches both the localized landing and its keyword pages).
const marketingRoutes = [
  ...SEO_PAGE_KEYS.map((page) => (
    <Route key={`en-${page}`} path={seoPagePath(page, "en")}>
      <MarketingPage lang="en" page={page} />
    </Route>
  )),
  ...LOCALIZED_LANGS.map((lang) => (
    <Route key={`loc-${lang}`} path={`/${lang}/:slug?`}>
      {(params: { slug?: string }) => (
        <LocalizedMarketingRoute lang={lang} slug={params.slug} />
      )}
    </Route>
  )),
];

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  if (!hasValidClerkKey) {
    return <ClerkConfigErrorScreen />;
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey!}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/privacy" component={PrivacyPage} />
          <Route path="/terms" component={TermsPage} />
          <Route path="/styleguide" component={Styleguide} />
          <Route path="/welcome" component={WelcomePage} />
          {marketingRoutes}
          <Route path="/*?" component={AppShell} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

// Reset scroll to the top of the page on every route change. Without this the
// SPA keeps the previous scroll offset, so navigating from e.g. the landing
// footer lands you at the bottom of the destination page. In-page #hash anchors
// use native <a> links and don't change wouter's path, so they're unaffected.
function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <PinLockProvider>
          <LanguageProvider>
            <LoadingProvider>
              <AudioProvider>
                <WouterRouter base={basePath}>
                  <ScrollToTop />
                  <ClerkProviderWithRoutes />
                </WouterRouter>
                <CookieConsentPopup />
                <Toaster />
              </AudioProvider>
            </LoadingProvider>
          </LanguageProvider>
        </PinLockProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
