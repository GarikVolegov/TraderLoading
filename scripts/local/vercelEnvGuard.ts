import path from "node:path";
import { fileURLToPath } from "node:url";

export type ProductionDatabaseUrlValidation =
  | { ok: true; host: string }
  | { ok: false; reason: "missing" | "invalid" | "loopback"; host: string | null };

export type ProductionSecretValidation =
  | { ok: true }
  | { ok: false; reason: "missing" | "test" | "invalid-prefix" };

export type ProductionUrlValidation =
  | { ok: true; origin: string }
  | { ok: false; reason: "missing" | "invalid" | "insecure"; origin: string | null };

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function validateProductionDatabaseUrl(value: string | undefined): ProductionDatabaseUrlValidation {
  const raw = value?.trim();
  if (!raw) return { ok: false, reason: "missing", host: null };

  try {
    const url = new URL(raw);
    if (LOOPBACK_HOSTS.has(url.hostname)) {
      return { ok: false, reason: "loopback", host: url.hostname };
    }
    return { ok: true, host: url.hostname };
  } catch {
    return { ok: false, reason: "invalid", host: null };
  }
}

export function assertProductionDatabaseUrl(value: string | undefined = process.env.DATABASE_URL) {
  const result = validateProductionDatabaseUrl(value);
  if (result.ok) {
    console.log(`Vercel DATABASE_URL points to ${result.host}`);
    return;
  }

  if (result.reason === "loopback") {
    throw new Error(
      `Vercel DATABASE_URL points to ${result.host}. Use a remote Postgres URL, for example the pooled Neon connection string.`,
    );
  }

  throw new Error(`Vercel DATABASE_URL is ${result.reason}. Set a remote Postgres connection string before deploying.`);
}

export function validateProductionKey(
  value: string | undefined,
  livePrefix: string,
  testPrefix: string,
): ProductionSecretValidation {
  const raw = value?.trim();
  if (!raw) return { ok: false, reason: "missing" };
  if (raw.startsWith(testPrefix)) return { ok: false, reason: "test" };
  if (!raw.startsWith(livePrefix)) return { ok: false, reason: "invalid-prefix" };
  return { ok: true };
}

export function validateProductionUrl(value: string | undefined): ProductionUrlValidation {
  const raw = value?.trim();
  if (!raw) return { ok: false, reason: "missing", origin: null };

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") {
      return { ok: false, reason: "insecure", origin: url.origin };
    }
    return { ok: true, origin: url.origin };
  } catch {
    return { ok: false, reason: "invalid", origin: null };
  }
}

export function assertProductionKey(
  name: string,
  value: string | undefined,
  livePrefix: string,
  testPrefix: string,
) {
  const result = validateProductionKey(value, livePrefix, testPrefix);
  if (result.ok) return;

  if (result.reason === "test") {
    throw new Error(`Vercel ${name} is a test key. Set the live production key before deploying.`);
  }

  if (result.reason === "invalid-prefix") {
    throw new Error(`Vercel ${name} does not start with ${livePrefix}. Set the live production key before deploying.`);
  }

  throw new Error(`Vercel ${name} is missing. Set it before deploying.`);
}

export function assertProductionUrl(name: string, value: string | undefined) {
  const result = validateProductionUrl(value);
  if (result.ok) {
    console.log(`Vercel ${name} points to ${result.origin}`);
    return;
  }

  if (result.reason === "insecure") {
    throw new Error(`Vercel ${name} points to ${result.origin}. Use the https production URL.`);
  }

  throw new Error(`Vercel ${name} is ${result.reason}. Set the https production URL before deploying.`);
}

export function assertVercelProductionEnv(env: NodeJS.ProcessEnv = process.env) {
  assertProductionDatabaseUrl(env.DATABASE_URL);
  assertProductionUrl("APP_BASE_URL", env.APP_BASE_URL);
  assertProductionKey("CLERK_PUBLISHABLE_KEY", env.CLERK_PUBLISHABLE_KEY, "pk_live_", "pk_test_");
  assertProductionKey("VITE_CLERK_PUBLISHABLE_KEY", env.VITE_CLERK_PUBLISHABLE_KEY, "pk_live_", "pk_test_");
  assertProductionKey("CLERK_SECRET_KEY", env.CLERK_SECRET_KEY, "sk_live_", "sk_test_");
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  assertProductionDatabaseUrl();
  if (process.env.STRICT_VERCEL_ENV_GUARD === "1") {
    assertVercelProductionEnv();
  }
}
