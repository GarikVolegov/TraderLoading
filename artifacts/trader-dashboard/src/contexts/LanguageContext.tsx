import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { it, enUS, es, fr, de } from "date-fns/locale";
import type { Locale } from "date-fns";
import { detectLanguageFromLocales, DICT, type Language } from "@/lib/i18n";
import { getLanguageFromPath } from "@/lib/seo";

export type { Language };

export const LANGUAGES: Record<Language, { name: string; flag: string; label: string }> = {
  it: { name: "Italiano", flag: "🇮🇹", label: "IT" },
  en: { name: "English", flag: "🇬🇧", label: "EN" },
  es: { name: "Español", flag: "🇪🇸", label: "ES" },
  fr: { name: "Français", flag: "🇫🇷", label: "FR" },
  de: { name: "Deutsch", flag: "🇩🇪", label: "DE" },
};

const DATE_FNS_LOCALES: Record<Language, Locale> = {
  it,
  en: enUS,
  es,
  fr,
  de,
};

const STORAGE_KEY = "tl_language";

// `import.meta.env` only exists under Vite; guard so module eval doesn't throw
// in the plain-node static test runner.
const ROUTER_BASE = (import.meta.env?.BASE_URL ?? "/").replace(/\/$/, "");

interface LanguageContextValue {
  language: Language;
  /**
   * Update the active language. Persists to localStorage by default; pass
   * `persist: false` when the language is driven by the URL prefix (e.g. a
   * /{lang} marketing route) so it doesn't overwrite the user's saved choice.
   */
  setLanguage: (lang: Language, persist?: boolean) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLanguage(): Language {
  // A /{lang} URL prefix wins, so deep-linked and prerendered marketing pages
  // render in the right language with no flash.
  const fromPath = getLanguageFromPath(window.location.pathname, ROUTER_BASE);
  if (fromPath) return fromPath;

  const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
  if (stored && stored in LANGUAGES) return stored;

  const browserLocales = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
  ];

  return detectLanguageFromLocales(browserLocales) ?? "it";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLangState] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language, persist = true) => {
    if (persist) localStorage.setItem(STORAGE_KEY, lang);
    setLangState(lang);
  };

  const t = (key: string, vars?: Record<string, string | number>): string => {
    let str = DICT[language]?.[key] ?? DICT["it"]?.[key] ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replaceAll(`{${k}}`, String(v));
      });
    }
    return str;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be inside LanguageProvider");
  return ctx;
}

export function useDateLocale(): Locale {
  const { language } = useLanguage();
  return DATE_FNS_LOCALES[language];
}

export function uiText(key: string, vars?: Record<string, string | number>): string {
  const language = detectLanguageFromLocales([document.documentElement.lang, localStorage.getItem(STORAGE_KEY)]) ?? "it";
  let str = DICT[language]?.[key] ?? DICT.it?.[key] ?? key;
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
