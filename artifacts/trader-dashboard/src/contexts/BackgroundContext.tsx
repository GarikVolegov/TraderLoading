import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import {
  useGetUserSettings,
  type TradingSessionConfig,
} from "@workspace/api-client-react";
import { getCurrenciesFromPairs } from "@workspace/pair-catalog";
import { normalizeLocalSessionTime } from "@/lib/marketSessions";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  type BackgroundPreset,
  type BackgroundDevice,
  pickActiveBackgroundUrl,
  resolveDeviceCatalog,
  loadCustomBackgrounds,
  saveCustomBackgrounds,
  migrateLegacyCustomBackgrounds,
  canAddCustom,
  DEFAULT_BACKGROUNDS_DESKTOP,
} from "@/lib/backgroundCatalog";

export type { BackgroundPreset };
export type { TradingSessionConfig };

const CALENDAR_CURRENCY_LIST = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "AUD",
  "CAD",
  "CHF",
  "NZD",
  "CNY",
];

const FONT_MAP: Record<string, string> = {
  inter: "'Inter', sans-serif",
  jetbrains: "'JetBrains Mono', monospace",
  roboto: "'Roboto', sans-serif",
  "space-grotesk": "'Space Grotesk', monospace",
  "ibm-plex": "'IBM Plex Sans', sans-serif",
};

export const DEFAULT_TRADING_SESSIONS: TradingSessionConfig[] = [
  {
    id: "asian",
    name: "Asiatica",
    openUTC: "00:00",
    closeUTC: "08:00",
    color: "session-asian",
    kind: "trading",
    enabled: true,
  },
  {
    id: "london",
    name: "Londinese",
    openUTC: "08:00",
    closeUTC: "14:30",
    color: "session-london",
    kind: "trading",
    enabled: true,
  },
  {
    id: "ny",
    name: "New York",
    openUTC: "14:30",
    closeUTC: "21:00",
    color: "session-ny",
    kind: "trading",
    enabled: true,
  },
  {
    id: "volume",
    name: "Conferma Vol.",
    openUTC: "21:00",
    closeUTC: "23:00",
    color: "session-volume",
    kind: "trading",
    enabled: true,
  },
];

export const DEFAULT_LOT_DIVISOR = 11;

interface BackgroundContextValue {
  activeBackgroundUrl: string | null;
  device: BackgroundDevice;
  backgroundUrlDesktop: string | null;
  backgroundUrlMobile: string | null;
  setActiveBackgroundForDevice: (url: string | null) => void;
  darkness: number;
  setDarkness: (d: number) => void;
  fontChoice: string;
  setFontChoice: (f: string) => void;
  tradingSessions: TradingSessionConfig[];
  setTradingSessions: (s: TradingSessionConfig[]) => void;
  lotDivisor: number;
  setLotDivisor: (d: number) => void;
  calendarCurrencies: string[];
  setCalendarCurrencies: (c: string[]) => void;
  calendarImpacts: string[];
  setCalendarImpacts: (i: string[]) => void;
  backgroundPresets: BackgroundPreset[];
  customBackgrounds: BackgroundPreset[];
  setCustomBackgrounds: (list: BackgroundPreset[]) => void;
  canAddCustomBackground: boolean;
  selectedPairs: string[];
  setSelectedPairs: (p: string[]) => void;
  selectedCurrencies: string[];
  settingsLoaded: boolean;
}

