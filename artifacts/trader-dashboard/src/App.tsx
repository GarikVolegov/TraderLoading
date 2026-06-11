import { lazy, Suspense, useEffect, useRef } from "react";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { motion } from "framer-motion";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
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
import { initAnalytics } from "./lib/analytics";

// Avvio analytics (no-op senza VITE_GA_MEASUREMENT_ID o senza consenso cookie).
initAnalytics();
import { ScheduledCallRuntime } from "./components/ScheduledCallRuntime";
import { LevelRewardModal } from "./components/LevelRewardModal";
import { PinLockScreen } from "./components/PinLockScreen";
import { ChecklistSetupModal } from "./components/ChecklistSetupModal";
import { PairOnboardingWrapper } from "./components/PairOnboardingWrapper";
import { AppTutorialWrapper } from "./components/AppTutorialWrapper";
import { TopNav } from "./components/TopNav";
import { BottomNav } from "./components/BottomNav";
import { useLanguage } from "./contexts/LanguageContext";
import { getGetUserSettingsQueryKey, useUpdateUserSettings } from "@workspace/api-client-react";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Journal = lazy(() => import("./pages/Journal"));
const Settings = lazy(() => import("./pages/Settings"));
const Checklist = lazy(() => import("./pages/Checklist"));
const News = lazy(() => import("./pages/News"));
const Chat = lazy(() => import("./pages/Chat"));
const Backtest = lazy(() => import("./pages/Backtest"));
const Brain = lazy(() => import("./pages/Brain"));
const Wiki = lazy(() => import("./pages/Wiki"));
const Zen = lazy(() => import("./pages/Zen"));
const Milestones = lazy(() => import("./pages/Milestones"));
const Library = lazy(() => import("./pages/Library"));
const Routine = lazy(() => import("./pages/Routine"));
const Missions = lazy(() => import("./pages/Missions"));
const Clock = lazy(() => import("./pages/Clock"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Broker = lazy(() => import("./pages/Broker"));
const ProPage = lazy(() => import("./pages/ProPage"));
const BillingReturn = lazy(() => import("./pages/BillingReturn"));
const NotFound = lazy(() => import("./pages/not-found"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Admin = lazy(() => import("./pages/Admin"));
const LegalPage = lazy(() => import("./pages/LegalPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

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
    colorPrimary: "#4ca973",
    colorForeground: "#f2f5f7",
    colorMutedForeground: "#98a1ae",
    colorDanger: "#d45454",
    colorBackground: "#0a0d14",
    colorInput: "#12161f",
    colorInputForeground: "#f2f5f7",
    colorNeutral: "#383f4d",
    fontFamily: "'Fira Sans', sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "!bg-transparent rounded-lg w-full max-w-full overflow-hidden !shadow-none !border-0",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!hidden",
    header: "!hidden",
    headerTitle: "text-[#f2f5f7] font-bold font-mono",
    headerSubtitle: "text-[#98a1ae]",
    socialButtonsBlockButtonText: "text-[#f2f5f7] font-semibold",
    formFieldLabel: "text-[#f2f5f7] font-semibold",
    footerActionLink: "text-[#4ca973] hover:text-[#70c296] font-semibold",
    footerActionText: "text-[#98a1ae]",
    dividerText: "text-[#98a1ae]",
    identityPreviewEditButton: "text-[#4ca973]",
    formFieldSuccessText: "text-[#4ca973]",
    alertText: "text-[#f2f5f7]",
    logoBox: "!hidden",
    logoImage: "h-11 w-11 rounded-lg",
    socialButtonsBlockButton: "!border-[#383f4d] hover:!border-[#4ca973]/50 !bg-[#12161f] !rounded-lg",
    formButtonPrimary: "!bg-[#4ca973] !text-[#06120b] hover:!bg-[#70c296] font-bold !rounded-lg",
    formFieldInput: "!bg-[#12161f] !border-[#383f4d] !text-[#f2f5f7] focus:!border-[#4ca973] !rounded-lg",
    footerAction: "!bg-[#0a0d14]",
    dividerLine: "!bg-[#383f4d]",
    alert: "!bg-[#1f0d12] !border-[#d45454]/35 !rounded-lg",
    otpCodeFieldInput: "!bg-[#12161f] !border-[#383f4d] !text-[#f2f5f7] focus:!border-[#4ca973] !rounded-lg",
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
        fallbackRedirectUrl={`${basePath}/`}
      />
    </AuthPageShell>
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
          <Route path="/brain" component={Brain} />
          <Route path="/wiki" component={Wiki} />
          <Route path="/zen" component={Zen} />
          <Route path="/milestones" component={Milestones} />
          <Route path="/library" component={Library} />
          <Route path="/routine" component={Routine} />
          <Route path="/missions" component={Missions} />
          <Route path="/clock" component={Clock} />
          <Route path="/calendar" component={Calendar} />
          <Route path="/broker" component={Broker} />
          <Route path="/pro" component={ProPage} />
          <Route path="/billing/return" component={BillingReturn} />
          <Route path="/settings" component={Settings} />
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

function AppShell() {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return <div className="min-h-screen bg-[hsl(224,71%,4%)]" />;
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

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey!}
      proxyUrl={clerkProxyUrl}
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
          <Route path="/*?" component={AppShell} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
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
