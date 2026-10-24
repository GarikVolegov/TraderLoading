import { useMobileViewport } from "./hooks/use-mobile-viewport";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Switch, Route, Redirect, useLocation, useSearch, Router as WouterRouter } from "wouter";
import { hasExplicitCenterView, resolveWorkspaceAlias } from "./lib/workspaceNavigation";
import { motion, MotionConfig } from "framer-motion";
import { useMediaQuery } from "./hooks/use-media-query";
import { MutationCache, QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { shouldRetryQuery } from "./lib/queryRetry";
import { shouldNotifyGlobally } from "./lib/mutationErrorPolicy";
import { toast } from "./hooks/use-toast";
import { reportClientError } from "./lib/clientErrorReporter";
import { uiText } from "./contexts/LanguageContext";
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
import { GoalReminders } from "./components/GoalReminders";
import { DailyAlarmNotifier } from "./components/DailyAlarmNotifier";
import { MacroNotifier } from "./components/MacroNotifier";
import { SessionStartNotifier } from "./components/SessionStartNotifier";
import { CommandPalette } from "./components/CommandPalette";
import { SignUpConversionTracker } from "./components/SignUpConversionTracker";
import { ReferralAttributionTracker } from "./components/ReferralAttributionTracker";
import { NicknameOnboarding } from "./pages/NicknameOnboarding";
import { initAnalytics } from "./lib/analytics";
import { academyAuthDestination } from "./lib/academyReferral";

// Avvio analytics (no-op senza VITE_GA_MEASUREMENT_ID o senza consenso cookie).
initAnalytics();
import { ScheduledCallRuntime } from "./components/ScheduledCallRuntime";
import { PinLockScreen } from "./components/PinLockScreen";
import { TopNav } from "./components/TopNav";
import { BottomNav } from "./components/BottomNav";
import { ThresholdOfSelectionModal } from "./components/onboarding/ThresholdOfSelectionModal";
import {
  getBrowserLanguage,
  getStoredLanguagePreference,
  hasStoredLanguagePreference,
  LANGUAGES,
  useLanguage,
} from "./contexts/LanguageContext";
import type { Language } from "./lib/i18n";
import {
  SEO_PAGE_KEYS,
  seoPageFromSlug,
  seoPagePath,
  type SeoPageKey,
} from "./lib/seo";
import { getGetUserSettingsQueryKey, useGetUserSettings, useUpdateUserSettings } from "@workspace/api-client-react";
import { decideLanguageSync } from "./lib/languageSync";

const Dashboard = lazy(() => import("./pages/OperatingDashboard"));
const Today = lazy(() => import("./pages/Today"));
const Academy = lazy(() => import("./pages/Academy"));
const AcademyWelcome = lazy(() => import("./pages/Academy").then(module => ({ default: module.AcademyWelcome })));
const Routine = lazy(() => import("./pages/Routine"));
const Missions = lazy(() => import("./pages/Missions"));
const Journal = lazy(() => import("./pages/Journal"));
const Settings = lazy(() => import("./pages/Settings"));
const Support = lazy(() => import("./pages/Support"));
const Chat = lazy(() => import("./pages/Chat"));
const Backtest = lazy(() => import("./pages/Backtest"));
const BacktestReplay = lazy(() => import("./pages/BacktestReplay"));
const Wiki = lazy(() => import("./pages/Wiki"));
const Milestones = lazy(() => import("./pages/Milestones"));
const ProPage = lazy(() => import("./pages/ProPage"));
const BillingReturn = lazy(() => import("./pages/BillingReturn"));
const NotFound = lazy(() => import("./pages/not-found"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Admin = lazy(() => import("./pages/Admin"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const Styleguide = lazy(() => import("@/components/ui/styleguide/Styleguide"));
const SeoArticlePage = lazy(() => import("./pages/seo/SeoArticlePage"));
const Protocollo = lazy(() => import("./pages/ProtocolloPage"));
const FinancialArchitecture = lazy(() => import("./pages/FinancialArchitecture"));
const DecompressionPage = lazy(() => import("./pages/DecompressionPage"));

// Public marketing languages served under a /{lang} URL prefix (English lives
// at the root and is the x-default).
const LOCALIZED_LANGS: Language[] = ["it", "es", "fr", "de"];

const queryClient = new QueryClient({
  // A failed mutation with no local onError handler used to fail silently (no
  // toast, no console) — e.g. every Wiki upload/rename/move mutation. This is
  // the single fallback net; call sites that already show their own feedback
  // opt out via meta.suppressGlobalError to avoid a double toast.
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (!shouldNotifyGlobally(mutation)) return;
      reportClientError(error, {
        context: "mutation",
        fallbackMessage: uiText("errors.mutation.generic"),
        toast,
      });
    },
  }),
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
    colorPrimary: "#C5A059",
    colorForeground: "#F4F4F6",
    colorMutedForeground: "#8E8E99",
    colorDanger: "#ef4444",
    colorBackground: "#0A0A0C",
    colorInput: "#141418",
    colorInputForeground: "#F4F4F6",
    colorNeutral: "#26262E",
    fontFamily: "'Space Grotesk', -apple-system, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "!bg-transparent rounded-lg w-full max-w-full overflow-hidden !shadow-none !border-0",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!hidden",
    header: "!hidden",
    headerTitle: "text-[#F4F4F6] font-bold font-mono tracking-wider",
    headerSubtitle: "text-[#8E8E99]",
    socialButtonsBlockButtonText: "text-[#F4F4F6] font-semibold",
    formFieldLabel: "text-[#F4F4F6] font-semibold text-xs tracking-wide",
    footerActionLink: "text-[#C5A059] hover:text-[#D6B575] font-semibold",
    footerActionText: "text-[#8E8E99]",
    dividerText: "text-[#8E8E99]",
    identityPreviewEditButton: "text-[#C5A059]",
    formFieldSuccessText: "text-[#C5A059]",
    alertText: "text-[#F4F4F6]",
    logoBox: "!hidden",
    logoImage: "h-11 w-11 rounded-lg",
    socialButtonsBlockButton: "!border-[#26262E] hover:!border-[#C5A059]/50 !bg-[#141418]/90 !rounded-xl backdrop-blur transition-all",
    formButtonPrimary: "!bg-[#C5A059] !text-[#0A0A0C] hover:!bg-[#D6B575] font-bold !rounded-xl !shadow-[0_4px_16px_rgba(197,160,89,0.25)] transition-all",
    formFieldInput: "!bg-[#141418]/90 !border-[#26262E] !text-[#F4F4F6] focus:!border-[#C5A059] focus:!ring-1 focus:!ring-[#C5A059]/40 !rounded-xl",
    footerAction: "!bg-[#0A0A0C]",
    dividerLine: "!bg-[#26262E]",
    alert: "!bg-[#1f0d12] !border-[#ef4444]/35 !rounded-xl",
    otpCodeFieldInput: "!bg-[#141418]/90 !border-[#26262E] !text-[#F4F4F6] focus:!border-[#C5A059] !rounded-xl",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  const search = useSearch();
  const academyDestination = academyAuthDestination(search);
  const academyQuery = academyDestination ? `?${search}` : "";
  return (
    <AuthPageShell mode="sign-in">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up${academyQuery}`}
        forceRedirectUrl={academyDestination ? `${basePath}${academyDestination}` : undefined}
        fallbackRedirectUrl={`${basePath}/`}
      />
    </AuthPageShell>
  );
}

function SignUpPage() {
  const search = useSearch();
  const academyDestination = academyAuthDestination(search);
  const academyQuery = academyDestination ? `?${search}` : "";
  return (
    <AuthPageShell mode="sign-up">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in${academyQuery}`}
        forceRedirectUrl={academyDestination ? `${basePath}${academyDestination}` : undefined}
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
  initial: { opacity: 0, y: 6, scale: 0.998 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] as const },
  },
};

function PageFallback() {
  return <div className="min-h-screen bg-background" />;
}

function LanguageServerSync() {
  const { language, setLanguage } = useLanguage();
  const updateSettings = useUpdateUserSettings();
  const qc = useQueryClient();
  const settings = useGetUserSettings();
  const decidedRef = useRef(false);
  const lastSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    // Aspetta l'esito della lettura: scrivere prima di aver letto è ciò che
    // sovrascriveva la preferenza salvata su un device nuovo.
    if (!settings.isSuccess && !settings.isError) return;

    const storedPreference = getStoredLanguagePreference();
    const effectiveClientLang = storedPreference ?? language;

    if (!decidedRef.current) {
      decidedRef.current = true;
      const decision = decideLanguageSync<Language>({
        serverLanguage: settings.data?.language ?? null,
        clientLanguage: effectiveClientLang,
        hasExplicitLocalChoice: storedPreference != null,
        supported: Object.keys(LANGUAGES),
      });
      if (decision.action === "adopt") {
        lastSyncedRef.current = decision.language;
        setLanguage(decision.language, true);
        return;
      }
      if (decision.action === "none") {
        lastSyncedRef.current = effectiveClientLang;
        return;
      }
    }

    // Only sync to server if this device has an explicit user choice, avoiding cross-device browser override
    if (!hasStoredLanguagePreference()) return;

    // A settings save already updates the query before applying the local choice.
    // Avoid sending a duplicate PUT from this bootstrap synchronizer.
    if (settings.data?.language === effectiveClientLang) { lastSyncedRef.current = effectiveClientLang; return; }
    if (lastSyncedRef.current === effectiveClientLang) return;
    lastSyncedRef.current = effectiveClientLang;
    updateSettings.mutate(
      { data: { language: effectiveClientLang } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() }) },
    );
  }, [settings.isSuccess, settings.isError, settings.data, language, qc, updateSettings, setLanguage]);

  return null;
}

