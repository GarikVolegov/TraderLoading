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
  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  const config: PoolConfig = {
    connectionString,
    max: parsePositiveInteger(env.PGPOOL_MAX, 10),
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
