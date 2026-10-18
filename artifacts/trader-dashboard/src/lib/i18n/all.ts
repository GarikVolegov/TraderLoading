// Aggregate of every language dictionary in the legacy `DICT` shape.
// FOR TESTS AND BUILD TOOLS ONLY — importing this from app code would put all
// five languages back into the eager bundle (the exact problem loadDict solves).
import type { Language } from "../i18n";
import it from "./dict.it";
import en from "./dict.en";
import es from "./dict.es";
import fr from "./dict.fr";
import de from "./dict.de";
import { reorganizationDictionary } from "./reorganization";

export const DICT: Record<Language, Record<string, string>> = Object.fromEntries(Object.entries({ it, en, es, fr, de }).map(([lang, dict]) => [lang, { ...dict, ...reorganizationDictionary(lang as Language) }])) as Record<Language, Record<string, string>>;
