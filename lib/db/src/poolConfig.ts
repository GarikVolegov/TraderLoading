import type { PoolConfig } from "pg";

type DbEnv = Partial<Record<string, string>>;

function parsePositiveInteger(
  raw: string | undefined,
  fallback: number,
): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function parseSslMode(raw: string | undefined): PoolConfig["ssl"] | undefined {
  if (!raw || raw === "disable") return undefined;
  if (raw === "require") return { rejectUnauthorized: true };
  if (raw === "no-verify") return { rejectUnauthorized: false };
  return undefined;
}

export function createPgPoolConfig(env: DbEnv = process.env): PoolConfig {
  let connectionString = env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  // Drizzle maps timestamp-without-time-zone values to UTC and writes explicit
  // Dates as ISO UTC. PostgreSQL's DEFAULT now() must use the same convention.
  // Keep trading-day/display rules in Europe/Rome; this only controls storage.
  // pg merges DSN parameters after config fields, so move any existing options
  // out of the URL and append UTC last to prevent a DSN timezone overriding it.
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    // Native URL errors include their input, which can contain DB credentials.
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }
  const dsnOptions = url.searchParams.getAll("options").at(-1);
  if (dsnOptions !== undefined) {
    url.searchParams.delete("options");
    connectionString = url.toString();
  }
  const statementTimeout = parsePositiveInteger(env.PG_STATEMENT_TIMEOUT_MS, 0);
  const statementOpt = statementTimeout > 0 ? `-c statement_timeout=${statementTimeout}ms` : undefined;
  const options = [dsnOptions ?? env.PGOPTIONS, statementOpt, "-c TimeZone=UTC"].filter(Boolean).join(" ");

  const config: PoolConfig = {
    connectionString,
    options,
    // Default of 20 connections per process; raise via PGPOOL_MAX. Keep the sum of
    // (max × instances) under the managed-Postgres connection cap (Neon pooler).
    max: parsePositiveInteger(env.PGPOOL_MAX, 20),
    idleTimeoutMillis: parsePositiveInteger(env.PG_IDLE_TIMEOUT_MS, 30_000),
    connectionTimeoutMillis: parsePositiveInteger(
      env.PG_CONNECTION_TIMEOUT_MS,
      5_000,
    ),
  };

  if (env.PG_ALLOW_EXIT_ON_IDLE === "true") {
    config.allowExitOnIdle = true;
  }

  const ssl = parseSslMode(env.PGSSLMODE);
  if (ssl) config.ssl = ssl;

  return config;
}
