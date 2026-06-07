import { createContext, useContext, useState, type ReactNode } from "react";
import { it, enUS, es, fr, de } from "date-fns/locale";
import type { Locale } from "date-fns";
import { DICT, type Language } from "@/lib/i18n";

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

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLangState] = useState<Language>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
    return stored && stored in LANGUAGES ? stored : "it";
  });

  const setLanguage = (lang: Language) => {
    localStorage.setItem(STORAGE_KEY, lang);
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