function WorkspaceAlias() {
  const [path, navigate] = useLocation();
  const search = useSearch();
  const destination = resolveWorkspaceAlias(path, search);
  useEffect(() => {
    if (destination) navigate(destination, { replace: true });
  }, [destination, navigate]);
  return <PageFallback />;
}

function HomeRoute() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const legacyDestination = resolveWorkspaceAlias("/", search);
  useEffect(() => {
    if (legacyDestination) navigate(legacyDestination, { replace: true });
  }, [legacyDestination, navigate]);
  if (legacyDestination) return <PageFallback />;
  return hasExplicitCenterView(search) ? <Dashboard /> : <Today />;
}

function AppRouter() {
  const [location] = useLocation();
  const search = useSearch();
  const isHomeScenario = location === "/" && hasExplicitCenterView(search);
  const transitionKey = isHomeScenario ? "/?scenario" : location;

  // Entrance-only page transition. No AnimatePresence: there is no exit
  // animation, so AnimatePresence served no purpose — and its sync mode kept the
  // previous page mounted (stacked under the new one, each min-h-screen), which
  // showed as duplicated content when scrolling after navigation. Rendering a
  // keyed motion.div directly unmounts the old page immediately while still
  // playing the entrance animation on each route change.
  return (
    <motion.div key={transitionKey} {...pageTransition}>
      <Suspense fallback={<PageFallback />}>
        <Switch>
          <Route path="/" component={HomeRoute} />
          <Route path="/method" component={WorkspaceAlias} />
          <Route path="/academy" component={Academy} />
          <Route path="/resources">
            {() => <Redirect to="/" />}
          </Route>
          <Route path="/dashboard/widgets" component={WorkspaceAlias} />
          <Route path="/journal" component={Journal} />
          <Route path="/checklist" component={WorkspaceAlias} />
          <Route path="/news" component={WorkspaceAlias} />
          <Route path="/chat" component={Chat} />
          <Route path="/backtest/:id/replay" component={BacktestReplay} />
          <Route path="/backtest" component={Backtest} />
          <Route path="/tools" component={WorkspaceAlias} />
          <Route path="/wiki" component={Wiki} />
          <Route path="/milestones" component={Milestones} />
          <Route path="/library" component={WorkspaceAlias} />
          <Route path="/routine" component={Routine} />
          <Route path="/missions" component={Missions} />
          <Route path="/tornei" component={WorkspaceAlias} />
          <Route path="/clock" component={WorkspaceAlias} />
          <Route path="/calendar" component={WorkspaceAlias} />
          <Route path="/broker" component={WorkspaceAlias} />
          <Route path="/pro" component={ProPage} />
          <Route path="/billing/return" component={BillingReturn} />
          <Route path="/settings" component={Settings} />
          <Route path="/support" component={Support} />
          <Route path="/support/:id" component={Support} />
          <Route path="/protocollo" component={Protocollo} />
          <Route path="/sandbox" component={Protocollo} />
          <Route path="/patrimonio" component={FinancialArchitecture} />
          <Route path="/decompressione" component={DecompressionPage} />
          <Route path="/distacco" component={DecompressionPage} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </motion.div>
  );
}

