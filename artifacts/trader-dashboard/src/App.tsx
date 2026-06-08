import { lazy, Suspense, useEffect, useRef } from "react";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
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
import { WelcomeNotification } from "./components/WelcomeNotification";
import { GoalReminders } from "./components/GoalReminders";
import { DailyAlarmNotifier } from "./components/DailyAlarmNotifier";
import { MacroNotifier } from "./components/MacroNotifier";
import { SessionStartNotifier } from "./components/SessionStartNotifier";
import { SessionCheckinModal } from "./components/SessionCheckinModal";
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
const Tools = lazy(() => import("./pages/Tools"));
const Brain = lazy(() => import("./pages/Brain"));
const Zen = lazy(() => import("./pages/Zen"));
const Milestones = lazy(() => import("./pages/Milestones"));
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
    colorPrimary: "#00cc66",
    colorForeground: "#d8e3f0",
    colorMutedForeground: "#7d90a7",
    colorDanger: "#f03838",
    colorBackground: "#090f1f",
    colorInput: "#1d2d44",
    colorInputForeground: "#d8e3f0",
    colorNeutral: "#1d2d44",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "!bg-[#07111f] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl shadow-black/60 border border-[#1d2d44]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#d8e3f0] font-bold",
    headerSubtitle: "text-[#7d90a7]",
    socialButtonsBlockButtonText: "text-[#d8e3f0] font-medium",
    formFieldLabel: "text-[#d8e3f0]",
    footerActionLink: "text-[#00cc66] hover:text-[#00e673]",
    footerActionText: "text-[#7d90a7]",
    dividerText: "text-[#7d90a7]",
    identityPreviewEditButton: "text-[#00cc66]",
    formFieldSuccessText: "text-[#00cc66]",
    alertText: "text-[#d8e3f0]",
    logoBox: "flex justify-center",
    logoImage: "h-12 w-12",
    socialButtonsBlockButton: "!border-[#1d2d44] hover:!border-[#00cc66]/40 !bg-[#0d1527]",
    formButtonPrimary: "!bg-[#00cc66] !text-[#031a0d] hover:!bg-[#00e673] font-semibold",
    formFieldInput: "!bg-[#0d1527] !border-[#1d2d44] !text-[#d8e3f0] focus:!border-[#00cc66]",
    footerAction: "!bg-[#060e1a]",
    dividerLine: "!bg-[#1d2d44]",
    alert: "!bg-[#1a0d0d] !border-[#f03838]/30",
    otpCodeFieldInput: "!bg-[#0d1527] !border-[#1d2d44] !text-[#d8e3f0]",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as const }}
      className="flex min-h-[100dvh] items-center justify-center bg-[hsl(224,71%,4%)] px-4"
    >
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={`${basePath}/`}
      />
    </motion.div>
  );
}

function SignUpPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as const }}
      className="flex min-h-[100dvh] items-center justify-center bg-[hsl(224,71%,4%)] px-4"
    >
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/`}
      />
    </motion.div>
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

  return (
    <AnimatePresence mode="sync" initial={false}>
      <motion.div key={location} {...pageTransition}>
        <Suspense fallback={<PageFallback />}>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/journal" component={Journal} />
            <Route path="/checklist" component={Checklist} />
            <Route path="/news" component={News} />
            <Route path="/chat" component={Chat} />
            <Route path="/backtest" component={Backtest} />
            <Route path="/tools" component={Tools} />
            <Route path="/brain" component={Brain} />
            <Route path="/zen" component={Zen} />
            <Route path="/milestones" component={Milestones} />
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
    </AnimatePresence>
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
