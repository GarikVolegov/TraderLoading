// Aggregate of every language dictionary in the legacy `DICT` shape.
// FOR TESTS AND BUILD TOOLS ONLY — importing this from app code would put all
// five languages back into the eager bundle (the exact problem loadDict solves).
import type { Language } from "../i18n";
import it from "./dict.it";
import en from "./dict.en";
import es from "./dict.es";
import fr from "./dict.fr";
import de from "./dict.de";

export const DICT: Record<Language, Record<string, string>> = { it, en, es, fr, de };