function AuthenticatedShell() {
  const [location] = useLocation();
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  if (location.startsWith("/admin")) {
    return (
      <Suspense fallback={<PageFallback />}>
        <Admin />
      </Suspense>
    );
  }

  return (
    <MotionConfig reducedMotion="user" skipAnimations={reduceMotion}>
    <BackgroundProvider>
      {/* Global overlays — never unmounted during page transitions */}
      <PinLockScreen />
      <LoadingScreen />
      <ThresholdOfSelectionModal />
      <GoalReminders />
      <DailyAlarmNotifier />
      <ScheduledCallRuntime />
      <MacroNotifier />
      <SessionStartNotifier />
      <LanguageServerSync />
      <CommandPalette />
      <SignUpConversionTracker />

      {/* Unified LIMEN navigation — always mounted across all authenticated routes */}
      <TopNav />
      <BottomNav />

      {/* Animated page content */}
      <AppRouter />
    </BackgroundProvider>
    </MotionConfig>
  );
}

function AuthTimeoutScreen() {
  return (
    <div
      role="alert"
      data-auth-unavailable
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.25rem",
        padding: "1.5rem",
        background: "#0A0A0C",
        color: "#F4F4F6",
        fontFamily: "'Space Grotesk', system-ui, -apple-system, sans-serif",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "2.5rem", lineHeight: 1 }}>⏳</div>
      <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700, fontFamily: "'Cinzel', serif", letterSpacing: "0.04em", textTransform: "uppercase" }}>
        Caricamento Lento
      </h1>
      <p style={{ margin: 0, maxWidth: "32rem", color: "#8E8E99", lineHeight: 1.6, fontSize: "0.95rem" }}>
        L'inizializzazione della sessione protetta sta richiedendo più tempo del previsto. Verifica la connessione e ricarica.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          cursor: "pointer",
          border: "none",
          borderRadius: "0.5rem",
          padding: "0.75rem 1.75rem",
          fontWeight: 700,
          fontSize: "0.95rem",
          background: "#C5A059",
          color: "#0A0A0C",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          boxShadow: "0 4px 16px rgba(197, 160, 89, 0.25)",
        }}
      >
        Ricarica
      </button>
    </div>
  );
}

