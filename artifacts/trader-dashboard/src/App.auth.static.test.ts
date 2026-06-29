import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("src/App.tsx", "utf8");
const shell = fs.readFileSync("src/components/AuthPageShell.tsx", "utf8");

assert.match(app, /import \{ AuthPageShell \} from "\.\/components\/AuthPageShell"/);
assert.match(app, /<AuthPageShell mode="sign-in">/);
assert.match(app, /<AuthPageShell mode="sign-up">/);
assert.match(app, /<SignIn[\s\S]*routing="path"[\s\S]*path=\{`\$\{basePath\}\/sign-in`\}/);
assert.match(app, /<SignUp[\s\S]*routing="path"[\s\S]*path=\{`\$\{basePath\}\/sign-up`\}/);
assert.match(app, /header: "!hidden"/);
assert.match(app, /logoBox: "!hidden"/);
assert.match(app, /footer: "!hidden"/);
assert.match(shell, /type AuthPageShellProps/);
assert.match(shell, /mode: "sign-in" \| "sign-up"/);
assert.match(shell, /<Rocket\b/);
assert.match(shell, /TraderLoading/);
assert.doesNotMatch(shell, /TraderLOADING|TRADERLOADING/);
assert.doesNotMatch(shell, /TRADER[\s\S]{0,120}LOADING/);
assert.match(shell, /children/);

// Segmented mode toggle: two links, one per auth route.
assert.match(shell, /href="\/sign-in"/, "shell must have a sign-in toggle link");
assert.match(shell, /href="\/sign-up"/, "shell must have a sign-up toggle link");
assert.match(shell, /auth\.toggle\.signin/, "shell must render the sign-in toggle label via t()");
assert.match(shell, /auth\.toggle\.signup/, "shell must render the sign-up toggle label via t()");

// Truthful trust rows (chat-only E2EE, read-only sync, GDPR) via i18n keys.
assert.match(shell, /auth\.shell\.trust\.e2ee\.title/);
assert.match(shell, /auth\.shell\.trust\.readonly\.title/);
assert.match(shell, /auth\.shell\.trust\.gdpr\.title/);

// Real-time rating, hidden when absent — never a hardcoded score.
assert.match(shell, /rating\?\.count|rating\.count > 0|rating && rating\.count/, "rating row must be guarded on real data");
assert.match(shell, /public\/stats/, "shell must fetch the public stats for the rating");
assert.doesNotMatch(shell, /4\.9\/5/, "no fabricated rating literal");

// Copy is i18n'd, not hardcoded marketing.
assert.match(shell, /useLanguage|t\(/, "shell copy must go through t()");

console.log("app auth shell static checks passed");
