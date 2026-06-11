// Starts only the API server (:3001) with the same env bootstrap used by
// start.ts, without touching the frontend dev server. Useful to reload the
// API after backend changes: tsx does not watch files, so a restart is the
// only way to pick up new code.
import { loadEnvLocal } from "./lib/env.js";
import { buildApiDevEnv } from "./startEnv.js";
import { resolveDatabaseTarget } from "./startDatabase.js";
import { checkTcp } from "./lib/health.js";

(async () => {
  loadEnvLocal();
  const rawUrl = process.env.LOCAL_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL missing");
  const database = resolveDatabaseTarget(rawUrl, {
    localDefaultPortOccupied: await checkTcp("127.0.0.1", 5432),
    managedPort: Number(process.env.LOCAL_POSTGRES_PORT ?? "55432"),
  });
  Object.assign(process.env, buildApiDevEnv(process.env, database.url));
  const apiEntryUrl = new URL("../../artifacts/api-server/src/index.ts", import.meta.url);
  await import(apiEntryUrl.href);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