function AppShell() {
  const { isLoaded, isSignedIn } = useAuth();
  const [location] = useLocation();
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
    if (authTimedOut && location === "/") {
      return (
        <Suspense fallback={<PageFallback />}>
          <LandingPage />
        </Suspense>
      );
    }
    return authTimedOut ? (
      <AuthTimeoutScreen />
    ) : (
      <div className="min-h-screen bg-[hsl(224,71%,4%)]" />
    );
  }

  if (location === "/academy" && !isSignedIn) {
    return (
      <Suspense fallback={<PageFallback />}>
        <AcademyWelcome />
      </Suspense>
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
      data-auth-unavailable
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.25rem",
        padding: "1.5rem",
        background: "#0A0A0C",
        color: "#F4F4F6",
        fontFamily: "'Space Grotesk', system-ui, -apple-system, sans-serif",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "2.5rem", lineHeight: 1 }}>🔑</div>
      <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700, fontFamily: "'Cinzel', serif", letterSpacing: "0.04em", textTransform: "uppercase" }}>
        Autenticazione Non Configurata
      </h1>
      <p style={{ margin: 0, maxWidth: "34rem", color: "#8E8E99", lineHeight: 1.6, fontSize: "0.95rem" }}>
        Questa build richiede la chiave pubblica Clerk per inizializzare l'accesso protetto al protocollo.
        Configura <code>VITE_CLERK_PUBLISHABLE_KEY</code> nell'ambiente per procedere.
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
    return () => {
      const preferred = getStoredLanguagePreference() ?? getBrowserLanguage();
      setLanguage(preferred, false);
    };
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
    return () => {
      const preferred = getStoredLanguagePreference() ?? getBrowserLanguage();
      setLanguage(preferred, false);
    };
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
        <ReferralAttributionTracker />
        <Switch>
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/privacy" component={PrivacyPage} />
          <Route path="/terms" component={TermsPage} />
          <Route path="/protocollo">
            {() => (
              <Suspense fallback={<PageFallback />}>
                <Protocollo />
              </Suspense>
            )}
          </Route>
          <Route path="/sandbox">
            {() => (
              <Suspense fallback={<PageFallback />}>
                <Protocollo />
              </Suspense>
            )}
          </Route>
          {/* Internal design-system reference: dev-only, never reachable in a
              production build (finding: was publicly reachable at /styleguide). */}
          {import.meta.env.DEV && <Route path="/styleguide" component={Styleguide} />}
          <Route path="/welcome" component={WelcomePage} />
          {marketingRoutes}
          <Route path="/*?" component={AppShell} />
        </Switch>
        {/* Inside ClerkProvider: CookieConsentPopup calls useUser() to fire the
            sign_up conversion with the user's createdAt on consent. */}
        <CookieConsentPopup />
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
  useMobileViewport();
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
