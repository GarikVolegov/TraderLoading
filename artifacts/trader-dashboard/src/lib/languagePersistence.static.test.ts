import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(resolve(__dirname, "../App.tsx"), "utf8");
const topNavSource = readFileSync(resolve(__dirname, "../components/TopNav.tsx"), "utf8");
const langContextSource = readFileSync(resolve(__dirname, "../contexts/LanguageContext.tsx"), "utf8");

// 1. AppShell must NEVER prematurely force English on root ("/") before auth initializes
assert.ok(
  !appSource.includes('location === "/" && !isSignedIn) return <MarketingLanding lang="en" />'),
  "AppShell must never hijack the root route with hardcoded English MarketingLanding",
);

// 2. AppShell must check !isLoaded before routing to signed-out or academy-welcome
const isLoadedIndex = appSource.indexOf("if (!isLoaded)");
const academyCheckIndex = appSource.indexOf('location === "/academy" && !isSignedIn');
assert.ok(isLoadedIndex > 0, "AppShell must guard on !isLoaded");
assert.ok(
  isLoadedIndex < academyCheckIndex,
  "!isLoaded check must occur before checking !isSignedIn to prevent FOUC / state corruption during Clerk init",
);

// 3. MarketingPage and MarketingLanding must clean up on unmount and restore user preference
assert.ok(
  appSource.includes("const preferred = getStoredLanguagePreference() ?? getBrowserLanguage();"),
  "Marketing components must restore user preferred language on unmount",
);

// 4. LanguageServerSync must use getStoredLanguagePreference and persist adopted language
assert.ok(
  appSource.includes("const storedPreference = getStoredLanguagePreference();"),
  "LanguageServerSync must read the user's explicit local stored preference",
);
assert.ok(
  appSource.includes("setLanguage(decision.language, true);"),
  "LanguageServerSync must persist the adopted server language to localStorage",
);

// 5. LanguageContext must export getStoredLanguagePreference
assert.ok(
  langContextSource.includes("export function getStoredLanguagePreference(): Language | null"),
  "LanguageContext must export getStoredLanguagePreference",
);

// 6. TopNav must offer a direct link to the language settings section
assert.ok(
  topNavSource.includes('/settings?section=lingua'),
  "TopNav profile menu must include a direct link to the language settings section",
);

console.log("language persistence and antifragile sync checks passed");
