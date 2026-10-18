import assert from "node:assert/strict";
import {
  assertLocalReleaseTarget,
  assertOwnedListener,
  assertReleasedApi,
  releaseGateEnv,
} from "./releaseChecks.js";

assert.equal(
  assertOwnedListener([123, 123], "/app/artifacts/api-server", "/app/artifacts/api-server"),
  123,
);
assert.throws(() => assertOwnedListener([], "/app", "/app"));
assert.throws(() => assertOwnedListener([123, 456], "/app", "/app"));
assert.throws(() =>
  assertOwnedListener([123], "/other/artifacts/api-server", "/app/artifacts/api-server"),
);
assert.throws(() => assertOwnedListener([-1], "/app", "/app"));
assertLocalReleaseTarget("127.0.0.1", "traderloadings", "traderloadings");
assert.throws(() =>
  assertLocalReleaseTarget("production.example", "traderloadings", "traderloadings"),
);
assert.throws(() => assertLocalReleaseTarget("localhost", "new_app", "traderloadings"));
assert.throws(() => assertLocalReleaseTarget("localhost", "", ""));

const env = releaseGateEnv({
  PATH: "/bin",
  HOME: "/user",
  DATABASE_URL: "private",
  CLERK_SECRET_KEY: "private",
  SMTP_PASSWORD: "private",
  CLERK_PUBLISHABLE_KEY: "pk_test_public",
  PROCESS_AUDIT_DATABASE_URL: "private",
});
assert.deepEqual(env, {
  PATH: "/bin",
  HOME: "/user",
  VITE_CLERK_PUBLISHABLE_KEY: "pk_test_public",
  LOCAL_BACKGROUND_TASKS: "0",
});
const ready = {
  status: "ok",
  service: "api",
  version: "local-abc",
  checks: { database: { status: "ok" } },
};
assertReleasedApi(ready, "local-abc");
assert.throws(() => assertReleasedApi(ready, "local-other"));
assert.throws(() =>
  assertReleasedApi({ ...ready, checks: { database: { status: "error" } } }, "local-abc"),
);
assert.throws(() => assertReleasedApi(null, "local-abc"));
console.log(
  "Local release ownership, database identity, environment isolation and version checks passed",
);
