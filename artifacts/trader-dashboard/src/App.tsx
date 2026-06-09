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
import { ScheduledCallRuntime } from "./components/ScheduledCallRuntime";
import { LevelRewardModal } from "./components/LevelRewardModal";
import { PinLockScreen } from "./components/PinLockScreen";
import { ChecklistSetupModal } from "./components/ChecklistSetupModal";
import { PairOnboardingWrapper } from "./components/PairOnboardingWrapper";
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
const Zen = lazy(() => import("./pages/Zen"));
const Milestones = lazy(() => import("./pages/Milestones"));
const Library = lazy(() => import("./pages/Library"));
const Routine = lazy(() => import("./pages/Routine"));
const Missions = lazy(() => import("./pages/Missions"));
const Clock = lazy(() => import("./pages/Clock"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Broker = lazy(() => import("./pages/Broker"));
const NotFound = lazy(() => import("./pages/not-found"));
const LandingPage = lazy(() => import("./pages/LandingPage"));

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
    colorPrimary: "#22c55e",
    colorForeground: "#f8fafc",
    colorMutedForeground: "#94a3b8",
    colorDanger: "#ef4444",
    colorBackground: "#07111f",
    colorInput: "#0d1527",
    colorInputForeground: "#f8fafc",
    colorNeutral: "#334155",
    fontFamily: "'Fira Sans', sans-serif",
    borderRadius: "0.5rem",
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
    footerActionLink: "text-[#22c55e] hover:text-[#4ade80] font-semibold",
    footerActionText: "text-[#94a3b8]",
    dividerText: "text-[#94a3b8]",
    identityPreviewEditButton: "text-[#22c55e]",
    formFieldSuccessText: "text-[#22c55e]",
    alertText: "text-[#f8fafc]",
    logoBox: "!hidden",
    logoImage: "h-11 w-11 rounded-lg",
    socialButtonsBlockButton: "!border-[#334155] hover:!border-[#22c55e]/50 !bg-[#0d1527] !rounded-lg",
    formButtonPrimary: "!bg-[#22c55e] !text-[#031a0d] hover:!bg-[#4ade80] font-bold !rounded-lg",
    formFieldInput: "!bg-[#0d1527] !border-[#334155] !text-[#f8fafc] focus:!border-[#22c55e] !rounded-lg",
    footerAction: "!bg-[#06101d]",
    dividerLine: "!bg-[#334155]",
    alert: "!bg-[#1f0d12] !border-[#ef4444]/35 !rounded-lg",
    otpCodeFieldInput: "!bg-[#0d1527] !border-[#334155] !text-[#f8fafc] focus:!border-[#22c55e] !rounded-lg",
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
          <Route path="/zen" component={Zen} />
          <Route path="/milestones" component={Milestones} />
          <Route path="/library" component={Library} />
          <Route path="/routine" component={Routine} />
          <Route path="/missions" component={Missions} />
          <Route path="/clock" component={Clock} />
          <Route path="/calendar" component={Calendar} />
          <Route path="/broker" component={Broker} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </motion.div>
  );
}

function AuthenticatedShell() {
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
      <SessionCheckinModal />
      <LevelRewardModal />
      <CommandPalette />

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
