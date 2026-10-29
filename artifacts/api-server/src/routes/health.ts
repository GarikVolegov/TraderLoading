import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import logger from "../lib/logger";
import { getAllCircuitBreakersStats } from "../lib/circuitBreaker.js";
import { systemWatchdog, type WatchdogTelemetry } from "../lib/systemWatchdog.js";

type CheckStatus = "ok" | "error";

export interface DependencyCheckResult {
  status: CheckStatus;
  latencyMs: number;
  error?: string;
  pool?: {
    total: number;
    idle: number;
    waiting: number;
  };
}

export interface HealthRouterOptions {
  checkDatabase?: () => Promise<DependencyCheckResult>;
  /** Returns null when Redis isn't part of readiness (unconfigured single instance). */
  checkRedis?: () => Promise<DependencyCheckResult | null>;
  version?: string;
}

interface StatusResponse {
  status: "ok" | "degraded";
  service: "api";
  timestamp: string;
  uptimeSeconds: number;
  version: string;
  memoryMb?: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
  circuitBreakers?: Record<string, unknown>;
  watchdog?: WatchdogTelemetry;
  checks: {
    server: { status: "ok" };
    database: DependencyCheckResult;
    redis?: DependencyCheckResult;
  };
}

async function defaultCheckDatabase(): Promise<DependencyCheckResult> {
  const started = Date.now();
  try {
    const { pool } = await import("@workspace/db");
    await pool.query("select 1");
    return {
      status: "ok",
      latencyMs: Date.now() - started,
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
    };
  } catch (err) {
    logger.error({ err }, "Database readiness check failed");
    return {
      status: "error",
      latencyMs: Date.now() - started,
      error: "database_unavailable",
    };
  }
}

// Never leak upstream error strings (which can carry host/credentials) to an
// unauthenticated probe: collapse any failure to a fixed, generic code.
function sanitizeDependencyCheck(result: DependencyCheckResult, errorCode: string): DependencyCheckResult {
  if (result.status === "ok") return result;
  return {
    status: "error",
    latencyMs: result.latencyMs,
    error: errorCode,
  };
}

/**
 * Redis readiness. Redis is optional on a single instance (rate-limit falls back
 * to in-memory — see redisClient.assertRedisConfigured), so when REDIS_URL is
 * unset this returns null (not part of readiness) rather than failing the probe.
 * When configured, PINGs with a short timeout so a hung Redis can't hang /readyz.
 */
async function defaultCheckRedis(): Promise<DependencyCheckResult | null> {
  const replicas = Number.parseInt(process.env.EXPECTED_REPLICAS ?? "", 10);
  const isScaled = Number.isFinite(replicas) && replicas > 1;
  if (!process.env.REDIS_URL) {
    if (isScaled && process.env.NODE_ENV === "production") {
      return { status: "error", latencyMs: 0, error: "redis_required_in_scaled_env" };
    }
    return null;
  }
  const started = Date.now();
  try {
    const { getSharedRedisClient } = await import("../lib/redisClient.js");
    const clientPromise = getSharedRedisClient();
    if (!clientPromise) {
      if (isScaled && process.env.NODE_ENV === "production") {
        return { status: "error", latencyMs: 0, error: "redis_client_uninitialized_in_scaled_env" };
      }
      return null;
    }
    const client = await clientPromise;
    await Promise.race([
      client.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("redis_ping_timeout")), 2_000)),
    ]);
    return { status: "ok", latencyMs: Date.now() - started };
  } catch (err) {
    logger.error({ err }, "Redis readiness check failed");
    return { status: "error", latencyMs: Date.now() - started, error: "redis_unavailable" };
  }
}

function getVersion(version: string | undefined): string {
  return (
    version ??
    process.env.APP_VERSION ??
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
    process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ??
    process.env.npm_package_version ??
    "unknown"
  );
}

async function createStatusResponse(options: Required<HealthRouterOptions>): Promise<StatusResponse> {
  const database = sanitizeDependencyCheck(await options.checkDatabase(), "database_unavailable");
  const redisRaw = await options.checkRedis();
  const redis = redisRaw ? sanitizeDependencyCheck(redisRaw, "redis_unavailable") : null;
  const healthy = database.status === "ok" && (redis === null || redis.status === "ok");
  const mem = process.memoryUsage();
  return {
    status: healthy ? "ok" : "degraded",
    service: "api",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    version: getVersion(options.version),
    memoryMb: {
      rss: Math.round(mem.rss / (1024 * 1024)),
      heapUsed: Math.round(mem.heapUsed / (1024 * 1024)),
      heapTotal: Math.round(mem.heapTotal / (1024 * 1024)),
    },
    circuitBreakers: getAllCircuitBreakersStats(),
    watchdog: systemWatchdog.getTelemetry(),
    checks: {
      server: { status: "ok" },
      database,
      ...(redis ? { redis } : {}),
    },
  };
}

export function createHealthRouter(options: HealthRouterOptions = {}): IRouter {
  const router: IRouter = Router();
  const resolvedOptions: Required<HealthRouterOptions> = {
    checkDatabase: options.checkDatabase ?? defaultCheckDatabase,
    checkRedis: options.checkRedis ?? defaultCheckRedis,
    version: getVersion(options.version),
  };

  router.get("/healthz", (_req, res) => {
    const data = HealthCheckResponse.passthrough().parse({
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      version: resolvedOptions.version,
    });
    res.json(data);
  });

  async function readiness(_req: unknown, res: { status(code: number): typeof res; json(body: StatusResponse): void }) {
    const data = await createStatusResponse(resolvedOptions);
    res.status(data.status === "ok" ? 200 : 503).json(data);
  }

  router.get("/readyz", readiness);
  router.get("/status", readiness);

  return router;
}

export default createHealthRouter();
