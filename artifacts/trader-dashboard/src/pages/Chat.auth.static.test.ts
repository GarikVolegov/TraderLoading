import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Chat must authenticate via Clerk like the rest of the app: the legacy
// replit-auth-web shim did a redundant /api/auth/user fetch and its login CTA
// pointed at the dead OIDC /api/login (503 in production).
const chat = readFileSync(
  fileURLToPath(new URL("./Chat.tsx", import.meta.url)),
  "utf8",
);

assert.match(chat, /from "@clerk\/react"/);
assert.match(chat, /useUser\(\)/);
assert.doesNotMatch(chat, /from "@workspace\/replit-auth-web"/);
assert.doesNotMatch(chat, /\/api\/login/);

console.log("chat auth static checks passed");
