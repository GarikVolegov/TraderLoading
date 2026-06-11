import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import logger from "../lib/logger";

type CheckStatus = "ok" | "error";

export interface DependencyCheckResult {
  status: CheckStatus;
  latencyMs: number;
  error?: string;
}

export interface HealthRouterOptions {
  checkDatabase?: () => Promise<DependencyCheckResult>;
  version?: string;
}

interface StatusResponse {
  status: "ok" | "degraded";
  service: "api";
  timestamp: string;
  uptimeSeconds: number;
  version: string;
  checks: {
    server: { status: "ok" };
    database: DependencyCheckResult;
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

function sanitizeDependencyCheck(result: DependencyCheckResult): DependencyCheckResult {
  if (result.status === "ok") return result;
  return {
    status: "error",
    latencyMs: result.latencyMs,
    error: "database_unavailable",
  };
}

function getVersion(version: string | undefined): string {
  return version ?? process.env.APP_VERSION ?? process.env.npm_package_version ?? "unknown";
}

async function createStatusResponse(options: Required<HealthRouterOptions>): Promise<StatusResponse> {
  const database = sanitizeDependencyCheck(await options.checkDatabase());
  return {
    status: database.status === "ok" ? "ok" : "degraded",
    service: "api",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    version: getVersion(options.version),
    checks: {
      server: { status: "ok" },
      database,
    },
  };
}

export function createHealthRouter(options: HealthRouterOptions = {}): IRouter {
  const router: IRouter = Router();
  const resolvedOptions: Required<HealthRouterOptions> = {
    checkDatabase: options.checkDatabase ?? defaultCheckDatabase,
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
