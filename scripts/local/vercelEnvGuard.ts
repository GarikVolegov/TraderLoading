import path from "node:path";
import { fileURLToPath } from "node:url";

export type ProductionDatabaseUrlValidation =
  | { ok: true; host: string }
  | { ok: false; reason: "missing" | "invalid" | "loopback"; host: string | null };

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

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  assertProductionDatabaseUrl();
}
