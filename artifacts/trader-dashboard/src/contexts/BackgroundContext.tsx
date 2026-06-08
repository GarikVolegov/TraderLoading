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
import { reportClientError } from "@/lib/clientErrorReporter";

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
const BACKGROUND_PRESETS_STORAGE_KEY = "tl_background_presets";

export type { TradingSessionConfig };

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

export interface BackgroundPreset {
  id: string;
  name: string;
  url: string;
  isDefault: boolean;
}

export const DEFAULT_BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: "burj-khalifa",
    name: "Burj Khalifa",
    url: "/images/IMG_1796_1773606839183.jpeg",
    isDefault: true,
  },
  {
    id: "gold-liquid",
    name: "Gold Liquid",
    url: "/images/IMG_1794_1773606839183.jpeg",
    isDefault: true,
  },
  {
    id: "wall-street",
    name: "Wall Street",
    url: "/images/IMG_1795_1773606839183.jpeg",
    isDefault: true,
  },
  {
    id: "nyc-rain",
    name: "NYC Rain",
    url: "/images/IMG_1804_1773606839183.jpeg",
    isDefault: true,
  },
  {
    id: "forest",
    name: "Forest",
    url: "/images/IMG_1805_1773606839183.jpeg",
    isDefault: true,
  },
];

function loadBackgroundPresets(): BackgroundPreset[] {
  try {
    const raw = localStorage.getItem(BACKGROUND_PRESETS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return parsed as BackgroundPreset[];
  } catch (error) {
    reportClientError(error, {
      context: "background presets load",
      notify: false,
    });
  }
  return DEFAULT_BACKGROUND_PRESETS;
}

export function saveBackgroundPresets(presets: BackgroundPreset[]) {
  localStorage.setItem(BACKGROUND_PRESETS_STORAGE_KEY, JSON.stringify(presets));
}

interface BackgroundContextValue {
  backgroundUrl: string | null;
  setBackgroundUrl: (url: string | null) => void;
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
  setBackgroundPresets: (p: BackgroundPreset[]) => void;
  selectedPairs: string[];
  setSelectedPairs: (p: string[]) => void;
  selectedCurrencies: string[];
  settingsLoaded: boolean;
}

const BackgroundCtx = createContext<BackgroundContextValue>({
  backgroundUrl: null,
  setBackgroundUrl: () => {},
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
  backgroundPresets: DEFAULT_BACKGROUND_PRESETS,
  setBackgroundPresets: () => {},
  selectedPairs: [],
  setSelectedPairs: () => {},
  selectedCurrencies: [],
  settingsLoaded: false,
});

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
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
  const [backgroundPresets, setBackgroundPresetsState] = useState<
    BackgroundPreset[]
  >(loadBackgroundPresets);
  const setBackgroundPresets = useCallback((presets: BackgroundPreset[]) => {
    saveBackgroundPresets(presets);
    setBackgroundPresetsState(presets);
  }, []);
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
    if (settings?.backgroundType === "custom" && settings.backgroundUrl) {
      setBackgroundUrl(settings.backgroundUrl);
    } else {
      setBackgroundUrl(null);
    }
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
    if (
      settings?.backgroundPresets &&
      Array.isArray(settings.backgroundPresets)
    ) {
      setBackgroundPresets(settings.backgroundPresets);
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
        backgroundUrl,
        setBackgroundUrl,
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
        setBackgroundPresets,
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