const BackgroundCtx = createContext<BackgroundContextValue>({
  activeBackgroundUrl: null,
  device: "desktop",
  backgroundUrlDesktop: null,
  backgroundUrlMobile: null,
  setActiveBackgroundForDevice: () => {},
  darkness: 60,
  setDarkness: () => {},
  fontChoice: "inter",
  setFontChoice: () => {},
  tradingSessions: DEFAULT_TRADING_SESSIONS,
  setTradingSessions: () => {},
  lotDivisor: DEFAULT_LOT_DIVISOR,
  setLotDivisor: () => {},
  calendarCurrencies: ["USD"],
  setCalendarCurrencies: () => {},
  calendarImpacts: ["High"],
  setCalendarImpacts: () => {},
  backgroundPresets: DEFAULT_BACKGROUNDS_DESKTOP,
  customBackgrounds: [],
  setCustomBackgrounds: () => {},
  canAddCustomBackground: true,
  selectedPairs: [],
  setSelectedPairs: () => {},
  selectedCurrencies: [],
  settingsLoaded: false,
});

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const device: BackgroundDevice = isMobile ? "mobile" : "desktop";
  const [backgroundUrlDesktop, setBackgroundUrlDesktop] = useState<string | null>(null);
  const [backgroundUrlMobile, setBackgroundUrlMobile] = useState<string | null>(null);
  const [customBackgrounds, setCustomBackgroundsState] = useState<BackgroundPreset[]>([]);

  useEffect(() => {
    migrateLegacyCustomBackgrounds();
    setCustomBackgroundsState([
      ...loadCustomBackgrounds("desktop"),
      ...loadCustomBackgrounds("mobile"),
    ]);
  }, []);

  const setCustomBackgrounds = useCallback((list: BackgroundPreset[]) => {
    saveCustomBackgrounds("desktop", list.filter((p) => p.device === "desktop"));
    saveCustomBackgrounds("mobile", list.filter((p) => p.device === "mobile"));
    setCustomBackgroundsState(list);
  }, []);

  const activeBackgroundUrl = pickActiveBackgroundUrl({ isMobile, desktopUrl: backgroundUrlDesktop, mobileUrl: backgroundUrlMobile });
  const backgroundPresets = resolveDeviceCatalog(device, customBackgrounds);
  const canAddCustomBackground = canAddCustom(device, customBackgrounds);

  const setActiveBackgroundForDevice = useCallback((url: string | null) => {
    if (isMobile) setBackgroundUrlMobile(url);
    else setBackgroundUrlDesktop(url);
  }, [isMobile]);

  const [darkness, setDarkness] = useState(60);
  const [fontChoice, setFontChoice] = useState("inter");
  const [tradingSessions, setTradingSessions] = useState<
    TradingSessionConfig[]
  >(DEFAULT_TRADING_SESSIONS);
  const [lotDivisor, setLotDivisor] = useState(DEFAULT_LOT_DIVISOR);
  const [calendarCurrencies, setCalendarCurrencies] = useState<string[]>([
    "USD",
  ]);
  const [calendarImpacts, setCalendarImpacts] = useState<string[]>(["High"]);
  const [selectedPairs, setSelectedPairsRaw] = useState<string[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const { data: settings } = useGetUserSettings();

  const selectedCurrencies = useMemo(
    () => getCurrenciesFromPairs(selectedPairs),
    [selectedPairs],
  );

  const syncCalendarFromPairs = useCallback((pairs: string[]) => {
    const currencies = getCurrenciesFromPairs(pairs);
    const derived = currencies.filter((c) =>
      CALENDAR_CURRENCY_LIST.includes(c),
    );
    if (derived.length > 0) setCalendarCurrencies(derived);
  }, []);

  const setSelectedPairs = useCallback(
    (pairs: string[]) => {
      setSelectedPairsRaw(pairs);
      syncCalendarFromPairs(pairs);
    },
    [syncCalendarFromPairs],
  );

  useEffect(() => {
    setBackgroundUrlDesktop(settings?.backgroundUrlDesktop ?? null);
    setBackgroundUrlMobile(settings?.backgroundUrlMobile ?? null);
    if (settings?.backgroundDarkness !== undefined) {
      setDarkness(settings.backgroundDarkness as number);
    }
    if (settings?.fontChoice) {
      setFontChoice(settings.fontChoice as string);
    }
    if (settings?.tradingSessions && Array.isArray(settings.tradingSessions)) {
      const nextSessions = settings.tradingSessions.map((session) => ({
        ...session,
        openUTC: normalizeLocalSessionTime(session.openUTC),
        closeUTC: normalizeLocalSessionTime(session.closeUTC),
      }));
      setTradingSessions(nextSessions);
    }
    if (settings?.lotDivisor !== undefined) {
      setLotDivisor(settings.lotDivisor);
    }
    if (settings?.calendarImpacts && Array.isArray(settings.calendarImpacts)) {
      setCalendarImpacts(settings.calendarImpacts);
    }
    if (settings?.selectedPairs && Array.isArray(settings.selectedPairs)) {
      const pairs = settings.selectedPairs as string[];
      setSelectedPairsRaw(pairs);
      syncCalendarFromPairs(pairs);
    } else if (
      settings?.calendarCurrencies &&
      Array.isArray(settings.calendarCurrencies)
    ) {
      setCalendarCurrencies(settings.calendarCurrencies);
    }
    if (settings) {
      setSettingsLoaded(true);
    }
  }, [settings, syncCalendarFromPairs]);

  useEffect(() => {
    const family = FONT_MAP[fontChoice] || FONT_MAP.inter;
    document.documentElement.style.setProperty("--font-sans", family);
    document.body.style.fontFamily = family;
  }, [fontChoice]);

  return (
    <BackgroundCtx.Provider
      value={{
        activeBackgroundUrl,
        device,
        backgroundUrlDesktop,
        backgroundUrlMobile,
        setActiveBackgroundForDevice,
        darkness,
        setDarkness,
        fontChoice,
        setFontChoice,
        tradingSessions,
        setTradingSessions,
        lotDivisor,
        setLotDivisor,
        calendarCurrencies,
        setCalendarCurrencies,
        calendarImpacts,
        setCalendarImpacts,
        backgroundPresets,
        customBackgrounds,
        setCustomBackgrounds,
        canAddCustomBackground,
        selectedPairs,
        setSelectedPairs,
        selectedCurrencies,
        settingsLoaded,
      }}
    >
      {children}
    </BackgroundCtx.Provider>
  );
}

export function useBackground() {
  return useContext(BackgroundCtx);
}
