import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./public.ts", import.meta.url), "utf8");

// `usersTable` ("users") is a Replit-Auth-era relic — nothing has written to it
// since the app moved to Clerk, so counting it always reports 0 "traders" even
// with real, active users. Real users are the ones with a `profile` row
// (created on onboarding, keyed by the Clerk userId).
assert.doesNotMatch(
  source,
  /usersTable/,
  "public stats must not read the abandoned Replit-Auth users table",
);
assert.match(
  source,
  /countDistinct\(profileTable\.userId\)/,
  "traders count must be distinct real users from the profile table",
);
assert.match(
  source,
  /isNotNull\(profileTable\.userId\)/,
  "traders count must exclude anonymous/unlinked profile rows",
);

assert.match(
  source,
  /\/public\/verify-honor\/:hash/,
  "must define public GET verify-honor route",
);
assert.match(
  source,
  /\/public\/og-honor\/:hash/,
  "must define public GET og-honor route for OpenGraph dynamic cards",
);
assert.match(
  source,
  /\/public\/verify-honor/,
  "must define public POST verify-honor route",
);
assert.match(
  source,
  /\/public\/register-honor-seal/,
  "must define public POST register-honor-seal route",
);

console.log("public stats route source checks passed");
