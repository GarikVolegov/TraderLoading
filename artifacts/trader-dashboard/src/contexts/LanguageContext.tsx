import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { it } from "date-fns/locale/it";
import type { Locale } from "date-fns";
import { detectLanguageFromLocales, FALLBACK_DICT, loadDict, type Language } from "@/lib/i18n";
import { getLanguageFromPath } from "@/lib/seo";

export type { Language };

export const LANGUAGES: Record<Language, { name: string; flag: string; label: string }> = {
  it: { name: "Italiano", flag: "🇮🇹", label: "IT" },
  en: { name: "English", flag: "🇬🇧", label: "EN" },
  es: { name: "Español", flag: "🇪🇸", label: "ES" },
  fr: { name: "Français", flag: "🇫🇷", label: "FR" },
  de: { name: "Deutsch", flag: "🇩🇪", label: "DE" },
};

const DATE_FNS_LOCALE_CACHE: Partial<Record<Language, Locale>> = {
  it,
};

const DATE_FNS_LOCALE_LOADERS: Record<Language, () => Promise<Locale>> = {
  it: () => Promise.resolve(it),
  en: () => import("date-fns/locale/en-US").then((m) => m.enUS),
  es: () => import("date-fns/locale/es").then((m) => m.es),
  fr: () => import("date-fns/locale/fr").then((m) => m.fr),
  de: () => import("date-fns/locale/de").then((m) => m.de),
};

const STORAGE_KEY = "tl_language";

/**
 * Read the user's explicitly persisted language preference, if any.
 * Returns null when the user has never explicitly picked a language or reset to auto.
 */
export function getStoredLanguagePreference(): Language | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
    return stored && stored in LANGUAGES ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Whether this device has an explicit, persisted language choice. Used by the
 * server-sync logic to tell "user picked this" apart from "browser default".
 */
export function hasStoredLanguagePreference(): boolean {
  return getStoredLanguagePreference() != null;
}

export function getBrowserLanguage(): Language {
  const browserLocales = [
    ...(typeof navigator !== "undefined" && Array.isArray(navigator.languages) ? navigator.languages : []),
    typeof navigator !== "undefined" ? navigator.language : undefined,
  ];
  return detectLanguageFromLocales(browserLocales) ?? "it";
}

export function resetToBrowserLanguage(): Language {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage might be restricted
  }
  return getBrowserLanguage();
}

// `import.meta.env` only exists under Vite; guard so module eval doesn't throw
// in the plain-node static test runner.
const ROUTER_BASE = (import.meta.env?.BASE_URL ?? "/").replace(/\/$/, "");

// Module-level dict reference used by uiText() (synchronous, outside React).
// Starts as Italian (FALLBACK_DICT) and is updated by LanguageProvider when a
// non-Italian dict finishes loading.
let _activeDict: Record<string, string> = FALLBACK_DICT;

interface LanguageContextValue {
  language: Language;
  isAutoDetected: boolean;
  /**
   * Update the active language. Persists to localStorage by default; pass
   * `persist: false` when the language is driven by the URL prefix (e.g. a
   * /{lang} marketing route) so it doesn't overwrite the user's saved choice.
   */
  setLanguage: (lang: Language, persist?: boolean) => void;
  resetToBrowserLanguage: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  dateLocale: Locale;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLanguage(): Language {
  // A /{lang} URL prefix wins, so deep-linked and prerendered marketing pages
  // render in the right language with no flash.
  const fromPath = getLanguageFromPath(window.location.pathname, ROUTER_BASE);
  if (fromPath) return fromPath;

  const stored = getStoredLanguagePreference();
  if (stored) return stored;

  const browserLocales = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
  ];

  return detectLanguageFromLocales(browserLocales) ?? "it";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLangState] = useState<Language>(getInitialLanguage);
  const [isAutoDetected, setIsAutoDetected] = useState<boolean>(() => !hasStoredLanguagePreference());
  // Italian is bundled eagerly (fallback); other languages swap in as soon as
  // their lazy chunk arrives (~30 kB gzip — one round-trip on cold load).
  const [dict, setDict] = useState<Record<string, string>>(FALLBACK_DICT);
  const [dateLocale, setDateLocale] = useState<Locale>(() => DATE_FNS_LOCALE_CACHE[language] ?? it);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    let alive = true;
    loadDict(language)
      .then((d) => {
        if (alive) {
          setDict(d);
          _activeDict = d;
        }
      })
      .catch(() => {
        // Chunk fetch can fail on flaky networks or across a redeploy; the UI
        // already degrades to FALLBACK_DICT, so just avoid an unhandled rejection.
      });

    const cachedLocale = DATE_FNS_LOCALE_CACHE[language];
    if (cachedLocale) {
      setDateLocale(cachedLocale);
    } else {
      DATE_FNS_LOCALE_LOADERS[language]()
        .then((loadedLocale) => {
          DATE_FNS_LOCALE_CACHE[language] = loadedLocale;
          if (alive) {
            setDateLocale(loadedLocale);
          }
        })
        .catch(() => {});
    }

    return () => {
      alive = false;
    };
  }, [language]);

  // Dynamically follow browser language changes if not explicitly overridden by user
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleBrowserLanguageChange = () => {
      if (!hasStoredLanguagePreference()) {
        const nextLang = getBrowserLanguage();
        setLangState(nextLang);
        setIsAutoDetected(true);
      }
    };
    window.addEventListener("languagechange", handleBrowserLanguageChange);
    return () => window.removeEventListener("languagechange", handleBrowserLanguageChange);
  }, []);

  const setLanguage = useCallback((lang: Language, persist = true) => {
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, lang);
        setIsAutoDetected(false);
      } catch {
        // localStorage might be restricted
      }
    }
    setLangState(lang);
  }, []);

  const handleResetToBrowserLanguage = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setIsAutoDetected(true);
    } catch {
      // localStorage might be restricted
    }
    const browserLang = getBrowserLanguage();
    setLangState(browserLang);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      let str = dict[key] ?? FALLBACK_DICT[key] ?? key;
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          str = str.replaceAll(`{${k}}`, String(v));
        });
      }
      return str;
    },
    [dict],
  );

  const contextValue = useMemo(
    () => ({
      language,
      isAutoDetected,
      setLanguage,
      resetToBrowserLanguage: handleResetToBrowserLanguage,
      t,
      dateLocale,
    }),
    [language, isAutoDetected, setLanguage, handleResetToBrowserLanguage, t, dateLocale],
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

const DEFAULT_LANGUAGE_FALLBACK: LanguageContextValue = {
  language: "it",
  isAutoDetected: false,
  setLanguage: () => {},
  resetToBrowserLanguage: () => {},
  t: (key: string, vars?: Record<string, string | number>) => uiText(key, vars),
  dateLocale: it,
};

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return DEFAULT_LANGUAGE_FALLBACK;
  }
  return ctx;
}

export function useDateLocale(): Locale {
  const ctx = useContext(LanguageContext);
  return ctx?.dateLocale ?? it;
}

export function uiText(key: string, vars?: Record<string, string | number>): string {
  let str = _activeDict[key] ?? FALLBACK_DICT[key] ?? key;
  if (vars) {
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replaceAll(`{${k}}`, String(v));
    });
  }
  return str;
}

export function I18nText({ k, vars }: { k: string; vars?: Record<string, string | number> }) {
  const { t } = useLanguage();
  return <>{t(k, vars)}</>;
}
