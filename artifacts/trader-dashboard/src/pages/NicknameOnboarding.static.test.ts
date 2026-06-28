import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync("src/pages/NicknameOnboarding.tsx", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");

// Reuses the existing profile endpoints — no new backend.
assert.match(src, /checkProfileName/, "must check nickname availability live");
assert.match(src, /useUpdateProfile/, "must save via PUT /profile");
assert.match(src, /@workspace\/api-client-react/, "must use the generated client");

// Copy via i18n.
assert.match(src, /auth\.nickname\.title/);
assert.match(src, /auth\.nickname\.skip/);

// Skippable: a skip path navigates home without forcing a save.
assert.match(src, /setLocation\("\/"\)/, "skip/continue navigates to the app home");

// Wiring: sign-up lands here; the route exists and is gated.
assert.match(app, /<SignUp[\s\S]*fallbackRedirectUrl=\{`\$\{basePath\}\/welcome`\}/, "sign-up must redirect to /welcome");
assert.match(app, /path="\/welcome"/, "the /welcome route must exist");
assert.match(app, /NicknameOnboarding/, "the /welcome route must render NicknameOnboarding");

console.log("nickname onboarding static checks passed");
