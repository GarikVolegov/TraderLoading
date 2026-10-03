import DICT_IT from "./i18n/dict.it";

export type Language = "it" | "en" | "es" | "fr" | "de";

export const SUPPORTED_LANGUAGES = ["it", "en", "es", "fr", "de"] as const;

export function normalizeLocaleToLanguage(locale: string | null | undefined): Language | null {
  const languageCode = locale?.trim().split(/[-_]/)[0]?.toLowerCase();
  return SUPPORTED_LANGUAGES.includes(languageCode as Language)
    ? (languageCode as Language)
    : null;
}

export function detectLanguageFromLocales(
  locales: readonly (string | null | undefined)[],
): Language | null {
  for (const locale of locales) {
    const language = normalizeLocaleToLanguage(locale);
    if (language) return language;
  }
  return null;
}

/** Italian dictionary — default language and the `t()` fallback; the only one in the eager bundle. */
export const FALLBACK_DICT: Record<string, string> = DICT_IT;

export type TranslationKey = keyof typeof DICT_IT;

const DICT_LOADERS: Record<Language, () => Promise<{ default: Record<string, string> }>> = {
  it: () => Promise.resolve({ default: DICT_IT }),
  en: () => import("./i18n/dict.en"),
  es: () => import("./i18n/dict.es"),
  fr: () => import("./i18n/dict.fr"),
  de: () => import("./i18n/dict.de"),
};

/** Load a language's dictionary; non-Italian languages arrive as lazy chunks. */
export async function loadDict(lang: Language): Promise<Record<string, string>> {
  return (await DICT_LOADERS[lang]()).default;
}
